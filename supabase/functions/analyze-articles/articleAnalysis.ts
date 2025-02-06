import { Article, ArticleAnalysis } from "./types.ts";
import { extractDomain } from "./utils.ts";

const DIFFBOT_API_TOKEN = Deno.env.get('DIFFBOT_API_TOKEN');

export async function analyzeArticle(article: Article): Promise<ArticleAnalysis> {
  console.log(`Analyzing article: ${article.url}`);
  
  try {
    // Fetch article content using Diffbot
    const diffbotUrl = `https://api.diffbot.com/v3/article?token=${DIFFBOT_API_TOKEN}&url=${encodeURIComponent(article.url)}`;
    const response = await fetch(diffbotUrl);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Diffbot API error: ${JSON.stringify(data)}`);
    }

    const articleData = data.objects[0];
    
    // Extract external links
    const externalLinks = (articleData.links || [])
      .filter((link: any) => link.type === 'link' && !link.url.includes(extractDomain(article.url)))
      .map((link: any) => ({
        url: link.url,
        text: link.text,
        domain: extractDomain(link.url)
      }));

    // Extract heading structure
    const headingStructure = (articleData.elements || [])
      .filter((element: any) => element.type === 'header')
      .map((header: any) => ({
        level: `h${header.headerLevel}`,
        text: header.text
      }));

    // Extract keywords using text content
    const keywords = extractKeywords(articleData.text);

    return {
      title: articleData.title,
      url: article.url,
      domain: extractDomain(article.url),
      wordCount: articleData.text.split(/\s+/).length,
      characterCount: articleData.text.length,
      headingsCount: headingStructure.length,
      paragraphsCount: (articleData.elements || []).filter((el: any) => el.type === 'p').length,
      imagesCount: (articleData.images || []).length,
      videosCount: (articleData.videos || []).length,
      externalLinksCount: externalLinks.length,
      metaTitle: articleData.title,
      metaDescription: articleData.description || '',
      keywords,
      externalLinks,
      headingStructure,
    };
  } catch (error) {
    console.error(`Error analyzing article ${article.url}:`, error);
    throw error;
  }
}

function extractKeywords(text: string): string[] {
  // Simple keyword extraction based on word frequency
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3);

  const frequency: { [key: string]: number } = {};
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });

  return Object.entries(frequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word);
}