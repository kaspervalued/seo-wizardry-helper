import { ArticleAnalysis, IdealStructure } from "./types.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

export async function generateIdealStructure(analyses: ArticleAnalysis[], keyword: string): Promise<IdealStructure> {
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

    const outlinePrompt = `As an expert content strategist, analyze this data and generate the perfect article outline that will outrank all existing articles for "${keyword}".

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

    console.log('Sending outline generation prompt to OpenAI');

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

    // Sort keywords by frequency and article count
    const rankedKeywords = Array.from(keywordFrequencyMap.entries())
      .sort((a, b) => {
        const articleCountDiff = b[1].articles.size - a[1].articles.size;
        if (articleCountDiff !== 0) return articleCountDiff;
        const freqDiff = b[1].frequency - a[1].frequency;
        if (freqDiff !== 0) return freqDiff;
        return a[0].length - b[0].length;
      })
      .map(([keyword, data]) => ({
        text: keyword,
        frequency: data.articles.size
      }));

    return {
      targetWordCount: calculatedTargetWordCount || 1500,
      recommendedKeywords: rankedKeywords,
      recommendedExternalLinks: [],  // Will be populated in main function
      suggestedTitles: [],  // Will be populated in main function
      suggestedDescriptions: [],  // Will be populated in main function
      outline: generatedOutline.headings,
    };
  } catch (error) {
    console.error('Error in generateIdealStructure:', error);
    throw error;
  }
}