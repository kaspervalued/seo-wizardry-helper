
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

if (!openAIApiKey) {
  console.error('Missing OpenAI API key');
  throw new Error('OPENAI_API_KEY not set');
}

export async function extractKeyPhrasesWithAI(content: string, keyword: string): Promise<string[]> {
  try {
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('[OpenAI] Making request to extract key phrases...');
    console.log('[OpenAI] Content length:', content.length);
    console.log('[OpenAI] Keyword:', keyword);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-1106-preview',
        messages: [
          {
            role: 'system',
            content: `Analyze the content and extract 5-7 key phrases that are:
            1. Most frequently mentioned across the text
            2. Highly relevant to the main topic "${keyword}"
            3. Technical or industry-specific terms
            
            Rules:
            - Return only complete, clean key phrases without any prefixes or special characters
            - Each phrase should be meaningful and self-contained
            - Do not include dashes, bullet points, or any other formatting
            - Format as plain text, one phrase per line
            
            For example:
            Static Application Security Testing
            Dynamic Application Security Testing
            Source Code Analysis
            Runtime Detection
            Vulnerability Scanning`
          },
          {
            role: 'user',
            content: content.substring(0, 4000)
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[OpenAI] API error response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorData
      });
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log('[OpenAI] Successfully received response');
    
    const phrases = data.choices[0].message.content
      .split('\n')
      .map(phrase => phrase.trim())
      .filter(Boolean)
      .map(phrase => phrase.replace(/^[-•*]\s*/, '')); // Remove any remaining bullet points or dashes
    
    console.log('[OpenAI] Extracted phrases:', phrases);
    return phrases;
  } catch (error) {
    console.error('[OpenAI] Error in extractKeyPhrasesWithAI:', error);
    throw error;
  }
}
