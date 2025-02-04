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
  // Common words to filter out
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

  // Split text into words and clean them
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  // Create n-grams (1 to 3 words)
  const phrases: { [key: string]: number } = {};
  
  // Single words
  words.forEach(word => {
    phrases[word] = (phrases[word] || 0) + 1;
  });

  // Bigrams (2 words)
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    phrases[bigram] = (phrases[bigram] || 0) + 1;
  }

  // Trigrams (3 words)
  for (let i = 0; i < words.length - 2; i++) {
    const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    phrases[trigram] = (phrases[trigram] || 0) + 1;
  }

  // Sort phrases by frequency and length
  return Object.entries(phrases)
    .sort(([, a], [, b]) => b - a)
    .filter(([phrase, count]) => count > 1) // Only keep phrases that appear more than once
    .slice(0, 15)
    .map(([phrase]) => phrase);
};

// Helper function to validate article content
const isValidArticle = (article: any): boolean => {
  if (!article) return false;

  const minWordCount = 300; // Minimum words for a valid article
  const maxWordCount = 10000; // Maximum words for a reasonable article
  const minHeadings = 2; // Minimum number of headings for structure
  const wordCount = article.textContent.split(/\s+/).length;

  return (
    wordCount >= minWordCount &&
    wordCount <= maxWordCount &&
    article.length > 1000 && // Reasonable article length in characters
    article.textContent.includes('.') // Contains at least some sentences
  );
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { urls } = await req.json();
    console.log('Analyzing URLs:', urls);
    
    const analyses = await Promise.all(
      urls.map(async (url) => {
        try {
          console.log(`Fetching content for ${url}`);
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
          }
          const html = await response.text();
          
          // Parse the HTML using JSDOM
          const dom = new JSDOM(html);
          const document = dom.window.document;
          
          // Use Readability to parse the main content
          const reader = new Readability(document, {
            charThreshold: 100,
            classesToPreserve: ['article', 'post', 'content', 'entry'],
          });
          const article = reader.parse();
          
          if (!article || !isValidArticle(article)) {
            throw new Error(`Failed to extract valid article content from ${url}`);
          }

          console.log(`Successfully extracted article from ${url}`);

          // Create a temporary div to parse HTML content
          const contentDiv = document.createElement('div');
          contentDiv.innerHTML = article.content;

          // Count headings with their levels
          const headings = Array.from(contentDiv.querySelectorAll('h1, h2, h3, h4, h5, h6'));
          const headingStructure = headings.map(heading => ({
            level: heading.tagName.toLowerCase(),
            text: heading.textContent?.trim() || ''
          }));

          // Count paragraphs
          const paragraphs = contentDiv.querySelectorAll('p');
          
          // Count images
          const images = contentDiv.querySelectorAll('img');
          
          // Count videos (common video embed patterns)
          const videos = contentDiv.querySelectorAll(
            'iframe[src*="youtube"], iframe[src*="youtu.be"], ' +
            'iframe[src*="vimeo"], video, ' +
            'div[class*="video"], div[id*="video"]'
          );
          
          // Extract and analyze external links
          const links = Array.from(contentDiv.querySelectorAll('a[href^="http"]'))
            .map(link => ({
              url: link.getAttribute('href') || '',
              text: link.textContent?.trim() || '',
              domain: extractDomain(link.getAttribute('href') || '')
            }))
            .filter(link => link.domain !== extractDomain(url)); // Filter out internal links

          // Extract text content for word counting and phrase analysis
          const textContent = article.textContent || '';
          const keyphrases = extractKeyphrases(textContent);

          // Get meta description
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
          return {
            title: url,
            url,
            domain: extractDomain(url),
            wordCount: 0,
            characterCount: 0,
            headingsCount: 0,
            paragraphsCount: 0,
            imagesCount: 0,
            videosCount: 0,
            externalLinks: [],
            externalLinksCount: 0,
            metaTitle: "",
            metaDescription: "",
            keywords: [],
            readabilityScore: 0,
            headingStructure: [],
            error: error.message
          };
        }
      })
    );

    // Filter out failed analyses
    const validAnalyses = analyses.filter(analysis => !analysis.error);

    if (validAnalyses.length === 0) {
      throw new Error('Failed to analyze any of the provided articles');
    }

    // Find common external links across articles
    const linkFrequency: { [key: string]: { count: number; text: string; domain: string } } = {};
    validAnalyses.forEach(analysis => {
      analysis.externalLinks.forEach(link => {
        if (!linkFrequency[link.url]) {
          linkFrequency[link.url] = { count: 0, text: link.text, domain: link.domain };
        }
        linkFrequency[link.url].count++;
      });
    });

    // Generate ideal structure based on the analyses
    const idealStructure = {
      targetWordCount: Math.round(
        validAnalyses.reduce((sum, a) => sum + a.wordCount, 0) / validAnalyses.length
      ),
      targetParagraphCount: Math.round(
        validAnalyses.reduce((sum, a) => sum + a.paragraphsCount, 0) / validAnalyses.length
      ),
      targetImageCount: Math.round(
        validAnalyses.reduce((sum, a) => sum + a.imagesCount, 0) / validAnalyses.length
      ),
      recommendedHeadingsCount: Math.round(
        validAnalyses.reduce((sum, a) => sum + a.headingsCount, 0) / validAnalyses.length
      ),
      recommendedKeywords: Array.from(
        new Set(validAnalyses.flatMap(a => a.keywords))
      ).slice(0, 10),
      suggestedHeadingStructure: validAnalyses[0].headingStructure,
      recommendedExternalLinks: Object.entries(linkFrequency)
        .filter(([, data]) => data.count > 1) // Only include links that appear in multiple articles
        .map(([url, data]) => ({
          url,
          text: data.text,
          domain: data.domain,
          frequency: data.count
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5) // Top 5 most common external links
    };

    return new Response(
      JSON.stringify({
        analyses: validAnalyses,
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