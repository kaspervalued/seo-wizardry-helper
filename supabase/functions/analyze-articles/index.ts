import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const diffbotToken = Deno.env.get('DIFFBOT_API_TOKEN');
const serpApiKey = Deno.env.get('SERPAPI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

if (!openAIApiKey || !diffbotToken || !serpApiKey) {
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

const extractLinksFromHTML = (html: string): { href: string; text: string }[] => {
  const links: { href: string; text: string }[] = [];
  
  // Method 1: Standard anchor tags
  const standardLinkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  let match;
  while ((match = standardLinkRegex.exec(html)) !== null) {
    links.push({
      href: match[1],
      text: match[2].trim()
    });
  }
  
  // Method 2: Links with nested elements
  const nestedLinkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  while ((match = nestedLinkRegex.exec(html)) !== null) {
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (text && !links.some(l => l.href === match[1])) {
      links.push({
        href: match[1],
        text: text
      });
    }
  }
  
  // Method 3: Look for URLs in text content
  const urlRegex = /https?:\/\/[^\s<>"']+/g;
  const textContent = html.replace(/<[^>]+>/g, ' ');
  const urlMatches = textContent.match(urlRegex) || [];
  urlMatches.forEach(url => {
    if (!links.some(l => l.href === url)) {
      links.push({
        href: url,
        text: url
      });
    }
  });
  
  return links;
};

async function fetchMetaDescriptionWithSerpApi(url: string) {
  try {
    console.log('Fetching meta description with SERPAPI for:', url);
    
    const encodedUrl = encodeURIComponent(url);
    const serpApiUrl = `https://serpapi.com/search.json?engine=google&q=site:${encodedUrl}&api_key=${serpApiKey}`;
    
    const response = await fetch(serpApiUrl);
    
    if (!response.ok) {
      throw new Error(`SERPAPI request failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('SERPAPI response:', data);
    
    // Extract meta description from organic results
    const organicResults = data.organic_results || [];
    const result = organicResults.find(r => r.link === url);
    
    if (result?.snippet) {
      console.log('Found meta description:', result.snippet);
      return result.snippet;
    }
    
    console.log('No meta description found for:', url);
    return '';
  } catch (error) {
    console.error('Error fetching meta description:', error);
    return '';
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

async function analyzeArticle(url: string, keyword: string) {
  console.log(`Starting analysis for ${url}`);
  
  try {
    const [article, metaDescription] = await Promise.all([
      fetchWithDiffbot(url),
      fetchMetaDescriptionWithSerpApi(url)
    ]);
    
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
    console.log('Article domain:', articleDomain);

    // Collect links from multiple sources
    const links = [];
    
    // Source 1: Diffbot's links array
    if (article.links && Array.isArray(article.links)) {
      console.log('Found links in Diffbot response:', article.links.length);
      links.push(...article.links);
    }
    
    // Source 2: Parse HTML content
    if (article.html) {
      const htmlLinks = extractLinksFromHTML(article.html);
      console.log('Found links in HTML content:', htmlLinks.length);
      links.push(...htmlLinks);
    }
    
    // Source 3: Check Diffbot's resolved URLs
    if (article.resolved_urls && Array.isArray(article.resolved_urls)) {
      console.log('Found resolved URLs:', article.resolved_urls.length);
      article.resolved_urls.forEach(resolvedUrl => {
        if (!links.some(l => l.href === resolvedUrl)) {
          links.push({
            href: resolvedUrl,
            text: resolvedUrl
          });
        }
      });
    }

    console.log('Total links found before filtering:', links.length);

    // Process and filter external links
    const externalLinks = links
      .filter(link => {
        if (!link.href) return false;
        try {
          const linkDomain = extractDomain(link.href);
          return linkDomain && 
                 linkDomain !== articleDomain && 
                 link.href.startsWith('http');
        } catch (error) {
          console.error('Error processing link:', link, error);
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
      // Remove duplicates based on URL
      .filter((link, index, self) => 
        index === self.findIndex((l) => l.url === link.url)
      );

    console.log('Final external links count:', externalLinks.length);
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
      metaDescription: metaDescription || article.meta?.description || '',
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
    console.log('Starting generateIdealStructure with analyses:', analyses.length);
    
    // Calculate average word count
    const validWordCounts = analyses
      .map(a => a.wordCount)
      .filter(count => count > 0);
    
    const calculatedTargetWordCount = Math.round(
      validWordCounts.reduce((sum, count) => sum + count, 0) / validWordCounts.length
    );

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

    // Aggregate and rank external links from all articles
    const linkFrequencyMap = new Map<string, { 
      url: string; 
      text: string; 
      domain: string; 
      articles: Set<string>;
    }>();
    
    analyses.forEach(analysis => {
      if (!analysis.externalLinks || !Array.isArray(analysis.externalLinks)) {
        console.warn('Invalid externalLinks array in analysis:', analysis);
        return;
      }

      analysis.externalLinks.forEach(link => {
        const existingLink = linkFrequencyMap.get(link.url);
        if (existingLink) {
          existingLink.articles.add(analysis.url);
        } else {
          linkFrequencyMap.set(link.url, {
            url: link.url,
            text: link.text,
            domain: link.domain,
            articles: new Set([analysis.url])
          });
        }
      });
    });

    console.log('Link frequency map:', 
      Array.from(linkFrequencyMap.entries()).map(([url, data]) => ({
        url,
        articleCount: data.articles.size
      }))
    );

    // Sort links by number of articles they appear in
    const rankedLinks = Array.from(linkFrequencyMap.values())
      .sort((a, b) => b.articles.size - a.articles.size)
      .map(link => ({
        url: link.url,
        text: link.text,
        domain: link.domain,
        frequency: link.articles.size
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
        model: 'gpt-4o-mini',
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
        model: 'gpt-4o-mini',
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
