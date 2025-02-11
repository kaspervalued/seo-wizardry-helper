
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

interface RedditContent {
  title: string;
  content: string;
  comments?: string[];
}

export async function analyzeRedditPost(url: string): Promise<RedditContent> {
  console.log('[Reddit] Analyzing post:', url);
  
  try {
    const urlObj = new URL(url);
    if (!urlObj.hostname.includes('reddit.com')) {
      throw new Error('Invalid Reddit URL');
    }

    console.log('[Reddit] Making request to OpenAI API...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `You are an AI that analyzes Reddit posts. Given a Reddit URL, return the post's content in this JSON format:
            {
              "title": "the post title",
              "content": "the full post content including all relevant information",
              "comments": ["top comment 1", "top comment 2", "top comment 3"] // Optional, include if available
            }`
          },
          {
            role: 'user',
            content: `Please analyze this Reddit post and return its content: ${url}`
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      console.error('[Reddit] OpenAI API error:', await response.text());
      throw new Error('Failed to analyze Reddit post with OpenAI');
    }

    const data = await response.json();
    const content = JSON.parse(data.choices[0].message.content);
    
    console.log('[Reddit] Successfully analyzed post');

    return {
      title: content.title || 'Reddit Post',
      content: content.content || 'Content unavailable',
      comments: content.comments || []
    };
  } catch (error) {
    console.error('[Reddit] Error analyzing post:', error);
    return {
      title: 'Reddit Post',
      content: 'Content unavailable - Failed to analyze the Reddit post.',
      comments: []
    };
  }
}
