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

    // Try different Reddit API endpoints
    const endpoints = [
      `https://www.reddit.com/comments/${postId}.json`,
      `https://old.reddit.com/comments/${postId}.json`,
      `https://reddit.com/comments/${postId}.json`
    ];

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Connection': 'keep-alive'
    };

    let lastError;
    for (const endpoint of endpoints) {
      try {
        console.log(`[Reddit] Trying endpoint: ${endpoint}`);
        const response = await fetch(endpoint, { headers });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Reddit] API error for ${endpoint}:`, errorText);
          continue;
        }

        const data = await response.json();
        const post = data[0]?.data?.children[0]?.data;
        
        if (!post) {
          console.error(`[Reddit] No post data from ${endpoint}`);
          continue;
        }

        // Extract comments
        const comments = data[1]?.data?.children
          ?.map((comment: any) => comment?.data?.body)
          .filter(Boolean)
          .slice(0, 10);

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
        console.error(`[Reddit] Error with endpoint ${endpoint}:`, error);
        lastError = error;
      }
    }

    // If all endpoints fail, try to fetch using old.reddit.com HTML
    try {
      console.log('[Reddit] Attempting fallback to HTML scraping');
      const fallbackData = await fetchRedditHtml(postId);
      if (fallbackData) {
        return fallbackData;
      }
    } catch (error) {
      console.error('[Reddit] Fallback scraping failed:', error);
    }

    throw lastError || new Error('Failed to fetch Reddit post from all endpoints');
  } catch (error) {
    console.error('[Reddit] Error analyzing post:', error);
    throw error;
  }
}

async function fetchRedditHtml(postId: string): Promise<RedditContent> {
  const response = await fetch(`https://old.reddit.com/comments/${postId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  });
  
  const html = await response.text();
  
  // Basic HTML parsing
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  const title = titleMatch ? 
    titleMatch[1].replace(' : reddit.com', '').trim() : 
    'Reddit Post';
  
  // Extract post content
  const contentMatch = html.match(/<div class="usertext-body[^>]*>(.*?)<\/div>/s);
  const content = contentMatch ? 
    contentMatch[1].replace(/<[^>]+>/g, '').trim() : 
    'Content not available';
  
  return {
    title,
    content,
    comments: []
  };
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
