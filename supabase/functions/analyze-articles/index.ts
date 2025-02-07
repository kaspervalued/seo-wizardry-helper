import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from './utils/cors.ts';
import { extractDomain, extractLinksFromHTML } from './utils/urlUtils.ts';
import { fetchWithDiffbot, type DiffbotArticle } from './services/diffbotService.ts';
import { fetchMetaDescriptionWithSerpApi } from './services/serpApiService.ts';
import { extractKeyPhrasesWithAI } from './services/openAiService.ts';

// Get OpenAI API key from environment
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

if (!openAIApiKey) {
  console.error('Missing OpenAI API key');
  throw new Error('OPENAI_API_KEY not set');
}

async function analyzeArticle(url: string, keyword: string) {
  console.log(`Starting analysis for ${url}`);
  
  try {
    // Add delay between articles to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
    
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
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    const keywords = await extractKeyPhrasesWithAI(textContent, keyword);

    const articleDomain = extractDomain(url);
    console.log('Article domain:', articleDomain);

    const links = [];
    
    if (article.links && Array.isArray(article.links)) {
      console.log('Found links in Diffbot response:', article.links.length);
      links.push(...article.links);
    }
    
    if (article.html) {
      const htmlLinks = extractLinksFromHTML(article.html);
      console.log('Found links in HTML content:', htmlLinks.length);
      links.push(...htmlLinks);
    }
    
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

    console.log('Total links found before filtering:', links.length);

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
      .filter((link, index, self) => 
        index === self.findIndex((l) => l.url === link.url)
      );

    console.log('Final external links count:', externalLinks.length);

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
      keywords,
      readabilityScore: 0,
      headingStructure: headings,
    };
  } catch (error) {
    console.error(`Error analyzing article ${url}:`, error);
    throw error;
  }
}

