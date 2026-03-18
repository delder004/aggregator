/**
 * YouTube transcript fetcher using the Supadata.ai API.
 *
 * Returns the concatenated transcript text for a given YouTube video ID,
 * or null if the transcript is unavailable or an error occurs.
 */

const SUPADATA_API_BASE = 'https://api.supadata.ai/v1/transcript';
const MAX_TRANSCRIPT_LENGTH = 10000;

interface SupadataTranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}

interface SupadataTranscriptResponse {
  lang: string;
  content: SupadataTranscriptSegment[];
}

/**
 * Fetch the transcript for a YouTube video using the Supadata.ai API.
 *
 * @param videoId - The YouTube video ID (e.g., "dQw4w9WgXcQ")
 * @param apiKey - The Supadata.ai API key
 * @returns The concatenated transcript text (truncated to 10000 chars), or null on failure
 */
export async function fetchYouTubeTranscript(
  videoId: string,
  apiKey: string
): Promise<string | null> {
  try {
    const url = `${SUPADATA_API_BASE}?url=https://youtu.be/${encodeURIComponent(videoId)}`;

    const response = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(
        `[Transcript] Supadata API returned ${response.status} for video ${videoId}`
      );
      return null;
    }

    const data: SupadataTranscriptResponse = await response.json();

    if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
      console.log(`[Transcript] No transcript content for video ${videoId}`);
      return null;
    }

    // Concatenate all text segments with spaces
    const fullText = data.content
      .map((segment) => segment.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!fullText) {
      return null;
    }

    // Truncate to max length
    if (fullText.length > MAX_TRANSCRIPT_LENGTH) {
      return fullText.slice(0, MAX_TRANSCRIPT_LENGTH);
    }

    return fullText;
  } catch (error) {
    console.error(`[Transcript] Error fetching transcript for video ${videoId}:`, error);
    return null;
  }
}
