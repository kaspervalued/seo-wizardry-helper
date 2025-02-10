
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

export async function fetchWithDiffbot(url: string, retries = 8, initialDelay = 2000): Promise<DiffbotArticle> {
  const diffbotUrl = `https://api.diffbot.com/v3/article?token=${diffbotToken}&url=${encodeURIComponent(url)}`;
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[Diffbot] Attempt ${i + 1}/${retries} for URL: ${url}`);
      
      const response = await fetch(diffbotUrl);
      const statusCode = response.status;
      
      console.log(`[Diffbot] Response status: ${statusCode} for URL: ${url}`);
      
      if (statusCode === 429) {
        const retryAfter = response.headers.get('retry-after');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : initialDelay * Math.pow(2, i);
        console.log(`[Diffbot] Rate limited for ${url}. Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      if (!response.ok) {
        console.error(`[Diffbot] Error response for ${url}:`, { status: statusCode });
        if (i === retries - 1) {
          throw new Error(`Diffbot API error: ${statusCode} for URL: ${url}`);
        }
        const delay = initialDelay * Math.pow(2, i);
        console.log(`[Diffbot] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      const data = await response.json();
      
      if (!data.objects?.[0]) {
        console.error(`[Diffbot] No article data in response for URL: ${url}`, data);
        throw new Error(`No article data returned from Diffbot for URL: ${url}`);
      }
      
      console.log(`[Diffbot] Successfully fetched article from Diffbot: ${url}`);
      return data.objects[0];
    } catch (error) {
      console.error(`[Diffbot] Error (attempt ${i + 1}) for URL ${url}:`, error);
      
      if (i === retries - 1) {
        throw new Error(`Failed to fetch article after ${retries} attempts: ${url} - ${error.message}`);
      }
      
      const delay = initialDelay * Math.pow(2, i);
      console.log(`[Diffbot] Waiting ${delay}ms before retry ${i + 2}...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`Failed to fetch article after ${retries} attempts: ${url}`);
}
