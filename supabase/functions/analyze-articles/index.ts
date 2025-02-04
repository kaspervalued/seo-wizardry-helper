import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Readability } from "npm:@mozilla/readability";
import { JSDOM } from "npm:jsdom";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const extractDomain = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch (error) {
    console.error(`Error extracting domain from ${url}:`, error);
    return '';
  }
};

const extractKeyphrases = (text: string): string[] => {
  const stopWords = new Set(['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have']);
  
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  const phrases: { [key: string]: number } = {};
  words.forEach(word => phrases[word] = (phrases[word] || 0) + 1);

  return Object.entries(phrases)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([phrase]) => phrase);
};

const isValidArticle = (article: any): boolean => {
  if (!article) return false;
  const wordCount = article.textContent.split(/\s+/).length;
  return wordCount >= 300 && wordCount <= 10000 && article.length > 1000;
};

async function extractArticleContent(url: string) {
  console.log(`Attempting to extract content from ${url}`);
  
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
    
    // Method 1: Try Readability
    const reader = new Readability(document);
    let article = reader.parse();
    
    if (article && isValidArticle(article)) {
      return article;
    }

    // Method 2: Try meta description + main content
    const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content');
    const mainContent = document.querySelector('main, article, [role="main"]');
    
    if (mainContent) {
      const tempDoc = new JSDOM().window.document;
      const tempDiv = tempDoc.createElement('div');
      tempDiv.innerHTML = mainContent.innerHTML;
      
      // Clean up unwanted elements
      ['nav', 'header', 'footer', '.sidebar', '.comments'].forEach(sel => {
        tempDiv.querySelectorAll(sel).forEach(el => el.remove());
      });
      
      if (tempDiv.textContent.length > 1000) {
        return {
          title: document.title,
          content: tempDiv.innerHTML,
          textContent: tempDiv.textContent,
          excerpt: metaDesc || tempDiv.textContent.slice(0, 200),
          length: tempDiv.textContent.length
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error extracting content from ${url}:`, error);
    return null;
  }
}

async function analyzeArticle(url: string) {
  try {
    const article = await extractArticleContent(url);
    
    if (!article) {
      console.error(`Failed to extract article content from ${url}`);
      return null;
    }

    const dom = new JSDOM(article.content);
    const contentDiv = dom.window.document;

    const headings = Array.from(contentDiv.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    const headingStructure = headings.map(heading => ({
      level: heading.tagName.toLowerCase(),
      text: heading.textContent?.trim() || ''
    }));

    const links = Array.from(contentDiv.querySelectorAll('a[href^="http"]'))
      .map(link => ({
        url: link.getAttribute('href') || '',
        text: link.textContent?.trim() || '',
        domain: extractDomain(link.getAttribute('href') || '')
      }))
      .filter(link => link.domain !== extractDomain(url));

    const textContent = article.textContent || '';
    const keyphrases = extractKeyphrases(textContent);

    return {
      title: article.title || "",
      url,
      domain: extractDomain(url),
      wordCount: textContent.split(/\s+/).length,
      characterCount: textContent.length,
      headingsCount: headings.length,
      paragraphsCount: contentDiv.querySelectorAll('p').length,
      imagesCount: contentDiv.querySelectorAll('img').length,
      videosCount: contentDiv.querySelectorAll('iframe[src*="youtube"], iframe[src*="vimeo"], video').length,
      externalLinks: links,
      externalLinksCount: links.length,
      metaTitle: article.title || "",
      metaDescription: article.excerpt || "",
      keywords: keyphrases,
      headingStructure,
    };
  } catch (error) {
    console.error(`Error analyzing article ${url}:`, error);
    return null;
  }
}

async function generateSuggestedContent(keyword: string, analyses: any[]) {
  try {
    // Prepare context from analyses
    const topics = analyses.map(a => a.title).join('\n');
    const keyPhrases = Array.from(
      new Set(analyses.flatMap(a => a.keywords))
    ).slice(0, 5).join(', ');

    const prompt = `As an SEO expert, generate 3 titles and 3 meta descriptions for an article about "${keyword}".

Context:
- Main keyword: ${keyword}
- Related topics from competitor articles:
${topics}
- Key phrases found: ${keyPhrases}

Requirements for titles:
- Keep the exact keyword "${keyword}" intact, don't split or modify it
- Each title should be 50-60 characters
- Start with action verbs
- If the keyword contains "vs" or "versus", make it a comparison-focused title

Requirements for descriptions:
- Keep the exact keyword "${keyword}" intact, use it exactly once
- Each description should be 110-160 characters
- Match user search intent (if comparison keyword, focus on comparison aspects)
- Be specific and actionable
- Include a clear value proposition

Format the response as JSON with arrays "titles" and "descriptions".`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an SEO expert that generates optimized titles and descriptions.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = JSON.parse(data.choices[0].message.content);

    return {
      suggestedTitles: content.titles,
      suggestedDescriptions: content.descriptions,
      recommendedKeywords: Array.from(
        new Set(analyses.flatMap(a => a.keywords))
      ).slice(0, 5),
    };
  } catch (error) {
    console.error('Error generating content with OpenAI:', error);
    // Fallback to basic suggestions if AI fails
    return {
      suggestedTitles: [
        `Compare ${keyword}: A Complete Analysis and Guide`,
        `${keyword}: Which One Should You Choose?`,
        `Understanding ${keyword}: Key Differences Explained`,
      ],
      suggestedDescriptions: [
        `Explore the key differences between ${keyword}. Our comprehensive comparison helps you understand which solution best fits your needs.`,
        `Looking to understand ${keyword}? Our detailed analysis breaks down the pros and cons to help you make an informed decision.`,
        `Discover the essential differences between ${keyword}. Learn which option is best for your specific use case with our expert comparison.`,
      ],
      recommendedKeywords: Array.from(
        new Set(analyses.flatMap(a => a.keywords))
      ).slice(0, 5),
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

    // Calculate link frequency
    const linkFrequency: { [key: string]: { count: number; text: string; domain: string } } = {};
    results.forEach(analysis => {
      analysis.externalLinks.forEach(link => {
        if (!linkFrequency[link.url]) {
          linkFrequency[link.url] = { count: 0, text: link.text, domain: link.domain };
        }
        linkFrequency[link.url].count++;
      });
    });

    const idealStructure = {
      ...(await generateSuggestedContent(keyword, results)),
      recommendedExternalLinks: Object.entries(linkFrequency)
        .map(([url, data]) => ({
          url,
          text: data.text,
          domain: data.domain,
          frequency: data.count
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5)
    };

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
