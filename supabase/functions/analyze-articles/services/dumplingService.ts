
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

async function logTranscriptAttempt(videoId: string, videoUrl: string, serviceName: string, responseStatus: number | null, responseBody: string | null, successful: boolean) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    console.error('[DumplingAI] Missing Supabase credentials for logging');
    return;
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/transcript_extraction_logs`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        video_id: videoId,
        video_url: videoUrl,
        service_name: serviceName,
        response_status: responseStatus,
        response_body: responseBody,
        successful
      })
    });

    if (!response.ok) {
      console.error('[DumplingAI] Failed to log transcript attempt:', await response.text());
    }
  } catch (error) {
    console.error('[DumplingAI] Error logging transcript attempt:', error);
  }
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

    // Try multiple transcript services in sequence
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
              'Accept': 'application/json',
              'Accept-Language': 'en-US,en;q=0.9',  // Add language header
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'  // Add User-Agent header
            },
            body: JSON.stringify({ 
              url,
              videoId,
              language: 'en', // Explicitly request English transcript
              format: 'text',
              timestamps: true
            })
          });

          const responseBody = await response.text();
          await logTranscriptAttempt(videoId, url, service.name, response.status, responseBody, response.ok);

          if (response.ok) {
            const data = JSON.parse(responseBody);
            if (data.transcript || data.text) {
              return {
                title: metadata.title || data.title,
                text: data.transcript || data.text,
                segments: data.segments || []
              };
            }
          } else {
            console.log(`[DumplingAI] ${service.name} response not ok:`, responseBody);
          }
        } else {
          // YouTube Direct attempt
          const pageResponse = await fetch(service.endpoint, {
            headers: {
              'Accept-Language': 'en-US,en;q=0.9',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });
          const html = await pageResponse.text();
          
          await logTranscriptAttempt(videoId, url, service.name, pageResponse.status, 
            'HTML length: ' + html.length + ' bytes', false);

          // Look for caption tracks in the YouTube page
          const captionMatch = html.match(/"captionTracks":\[(.*?)\]/);
          if (captionMatch) {
            console.log('[DumplingAI] Found caption tracks in YouTube page');
            const captionData = JSON.parse(`[${captionMatch[1]}]`);
            console.log('[DumplingAI] Caption tracks:', captionData);
            
            const englishTrack = captionData.find((track: any) => 
              track.languageCode === 'en' || track.vssId?.includes('.en')
            );
            
            if (englishTrack?.baseUrl) {
              console.log('[DumplingAI] Found English caption track:', englishTrack);
              const transcriptResponse = await fetch(englishTrack.baseUrl);
              const transcriptXml = await transcriptResponse.text();
              
              await logTranscriptAttempt(videoId, url, 'YouTube Captions API', 
                transcriptResponse.status, transcriptXml, transcriptResponse.ok);
              
              // Basic XML parsing to extract text
              const textContent = transcriptXml
                .match(/<text[^>]*>(.*?)<\/text>/g)
                ?.map(line => line.replace(/<[^>]+>/g, '').trim())
                .filter(Boolean)
                .join('\n');

              if (textContent) {
                return {
                  title: metadata.title,
                  text: textContent,
                  segments: []
                };
              }
            }
          }
        }
      } catch (error) {
        console.error(`[DumplingAI] ${service.name} attempt failed:`, error);
        await logTranscriptAttempt(videoId, url, service.name, null, 
          error instanceof Error ? error.message : 'Unknown error', false);
      }
    }

    // If all attempts fail, return basic metadata
    console.log('[DumplingAI] All transcript extraction attempts failed, returning metadata only');
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
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
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
