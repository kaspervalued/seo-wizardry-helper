import { ArticleAnalysis, ArticleContent } from "./types.ts";
import { calculateReadabilityScore, extractDomain, extractExternalLinks, fetchWithTimeout } from "./utils.ts";

const DIFFBOT_API_TOKEN = Deno.env.get('DIFFBOT_API_TOKEN');

export async function extractArticleContent(url: string): Promise<ArticleContent> {
  console.log(`Extracting content from: ${url}`);
  
  const diffbotUrl = `https://api.diffbot.com/v3/article?token=${DIFFBOT_API_TOKEN}&url=${encodeURIComponent(url)}`;
  
  try {
    const response = await fetchWithTimeout(diffbotUrl, { timeout: 30000 });
    
    if (!response.ok) {
      throw new Error(`Diffbot API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const article = data.objects[0];
    
    if (!article) {
      throw new Error('No article content found');
    }
    
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
    throw error;
  }
}

export async function analyzeArticle(content: ArticleContent): Promise<ArticleAnalysis> {
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
}