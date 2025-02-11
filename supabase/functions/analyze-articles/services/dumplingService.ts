const dumplingApiKey = Deno.env.get('DUMPLING_API_KEY');

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

interface TranscriptResponse {
  title?: string;
  text: string;
  segments?: TranscriptSegment[];
}

export async function getYoutubeTranscript(url: string): Promise<TranscriptResponse> {
  console.log('[DumplingAI] Fetching transcript for:', url);
  
  if (!dumplingApiKey) {
    throw new Error('DUMPLING_API_KEY not set');
  }

  try {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    console.log('[DumplingAI] Extracted video ID:', videoId);
    
    // Try alternate endpoints and formats
    const endpoints = [
      'https://api.dumplingai.com/v1/youtube/transcript',
      'https://api.dumplingai.com/v1/transcript',
      'https://api.dumplingai.com/youtube/transcript'
    ];

    let lastError;
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${dumplingApiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          body: JSON.stringify({ 
            url,
            videoId,
            format: 'text'
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[DumplingAI] API error for endpoint ${endpoint}:`, errorText);
          continue;
        }

        const data = await response.json();
        if (!data.transcript && !data.text) {
          console.error(`[DumplingAI] No transcript data for endpoint ${endpoint}`);
          continue;
        }

        console.log('[DumplingAI] Successfully fetched transcript from:', endpoint);
        return {
          title: data.title,
          text: data.transcript || data.text,
          segments: data.segments,
        };
      } catch (error) {
        console.error(`[DumplingAI] Error with endpoint ${endpoint}:`, error);
        lastError = error;
      }
    }

    // If all endpoints failed, try to extract basic video info
    try {
      const fallbackData = await fetchBasicVideoInfo(videoId);
      if (fallbackData) {
        return fallbackData;
      }
    } catch (error) {
      console.error('[DumplingAI] Fallback extraction failed:', error);
    }

    throw lastError || new Error('Failed to fetch transcript from all endpoints');
  } catch (error) {
    console.error('[DumplingAI] Error fetching transcript:', error);
    throw error;
  }
}

async function fetchBasicVideoInfo(videoId: string): Promise<TranscriptResponse> {
  const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
  const html = await response.text();
  
  // Extract title from meta tags
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  const title = titleMatch ? titleMatch[1].replace(' - YouTube', '') : '';
  
  return {
    title,
    text: `Video ID: ${videoId}\nTitle: ${title}\n(Transcript not available)`,
    segments: []
  };
}

// Helper function to extract video ID from various YouTube URL formats
function extractYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    if (!hostname.includes('youtube.com') && !hostname.includes('youtu.be')) {
      return null;
    }

    // Handle youtu.be URLs
    if (hostname.includes('youtu.be')) {
      return urlObj.pathname.substring(1);
    }

    // Handle youtube.com URLs
    const videoParam = urlObj.searchParams.get('v');
    if (videoParam) {
      return videoParam;
    }

    // Handle other formats
    const patterns = [
      /^\/embed\/([^/?]+)/,
      /^\/v\/([^/?]+)/,
      /^\/watch\/([^/?]+)/
    ];

    for (const pattern of patterns) {
      const match = urlObj.pathname.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  } catch (error) {
    console.error('[YouTube] Error parsing URL:', error);
    return null;
  }
}
