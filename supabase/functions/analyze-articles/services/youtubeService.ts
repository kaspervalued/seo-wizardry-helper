
const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY');

if (!youtubeApiKey) {
  console.error('Missing YouTube API key');
  throw new Error('YOUTUBE_API_KEY not set');
}

interface YouTubeCaption {
  id: string;
  language: string;
  name: string;
}

interface YouTubeTranscript {
  text: string;
  duration: number;
  offset: number;
}

export async function getVideoMetadata(videoId: string) {
  console.log('[YouTube] Fetching metadata for video:', videoId);
  
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${youtubeApiKey}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch video metadata: ${await response.text()}`);
  }

  const data = await response.json();
  if (!data.items?.[0]) {
    throw new Error('Video not found or is private');
  }

  const snippet = data.items[0].snippet;
  return {
    title: snippet.title,
    description: snippet.description,
    publishedAt: snippet.publishedAt,
    channelTitle: snippet.channelTitle,
  };
}

export async function getTranscript(videoId: string): Promise<string> {
  console.log('[YouTube] Getting transcript for video:', videoId);

  try {
    // First check if we have a cached version
    const { supabase } = await import('../supabaseClient.ts');
    const { data: cachedVideo } = await supabase
      .from('youtube_video_metadata')
      .select('transcript, title, description')
      .eq('video_id', videoId)
      .maybeSingle();

    if (cachedVideo?.transcript) {
      console.log('[YouTube] Using cached transcript for:', videoId);
      return cachedVideo.transcript;
    }

    // Get video metadata first
    const metadata = await getVideoMetadata(videoId);
    
    // For now, use a simpler approach with just title and description
    // since the captions API requires OAuth2 with additional scopes
    const fallbackText = `Title: ${metadata.title}\n\nDescription: ${metadata.description}`;
    
    // Cache the result
    await supabase.from('youtube_video_metadata').upsert({
      video_id: videoId,
      title: metadata.title,
      description: metadata.description,
      transcript: fallbackText,
      language_code: 'en',
    });

    return fallbackText;

  } catch (error) {
    console.error('[YouTube] Error getting transcript:', error);
    throw error;
  }
}

export function extractVideoId(url: string): string {
  try {
    const urlObj = new URL(url);
    let videoId = '';

    if (urlObj.hostname === 'youtu.be') {
      videoId = urlObj.pathname.slice(1);
    } else if (urlObj.hostname.includes('youtube.com')) {
      videoId = urlObj.searchParams.get('v') || '';
    }

    if (!videoId) {
      throw new Error('Could not extract video ID from URL');
    }

    return videoId;
  } catch (error) {
    console.error('[YouTube] Error extracting video ID:', error);
    throw error;
  }
}
