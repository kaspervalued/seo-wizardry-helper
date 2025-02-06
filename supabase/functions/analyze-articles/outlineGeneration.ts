import { ArticleAnalysis, IdealStructure } from "./types.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

export async function generateIdealStructure(analyses: ArticleAnalysis[], keyword: string): Promise<IdealStructure> {
  console.log('Generating ideal structure from analyses');

  try {
    const prompt = `Analyze these ${analyses.length} articles and create an ideal content structure that would outrank them for the keyword "${keyword}". Focus on creating a comprehensive, well-structured outline that covers all important aspects of the topic.

Context from competitor analysis:
${analyses.map(a => `
- Article: ${a.title}
  Word count: ${a.wordCount}
  Key topics: ${a.keywords.join(', ')}
  Heading structure:
  ${a.headingStructure.map(h => `  ${h.level}: ${h.text}`).join('\n')}
`).join('\n')}

Return a JSON object with this exact structure:
{
  "targetWordCount": number,
  "suggestedTitles": string[],
  "suggestedDescriptions": string[],
  "recommendedKeywords": { "text": string, "frequency": number }[],
  "recommendedExternalLinks": { "url": string, "text": string, "domain": string, "frequency": number }[],
  "outline": { "level": string, "text": string }[]
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an SEO expert that analyzes content and creates detailed outlines. Always return valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const structureStr = data.choices[0].message.content;
    
    try {
      const structure = JSON.parse(structureStr);
      console.log('Successfully generated ideal structure');
      return structure;
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      console.log('Raw response:', structureStr);
      throw new Error('Failed to parse OpenAI response as JSON');
    }
  } catch (error) {
    console.error('Error generating ideal structure:', error);
    throw error;
  }
}