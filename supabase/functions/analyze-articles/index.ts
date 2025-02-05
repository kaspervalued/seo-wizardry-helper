
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { JSDOM } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

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
    // Add delay to prevent rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));

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
            content: `Extract 5-7 specific key phrases from the content related to "${keyword}". Focus on technical terms and industry-specific phrases.`
          },
          {
            role: 'user',
            content: content.substring(0, 4000) // Limit content length
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

async function analyzeArticle(url: string, keyword: string) {
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

    const title = document.querySelector('title')?.textContent || '';
    const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    
    // Limit content extraction to main content areas
    const mainContent = document.querySelector('main, article, [role="main"], #content, .content');
    const textContent = (mainContent?.textContent || document.body.textContent || '').substring(0, 8000); // Limit content length
    
    const wordCount = textContent.split(/\s+/).length;
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    const paragraphs = Array.from(document.querySelectorAll('p'));
    const images = Array.from(document.querySelectorAll('img'));
    const videos = Array.from(document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]'));
    const links = Array.from(document.querySelectorAll('a[href^="http"]'))
      .slice(0, 20) // Limit number of links
      .map(link => ({
        url: link.getAttribute('href') || '',
        text: link.textContent?.trim() || '',
        domain: extractDomain(link.getAttribute('href') || '')
      }))
      .filter(link => link.domain !== extractDomain(url));

    // Add delay before AI processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    const keywords = await extractKeyPhrasesWithAI(textContent, keyword);

    const headingStructure = headings.slice(0, 15).map(heading => ({
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
    const validWordCounts = analyses
      .map(a => a.wordCount)
      .filter(count => count > 0);
    
    const calculatedTargetWordCount = Math.round(
      validWordCounts.reduce((sum, count) => sum + count, 0) / validWordCounts.length
    );

    // Prepare concise context from analyses
    const articlesContext = analyses.map(a => `
      Title: ${a.title}
      Key phrases: ${a.keywords.slice(0, 5).join(', ')}
    `).join('\n');

    // Add delay before AI call
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Generating ideal structure...');
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
            content: `As an SEO expert, analyze these articles and provide recommendations for the keyword "${keyword}".`
          },
          {
            role: 'user',
            content: `Based on these articles:\n${articlesContext}\n
            Provide a JSON response with:
            {
              "title_suggestions": ["3 SEO titles with keyword"],
              "meta_descriptions": ["3 meta descriptions with keyword"],
              "recommended_keywords": ["6-8 key phrases from articles"]
            }`
          }
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    console.log('Received AI response');

    let recommendations;
    try {
      recommendations = JSON.parse(data.choices[0].message.content.trim());
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      recommendations = {
        title_suggestions: [`Complete Guide to ${keyword}`, `${keyword} Tutorial`, `Understanding ${keyword}`],
        meta_descriptions: [`Learn everything about ${keyword} in our comprehensive guide.`],
        recommended_keywords: [keyword, 'guide', 'tutorial', 'tips'],
      };
    }

    // Get common external links (limited)
    const commonLinks = analyses
      .flatMap(a => a.externalLinks.slice(0, 5))
      .reduce((acc: any[], link) => {
        const existing = acc.find(l => l.url === link.url);
        if (existing) {
          existing.frequency++;
        } else if (acc.length < 5) {
          acc.push({ ...link, frequency: 1 });
        }
        return acc;
      }, [])
      .sort((a, b) => b.frequency - a.frequency);

    return {
      targetWordCount: calculatedTargetWordCount || 1500,
      suggestedTitles: recommendations.title_suggestions || [],
      suggestedDescriptions: recommendations.meta_descriptions || [],
      recommendedKeywords: recommendations.recommended_keywords || [],
      recommendedExternalLinks: commonLinks,
    };
  } catch (error) {
    console.error('Error generating ideal structure:', error);
    return {
      targetWordCount: 1500,
      suggestedTitles: [`Complete Guide to ${keyword}`, `${keyword} Tutorial`],
      suggestedDescriptions: [`Learn everything about ${keyword} in our guide.`],
      recommendedKeywords: [keyword, 'guide', 'tutorial'],
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
    console.log('Starting analysis for URLs:', urls);
    
    const results = [];
    
    // Process articles sequentially with delay between each
    for (const url of urls) {
      const result = await analyzeArticle(url, keyword);
      if (result) {
        results.push(result);
      }
      // Add delay between article processing
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (results.length === 0) {
      throw new Error('Failed to analyze any articles');
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