async function generateIdealStructure(analyses: any[], keyword: string) {
  try {
    console.log('Starting generateIdealStructure with analyses:', analyses.length);
    
    const validWordCounts = analyses
      .map(a => a.wordCount)
      .filter(count => count > 0);
    
    const calculatedTargetWordCount = Math.round(
      validWordCounts.reduce((sum, count) => sum + count, 0) / validWordCounts.length
    );

    const allContent = analyses.map(analysis => ({
      title: analysis.title,
      description: analysis.metaDescription,
      headings: analysis.headingStructure,
      keywords: analysis.keywords
    }));

    const outlinePrompt = `As an expert SEO content strategist, analyze this data and generate the perfect article outline that will outrank all existing articles for "${keyword}".

Context:
- Focus keyword: "${keyword}"
- Analyzed articles:
${allContent.map(content => `
Title: ${content.title}
Description: ${content.description}
Headings: ${content.headings.map(h => `\n  ${h.level}: ${h.text}`).join('')}
Keywords: ${content.keywords.join(', ')}
`).join('\n')}

Requirements for the perfect outline:
1. Create a comprehensive outline that covers all essential aspects of "${keyword}"
2. Structure the content to demonstrate deep expertise and authority
3. Address user intent comprehensively by answering all relevant questions
4. Include practical examples, use cases, and implementation guidance where relevant
5. Cover both basic concepts for beginners and advanced insights for experts
6. Target length: ${calculatedTargetWordCount} words
7. Format as a hierarchical outline with H2 and H3 headings only

Additional guidelines:
- Ensure logical flow and progression of topics
- Include sections that competitors might have missed
- Balance theory with practical application
- Consider both beginner and advanced user needs
- Include clear comparisons and evaluations where relevant
- Address common questions and concerns

Return ONLY a valid JSON object in this exact format, with no additional text or formatting:
{
  "headings": [
    {
      "id": "string-id",
      "level": "h2 or h3",
      "text": "heading text",
      "children": [] 
    }
  ]
}`;

    console.log('Sending outline generation prompt to OpenAI:', outlinePrompt);

    const outlineResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: 'You are an SEO expert that generates comprehensive article outlines optimized to outrank competing content. Always return ONLY valid JSON, no markdown or additional text.' 
          },
          { role: 'user', content: outlinePrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!outlineResponse.ok) {
      throw new Error(`OpenAI API error: ${outlineResponse.status}`);
    }

    const outlineData = await outlineResponse.json();
    console.log('Raw OpenAI response:', outlineData);

    let generatedOutline;
    try {
      const content = outlineData.choices[0].message.content.trim();
      console.log('Parsing outline content:', content);
      generatedOutline = JSON.parse(content);
    } catch (parseError) {
      console.error('Error parsing outline JSON:', parseError);
      throw new Error('Failed to parse outline JSON from OpenAI response');
    }

    // Aggregate and rank keywords from all articles
    const keywordFrequencyMap = new Map<string, { frequency: number, articles: Set<string> }>();
    analyses.forEach(analysis => {
      if (!analysis.keywords || !Array.isArray(analysis.keywords)) {
        console.warn('Invalid keywords array in analysis:', analysis);
        return;
      }

      analysis.keywords.forEach(keyword => {
        const normalizedKeyword = keyword.toLowerCase().trim();
        const existing = keywordFrequencyMap.get(normalizedKeyword);
        if (existing) {
          existing.frequency += 1;
          existing.articles.add(analysis.url);
        } else {
          keywordFrequencyMap.set(normalizedKeyword, {
            frequency: 1,
            articles: new Set([analysis.url])
          });
        }
      });
    });

    // Aggregate and rank external links from all articles with improved counting
    const linkFrequencyMap = new Map<string, { 
      url: string; 
      text: string; 
      domain: string; 
      articles: Set<string>;
      totalMentions: number; // Add total mentions counter
    }>();
    
    analyses.forEach(analysis => {
      if (!analysis.externalLinks || !Array.isArray(analysis.externalLinks)) {
        console.warn('Invalid externalLinks array in analysis:', analysis);
        return;
      }

      // Count both unique articles and total mentions
      const processedUrls = new Set<string>(); // Track processed URLs per article
      
      analysis.externalLinks.forEach(link => {
        const existingLink = linkFrequencyMap.get(link.url);
        if (existingLink) {
          existingLink.articles.add(analysis.url);
          existingLink.totalMentions++; // Increment total mentions
          
          // Update text if current one is more descriptive
          if (link.text && link.text.length > existingLink.text.length) {
            existingLink.text = link.text;
          }
        } else {
          linkFrequencyMap.set(link.url, {
            url: link.url,
            text: link.text,
            domain: link.domain,
            articles: new Set([analysis.url]),
            totalMentions: 1
          });
        }
      });
    });

    console.log('Link frequency map:', 
      Array.from(linkFrequencyMap.entries()).map(([url, data]) => ({
        url,
        articleCount: data.articles.size,
        totalMentions: data.totalMentions
      }))
    );

    // Sort links by both unique articles and total mentions
    const rankedLinks = Array.from(linkFrequencyMap.values())
      .sort((a, b) => {
        // First sort by number of unique articles
        const articleDiff = b.articles.size - a.articles.size;
        if (articleDiff !== 0) return articleDiff;
        
        // If same number of articles, sort by total mentions
        return b.totalMentions - a.totalMentions;
      })
      .map(link => ({
        url: link.url,
        text: link.text,
        domain: link.domain,
        frequency: link.articles.size,
        totalMentions: link.totalMentions
      }))
      .slice(0, 10);

    console.log('Final ranked links:', rankedLinks);

    // Sort keywords by frequency and article count
    const rankedKeywords = Array.from(keywordFrequencyMap.entries())
      .sort((a, b) => {
        // First sort by number of articles containing the keyword
        const articleCountDiff = b[1].articles.size - a[1].articles.size;
        if (articleCountDiff !== 0) return articleCountDiff;
        
        // If article count is equal, sort by total frequency
        const freqDiff = b[1].frequency - a[1].frequency;
        if (freqDiff !== 0) return freqDiff;
        
        // If frequencies are equal, sort by length (prefer shorter keywords)
        return a[0].length - b[0].length;
      })
      .map(([keyword, data]) => ({
        text: keyword,
        frequency: data.articles.size
      }));

    // Generate SEO-optimized titles using OpenAI
    const titlePrompt = `As an SEO expert, analyze this data and generate 3 SEO-optimized meta titles for an article about "${keyword}".

Context:
- Focus keyword: "${keyword}"
- Analyzed titles from top-ranking articles:
${analyses.map(a => `- ${a.title}`).join('\n')}
- Key topics and phrases found:
${rankedKeywords.slice(0, 10).map(k => `- ${k.text}`).join('\n')}

Requirements:
1. Create 3 unique, compelling titles that will compete with existing top articles
2. Each title must:
   - Include the focus keyword "${keyword}"
   - Be 50-60 characters long
   - Address search intent and user value
   - Reflect the depth and comprehensiveness of the content
   - Be optimized for both SEO and readability
3. Format output as a simple list of 3 titles, one per line

Generate only the titles, no explanations or additional text.`;

    console.log('Sending title generation prompt to OpenAI:', titlePrompt);

    const titleResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-1106-preview',
        messages: [
          { role: 'system', content: 'You are an SEO expert that generates optimized titles.' },
          { role: 'user', content: titlePrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!titleResponse.ok) {
      throw new Error(`OpenAI API error: ${titleResponse.status}`);
    }

    const titleData = await titleResponse.json();
    const suggestedTitles = titleData.choices[0].message.content
      .split('\n')
      .filter(Boolean)
      .slice(0, 3);

    console.log('Generated titles:', suggestedTitles);

    // Generate SEO-optimized descriptions using OpenAI
    const descriptionPrompt = `As an SEO expert, analyze this data and generate 3 SEO-optimized meta descriptions for an article about "${keyword}".

Context:
- Focus keyword: "${keyword}"
- Analyzed descriptions from top-ranking articles:
${analyses.map(a => `- ${a.metaDescription}`).join('\n')}
- Key topics and phrases found:
${rankedKeywords.slice(0, 10).map(k => `- ${k.text}`).join('\n')}

Search Intent Analysis:
${analyses.map(a => `
Title: ${a.title}
Description: ${a.metaDescription}
Key Topics: ${a.keywords.slice(0, 5).join(', ')}
`).join('\n')}

Requirements:
1. Create 3 unique, compelling meta descriptions that will compete with existing top articles
2. Each description must:
   - Include the focus keyword "${keyword}"
   - Be 120-150 characters long
   - Match the search intent identified from top articles
   - Highlight unique value proposition
   - Include a clear call-to-action based on user intent
   - Reflect content depth and comprehensiveness
   - Be optimized for both SEO and readability
3. Format output as a simple list of 3 descriptions, one per line

Generate only the descriptions, no explanations or additional text.`;

    console.log('Sending description generation prompt to OpenAI:', descriptionPrompt);

    const descriptionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-1106-preview',
        messages: [
          { role: 'system', content: 'You are an SEO expert that generates optimized meta descriptions.' },
          { role: 'user', content: descriptionPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!descriptionResponse.ok) {
      throw new Error(`OpenAI API error: ${descriptionResponse.status}`);
    }

    const descriptionData = await descriptionResponse.json();
    const suggestedDescriptions = descriptionData.choices[0].message.content
      .split('\n')
      .filter(Boolean)
      .slice(0, 3);

    console.log('Generated descriptions:', suggestedDescriptions);

    return {
      targetWordCount: calculatedTargetWordCount || 1500,
      suggestedTitles,
      suggestedDescriptions,
      recommendedKeywords: rankedKeywords,
      recommendedExternalLinks: rankedLinks,
      outline: generatedOutline.headings,
    };
  } catch (error) {
    console.error('Error in generateIdealStructure:', error);
    throw error;
  }
}

serve(async (req) => {
  // Always handle CORS preflight first
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: corsHeaders 
    });
  }

  try {
    console.log('Received request to analyze-articles function');
    
    const requestBody = await req.json();
    const { urls, keyword } = requestBody;
    
    console.log('Request data:', { urls, keyword });
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      throw new Error('No URLs provided for analysis');
    }

    if (!keyword || typeof keyword !== 'string') {
      throw new Error('No keyword provided for analysis');
    }

    console.log('Starting analysis for URLs:', urls);
    
    // Process articles sequentially with delay between each
    const results = [];
    for (const url of urls) {
      try {
        console.log(`Processing URL: ${url}`);
        const result = await analyzeArticle(url, keyword);
        if (result) results.push(result);
        // Add delay between articles
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Failed to analyze article ${url}:`, error);
        // Continue with other articles even if one fails
      }
    }

    if (results.length === 0) {
      throw new Error('No articles could be successfully analyzed');
    }

    const idealStructure = await generateIdealStructure(results, keyword);

    console.log('Analysis completed successfully');

    return new Response(
      JSON.stringify({
        analyses: results,
        idealStructure,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in analyze-articles function:', error);
    
    // Always return error responses with CORS headers
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.stack || undefined
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
