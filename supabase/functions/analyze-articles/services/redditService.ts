
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

    // Check if it's a search URL
    if (urlObj.pathname.includes('/search/')) {
      return {
        title: 'Reddit Search Results',
        content: `Search query: ${urlObj.searchParams.get('q') || 'Not specified'}`,
        comments: []
      };
    }

    // Extract post ID from URL
    const postId = extractRedditPostId(url);
    if (!postId) {
      throw new Error('Invalid Reddit post URL - please provide a direct link to a Reddit post');
    }

    console.log('[Reddit] Extracted post ID:', postId);

    // Fetch Reddit post data with proper headers and retries
    const maxRetries = 3;
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(`https://www.reddit.com/comments/${postId}.json`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          console.error(`[Reddit] API response status (attempt ${attempt + 1}):`, response.status);
          const errorText = await response.text();
          console.error(`[Reddit] API response text (attempt ${attempt + 1}):`, errorText);
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
        console.error(`[Reddit] Attempt ${attempt + 1} failed:`, error);
        lastError = error;
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        throw error;
      }
    }

    throw lastError || new Error('Failed to fetch Reddit post after retries');
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
