
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from './utils/cors.ts';
import { extractDomain, extractLinksFromHTML } from './utils/urlUtils.ts';
import { fetchWithDiffbot, type DiffbotArticle } from './services/diffbotService.ts';
import { fetchMetaDescriptionWithSerpApi } from './services/serpApiService.ts';
import { extractKeyPhrasesWithAI } from './services/openAiService.ts';
import { analyzeRedditPost } from './services/redditService.ts';
import { supabase } from './supabaseClient.ts';
import { extractVideoId, getVideoMetadata, getTranscript } from './services/youtubeService.ts';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const dumplingApiKey = Deno.env.get('DUMPLING_API_KEY');

if (!openAIApiKey) {
  console.error('Missing OpenAI API key');
  throw new Error('OPENAI_API_KEY not set');
}

if (!dumplingApiKey) {
  console.error('Missing DumplingAI API key');
  throw new Error('DUMPLING_API_KEY not set');
}

const getContentType = (url: string): 'article' | 'reddit' | 'youtube' => {
  if (url.includes('reddit.com')) return 'reddit';
  if (url.includes('youtu.be') || url.includes('youtube.com')) return 'youtube';
  return 'article';
};

async function analyzeYouTubeVideo(url: string, keyword: string) {
  console.log(`[Analysis] Starting YouTube analysis for ${url}`);
  
  try {
    const videoId = extractVideoId(url);
    console.log(`[Analysis] Extracted video ID: ${videoId}`);

    // Get video metadata and transcript concurrently
    const [metadata, transcript] = await Promise.all([
      getVideoMetadata(videoId),
      getTranscript(videoId)
    ]);

    if (!transcript) {
      throw new Error('No transcript or content available for this video');
    }

    // Process the text content
    const textContent = transcript;
    const wordCount = textContent.split(/\s+/).length;
    
    // Extract keywords from available content
    const keywords = await extractKeyPhrasesWithAI(textContent, keyword);
    const domain = extractDomain(url);

    return {
      title: metadata.title || url,
      url: url,
      domain: domain,
      wordCount,
      characterCount: textContent.length,
      headingsCount: 0,
      paragraphsCount: 1,
      imagesCount: 0,
      videosCount: 1,
      externalLinksCount: 0,
      metaTitle: metadata.title || '',
      metaDescription: metadata.description || '',
      keywords,
      contentType: 'youtube' as const,
      transcript: textContent,
      channelTitle: metadata.channelTitle,
      publishedAt: metadata.publishedAt
    };
  } catch (error) {
    console.error(`[Analysis] Error analyzing YouTube video ${url}:`, error);
    throw error;
  }
}

async function analyzeRedditContent(url: string, keyword: string) {
  console.log(`[Analysis] Starting Reddit analysis for ${url}`);
  
  try {
    const redditData = await analyzeRedditPost(url);
    const textContent = redditData.content;
    const wordCount = textContent.split(/\s+/).length;
    
    const keywords = await extractKeyPhrasesWithAI(textContent, keyword);
    const domain = extractDomain(url);

    return {
      title: redditData.title,
      url: url,
      domain: domain,
      wordCount,
      characterCount: textContent.length,
      headingsCount: 0,
      paragraphsCount: 1,
      keywords,
      contentType: 'reddit' as const,
      redditContent: redditData,
    };
  } catch (error) {
    console.error(`[Analysis] Error analyzing Reddit post ${url}:`, error);
    throw error;
  }
}

