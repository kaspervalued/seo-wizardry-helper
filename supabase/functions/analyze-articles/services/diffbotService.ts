
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

export async function fetchWithDiffbot(url: string, retries = 5, initialDelay = 1000): Promise<DiffbotArticle> {
  const diffbotUrl = `https://api.diffbot.com/v3/article?token=${diffbotToken}&url=${encodeURIComponent(url)}`;
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempting to fetch article with Diffbot (attempt ${i + 1}/${retries}) for URL: ${url}`);
      
      const response = await fetch(diffbotUrl);
      
      if (response.status === 429) {
        const delay = initialDelay * Math.pow(1.5, i);
        console.log(`Rate limited for ${url}. Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`Diffbot API error: ${response.status} for URL: ${url}`);
      }
      
      const data = await response.json();
      
      if (!data.objects?.[0]) {
        throw new Error(`No article data returned from Diffbot for URL: ${url}`);
      }
      
      console.log('Successfully fetched article from Diffbot:', url);
      return data.objects[0];
    } catch (error) {
      console.error(`Diffbot API error (attempt ${i + 1}) for URL ${url}:`, error);
      if (i === retries - 1) throw error;
      const delay = initialDelay * Math.pow(1.5, i);
      console.log(`Waiting ${delay}ms before retrying ${url}...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`Failed to fetch article after ${retries} attempts: ${url}`);
}

