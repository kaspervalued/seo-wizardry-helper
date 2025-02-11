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
    
    // First, try to get video metadata from YouTube
    const metadata = await fetchYouTubeMetadata(videoId);
    console.log('[DumplingAI] Fetched metadata:', metadata);

    // Try transcript services
    const services = [
      { name: 'DumplingAI', endpoint: 'https://api.dumplingai.com/v1/youtube/transcript' },
      { name: 'DumplingAI Alt', endpoint: 'https://api.dumplingai.com/v1/transcript' },
      { name: 'YouTube Direct', endpoint: `https://www.youtube.com/watch?v=${videoId}` }
    ];

    for (const service of services) {
      try {
        console.log(`[DumplingAI] Trying ${service.name}...`);
        
        if (service.name.includes('DumplingAI')) {
          const response = await fetch(service.endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${dumplingApiKey}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({ 
              url,
              videoId,
              format: 'text'
            })
          });

          if (response.ok) {
            const data = await response.json();
            if (data.transcript || data.text) {
              return {
                title: metadata.title || data.title,
                text: data.transcript || data.text,
                segments: data.segments || []
              };
            }
          }
        } else {
          // Fallback to basic metadata
          return {
            title: metadata.title,
            text: `Title: ${metadata.title}\nDescription: ${metadata.description || 'No description available'}\n\nNote: Full transcript could not be retrieved. Video metadata shown instead.`,
            segments: []
          };
        }
      } catch (error) {
        console.error(`[DumplingAI] ${service.name} attempt failed:`, error);
      }
    }

    // If all attempts fail, return basic metadata
    return {
      title: metadata.title,
      text: `Title: ${metadata.title}\nDescription: ${metadata.description || 'No description available'}\n\nNote: Transcript service unavailable. Video metadata shown instead.`,
      segments: []
    };
  } catch (error) {
    console.error('[DumplingAI] Error fetching transcript:', error);
    throw error;
  }
}

async function fetchYouTubeMetadata(videoId: string) {
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
    const html = await response.text();
    
    // Extract title
    const titleMatch = html.match(/<title>([^<]*)<\/title>/);
    const title = titleMatch ? 
      titleMatch[1].replace(' - YouTube', '').trim() : 
      'Untitled Video';

    // Extract description
    const descMatch = html.match(/<meta name="description" content="([^"]*)">/);
    const description = descMatch ? 
      descMatch[1].trim() : 
      '';

    return { title, description };
  } catch (error) {
    console.error('[YouTube] Error fetching metadata:', error);
    return { 
      title: `YouTube Video (${videoId})`,
      description: 'Description unavailable'
    };
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