async function analyzeArticle(url: string, keyword: string) {
  console.log(`[Analysis] Starting analysis for ${url}`);
  
  try {
    // Run Diffbot and SerpAPI calls concurrently
    const [article, metaDescription] = await Promise.all([
      fetchWithDiffbot(url),
      fetchMetaDescriptionWithSerpApi(url).catch(error => {
        console.error(`[SerpAPI] Error for ${url}:`, error);
        return null; // Continue with null meta description if SerpAPI fails
      })
    ]);
    
    if (!article.text) {
      console.error(`[Analysis] No content extracted from ${url}`);
      throw new Error(`No content extracted from ${url}`);
    }

    const textContent = article.text;
    const wordCount = textContent.split(/\s+/).length;
    
    // Extract keywords concurrently with other processing
    const keywordsPromise = extractKeyPhrasesWithAI(textContent, keyword).catch(error => {
      console.error(`[OpenAI] Error for ${url}:`, error);
      return []; // Continue with empty keywords if OpenAI fails
    });

    const articleDomain = extractDomain(url);
    console.log('[Analysis] Article domain:', articleDomain);

    const links = [];
    
    if (article.links && Array.isArray(article.links)) {
      console.log(`[Analysis] Found ${article.links.length} links in Diffbot response for ${url}`);
      links.push(...article.links);
    }
    
    if (article.html) {
      const htmlLinks = extractLinksFromHTML(article.html);
      console.log(`[Analysis] Found ${htmlLinks.length} links in HTML content for ${url}`);
      links.push(...htmlLinks);
    }
    
    if (article.resolved_urls && Array.isArray(article.resolved_urls)) {
      console.log(`[Analysis] Found ${article.resolved_urls.length} resolved URLs for ${url}`);
      article.resolved_urls.forEach(resolvedUrl => {
        if (!links.some(l => l.href === resolvedUrl)) {
          links.push({
            href: resolvedUrl,
            text: resolvedUrl
          });
        }
      });
    }

    console.log(`[Analysis] Total links found before filtering for ${url}:`, links.length);

    const externalLinks = links
      .filter(link => {
        if (!link.href) return false;
        try {
          const linkDomain = extractDomain(link.href);
          return linkDomain && 
                 linkDomain !== articleDomain && 
                 link.href.startsWith('http');
        } catch (error) {
          console.error(`[Analysis] Error processing link for ${url}:`, link, error);
          return false;
        }
      })
      .map(link => {
        const domain = extractDomain(link.href);
        return {
          url: link.href,
          text: link.text || link.title || domain,
          domain: domain
        };
      })
      .filter((link, index, self) => 
        index === self.findIndex((l) => l.url === link.url)
      );

    console.log(`[Analysis] Final external links count for ${url}:`, externalLinks.length);

    const headings = [];
    if (article.html) {
      const headingMatches = article.html.match(/<h[1-6][^>]*>.*?<\/h[1-6]>/gi) || [];
      headingMatches.forEach(match => {
        const level = match.match(/<h([1-6])/i)?.[1] || '1';
        const text = match.replace(/<[^>]+>/g, '').trim();
        if (text) {
          headings.push({
            level: `h${level}`,
            text: text
          });
        }
      });
    }

    // Wait for keywords extraction to complete
    const keywords = await keywordsPromise;

    return {
      title: article.title || '',
      url: url,
      domain: articleDomain,
      wordCount,
      characterCount: textContent.length,
      headingsCount: headings.length,
      paragraphsCount: article.numPages || 1,
      imagesCount: (article.images || []).length,
      videosCount: (article.videos || []).length,
      externalLinks,
      externalLinksCount: externalLinks.length,
      metaTitle: article.title || '',
      metaDescription: metaDescription || article.meta?.description || '',
      keywords,
      readabilityScore: 0,
      headingStructure: headings,
    };
  } catch (error) {
    console.error(`[Analysis] Error analyzing article ${url}:`, error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[Handler] Received request to analyze-articles function');
    
    const requestBody = await req.json();
    const { urls, keyword } = requestBody;
    
    console.log('[Handler] Request data:', { urls, keyword });
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      throw new Error('No URLs provided for analysis');
    }

    if (!keyword || typeof keyword !== 'string') {
      throw new Error('No keyword provided for analysis');
    }

    console.log('[Handler] Starting parallel analysis for URLs:', urls);
    
    // Analyze each URL based on its content type
    const analysisResults = await Promise.allSettled(
      urls.map(async (url) => {
        const contentType = getContentType(url);
        switch (contentType) {
          case 'youtube':
            return await analyzeYouTubeVideo(url, keyword);
          case 'reddit':
            return await analyzeRedditContent(url, keyword);
          default:
            return await analyzeArticle(url, keyword);
        }
      })
    );

    // Log comprehensive summary of results
    const successfulResults = [];
    const failedUrls = [];

    analysisResults.forEach((result, index) => {
      const url = urls[index];
      if (result.status === 'fulfilled') {
        successfulResults.push(result.value);
        console.log(`[Handler] Successfully analyzed: ${url}`);
      } else {
        failedUrls.push({
          url,
          error: result.reason.message || 'Unknown error'
        });
        console.error(`[Handler] Failed to analyze ${url}:`, result.reason);
      }
    });

    console.log('[Handler] Analysis summary:', {
      total: urls.length,
      successful: successfulResults.length,
      failed: failedUrls.length,
      failedUrls: failedUrls
    });

    if (successfulResults.length === 0) {
      throw new Error('No content could be successfully analyzed');
    }

    const idealStructure = await generateIdealStructure(successfulResults, keyword);

    // Store analysis results in Supabase
    const { data: storedAnalyses, error: dbError } = await supabase
      .from('content_analyses')
      .upsert(
        successfulResults.map(result => ({
          url: result.url,
          content_type: getContentType(result.url),
          title: result.title,
          analysis: result,
          updated_at: new Date().toISOString()
        }))
      );

    if (dbError) {
      console.error('[Handler] Error storing analyses:', dbError);
    }

    return new Response(
      JSON.stringify({
        analyses: successfulResults,
        idealStructure,
        summary: {
          totalUrls: urls.length,
          successfulAnalyses: successfulResults.length,
          failedAnalyses: failedUrls.length,
          failedUrls: failedUrls
        }
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[Handler] Error in analyze-articles function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.stack || undefined
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
