
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
    const postId = extractRedditPostId(url);
    if (!postId) {
      throw new Error('Invalid Reddit URL');
    }

    console.log('[Reddit] Extracted post ID:', postId);

    // Fetch Reddit post data with proper headers
    const response = await fetch(`https://www.reddit.com/comments/${postId}.json`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOAnalyzer/1.0)',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('[Reddit] API response status:', response.status);
      console.error('[Reddit] API response text:', await response.text());
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

// Helper function to extract post ID from various Reddit URL formats
function extractRedditPostId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (!urlObj.hostname.includes('reddit.com')) {
      return null;
    }

    // Handle different Reddit URL formats
    const patterns = [
      /\/comments\/([a-zA-Z0-9]+)/,  // Standard post URL
      /\/r\/[^/]+\/comments\/([a-zA-Z0-9]+)/, // Subreddit post URL
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  } catch (error) {
    console.error('[Reddit] Error parsing URL:', error);
    return null;
  }
}
