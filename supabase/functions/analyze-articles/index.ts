import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { analyzeArticle } from "./articleAnalysis.ts";
import { generateIdealStructure } from "./outlineGeneration.ts";
import type { Article, ArticleAnalysis } from "./types.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Received request to analyze-articles function');
    
    const requestBody = await req.json().catch(e => {
      console.error('Failed to parse request body:', e);
      throw new Error('Invalid JSON in request body');
    });
    
    const { urls, keyword } = requestBody;
    
    console.log('Request data:', { urls, keyword });
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      console.error('No URLs provided:', urls);
      throw new Error('No URLs provided for analysis');
    }

    if (!keyword || typeof keyword !== 'string') {
      console.error('Invalid keyword:', keyword);
      throw new Error('No keyword provided for analysis');
    }

    console.log('Starting parallel analysis for URLs:', urls);
    
    // Process articles in parallel with Promise.all
    const analysisPromises = urls.map(url => analyzeArticle(url, keyword));
    const results = (await Promise.all(analysisPromises)).filter(Boolean) as ArticleAnalysis[];

    if (results.length === 0) {
      throw new Error('Failed to analyze any articles');
    }

    const idealStructure = await generateIdealStructure(results, keyword);

    console.log('Analysis completed successfully');

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