import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from './utils.ts';
import { fetchArticleContent, analyzeArticle } from './articleAnalysis.ts';
import { generateIdealStructure } from './outlineGeneration.ts';
import type { Article, AnalysisResponse } from './types.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urls, keyword } = await req.json();

    if (!Array.isArray(urls) || urls.length === 0 || !keyword) {
      throw new Error('Invalid request: urls array and keyword are required');
    }

    console.log(`Starting analysis for ${urls.length} articles with keyword: ${keyword}`);

    // Fetch and analyze articles in parallel
    const analysisPromises = urls.map(async (url: string) => {
      try {
        console.log(`Fetching content for ${url}`);
        const content = await fetchArticleContent(url);
        console.log(`Analyzing content for ${url}`);
        return await analyzeArticle(url, content);
      } catch (error) {
        console.error(`Error analyzing article ${url}:`, error);
        throw error;
      }
    });

    const analyses = await Promise.all(analysisPromises);
    console.log('All articles analyzed successfully');

    console.log('Generating ideal structure');
    const idealStructure = await generateIdealStructure(analyses, keyword);
    console.log('Ideal structure generated successfully');

    const response: AnalysisResponse = {
      analyses,
      idealStructure
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in analyze-articles function:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});