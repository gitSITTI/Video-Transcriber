import { TranscriptionChunk } from '../types';

interface AudioProcessingResult {
  fullTranscription: string;
}

/**
 * Transcribes an audio Blob using the OpenAI Whisper API.
 * This function is designed for non-streaming transcription, sending the entire audio file at once.
 *
 * @param openaiApiKey The OpenAI API key provided by the user.
 * @param audioBlob The audio data as a Blob (e.g., WAV format).
 * @param onTranscriptionUpdate Callback function to update UI with the final transcription.
 * @param onProgressUpdate Callback function to update UI with transcription progress (0-100%).
 * @returns A Promise that resolves with the full transcription string.
 */
export async function transcribeWithWhisper(
  openaiApiKey: string, // Accept API key as an argument
  audioBlob: Blob,
  onTranscriptionUpdate: (chunk: TranscriptionChunk) => void,
  onProgressUpdate: (progress: number) => void,
): Promise<AudioProcessingResult> {
  onProgressUpdate(0); // Start progress at 0%

  if (!openaiApiKey) {
    throw new Error('OpenAI API key is missing. Please provide your key to use Whisper.');
  }

  try {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav'); // Assuming WAV format for the blob
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text'); // Request plain text response

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`, // Use the provided API key
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const transcription = await response.text();

    onTranscriptionUpdate({ text: transcription, isFinal: true });
    onProgressUpdate(100); // Complete progress at 100%

    return { fullTranscription: transcription };
  } catch (error) {
    console.error('Error transcribing with OpenAI Whisper:', error);
    onProgressUpdate(0); // Reset progress on error
    throw new Error(`Failed to transcribe with Whisper: ${error instanceof Error ? error.message : String(error)}`);
  }
}
