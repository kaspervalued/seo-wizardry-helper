import { Article, ArticleAnalysis } from "./types.ts";
import { extractDomain, extractLinksFromHTML } from "./utils.ts";

const diffbotToken = Deno.env.get('DIFFBOT_API_TOKEN');
const serpApiKey = Deno.env.get('SERPAPI_API_KEY');

export async function fetchMetaDescriptionWithSerpApi(url: string) {
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

export async function fetchWithDiffbot(url: string, retries = 3): Promise<any> {
  const diffbotUrl = `https://api.diffbot.com/v3/article?token=${diffbotToken}&url=${encodeURIComponent(url)}`;
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempting to fetch article with Diffbot (attempt ${i + 1}/${retries})`);
      const response = await fetch(diffbotUrl);
      
      if (!response.ok) {
        throw new Error(`Diffbot API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.objects?.[0]) {
        throw new Error('No article data returned from Diffbot');
      }
      
      console.log('Diffbot response:', JSON.stringify(data.objects[0], null, 2));
      return data.objects[0];
    } catch (error) {
      console.error(`Diffbot API error (attempt ${i + 1}):`, error);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  
  throw new Error(`Failed to fetch article after ${retries} attempts`);
}

export async function analyzeArticle(url: string, keyword: string): Promise<ArticleAnalysis | null> {
  console.log(`Starting analysis for ${url}`);
  
  try {
    // Fetch article content and meta description in parallel
    const [article, metaDescription] = await Promise.all([
      fetchWithDiffbot(url),
      fetchMetaDescriptionWithSerpApi(url)
    ]);
    
    if (!article.text) {
      console.error(`No content extracted from ${url}`);
      return null;
    }

    const textContent = article.text;
    const wordCount = textContent.split(/\s+/).length;
    
    // Extract and process links
    const articleDomain = extractDomain(url);
    console.log('Article domain:', articleDomain);

    // Collect links from multiple sources
    const links = [];
    
    // Source 1: Diffbot's links array
    if (article.links && Array.isArray(article.links)) {
      console.log('Found links in Diffbot response:', article.links.length);
      links.push(...article.links);
    }
    
    // Source 2: Parse HTML content
    if (article.html) {
      const htmlLinks = extractLinksFromHTML(article.html);
      console.log('Found links in HTML content:', htmlLinks.length);
      links.push(...htmlLinks);
    }
    
    // Source 3: Check Diffbot's resolved URLs
    if (article.resolved_urls && Array.isArray(article.resolved_urls)) {
      console.log('Found resolved URLs:', article.resolved_urls.length);
      article.resolved_urls.forEach(resolvedUrl => {
        if (!links.some(l => l.href === resolvedUrl)) {
          links.push({
            href: resolvedUrl,
            text: resolvedUrl
          });
        }
      });
    }

    // Process and filter external links
    const externalLinks = links
      .filter(link => {
        if (!link.href) return false;
        try {
          const linkDomain = extractDomain(link.href);
          return linkDomain && 
                 linkDomain !== articleDomain && 
                 link.href.startsWith('http');
        } catch (error) {
          console.error('Error processing link:', link, error);
          return false;
        }
      })
      .map(link => {
        const domain = extractDomain(link.href);
        return {
          url: link.href,
          text: link.text || link.title || domain,
          domain: domain
        };
      })
      // Remove duplicates based on URL
      .filter((link, index, self) => 
        index === self.findIndex((l) => l.url === link.url)
      );

    // Extract and process heading structure
    const headings = [];
    if (article.html) {
      const headingMatches = article.html.match(/<h[1-6][^>]*>.*?<\/h[1-6]>/gi) || [];
      headingMatches.forEach(match => {
        const level = match.match(/<h([1-6])/i)?.[1] || '1';
        const text = match.replace(/<[^>]+>/g, '').trim();
        if (text) {
          headings.push({
            level: `h${level}`,
            text: text
          });
        }
      });
    }

    return {
      title: article.title || '',
      url: url,
      domain: articleDomain,
      wordCount,
      characterCount: textContent.length,
      headingsCount: headings.length,
      paragraphsCount: article.numPages || 1,
      imagesCount: (article.images || []).length,
      videosCount: (article.videos || []).length,
      externalLinks,
      externalLinksCount: externalLinks.length,
      metaTitle: article.title || '',
      metaDescription: metaDescription || article.meta?.description || '',
      keywords: [],  // Will be populated by AI analysis
      readabilityScore: 0,
      headingStructure: headings,
    };
  } catch (error) {
    console.error(`Error analyzing article ${url}:`, error);
    throw error;
  }
}