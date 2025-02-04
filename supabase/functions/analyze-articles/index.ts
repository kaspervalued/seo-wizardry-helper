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

// Helper function to fetch and analyze a single article
async function analyzeArticle(url: string) {
  try {
    console.log(`Fetching content for ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const html = await response.text();
    console.log(`Successfully fetched HTML for ${url}, length: ${html.length}`);
    
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const reader = new Readability(document, {
      charThreshold: 100,
      classesToPreserve: ['article', 'post', 'content', 'entry'],
    });
    let article = reader.parse();
    
    if (!article || !isValidArticle(article)) {
      console.log(`Readability failed for ${url}, trying fallback methods...`);
      
      const selectors = [
        'article',
        '[role="article"]',
        '.post-content',
        '.article-content',
        '.entry-content',
        '#main-content',
        '.main-content',
        'main'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          const tempDoc = new JSDOM().window.document;
          const tempDiv = tempDoc.createElement('div');
          tempDiv.innerHTML = element.innerHTML;
          
          const tempReader = new Readability(tempDoc);
          article = tempReader.parse();
          
          if (article && isValidArticle(article)) {
            console.log(`Successfully extracted article from ${url} using selector: ${selector}`);
            break;
          }
        }
      }
    }
    
    if (!article || !isValidArticle(article)) {
      console.error(`Failed to extract valid article content from ${url} after all attempts`);
      return null;
    }

    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = article.content;

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

    const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || 
                          document.querySelector('meta[property="og:description"]')?.getAttribute('content') || 
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
