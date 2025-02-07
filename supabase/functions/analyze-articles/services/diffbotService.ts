
import { corsHeaders } from '../utils/cors.ts';

const diffbotToken = Deno.env.get('DIFFBOT_API_TOKEN');

if (!diffbotToken) {
  console.error('Missing Diffbot API token');
  throw new Error('DIFFBOT_API_TOKEN not set');
}

export interface DiffbotArticle {
  title?: string;
  text?: string;
  html?: string;
  meta?: {
    description?: string;
  };
  links?: Array<{ href: string; text: string }>;
  numPages?: number;
  images?: Array<any>;
  videos?: Array<any>;
  resolved_urls?: Array<string>;
}

export async function fetchWithDiffbot(url: string, retries = 3, initialDelay = 2000): Promise<DiffbotArticle> {
  const diffbotUrl = `https://api.diffbot.com/v3/article?token=${diffbotToken}&url=${encodeURIComponent(url)}`;
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[Diffbot] Attempt ${i + 1}/${retries} for URL: ${url}`);
      
      // Add increasing delay between retries
      if (i > 0) {
        const delay = initialDelay * Math.pow(2, i - 1);
        console.log(`[Diffbot] Retry delay: ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const response = await fetch(diffbotUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Diffbot] API error response:`, {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        
        if (response.status === 429) {
          console.log('[Diffbot] Rate limited, will retry after delay');
          continue;
        }
        
        throw new Error(`Diffbot API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[Diffbot] Response data:', JSON.stringify(data).substring(0, 500) + '...');
      
      if (!data.objects?.[0]) {
        console.error('[Diffbot] No article data in response:', data);
        throw new Error('No article data returned from Diffbot');
      }
      
      console.log(`[Diffbot] Successfully fetched article from: ${url}`);
      return data.objects[0];
    } catch (error) {
      console.error(`[Diffbot] Error attempt ${i + 1}:`, error);
      if (i === retries - 1) throw error;
    }
  }
  
  throw new Error(`Failed to fetch article after ${retries} attempts`);
}
