import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Readability } from "npm:@mozilla/readability";
import { JSDOM } from "npm:jsdom";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { urls } = await req.json();
    console.log('Analyzing URLs:', urls);
    
    const analyses = await Promise.all(
      urls.map(async (url) => {
        try {
          // Fetch the HTML content
          const response = await fetch(url);
          const html = await response.text();
          
          // Parse the HTML using JSDOM
          const dom = new JSDOM(html);
          const document = dom.window.document;
          
          // Use Readability to parse the main content
          const reader = new Readability(document);
          const article = reader.parse();
          
          if (!article) {
            throw new Error(`Failed to extract article from ${url}`);
          }

          // Create a temporary div to parse HTML content
          const contentDiv = document.createElement('div');
          contentDiv.innerHTML = article.content;

          // Count headings
          const headings = contentDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');
          const headingStructure = Array.from(headings).map(heading => ({
            level: heading.tagName.toLowerCase(),
            text: heading.textContent || ''
          }));

          // Count paragraphs
          const paragraphs = contentDiv.querySelectorAll('p');
          
          // Count images
          const images = contentDiv.querySelectorAll('img');
          
          // Count videos (common video embed patterns)
          const videos = contentDiv.querySelectorAll('iframe[src*="youtube"], iframe[src*="vimeo"], video');
          
          // Count external links
          const links = contentDiv.querySelectorAll('a[href^="http"]');

          // Extract text content for word counting
          const textContent = article.textContent || '';
          const words = textContent.toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 3)
            .filter(word => !['the', 'and', 'that', 'this', 'with', 'from', 'have', 'will'].includes(word));

          // Calculate keyword frequency
          const wordFreq: Record<string, number> = {};
          words.forEach(word => {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
          });

          // Get top keywords
          const keywords = Object.entries(wordFreq)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([word]) => word);

          // Get meta description
          const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || 
                                document.querySelector('meta[property="og:description"]')?.getAttribute('content') || 
                                '';

          return {
            title: article.title || "",
            url,
            wordCount: words.length,
            characterCount: textContent.length,
            headingsCount: headings.length,
            paragraphsCount: paragraphs.length,
            imagesCount: images.length,
            videosCount: videos.length,
            externalLinksCount: links.length,
            metaTitle: article.title || "",
            metaDescription,
            keywords,
            readabilityScore: Math.round(article.length / words.length * 10), // Simple readability score
            headingStructure,
          };
        } catch (error) {
          console.error(`Error analyzing article ${url}:`, error);
          return null;
        }
      })
    );

    // Filter out failed analyses
    const validAnalyses = analyses.filter(analysis => analysis !== null);

    // Generate ideal structure based on the analyses
    const idealStructure = {
      targetWordCount: Math.round(
        validAnalyses.reduce((sum, a) => sum + (a?.wordCount || 0), 0) / validAnalyses.length
      ),
      targetParagraphCount: Math.round(
        validAnalyses.reduce((sum, a) => sum + (a?.paragraphsCount || 0), 0) / validAnalyses.length
      ),
      targetImageCount: Math.round(
        validAnalyses.reduce((sum, a) => sum + (a?.imagesCount || 0), 0) / validAnalyses.length
      ),
      recommendedHeadingsCount: Math.round(
        validAnalyses.reduce((sum, a) => sum + (a?.headingsCount || 0), 0) / validAnalyses.length
      ),
      recommendedKeywords: Array.from(
        new Set(validAnalyses.flatMap(a => a?.keywords || []))
      ).slice(0, 10),
      suggestedHeadingStructure: validAnalyses[0]?.headingStructure || [],
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
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
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