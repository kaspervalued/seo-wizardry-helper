
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
  
  try {
    const response = await fetch('https://api.dumplingai.com/v1/youtube/transcript', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${dumplingApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DumplingAI] API error:', errorText);
      throw new Error(`DumplingAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[DumplingAI] Successfully fetched transcript');

    return {
      title: data.title,
      text: data.transcript || data.text,
      segments: data.segments,
    };
  } catch (error) {
    console.error('[DumplingAI] Error fetching transcript:', error);
    throw error;
  }
}
