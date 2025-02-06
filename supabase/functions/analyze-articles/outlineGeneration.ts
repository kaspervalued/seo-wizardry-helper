import { ArticleAnalysis, IdealStructure } from "./types.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

export async function generateIdealStructure(
  analyses: ArticleAnalysis[],
  keyword: string
): Promise<IdealStructure> {
  console.log('Generating ideal structure from analyses');
  
  try {
    // Prepare the analysis summary for GPT
    const analysisSummary = analyses.map(analysis => ({
      title: analysis.title,
      wordCount: analysis.wordCount,
      keywords: analysis.keywords,
      headings: analysis.headingStructure,
      externalLinks: analysis.externalLinks,
    }));
    
    const prompt = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an SEO expert analyzing multiple top-ranking articles to create an ideal content structure."
        },
        {
          role: "user",
          content: `Based on these top-ranking articles for the keyword "${keyword}":
            ${JSON.stringify(analysisSummary, null, 2)}
            
            Create an ideal content structure including:
            1. Target word count
            2. Most important keywords to include (with frequency)
            3. Recommended external links to include
            4. 3 suggested titles
            5. 3 suggested meta descriptions`
        }
      ]
    };
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(prompt)
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const aiSuggestions = JSON.parse(data.choices[0].message.content);
    
    // Process and aggregate external links
    const linkFrequency = new Map<string, number>();
    analyses.forEach(analysis => {
      analysis.externalLinks.forEach(link => {
        const count = linkFrequency.get(link.domain) || 0;
        linkFrequency.set(link.domain, count + 1);
      });
    });
    
    // Get most frequently referenced external links
    const recommendedLinks = Array.from(linkFrequency.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([domain, frequency]) => {
        const link = analyses
          .flatMap(a => a.externalLinks)
          .find(l => l.domain === domain);
        return { ...link!, frequency };
      });
    
    return {
      targetWordCount: Math.round(
        analyses.reduce((sum, a) => sum + a.wordCount, 0) / analyses.length
      ),
      recommendedKeywords: aiSuggestions.keywords,
      recommendedExternalLinks: recommendedLinks,
      suggestedTitles: aiSuggestions.titles,
      suggestedDescriptions: aiSuggestions.descriptions,
    };
  } catch (error) {
    console.error('Error generating ideal structure:', error);
    throw error;
  }
}