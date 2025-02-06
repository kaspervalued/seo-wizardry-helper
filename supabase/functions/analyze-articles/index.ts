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
      throw new Error('No URLs provided for analysis');
    }

    console.log(`Starting analysis of ${urls.length} articles for keyword: ${keyword}`);

    // Process articles sequentially to avoid overwhelming the API
    const analysisResults = [];
    for (const url of urls) {
      try {
        console.log(`Processing article: ${url}`);
        const content = await extractArticleContent(url);
        if (!content) {
          console.error(`Failed to extract content from ${url}`);
          continue;
        }
        const analysis = await analyzeArticle(content);
        if (analysis) {
          analysisResults.push(analysis);
        }
      } catch (error) {
        console.error(`Error processing article ${url}:`, error);
        continue;
      }
    }

    if (analysisResults.length === 0) {
      throw new Error('No articles could be successfully analyzed');
    }

    console.log(`Successfully analyzed ${analysisResults.length} articles`);

    // Generate ideal structure based on analyses
    const idealStructure = await generateIdealStructure(analysisResults, keyword);

    return new Response(
      JSON.stringify({
        analyses: analysisResults,
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