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

    const DIFFBOT_API_TOKEN = Deno.env.get('DIFFBOT_API_TOKEN');
    if (!DIFFBOT_API_TOKEN) {
      console.error('DIFFBOT_API_TOKEN is not configured');
      throw new Error('DIFFBOT_API_TOKEN is not configured. Please set up the DIFFBOT_API_TOKEN in your Supabase Edge Function secrets.');
    }

    console.log(`Starting analysis of ${urls.length} articles for keyword: ${keyword}`);

    // Process articles sequentially to avoid rate limits
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
          console.log(`Successfully analyzed article: ${url}`);
        } else {
          console.error(`Failed to analyze content from ${url}`);
        }
      } catch (error) {
        console.error(`Error processing article ${url}:`, error);
      }
    }

    console.log(`Successfully analyzed ${analysisResults.length} out of ${urls.length} articles`);

    if (analysisResults.length === 0) {
      throw new Error('No articles could be successfully analyzed. This might be due to invalid URLs or API rate limits. Please try again with different URLs.');
    }

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