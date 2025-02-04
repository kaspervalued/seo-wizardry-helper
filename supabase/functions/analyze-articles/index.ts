import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Readability } from "npm:@mozilla/readability";
import { JSDOM } from "npm:jsdom";

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { urls } = await req.json();
    console.log('Analyzing URLs:', urls);
    
    // Process articles one at a time
    const results = [];
    const failedUrls = [];
    
    for (const url of urls) {
      const result = await analyzeArticle(url);
      if (result) {
        results.push(result);
      } else {
        failedUrls.push(url);
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

    // Generate suggested titles and descriptions based on analyzed content
    const commonKeywords = Array.from(
      new Set(results.flatMap(a => a.keywords))
    ).slice(0, 5);

    const suggestedTitles = [
      `Master ${commonKeywords[0]}: A Complete Guide to ${commonKeywords[1]}`,
      `Transform Your ${commonKeywords[0]} with Expert ${commonKeywords[1]} Tips`,
      `Discover Essential ${commonKeywords[0]} Strategies for ${commonKeywords[1]}`,
    ];

    const suggestedDescriptions = [
      `Learn everything you need to know about ${commonKeywords[0]}. This comprehensive guide covers ${commonKeywords[1]} and provides expert tips for success.`,
      `Looking to improve your ${commonKeywords[0]}? Explore our expert guide on ${commonKeywords[1]} with practical strategies and proven techniques.`,
      `Master the art of ${commonKeywords[0]} with our in-depth guide. Discover essential ${commonKeywords[1]} techniques and best practices.`,
    ];

    const idealStructure = {
      suggestedTitles,
      suggestedDescriptions,
      recommendedKeywords: commonKeywords,
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
        failedUrls,
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
        details: error.stack,
        failedUrls: []
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