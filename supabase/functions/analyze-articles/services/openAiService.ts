
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

if (!openAIApiKey) {
  console.error('Missing OpenAI API key');
  throw new Error('OPENAI_API_KEY not set');
}

export async function extractKeyPhrasesWithAI(content: string, keyword: string): Promise<string[]> {
  try {
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Making request to OpenAI API...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Analyze the content and extract 5-7 key phrases that are:
            1. Most frequently mentioned across the text
            2. Highly relevant to the main topic "${keyword}"
            3. Technical or industry-specific terms
            
            Format each key phrase as a simple string without any additional explanation or formatting.
            Return only the key phrases, one per line.`
          },
          {
            role: 'user',
            content: content.substring(0, 4000)
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error response:', errorData);
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log('Successfully received OpenAI API response');
    
    return data.choices[0].message.content
      .split('\n')
      .map(phrase => phrase.trim())
      .filter(Boolean);
  } catch (error) {
    console.error('Error in extractKeyPhrasesWithAI:', error);
    throw error;
  }
}
