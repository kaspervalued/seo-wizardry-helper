
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

interface RedditContent {
  title: string;
  content: string;
  comments?: string[];
}

export async function analyzeRedditPost(url: string): Promise<RedditContent> {
  console.log('[Reddit] Analyzing post:', url);
  
  try {
    // Extract post ID from URL
    const postId = url.split('/comments/')[1]?.split('/')[0];
    if (!postId) {
      throw new Error('Invalid Reddit URL');
    }

    // Fetch Reddit post data
    const response = await fetch(`https://www.reddit.com/comments/${postId}.json`);
    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status}`);
    }

    const data = await response.json();
    const post = data[0]?.data?.children[0]?.data;
    
    if (!post) {
      throw new Error('Could not fetch Reddit post data');
    }

    // Extract comments
    const comments = data[1]?.data?.children
      ?.map((comment: any) => comment?.data?.body)
      .filter(Boolean)
      .slice(0, 10); // Get top 10 comments

    const content = [
      post.selftext || '',
      ...(comments || [])
    ].join('\n\n');

    return {
      title: post.title,
      content,
      comments,
    };
  } catch (error) {
    console.error('[Reddit] Error analyzing post:', error);
    throw error;
  }
}
