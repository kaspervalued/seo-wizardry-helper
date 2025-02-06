import { ArticleContent, AnalysisResult } from './types.ts';
import { extractDomain, countWords, countCharacters, extractExternalLinks, calculateReadabilityScore } from './utils.ts';

const DIFFBOT_API_TOKEN = Deno.env.get('DIFFBOT_API_TOKEN');

export async function fetchArticleContent(url: string): Promise<ArticleContent> {
  const diffbotUrl = `https://api.diffbot.com/v3/article?token=${DIFFBOT_API_TOKEN}&url=${encodeURIComponent(url)}`;
  
  try {
    const response = await fetch(diffbotUrl);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Diffbot API error: ${data.error}`);
    }
    
    if (!data.objects?.[0]) {
      throw new Error('No article content found');
    }
    
    return {
      title: data.objects[0].title,
      text: data.objects[0].text,
      html: data.objects[0].html,
      meta: {
        description: data.objects[0].meta?.description
      }
    };
  } catch (error) {
    console.error(`Error fetching article content for ${url}:`, error);
    throw error;
  }
}

export async function analyzeArticle(url: string, content: ArticleContent): Promise<AnalysisResult> {
  const domain = extractDomain(url);
  const parser = new DOMParser();
  const doc = parser.parseFromString(content.html, 'text/html');
  
  // Extract headings
  const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(heading => ({
    level: heading.tagName.toLowerCase(),
    text: heading.textContent || ''
  }));
  
  // Extract external links
  const externalLinks = extractExternalLinks(content.html, domain);
  
  // Extract keywords using OpenAI
  const keywordsResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Extract the main keywords from the following article text. Return only an array of keywords, no explanation.'
        },
        {
          role: 'user',
          content: content.text.substring(0, 4000) // Limit text length
        }
      ]
    })
  });
  
  const keywordsData = await keywordsResponse.json();
  const keywords = JSON.parse(keywordsData.choices[0].message.content);
  
  return {
    title: content.title,
    url,
    domain,
    wordCount: countWords(content.text),
    characterCount: countCharacters(content.text),
    headingsCount: headings.length,
    paragraphsCount: doc.querySelectorAll('p').length,
    imagesCount: doc.querySelectorAll('img').length,
    videosCount: doc.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length,
    externalLinks,
    externalLinksCount: externalLinks.length,
    metaTitle: content.title,
    metaDescription: content.meta.description || '',
    keywords,
    readabilityScore: calculateReadabilityScore(content.text),
    headingStructure: headings
  };
}