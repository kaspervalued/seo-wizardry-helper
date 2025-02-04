import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Readability } from "npm:@mozilla/readability";
import { JSDOM } from "npm:jsdom";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to extract domain from URL
const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    console.error(`Error extracting domain from ${url}:`, error);
    return '';
  }
};

// Helper function to extract keyphrases
const extractKeyphrases = (text: string): string[] => {
  const stopWords = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for',
    'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his',
    'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my',
    'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if',
    'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like',
    'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your',
    'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look',
    'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two',
    'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because',
    'any', 'these', 'give', 'day', 'most', 'us'
  ]);

  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  const phrases: { [key: string]: number } = {};
  
  words.forEach(word => {
    phrases[word] = (phrases[word] || 0) + 1;
  });

  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    phrases[bigram] = (phrases[bigram] || 0) + 1;
  }

  for (let i = 0; i < words.length - 2; i++) {
    const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    phrases[trigram] = (phrases[trigram] || 0) + 1;
  }

  return Object.entries(phrases)
    .sort(([, a], [, b]) => b - a)
    .filter(([phrase, count]) => count > 1)
    .slice(0, 15)
    .map(([phrase]) => phrase);
};

// Helper function to validate article content
const isValidArticle = (article: any): boolean => {
  if (!article) return false;

  const minWordCount = 300;
  const maxWordCount = 10000;
  const minHeadings = 2;
  const wordCount = article.textContent.split(/\s+/).length;

  return (
    wordCount >= minWordCount &&
    wordCount <= maxWordCount &&
    article.length > 1000 &&
    article.textContent.includes('.')
  );
};

// Add new fallback methods for article extraction
async function extractArticleContent(url: string, html: string) {
  console.log(`Attempting to extract content from ${url}`);
  const dom = new JSDOM(html);
  const document = dom.window.document;
  
  // Method 1: Try Readability
  try {
    const reader = new Readability(document, {
      charThreshold: 100,
      classesToPreserve: ['article', 'post', 'content', 'entry'],
    });
    let article = reader.parse();
    
    if (article && isValidArticle(article)) {
      console.log(`Successfully extracted article from ${url} using Readability`);
      return article;
    }
  } catch (error) {
    console.error(`Readability failed for ${url}:`, error);
  }
  
  console.log(`Readability failed for ${url}, trying fallback methods...`);
  
  // Method 2: Try common article selectors
  const selectors = [
    'article',
    '[role="article"]',
    '.post-content',
    '.article-content',
    '.entry-content',
    '#main-content',
    '.main-content',
    'main',
    '.content',
    '.post',
    '.blog-post',
    '.article-body',
    '.post-body',
    '.entry',
    '.blog-entry',
    '[itemprop="articleBody"]',
    '.story-content',
    '#article-content',
    '.article__content',
    '.article-text',
    '.post__content',
    '.post-text',
    '.story__content',
    '.story-text',
    '.content__main',
    '.main__content',
    '.article__body',
    '.post__body',
    '.story__body'
  ];
  
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        // Create a new document to avoid modifying the original
        const tempDoc = new JSDOM().window.document;
        const tempDiv = tempDoc.createElement('div');
        tempDiv.innerHTML = element.innerHTML;
        
        // Clean up unwanted elements
        const unwantedSelectors = [
          'nav',
          'header',
          'footer',
          '.sidebar',
          '.comments',
          '.related-posts',
          '.advertisement',
          '.social-share',
          '.newsletter',
          '.author-bio',
          '.widget',
          '[role="complementary"]',
          '.popup',
          '.modal',
          '.cookie-notice',
          '.subscription',
          '.promotion',
          '.cta',
          '.call-to-action',
          '.share-buttons',
          '.social-buttons',
          '.recommended-articles',
          '.similar-posts',
          '.trending',
          '.popular-posts',
          '.sidebar-content',
          '.advertisement-content',
          '.ad-container'
        ];
        
        unwantedSelectors.forEach(sel => {
          const elements = tempDiv.querySelectorAll(sel);
          elements.forEach(el => el.remove());
        });
        
        // Try Readability on cleaned content
        const tempReader = new Readability(tempDoc);
        const article = tempReader.parse();
        
        if (article && isValidArticle(article)) {
          console.log(`Successfully extracted article from ${url} using selector: ${selector}`);
          return article;
        }
      }
    } catch (error) {
      console.error(`Error with selector ${selector} for ${url}:`, error);
      continue;
    }
  }
  
  // Method 3: Try to find the largest text block
  try {
    const textBlocks = Array.from(document.getElementsByTagName('*'))
      .filter(el => {
        const text = el.textContent?.trim() || '';
        return text.length > 500 && // Minimum text length
               text.split('.').length > 3 && // At least 3 sentences
               el.querySelectorAll('p, h1, h2, h3, h4, h5, h6').length > 2; // Has paragraphs and headings
      })
      .map(el => ({
        element: el,
        textLength: el.textContent?.length || 0,
        paragraphs: el.querySelectorAll('p').length,
        headings: el.querySelectorAll('h1, h2, h3, h4, h5, h6').length
      }))
      .sort((a, b) => {
        // Score based on text length and structure
        const scoreA = a.textLength + (a.paragraphs * 100) + (a.headings * 200);
        const scoreB = b.textLength + (b.paragraphs * 100) + (b.headings * 200);
        return scoreB - scoreA;
      });
    
    if (textBlocks.length > 0) {
      const largestBlock = textBlocks[0];
      const tempDoc = new JSDOM().window.document;
      const tempDiv = tempDoc.createElement('div');
      tempDiv.innerHTML = largestBlock.element.innerHTML;
      
      const tempReader = new Readability(tempDoc);
      const article = tempReader.parse();
      
      if (article && isValidArticle(article)) {
        console.log(`Successfully extracted article from ${url} using largest text block method`);
        return article;
      }
    }
  } catch (error) {
    console.error(`Error with largest text block method for ${url}:`, error);
  }

  // Method 4: Try to extract content from specific meta tags
  try {
    const articleContent = document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
                          document.querySelector('meta[name="description"]')?.getAttribute('content');
    
    if (articleContent && articleContent.length > 200) {
      const tempDoc = new JSDOM().window.document;
      const tempDiv = tempDoc.createElement('div');
      tempDiv.textContent = articleContent;
      
      return {
        title: document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
               document.querySelector('title')?.textContent || '',
        content: tempDiv.innerHTML,
        textContent: articleContent,
        length: articleContent.length
      };
    }
  } catch (error) {
    console.error(`Error with meta tags method for ${url}:`, error);
  }
  
  console.error(`Failed to extract valid article content from ${url} after all attempts`);
  return null;
}

