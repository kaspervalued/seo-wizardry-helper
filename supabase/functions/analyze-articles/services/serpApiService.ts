
const serpApiKey = Deno.env.get('SERPAPI_API_KEY');

if (!serpApiKey) {
  console.error('Missing SerpAPI key');
  throw new Error('SERPAPI_API_KEY not set');
}

export async function fetchMetaDescriptionWithSerpApi(url: string): Promise<string> {
  try {
    console.log('Fetching meta description with SERPAPI for:', url);
    
    const encodedUrl = encodeURIComponent(url);
    const serpApiUrl = `https://serpapi.com/search.json?engine=google&q=site:${encodedUrl}&api_key=${serpApiKey}`;
    
    const response = await fetch(serpApiUrl);
    
    if (!response.ok) {
      throw new Error(`SERPAPI request failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('SERPAPI response:', data);
    
    // Extract meta description from organic results
    const organicResults = data.organic_results || [];
    const result = organicResults.find(r => r.link === url);
    
    if (result?.snippet) {
      console.log('Found meta description:', result.snippet);
      return result.snippet;
    }
    
    console.log('No meta description found for:', url);
    return '';
  } catch (error) {
    console.error('Error fetching meta description:', error);
    return '';
  }
}
