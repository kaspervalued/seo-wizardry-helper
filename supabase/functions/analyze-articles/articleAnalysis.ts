import { ArticleAnalysis, ArticleContent } from "./types.ts";
import { calculateReadabilityScore, extractDomain, extractExternalLinks } from "./utils.ts";

const DIFFBOT_API_TOKEN = Deno.env.get('DIFFBOT_API_TOKEN');

export async function extractArticleContent(url: string): Promise<ArticleContent | null> {
  console.log(`Extracting content from: ${url}`);
  
  if (!DIFFBOT_API_TOKEN) {
    console.error('DIFFBOT_API_TOKEN is not set');
    return null;
  }
  
  const diffbotUrl = `https://api.diffbot.com/v3/article?token=${DIFFBOT_API_TOKEN}&url=${encodeURIComponent(url)}`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(diffbotUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`Diffbot API error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    console.log('Diffbot API response:', JSON.stringify(data));
    
    if (!data.objects?.[0]) {
      console.error('No article content found in Diffbot response');
      return null;
    }
    
    const article = data.objects[0];
    
    return {
      title: article.title,
      url: article.pageUrl,
      domain: extractDomain(article.pageUrl),
      text: article.text,
      html: article.html,
      meta: {
        title: article.title,
        description: article.meta?.description || '',
      },
      images: article.images || [],
    };
  } catch (error) {
    console.error(`Error extracting content from ${url}:`, error);
    return null;
  }
}

export async function analyzeArticle(content: ArticleContent): Promise<ArticleAnalysis | null> {
  try {
    console.log(`Analyzing article: ${content.title}`);
    
    const externalLinks = extractExternalLinks(content.html, content.domain);
    
    // Extract headings using regex
    const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi;
    const headings = Array.from(content.html.matchAll(headingRegex)).map(match => ({
      level: `h${match[1]}`,
      text: match[2].replace(/<[^>]+>/g, '').trim(),
    }));
    
    // Count paragraphs
    const paragraphCount = (content.html.match(/<p[^>]*>/g) || []).length;
    
    // Extract keywords (simple implementation - could be enhanced with NLP)
    const words = content.text.toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 3)
      .reduce((acc, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    
    const keywords = Object.entries(words)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
    
    return {
      title: content.title,
      url: content.url,
      domain: content.domain,
      wordCount: content.text.split(/\s+/).length,
      characterCount: content.text.length,
      headingsCount: headings.length,
      paragraphsCount: paragraphCount,
      imagesCount: content.images.length,
      videosCount: (content.html.match(/<video[^>]*>/g) || []).length,
      externalLinks,
      externalLinksCount: externalLinks.length,
      metaTitle: content.meta.title,
      metaDescription: content.meta.description,
      keywords,
      readabilityScore: calculateReadabilityScore(content.text),
      headingStructure: headings,
    };
  } catch (error) {
    console.error(`Error analyzing article ${content.url}:`, error);
    return null;
  }
}