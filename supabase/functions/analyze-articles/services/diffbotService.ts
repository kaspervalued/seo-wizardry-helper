
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
      console.log(`Attempting to fetch article with Diffbot (attempt ${i + 1}/${retries})`);
      
      // Add increasing delay between retries
      if (i > 0) {
        const delay = initialDelay * Math.pow(2, i - 1);
        console.log(`Retry delay: ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const response = await fetch(diffbotUrl);
      
      if (response.status === 429) {
        console.log('Rate limited by Diffbot, will retry after delay');
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`Diffbot API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.objects?.[0]) {
        throw new Error('No article data returned from Diffbot');
      }
      
      console.log('Successfully fetched article from Diffbot');
      return data.objects[0];
    } catch (error) {
      console.error(`Diffbot API error (attempt ${i + 1}):`, error);
      if (i === retries - 1) throw error;
    }
  }
  
  throw new Error(`Failed to fetch article after ${retries} attempts`);
}
