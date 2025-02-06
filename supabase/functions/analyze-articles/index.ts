import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "./utils.ts";
import { analyzeArticle, extractArticleContent } from "./articleAnalysis.ts";
import { generateIdealStructure } from "./outlineGeneration.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urls, keyword } = await req.json();

    if (!Array.isArray(urls) || urls.length === 0) {
      console.error('No URLs provided for analysis');
      throw new Error('No URLs provided for analysis');
    }

    if (!keyword) {
      console.error('No keyword provided for analysis');
      throw new Error('No keyword provided for analysis');
    }

    console.log(`Starting analysis of ${urls.length} articles for keyword: ${keyword}`);

    // Process all articles in parallel
    const analysisPromises = urls.map(async (url: string) => {
      try {
        console.log(`Processing article: ${url}`);
        const content = await extractArticleContent(url);
        const analysis = await analyzeArticle(content);
        console.log(`Successfully processed article: ${url}`);
        return analysis;
      } catch (error) {
        console.error(`Error processing article ${url}:`, error);
        return null;
      }
    });

    const analysisResults = await Promise.all(analysisPromises);
    const validAnalyses = analysisResults.filter(result => result !== null);

    console.log(`Successfully analyzed ${validAnalyses.length} out of ${urls.length} articles`);

    if (validAnalyses.length === 0) {
      throw new Error(`No articles could be successfully analyzed. Please check the provided URLs and try again.`);
    }

    // Generate ideal structure based on analyses
    const idealStructure = await generateIdealStructure(validAnalyses, keyword);

    return new Response(
      JSON.stringify({
        analyses: validAnalyses,
        idealStructure,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in analyze-articles function:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred during analysis',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});