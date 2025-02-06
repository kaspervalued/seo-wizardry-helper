import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { analyzeArticle } from "./articleAnalysis.ts";
import { generateIdealStructure } from "./outlineGeneration.ts";
import { corsHeaders } from "./utils.ts";
import type { Article } from "./types.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Received request to analyze-articles function');
    
    const { urls, keyword } = await req.json();
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      throw new Error('No URLs provided for analysis');
    }

    if (!keyword || typeof keyword !== 'string') {
      throw new Error('No keyword provided for analysis');
    }

    console.log('Starting parallel analysis for URLs:', urls);
    
    // Process articles in parallel
    const analysisPromises = urls.map(url => analyzeArticle({ url, title: '', snippet: '', rank: 0 }));
    const analyses = await Promise.all(analysisPromises);

    if (analyses.length === 0) {
      throw new Error('Failed to analyze any articles');
    }

    const idealStructure = await generateIdealStructure(analyses, keyword);

    console.log('Analysis completed successfully');

    return new Response(
      JSON.stringify({
        analyses,
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