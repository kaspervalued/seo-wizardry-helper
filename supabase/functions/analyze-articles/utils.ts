import { ArticleContent, ExternalLink } from "./types.ts";

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    console.error('Error extracting domain:', error);
    return '';
  }
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).length;
}

export function extractExternalLinks(html: string, currentDomain: string): ExternalLink[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const links = Array.from(doc.querySelectorAll('a[href]'));
  
  return links
    .map(link => {
      const url = link.getAttribute('href') || '';
      const domain = extractDomain(url);
      
      if (domain && domain !== currentDomain) {
        return {
          url,
          text: link.textContent || '',
          domain,
        };
      }
      return null;
    })
    .filter((link): link is ExternalLink => link !== null);
}

export function calculateReadabilityScore(text: string): number {
  // Implement a basic readability score calculation
  const sentences = text.split(/[.!?]+/).length;
  const words = countWords(text);
  const characters = text.length;
  
  if (words === 0 || sentences === 0) return 0;
  
  // Basic Flesch-Kincaid reading ease score
  const wordsPerSentence = words / sentences;
  const charactersPerWord = characters / words;
  
  return Math.round(206.835 - (1.015 * wordsPerSentence) - (84.6 * charactersPerWord));
}

export async function fetchWithTimeout(url: string, options: RequestInit & { timeout?: number } = {}): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options;
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}