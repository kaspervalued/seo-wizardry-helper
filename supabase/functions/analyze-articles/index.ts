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
    // Calculate target word count from analyses
    const validWordCounts = analyses
      .map(a => a.wordCount)
      .filter(count => count > 0);
    
    const calculatedTargetWordCount = Math.round(
      validWordCounts.reduce((sum, count) => sum + count, 0) / validWordCounts.length
    );

    // Prepare context from analyses
    const articlesContext = analyses.map(a => `
      Title: ${a.title}
      Key phrases: ${a.keywords.join(', ')}
      Word count: ${a.wordCount}
      Headings: ${a.headingStructure.map(h => h.text).join(', ')}
    `).join('\n\n');

    console.log('Sending request to OpenAI for ideal structure generation...');

    // Generate ideal content structure with OpenAI
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
            content: `As an SEO content expert, analyze these top-ranking articles for the keyword "${keyword}". Consider:
            - Search intent and user value
            - Key topics covered across articles
            - Content depth and comprehensiveness
            - Optimal content structure for readability
            
            When suggesting titles and descriptions:
            - Keep the exact keyword "${keyword}" intact, don't split or modify it
            - If the keyword contains "vs" or "versus", make it a comparison-focused piece
            - Titles should be 50-60 characters
            - Descriptions should be 150-160 characters`
          },
          {
            role: 'user',
            content: `Analyze these top-ranking articles:\n\n${articlesContext}\n\n
            Provide recommendations in JSON format with:
            {
              "title_suggestions": ["3 SEO-optimized titles that include the focus keyword"],
              "meta_descriptions": ["3 compelling descriptions that include the focus keyword"],
              "recommended_keywords": ["6-8 semantically related keywords found in top articles"]
            }`
          }
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    console.log('OpenAI Response:', data);

    let recommendations;
    try {
      // Try to parse the content as JSON
      recommendations = JSON.parse(data.choices[0].message.content.trim());
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      // Provide default values if parsing fails
      recommendations = {
        title_suggestions: [`Top Guide to ${keyword}`, `Complete ${keyword} Tutorial`, `${keyword}: Ultimate Guide`],
        meta_descriptions: [`Comprehensive guide about ${keyword}. Learn everything you need to know about ${keyword} with our expert insights and practical tips.`],
        recommended_keywords: [`${keyword}`, 'guide', 'tutorial', 'tips', 'best practices'],
      };
    }

    // Get common external links
    const commonLinks = analyses
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
      .slice(0, 5);

    console.log('Generated ideal structure:', {
      targetWordCount: calculatedTargetWordCount,
      suggestedTitles: recommendations.title_suggestions,
      suggestedDescriptions: recommendations.meta_descriptions,
      recommendedKeywords: recommendations.recommended_keywords,
      recommendedExternalLinks: commonLinks,
    });

    return {
      targetWordCount: calculatedTargetWordCount || 1500, // Fallback to 1500 if calculation fails
      suggestedTitles: recommendations.title_suggestions || [],
      suggestedDescriptions: recommendations.meta_descriptions || [],
      recommendedKeywords: recommendations.recommended_keywords || [],
      recommendedExternalLinks: commonLinks,
    };
  } catch (error) {
    console.error('Error generating ideal structure:', error);
    // Provide meaningful fallback values if AI generation fails
    return {
      targetWordCount: 1500, // Default to 1500 words
      suggestedTitles: [`Complete Guide to ${keyword}`, `${keyword} Tutorial`, `Understanding ${keyword}`],
      suggestedDescriptions: [`Learn everything you need to know about ${keyword} in our comprehensive guide. Discover expert tips and best practices for ${keyword}.`],
      recommendedKeywords: [`${keyword}`, 'guide', 'tutorial', 'tips', 'best practices'],
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