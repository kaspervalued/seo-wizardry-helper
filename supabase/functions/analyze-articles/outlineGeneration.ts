import { AnalysisResult, IdealStructure } from './types.ts';

export async function generateIdealStructure(analyses: AnalysisResult[], keyword: string): Promise<IdealStructure> {
  try {
    // Prepare analysis summary for OpenAI
    const analysisSummary = analyses.map(analysis => ({
      wordCount: analysis.wordCount,
      keywords: analysis.keywords,
      externalLinks: analysis.externalLinks,
      headingStructure: analysis.headingStructure
    }));
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `Analyze the following articles and generate an ideal content structure. Focus on the keyword: ${keyword}. Return a JSON object with targetWordCount, recommendedKeywords (with frequency), recommendedExternalLinks (with frequency), suggestedTitles, and suggestedDescriptions.`
          },
          {
            role: 'user',
            content: JSON.stringify(analysisSummary)
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    const structure = JSON.parse(data.choices[0].message.content);
    
    return {
      targetWordCount: structure.targetWordCount,
      recommendedKeywords: structure.recommendedKeywords,
      recommendedExternalLinks: structure.recommendedExternalLinks,
      suggestedTitles: structure.suggestedTitles,
      suggestedDescriptions: structure.suggestedDescriptions
    };
  } catch (error) {
    console.error('Error generating ideal structure:', error);
    throw error;
  }
}