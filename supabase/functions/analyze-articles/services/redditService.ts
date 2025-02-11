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
      const query = urlObj.searchParams.get('q');
      return {
        title: `Reddit Search: ${query || 'Unknown Query'}`,
        content: `Search query: ${query || 'Not specified'}`,
        comments: []
      };
    }

    // Extract post ID from URL
    const postId = extractRedditPostId(url);
    if (!postId) {
      throw new Error('Invalid Reddit post URL - please provide a direct link to a Reddit post');
    }

    console.log('[Reddit] Extracted post ID:', postId);

    // First try old.reddit.com without JSON (more reliable)
    try {
      console.log('[Reddit] Trying old.reddit.com HTML fetch');
      const htmlData = await fetchRedditHtml(postId);
      if (htmlData && htmlData.content && htmlData.content !== 'Content not available') {
        return htmlData;
      }
    } catch (error) {
      console.error('[Reddit] HTML fetch failed:', error);
    }

    // Then try JSON endpoints
    const endpoints = [
      { url: `https://old.reddit.com/comments/${postId}.json`, name: 'old.reddit.com' },
      { url: `https://www.reddit.com/comments/${postId}.json`, name: 'www.reddit.com' },
      { url: `https://reddit.com/comments/${postId}.json`, name: 'reddit.com' }
    ];

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'application/json'
    };

    for (const endpoint of endpoints) {
      try {
        console.log(`[Reddit] Trying ${endpoint.name}`);
        const response = await fetch(endpoint.url, { 
          headers,
          credentials: 'omit'  // Don't send cookies
        });

        if (!response.ok) {
          console.error(`[Reddit] ${endpoint.name} returned ${response.status}`);
          continue;
        }

        const data = await response.json();
        const post = data[0]?.data?.children[0]?.data;
        
        if (!post) {
          console.error(`[Reddit] No post data from ${endpoint.name}`);
          continue;
        }

        // Extract comments
        const comments = data[1]?.data?.children
          ?.map((comment: any) => comment?.data?.body)
          .filter(Boolean)
          .slice(0, 10);

        const content = [
          post.title,
          post.selftext || '',
          ...(comments || [])
        ].filter(Boolean).join('\n\n');

        return {
          title: post.title,
          content: content || 'No content available',
          comments
        };
      } catch (error) {
        console.error(`[Reddit] ${endpoint.name} attempt failed:`, error);
      }
    }

    // If all attempts fail, try HTML scraping one last time
    return await fetchRedditHtml(postId);
  } catch (error) {
    console.error('[Reddit] Error analyzing post:', error);
    throw error;
  }
}

async function fetchRedditHtml(postId: string): Promise<RedditContent> {
  const urls = [
    { url: `https://old.reddit.com/comments/${postId}`, name: 'old.reddit.com' },
    { url: `https://www.reddit.com/comments/${postId}`, name: 'www.reddit.com' }
  ];

  for (const endpoint of urls) {
    try {
      console.log(`[Reddit] Trying HTML fetch from ${endpoint.name}`);
      const response = await fetch(endpoint.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html'
        },
        credentials: 'omit'  // Don't send cookies
      });

      if (!response.ok) {
        console.error(`[Reddit] HTML fetch from ${endpoint.name} failed with ${response.status}`);
        continue;
      }

      const html = await response.text();
      
      // Extract title
      const titleMatch = html.match(/<title>([^<]*)<\/title>/);
      const title = titleMatch ? 
        titleMatch[1].replace(' : reddit.com', '').trim() : 
        'Reddit Post';
      
      // Extract post content
      const contentMatch = html.match(/<div class="usertext-body[^>]*>(.*?)<\/div>/s);
      const contentText = contentMatch ? 
        contentMatch[1].replace(/<[^>]+>/g, '').trim() : 
        '';

      // Extract comments
      const commentMatches = html.match(/<div class="usertext-body[^>]*>(.*?)<\/div>/g) || [];
      const comments = commentMatches
        .slice(1) // Skip the first match (post content)
        .map(match => match.replace(/<[^>]+>/g, '').trim())
        .filter(Boolean)
        .slice(0, 10);

      const content = [title, contentText, ...comments].filter(Boolean).join('\n\n');
      
      if (content && content !== title) {
        return { title, content, comments };
      }
    } catch (error) {
      console.error(`[Reddit] HTML parsing for ${endpoint.name} failed:`, error);
    }
  }

  // If everything fails, return a basic response
  return {
    title: `Reddit Post (${postId})`,
    content: 'Content unavailable - Reddit may be blocking access to this post.',
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
