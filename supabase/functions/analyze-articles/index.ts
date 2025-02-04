import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { extract } from "https://deno.land/x/article_extractor@v0.1.2/mod.ts";

interface ArticleRequest {
  urls: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { urls } = await req.json() as ArticleRequest;
    
    const analyses = await Promise.all(
      urls.map(async (url) => {
        try {
          const article = await extract(url);
          
          if (!article) {
            throw new Error(`Failed to extract article from ${url}`);
          }

          // Count headings in content
          const headingsMatch = article.content?.match(/<h[1-6][^>]*>.*?<\/h[1-6]>/gi) || [];
          const headingsCount = headingsMatch.length;

          // Extract heading structure
          const headingStructure = headingsMatch.map(heading => {
            const level = heading.match(/<h([1-6])/i)?.[1] || "1";
            const text = heading.replace(/<[^>]+>/g, '').trim();
            return { level: `h${level}`, text };
          });

          // Count paragraphs
          const paragraphsCount = (article.content?.match(/<p[^>]*>.*?<\/p>/gi) || []).length;

          // Count images
          const imagesCount = (article.content?.match(/<img[^>]+>/gi) || []).length;

          // Count videos (assuming common video embed patterns)
          const videosCount = (article.content?.match(/<iframe[^>]*>(.*?)<\/iframe>/gi) || []).length;

          // Count external links
          const externalLinksCount = (article.content?.match(/<a[^>]+href=["']http[^>]+>/gi) || []).length;

          // Extract text content without HTML tags for word and character count
          const textContent = article.content?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '';

          // Basic keyword extraction (get most frequent meaningful words)
          const words = textContent.toLowerCase()
            .split(/\W+/)
            .filter(word => word.length > 3)
            .filter(word => !['the', 'and', 'that', 'this', 'with', 'from'].includes(word));
          
          const wordFreq: Record<string, number> = {};
          words.forEach(word => {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
          });

          const keywords = Object.entries(wordFreq)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([word]) => word);

          return {
            title: article.title || "",
            url,
            wordCount: words.length,
            characterCount: textContent.length,
            headingsCount,
            paragraphsCount,
            imagesCount,
            videosCount,
            externalLinksCount,
            metaTitle: article.title || "",
            metaDescription: article.description || "",
            keywords,
            readabilityScore: 75, // This could be improved with actual readability calculation
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