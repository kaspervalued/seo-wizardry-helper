import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const diffbotToken = Deno.env.get('DIFFBOT_API_TOKEN');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

if (!openAIApiKey || !diffbotToken) {
  console.error('Missing required API keys');
  throw new Error('Required API keys not set');
}

const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch (error) {
    console.error(`Error extracting domain from ${url}:`, error);
    return '';
  }
};

async function extractKeyPhrasesWithAI(content: string, keyword: string): Promise<string[]> {
  try {
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Making request to OpenAI API...');
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
            content: `Analyze the content and extract 5-7 key phrases that are:
            1. Most frequently mentioned across the text
            2. Highly relevant to the main topic "${keyword}"
            3. Technical or industry-specific terms
            
            Format each key phrase as a simple string without any additional explanation or formatting.
            Return only the key phrases, one per line.`
          },
          {
            role: 'user',
            content: content.substring(0, 4000)
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error response:', errorData);
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log('Successfully received OpenAI API response');
    
    return data.choices[0].message.content
      .split('\n')
      .map(phrase => phrase.trim())
      .filter(Boolean);
  } catch (error) {
    console.error('Error in extractKeyPhrasesWithAI:', error);
    throw error;
  }
}

async function fetchWithDiffbot(url: string, retries = 3): Promise<any> {
  const diffbotUrl = `https://api.diffbot.com/v3/article?token=${diffbotToken}&url=${encodeURIComponent(url)}`;
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempting to fetch article with Diffbot (attempt ${i + 1}/${retries})`);
      const response = await fetch(diffbotUrl);
      
      if (!response.ok) {
        throw new Error(`Diffbot API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.objects?.[0]) {
        throw new Error('No article data returned from Diffbot');
      }
      
      console.log('Diffbot response:', JSON.stringify(data.objects[0], null, 2));
      return data.objects[0];
    } catch (error) {
      console.error(`Diffbot API error (attempt ${i + 1}):`, error);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  
  throw new Error(`Failed to fetch article after ${retries} attempts`);
}

async function analyzeArticle(url: string, keyword: string) {
  console.log(`Starting analysis for ${url}`);
  
  try {
    const article = await fetchWithDiffbot(url);
    
    if (!article.text) {
      console.error(`No content extracted from ${url}`);
      return null;
    }

    const textContent = article.text;
    const wordCount = textContent.split(/\s+/).length;
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    const keywords = await extractKeyPhrasesWithAI(textContent, keyword);

    // Extract and process links
    const articleDomain = extractDomain(url);
    const links = article.links || [];
    console.log('Processing links:', links);

    const externalLinks = links
      .filter(link => {
        if (!link.href) return false;
        const linkDomain = extractDomain(link.href);
        return linkDomain && linkDomain !== articleDomain;
      })
      .map(link => ({
        url: link.href,
        text: link.text || link.title || extractDomain(link.href),
        domain: extractDomain(link.href)
      }));

    console.log('Extracted external links:', externalLinks);

    // Extract and process heading structure
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
      metaDescription: article.meta?.description || '',
      keywords,
      readabilityScore: 0,
      headingStructure: headings,
    };
  } catch (error) {
    console.error(`Error analyzing article ${url}:`, error);
    throw error;
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

    const articlesContext = analyses.map(a => `
      Title: ${a.title}
      Key phrases: ${a.keywords.slice(0, 5).join(', ')}
    `).join('\n');

    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Making request to OpenAI API for ideal structure...');
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

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error response:', errorData);
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log('Successfully received OpenAI API response for ideal structure');

    let recommendations;
    try {
      recommendations = JSON.parse(data.choices[0].message.content.trim());
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      recommendations = {
        title_suggestions: [`Complete Guide to ${keyword}`, `${keyword} Tutorial`, `Understanding ${keyword}`],
        meta_descriptions: [`3 meta descriptions with keyword`],
        recommended_keywords: [keyword, 'guide', 'tutorial', 'tips'],
      };
    }

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
    console.error('Error in generateIdealStructure:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Received request to analyze-articles function');
    
    const requestBody = await req.json().catch(e => {
      console.error('Failed to parse request body:', e);
      throw new Error('Invalid JSON in request body');
    });
    
    const { urls, keyword } = requestBody;
    
    console.log('Request data:', { urls, keyword });
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      console.error('No URLs provided:', urls);
      throw new Error('No URLs provided for analysis');
    }

    if (!keyword || typeof keyword !== 'string') {
      console.error('Invalid keyword:', keyword);
      throw new Error('No keyword provided for analysis');
    }

    console.log('Starting analysis for URLs:', urls);
    
    const results = [];
    
    // Process articles sequentially with delay between each
    for (const url of urls) {
      console.log(`Processing URL: ${url}`);
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

    console.log('Analysis completed successfully');

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
