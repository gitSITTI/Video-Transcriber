import { GoogleGenAI, LiveServerMessage } from '@google/genai';
import { GEMINI_LIVE_MODEL, GEMINI_SUMMARIZER_MODEL, TARGET_SAMPLE_RATE, AUDIO_CHUNK_SIZE, SEND_INTERVAL_MS } from '../constants';
import { createPcmBlob, encode, decode } from '../utils/audioUtils';
import { TranscriptionChunk } from '../types';

interface AudioProcessingResult {
  fullTranscription: string;
}

/**
 * Transcribes an array of Float32Array audio chunks using the Gemini Live API.
 * The function simulates real-time streaming by sending chunks at intervals.
 *
 * @param audioDataBuffer The complete Float32Array of audio data (resampled to TARGET_SAMPLE_RATE).
 * @param onTranscriptionUpdate Callback function to update UI with partial and final transcription.
 * @param onProgressUpdate Callback function to update UI with transcription progress (0-100%).
 * @returns A Promise that resolves with the full transcription string.
 */
export async function transcribeAudioStream(
  audioDataBuffer: Float32Array,
  onTranscriptionUpdate: (chunk: TranscriptionChunk) => void,
  onProgressUpdate: (progress: number) => void,
): Promise<AudioProcessingResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  let finalTranscriptionSegments: string[] = []; // Store final segments
  let latestNonFinalText = ''; // Track latest non-final text for UI
  let intervalId: number | undefined;
  let sentAudioLength = 0; // Track how much audio has been sent
  let allInputAudioSent = false; // Flag to indicate if all audio has been sent

  return new Promise<AudioProcessingResult>(async (resolve, reject) => {
    let session: Awaited<ReturnType<typeof ai.live.connect>>;

    try {
      session = await ai.live.connect({
        model: GEMINI_LIVE_MODEL,
        callbacks: {
          onopen: () => {
            console.log('Gemini Live session opened.');
            let currentOffset = 0;
            intervalId = window.setInterval(() => {
              if (currentOffset >= audioDataBuffer.length) {
                clearInterval(intervalId);
                console.log('Finished sending all audio chunks to Gemini Live.');
                allInputAudioSent = true; // All audio input has been sent
                // DO NOT close session here. Wait for model's final response or turnComplete.
                return;
              }

              const endOffset = Math.min(
                currentOffset + AUDIO_CHUNK_SIZE,
                audioDataBuffer.length,
              );
              const chunk = audioDataBuffer.slice(currentOffset, endOffset);
              const pcmBlob = createPcmBlob(chunk);

              try {
                session.sendRealtimeInput({ media: pcmBlob });
                currentOffset = endOffset;
                sentAudioLength = currentOffset; // Update sent length
                onProgressUpdate((sentAudioLength / audioDataBuffer.length) * 100);
              } catch (sendError) {
                console.error('Error sending audio chunk to Gemini Live:', sendError);
                clearInterval(intervalId);
                session.close();
                reject(sendError);
              }
            }, SEND_INTERVAL_MS);
          },
          onmessage: (message: LiveServerMessage) => {
            console.log('Received message from Gemini Live:', message); // Log entire message for debugging

            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              const isFinal = message.serverContent.inputTranscription.isFinal || false;

              console.log(`Transcription: "${text}", isFinal: ${isFinal}`);

              if (isFinal) {
                // Only add non-empty final segments
                if (text.trim() !== '') {
                  finalTranscriptionSegments.push(text.trim());
                }
                latestNonFinalText = ''; // Clear non-final text, as it's now part of final or discarded
              } else {
                latestNonFinalText = text; // Update latest non-final text
              }

              // Concatenate for UI update: final segments + latest non-final (if any)
              const currentFullTextForDisplay =
                finalTranscriptionSegments.join(' ') +
                (latestNonFinalText ? ' ' + latestNonFinalText : '');

              onTranscriptionUpdate({ text: currentFullTextForDisplay.trim(), isFinal: isFinal });
            }

            // Important: Use turnComplete to signal the end of the transcription process
            if (allInputAudioSent && message.serverContent?.turnComplete) {
              console.log('Gemini Live turn complete. Closing session.');
              session.close(); // Explicitly close the session when the turn is complete
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Gemini Live session error:', e);
            clearInterval(intervalId);
            session.close();
            reject(new Error(`Transcription failed: ${e.message}`));
          },
          onclose: (e: CloseEvent) => {
            console.log('Gemini Live session closed:', e);
            clearInterval(intervalId);
            // After closing, ensure progress is 100% and resolve with concatenated final segments.
            onProgressUpdate(100);
            const fullTranscription = finalTranscriptionSegments.join(' ').trim();
            console.log('Final accumulated transcription:', fullTranscription);
            resolve({ fullTranscription });
          },
        },
        config: {
          responseModalities: ['AUDIO'], // Even though we only care about text, audio is required.
          inputAudioTranscription: {}, // Enable transcription for user input audio.
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
        },
      });
    } catch (error) {
      console.error('Failed to connect to Gemini Live session:', error);
      clearInterval(intervalId);
      if (session) session.close(); // Ensure session is closed if connection failed early
      reject(error);
    }
  });
}

/**
 * Summarizes a given text using the Gemini Pro model.
 * @param text The text to summarize.
 * @returns A Promise that resolves with the summarized text.
 */
export async function summarizeText(text: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const prompt = `Summarize the following text, which is a transcription of a video, concisely and descriptively. Focus on key topics and information presented.
    Text: """${text}"""
    Summary:`;

    const response = await ai.models.generateContent({
      model: GEMINI_SUMMARIZER_MODEL,
      contents: prompt,
      config: {
        temperature: 0.7,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 500, // Limit summary length
      },
    });

    return response.text;
  } catch (error) {
    console.error('Error summarizing text with Gemini:', error);
    throw new Error('Failed to generate summary.');
  }
}

/**
 * Helper to decode audio data from base64 (e.g., for playing back TTS from Gemini, not used in this app for input).
 * @param data Uint8Array of audio data.
 * @param ctx AudioContext to use for decoding.
 * @param sampleRate Expected sample rate.
 * @param numChannels Number of audio channels.
 * @returns Promise resolving to an AudioBuffer.
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}