// Update the analyzeArticle function to use the new extraction method
async function analyzeArticle(url: string) {
  try {
    console.log(`Fetching content for ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const html = await response.text();
    console.log(`Successfully fetched HTML for ${url}, length: ${html.length}`);
    
    const article = await extractArticleContent(url, html);
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

    const paragraphs = contentDiv.querySelectorAll('p');
    const images = contentDiv.querySelectorAll('img');
    const videos = contentDiv.querySelectorAll(
      'iframe[src*="youtube"], iframe[src*="youtu.be"], ' +
      'iframe[src*="vimeo"], video, ' +
      'div[class*="video"], div[id*="video"]'
    );
    
    const links = Array.from(contentDiv.querySelectorAll('a[href^="http"]'))
      .map(link => ({
        url: link.getAttribute('href') || '',
        text: link.textContent?.trim() || '',
        domain: extractDomain(link.getAttribute('href') || '')
      }))
      .filter(link => link.domain !== extractDomain(url));

    const textContent = article.textContent || '';
    const keyphrases = extractKeyphrases(textContent);

    const metaDescription = dom.window.document.querySelector('meta[name="description"]')?.getAttribute('content') || 
                           dom.window.document.querySelector('meta[property="og:description"]')?.getAttribute('content') || 
                           '';

    console.log(`Analysis complete for ${url}`);

    return {
      title: article.title || "",
      url,
      domain: extractDomain(url),
      wordCount: textContent.split(/\s+/).length,
      characterCount: textContent.length,
      headingsCount: headings.length,
      paragraphsCount: paragraphs.length,
      imagesCount: images.length,
      videosCount: videos.length,
      externalLinks: links,
      externalLinksCount: links.length,
      metaTitle: article.title || "",
      metaDescription,
      keywords: keyphrases,
      readabilityScore: Math.round(article.length / textContent.split(/\s+/).length * 10),
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
    
    const batchSize = 3;
    const results = [];
    const failedUrls = [];
    
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async url => {
          const result = await analyzeArticle(url);
          if (!result) {
            failedUrls.push(url);
            return null;
          }
          return result;
        })
      );
      
      results.push(...batchResults.filter(result => result !== null));
      
      if (i + batchSize < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (results.length === 0) {
      throw new Error('Failed to analyze any of the provided articles');
    }

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
      recommendedKeywords: Array.from(
        new Set(results.flatMap(a => a.keywords))
      ).slice(0, 10),
      recommendedExternalLinks: Object.entries(linkFrequency)
        .filter(([, data]) => data.count > 1)
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