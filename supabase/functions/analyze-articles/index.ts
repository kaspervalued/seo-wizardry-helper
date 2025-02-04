import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { JSDOM } from "npm:jsdom";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const extractDomain = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch (error) {
    console.error(`Error extracting domain from ${url}:`, error);
    return '';
  }
};

async function extractKeyPhrasesWithAI(content: string, keyword: string): Promise<string[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an SEO expert that extracts key phrases from content. Extract 5-7 specific, meaningful key phrases that best represent the main topics and concepts in the text. Focus on technical terms, industry-specific phrases, and important concepts related to "${keyword}". Avoid generic words.`
          },
          {
            role: 'user',
            content: `Extract key phrases from this content:\n\n${content}`
          }
        ],
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content
      .split('\n')
      .map(phrase => phrase.replace(/^[-\d.\s]+/, '').trim())
      .filter(Boolean);
  } catch (error) {
    console.error('Error extracting key phrases with AI:', error);
    return [];
  }
}

async function analyzeArticle(url: string) {
  console.log(`Starting analysis for ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const title = document.title || '';
    const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    
    const mainContent = document.querySelector('main, article, [role="main"], #content, .content');
    const textContent = mainContent?.textContent || document.body.textContent || '';
    
    const wordCount = textContent.split(/\s+/).length;
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const paragraphs = document.querySelectorAll('p');
    const images = document.querySelectorAll('img');
    const videos = document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]');
    const links = Array.from(document.querySelectorAll('a[href^="http"]'))
      .map(link => ({
        url: link.getAttribute('href') || '',
        text: link.textContent?.trim() || '',
        domain: extractDomain(link.getAttribute('href') || '')
      }))
      .filter(link => link.domain !== extractDomain(url));

    const keywords = await extractKeyPhrasesWithAI(textContent, title);

    const headingStructure = Array.from(headings).map(heading => ({
      level: heading.tagName.toLowerCase(),
      text: heading.textContent?.trim() || ''
    }));

    return {
      title,
      url,
      domain: extractDomain(url),
      wordCount,
      characterCount: textContent.length,
      headingsCount: headings.length,
      paragraphsCount: paragraphs.length,
      imagesCount: images.length,
      videosCount: videos.length,
      externalLinks: links,
      externalLinksCount: links.length,
      metaTitle: title,
      metaDescription: metaDesc,
      keywords,
      headingStructure,
    };
  } catch (error) {
    console.error(`Error analyzing article ${url}:`, error);
    return null;
  }
}

async function generateIdealStructure(analyses: any[], keyword: string) {
  try {
    // Calculate target word count
    const validWordCounts = analyses
      .map(a => a.wordCount)
      .filter(count => count > 0);
    
    const targetWordCount = Math.round(
      validWordCounts.reduce((sum, count) => sum + count, 0) / validWordCounts.length
    );

    // Collect all keywords from analyses for context
    const allKeywords = analyses.flatMap(a => a.keywords);
    const keywordContext = allKeywords.join('\n');

    // Generate titles and descriptions with OpenAI
    const titleResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an SEO expert that generates optimized titles and descriptions.
            Requirements for titles:
            - Keep the exact keyword "${keyword}" intact, don't split or modify it
            - Each title should be 50-60 characters
            - If the keyword contains "vs" or "versus", make it a comparison-focused title
            
            Requirements for descriptions:
            - Keep the exact keyword "${keyword}" intact, use it exactly once
            - Each description should be 150-160 characters
            - Match user search intent (if comparison keyword, focus on comparison aspects)
            - Be specific and actionable`
          },
          {
            role: 'user',
            content: `Generate 3 SEO-optimized titles and descriptions for an article about "${keyword}".
            
            Context:
            - Main keyword: ${keyword}
            - Related key phrases: ${keywordContext}
            - Target word count: ${targetWordCount} words
            
            Format the response as JSON with arrays "titles" and "descriptions".`
          }
        ],
        temperature: 0.7,
      }),
    });

    const titleData = await titleResponse.json();
    const { titles: suggestedTitles, descriptions: suggestedDescriptions } = JSON.parse(
      titleData.choices[0].message.content
    );

    // Generate recommended keywords with OpenAI
    const keywordResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an SEO expert that analyzes key phrases and synthesizes them into recommended keywords.
            Focus on specific, meaningful phrases that are most relevant to the main topic.
            If the main keyword contains "vs" or "versus", ensure recommendations include comparison-related terms.
            Avoid generic words and ensure all recommendations are highly specific to the topic.`
          },
          {
            role: 'user',
            content: `Main keyword: "${keyword}"
            
            Here are the key phrases found in competitor articles:
            ${keywordContext}
            
            Analyze these key phrases and provide 5-7 most important recommended keywords that should be included in a new article about "${keyword}". Focus on specific, technical terms and important concepts.`
          }
        ],
        temperature: 0.3,
      }),
    });

    const keywordData = await keywordResponse.json();
    const recommendedKeywords = keywordData.choices[0].message.content
      .split('\n')
      .map(phrase => phrase.replace(/^[-\d.\s]+/, '').trim())
      .filter(Boolean);

    return {
      targetWordCount,
      suggestedTitles,
      suggestedDescriptions,
      recommendedKeywords,
      recommendedExternalLinks: analyses
        .flatMap(a => a.externalLinks)
        .reduce((acc: any[], link) => {
          const existing = acc.find(l => l.url === link.url);
          if (existing) {
            existing.frequency++;
          } else {
            acc.push({ ...link, frequency: 1 });
          }
          return acc;
        }, [])
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5),
    };
  } catch (error) {
    console.error('Error generating ideal structure:', error);
    return {
      targetWordCount: 0,
      suggestedTitles: [],
      suggestedDescriptions: [],
      recommendedKeywords: [],
      recommendedExternalLinks: [],
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urls, keyword } = await req.json();
    console.log('Analyzing URLs:', urls);
    
    const results = [];
    
    // Process one article at a time
    for (const url of urls) {
      const result = await analyzeArticle(url);
      if (result) {
        results.push(result);
      }
      // Add a small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (results.length === 0) {
      throw new Error('Failed to analyze any of the provided articles');
    }

    const idealStructure = await generateIdealStructure(results, keyword);

    return new Response(
      JSON.stringify({
        analyses: results,
        idealStructure,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in analyze-articles function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
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
