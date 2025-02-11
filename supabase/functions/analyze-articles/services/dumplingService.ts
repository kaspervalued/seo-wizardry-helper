
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
    
    // Implement retry logic for DumplingAI API
    const maxRetries = 3;
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch('https://api.dumplingai.com/v1/youtube/transcript', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${dumplingApiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          body: JSON.stringify({ 
            url,
            videoId, // Add video ID explicitly
            format: 'text' // Request plain text format
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[DumplingAI] API error (attempt ${attempt + 1}):`, errorText);
          throw new Error(`DumplingAI API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('[DumplingAI] Successfully fetched transcript');

        if (!data.transcript && !data.text) {
          throw new Error('No transcript available for this video');
        }

        return {
          title: data.title,
          text: data.transcript || data.text,
          segments: data.segments,
        };
      } catch (error) {
        console.error(`[DumplingAI] Attempt ${attempt + 1} failed:`, error);
        lastError = error;
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        throw error;
      }
    }

    throw lastError || new Error('Failed to fetch transcript after retries');
  } catch (error) {
    console.error('[DumplingAI] Error fetching transcript:', error);
    throw error;
  }
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
