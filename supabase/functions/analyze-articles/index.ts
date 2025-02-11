import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from './utils/cors.ts';
import { extractDomain, extractLinksFromHTML } from './utils/urlUtils.ts';
import { fetchWithDiffbot, type DiffbotArticle } from './services/diffbotService.ts';
import { fetchMetaDescriptionWithSerpApi } from './services/serpApiService.ts';
import { extractKeyPhrasesWithAI } from './services/openAiService.ts';
import { getYoutubeTranscript } from './services/dumplingService.ts';
import { analyzeRedditPost } from './services/redditService.ts';
import { supabase } from './supabaseClient.ts';

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
    const transcript = await getYoutubeTranscript(url);
    if (!transcript) {
      throw new Error('No transcript available for this video');
    }

    const textContent = transcript.text;
    const wordCount = textContent.split(/\s+/).length;
    
    const keywords = await extractKeyPhrasesWithAI(textContent, keyword);
    const domain = extractDomain(url);

    return {
      title: transcript.title || url,
      url: url,
      domain: domain,
      wordCount,
      characterCount: textContent.length,
      headingsCount: 0,
      paragraphsCount: transcript.segments?.length || 1,
      keywords,
      contentType: 'youtube' as const,
      transcript: textContent,
      segments: transcript.segments,
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

async function generateIdealStructure(analyses: any[], keyword: string) {
  try {
    console.log('Starting generateIdealStructure with analyses:', analyses.length);
    
    const validWordCounts = analyses
      .map(a => a.wordCount)
      .filter(count => count > 0);
    
    const calculatedTargetWordCount = Math.round(
      validWordCounts.reduce((sum, count) => sum + count, 0) / validWordCounts.length
    );

    const allContent = analyses.map(analysis => ({
      title: analysis.title,
      description: analysis.metaDescription,
      headings: analysis.headingStructure,
      keywords: analysis.keywords
    }));

    const outlinePrompt = `As an expert SEO content strategist, I need you to generate a perfectly structured article outline in valid JSON format. The outline should help create content that will outrank existing articles for "${keyword}".

Context:
- Focus keyword: "${keyword}"
- Target word count: ${calculatedTargetWordCount}
- Number of analyzed articles: ${analyses.length}

Requirements:
1. Return ONLY a valid JSON object with this exact structure:
{
  "headings": [
    {
      "id": "unique-string-id",
      "level": "h2",
      "text": "heading text",
      "children": [
        {
          "id": "child-unique-id",
          "level": "h3",
          "text": "subheading text"
        }
      ]
    }
  ]
}

2. The outline must:
- Use only h2 and h3 headings
- Have unique string IDs for each heading
- Include 4-6 main sections (h2)
- Include 2-4 subsections (h3) under each main section
- Cover all essential aspects of "${keyword}"
- Address both basic and advanced topics
- Include practical examples and implementations

Do not include any explanation or additional text. Return ONLY the JSON object.`;

    console.log('Sending outline generation prompt to OpenAI');

    const outlineResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: 'You are an AI that generates article outlines in valid JSON format. Always verify the JSON structure is valid before responding.' 
          },
          { role: 'user', content: outlinePrompt }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      }),
    });

    if (!outlineResponse.ok) {
      console.error('OpenAI API error:', await outlineResponse.text());
      throw new Error('Failed to generate outline from OpenAI');
    }

    const outlineData = await outlineResponse.json();
    console.log('Raw OpenAI response:', outlineData);

    let parsedOutline;
    try {
      const content = outlineData.choices[0].message.content;
      console.log('Parsing outline content:', content);
      parsedOutline = JSON.parse(content);
      
      // Validate the structure
      if (!parsedOutline.headings || !Array.isArray(parsedOutline.headings)) {
        throw new Error('Invalid outline structure: missing headings array');
      }
    } catch (parseError) {
      console.error('Error parsing outline JSON:', parseError);
      throw new Error('Failed to parse outline JSON from OpenAI response');
    }

    // Aggregate and rank keywords from all articles
    const keywordFrequencyMap = new Map<string, { frequency: number, articles: Set<string> }>();
    analyses.forEach(analysis => {
      if (!analysis.keywords || !Array.isArray(analysis.keywords)) {
        console.warn('Invalid keywords array in analysis:', analysis);
        return;
      }

      analysis.keywords.forEach(keyword => {
        const normalizedKeyword = keyword.toLowerCase().trim();
        const existing = keywordFrequencyMap.get(normalizedKeyword);
        if (existing) {
          existing.frequency += 1;
          existing.articles.add(analysis.url);
        } else {
          keywordFrequencyMap.set(normalizedKeyword, {
            frequency: 1,
            articles: new Set([analysis.url])
          });
        }
      });
    });

    // Aggregate and rank external links from all articles with improved counting
    const linkFrequencyMap = new Map<string, { 
      url: string; 
      text: string; 
      domain: string; 
      articles: Set<string>;
      totalMentions: number; // Add total mentions counter
    }>();
    
    analyses.forEach(analysis => {
      if (!analysis.externalLinks || !Array.isArray(analysis.externalLinks)) {
        console.warn('Invalid externalLinks array in analysis:', analysis);
        return;
      }

      // Count both unique articles and total mentions
      const processedUrls = new Set<string>(); // Track processed URLs per article
      
      analysis.externalLinks.forEach(link => {
        const existingLink = linkFrequencyMap.get(link.url);
        if (existingLink) {
          existingLink.articles.add(analysis.url);
          existingLink.totalMentions++; // Increment total mentions
          
          // Update text if current one is more descriptive
          if (link.text && link.text.length > existingLink.text.length) {
            existingLink.text = link.text;
          }
        } else {
          linkFrequencyMap.set(link.url, {
            url: link.url,
            text: link.text,
            domain: link.domain,
            articles: new Set([analysis.url]),
            totalMentions: 1
          });
        }
      });
    });

    console.log('Link frequency map:', 
      Array.from(linkFrequencyMap.entries()).map(([url, data]) => ({
        url,
        articleCount: data.articles.size,
        totalMentions: data.totalMentions
      }))
    );

    // Sort links by both unique articles and total mentions
    const rankedLinks = Array.from(linkFrequencyMap.values())
      .sort((a, b) => {
        // First sort by number of unique articles
        const articleDiff = b.articles.size - a.articles.size;
        if (articleDiff !== 0) return articleDiff;
        
        // If same number of articles, sort by total mentions
        return b.totalMentions - a.totalMentions;
      })
      .map(link => ({
        url: link.url,
        text: link.text,
        domain: link.domain,
        frequency: link.articles.size,
        totalMentions: link.totalMentions
      }))
      .slice(0, 10);

    console.log('Final ranked links:', rankedLinks);

    // Sort keywords by frequency and article count
    const rankedKeywords = Array.from(keywordFrequencyMap.entries())
      .sort((a, b) => {
        // First sort by number of articles containing the keyword
        const articleCountDiff = b[1].articles.size - a[1].articles.size;
        if (articleCountDiff !== 0) return articleCountDiff;
        
        // If article count is equal, sort by total frequency
        const freqDiff = b[1].frequency - a[1].frequency;
        if (freqDiff !== 0) return freqDiff;
        
        // If frequencies are equal, sort by length (prefer shorter keywords)
        return a[0].length - b[0].length;
      })
      .map(([keyword, data]) => ({
        text: keyword,
        frequency: data.articles.size
      }));

    // Generate SEO-optimized titles using OpenAI
    const titlePrompt = `As an SEO expert, analyze this data and generate 3 SEO-optimized meta titles for an article about "${keyword}".

Context:
- Focus keyword: "${keyword}"
- Analyzed titles from top-ranking articles:
${analyses.map(a => `- ${a.title}`).join('\n')}
- Key topics and phrases found:
${rankedKeywords.slice(0, 10).map(k => `- ${k.text}`).join('\n')}

Requirements:
1. Create 3 unique, compelling titles that will compete with existing top articles
2. Each title must:
   - Include the focus keyword "${keyword}"
   - Be 50-60 characters long
   - Address search intent and user value
   - Reflect the depth and comprehensiveness of the content
   - Be optimized for both SEO and readability
3. Format output as a simple list of 3 titles, one per line

Generate only the titles, no explanations or additional text.`;

    console.log('Sending title generation prompt to OpenAI:', titlePrompt);

    const titleResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-1106-preview',
        messages: [
          { role: 'system', content: 'You are an SEO expert that generates optimized titles.' },
          { role: 'user', content: titlePrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!titleResponse.ok) {
      throw new Error(`OpenAI API error: ${titleResponse.status}`);
    }

    const titleData = await titleResponse.json();
    const suggestedTitles = titleData.choices[0].message.content
      .split('\n')
      .filter(Boolean)
      .slice(0, 3);

    console.log('Generated titles:', suggestedTitles);

    // Generate SEO-optimized descriptions using OpenAI
    const descriptionPrompt = `As an SEO expert, analyze this data and generate 3 SEO-optimized meta descriptions for an article about "${keyword}".

Context:
- Focus keyword: "${keyword}"
- Analyzed descriptions from top-ranking articles:
${analyses.map(a => `- ${a.metaDescription}`).join('\n')}
- Key topics and phrases found:
${rankedKeywords.slice(0, 10).map(k => `- ${k.text}`).join('\n')}

Search Intent Analysis:
${analyses.map(a => `
Title: ${a.title}
Description: ${a.metaDescription}
Key Topics: ${a.keywords.slice(0, 5).join(', ')}
`).join('\n')}

Requirements:
1. Create 3 unique, compelling meta descriptions that will compete with existing top articles
2. Each description must:
   - Include the focus keyword "${keyword}"
   - Be 120-150 characters long
   - Match the search intent identified from top articles
   - Highlight unique value proposition
   - Include a clear call-to-action based on user intent
   - Reflect content depth and comprehensiveness
   - Be optimized for both SEO and readability
3. Format output as a simple list of 3 descriptions, one per line

Generate only the descriptions, no explanations or additional text.`;

    console.log('Sending description generation prompt to OpenAI:', descriptionPrompt);

    const descriptionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-1106-preview',
        messages: [
          { role: 'system', content: 'You are an SEO expert that generates optimized meta descriptions.' },
          { role: 'user', content: descriptionPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!descriptionResponse.ok) {
      throw new Error(`OpenAI API error: ${descriptionResponse.status}`);
    }

    const descriptionData = await descriptionResponse.json();
    const suggestedDescriptions = descriptionData.choices[0].message.content
      .split('\n')
      .filter(Boolean)
      .slice(0, 3);

    console.log('Generated descriptions:', suggestedDescriptions);

    return {
      targetWordCount: calculatedTargetWordCount || 1500,
      suggestedTitles,
      suggestedDescriptions,
      recommendedKeywords: rankedKeywords,
      recommendedExternalLinks: rankedLinks,
      outline: parsedOutline.headings,
    };
  } catch (error) {
    console.error('Error in generateIdealStructure:', error);
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
