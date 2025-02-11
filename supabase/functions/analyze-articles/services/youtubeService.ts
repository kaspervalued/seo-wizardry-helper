
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

export async function getAvailableCaptions(videoId: string): Promise<YouTubeCaption[]> {
  console.log('[YouTube] Fetching available captions for video:', videoId);
  
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${youtubeApiKey}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch captions list: ${await response.text()}`);
  }

  const data = await response.json();
  return (data.items || []).map((item: any) => ({
    id: item.id,
    language: item.snippet.language,
    name: item.snippet.name,
  }));
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

    // Fetch fresh metadata and captions
    const [metadata, captions] = await Promise.all([
      getVideoMetadata(videoId),
      getAvailableCaptions(videoId)
    ]);

    // Find English captions (prefer manual over auto-generated)
    const englishCaptions = captions.filter(cap => 
      cap.language === 'en' || cap.language.startsWith('en-')
    );

    // Sort to prefer manual captions over auto-generated
    const sortedCaptions = englishCaptions.sort((a, b) => {
      const aAuto = a.name.toLowerCase().includes('auto');
      const bAuto = b.name.toLowerCase().includes('auto');
      return aAuto === bAuto ? 0 : aAuto ? 1 : -1;
    });

    if (sortedCaptions.length === 0) {
      console.log('[YouTube] No English captions found, using metadata only');
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
    }

    // Get the transcript for the first available caption track
    const captionId = sortedCaptions[0].id;
    const transcriptResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/captions/${captionId}?key=${youtubeApiKey}`
    );

    if (!transcriptResponse.ok) {
      throw new Error(`Failed to fetch transcript: ${await transcriptResponse.text()}`);
    }

    const transcriptData = await transcriptResponse.json();
    const transcript = transcriptData.text;

    // Cache the successful result
    await supabase.from('youtube_video_metadata').upsert({
      video_id: videoId,
      title: metadata.title,
      description: metadata.description,
      transcript: transcript,
      language_code: 'en',
    });

    return transcript;
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
