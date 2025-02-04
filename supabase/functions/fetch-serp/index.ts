import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { keyword } = await req.json();
    const apiKey = Deno.env.get('SERPAPI_API_KEY');

    if (!apiKey) {
      throw new Error('SERPAPI_API_KEY not found');
    }

    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(keyword)}&location=United States&hl=en&api_key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});