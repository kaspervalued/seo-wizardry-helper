
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
            content: `You are an AI that analyzes Reddit posts. For each post, provide:
            1. The main title
            2. A clear, well-structured summary of the original post's content, including:
               - Main question or topic
               - Key points or requirements mentioned
               - Any specific context provided
            3. A summary of the top comments/responses (if available), highlighting:
               - Common themes in responses
               - Notable suggestions or solutions
               - Areas of agreement/disagreement
            
            Return the analysis in this JSON format:
            {
              "title": "post title",
              "content": "comprehensive summary of the original post",
              "comments": ["summary of key response 1", "summary of key response 2", ...]
            }`
          },
          {
            role: 'user',
            content: `Please analyze this Reddit post and summarize its content: ${url}`
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
