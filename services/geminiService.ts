import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import {
  GEMINI_LIVE_MODEL,
  GEMINI_SUMMARIZER_MODEL,
  TARGET_SAMPLE_RATE,
  AUDIO_CHUNK_SIZE,
  SEND_INTERVAL_MS,
  SESSION_CLOSE_DELAY_MS, // New import
} from '../constants';
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
  let intervalId: number | undefined; // ID for the audio sending interval
  let sessionClosureTimeoutId: number | undefined; // ID for the fallback session closure timeout
  let sentAudioLength = 0; // Track how much audio has been sent
  let allInputAudioSent = false; // Flag to indicate if all audio has been sent

  return new Promise<AudioProcessingResult>(async (resolve, reject) => {
    let session: Awaited<ReturnType<typeof ai.live.connect>> | undefined; // Initialize as undefined

    // Centralized cleanup function to clear all timers and close session
    const cleanup = () => {
      console.log('Performing cleanup: Clearing timers and closing session (if active).');
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
      if (sessionClosureTimeoutId !== undefined) {
        clearTimeout(sessionClosureTimeoutId);
        sessionClosureTimeoutId = undefined;
      }
      // Note: session.close() is typically handled by onclose callback or explicit calls.
      // We don't want to call it here if onclose is about to be called naturally.
    };

    const cleanupAndReject = (error: any) => {
      console.error('Transcription failed, cleaning up and rejecting:', error);
      cleanup();
      if (session) {
        // Ensure session is closed if an error occurs before onclose
        try {
          session.close();
        } catch (closeError) {
          console.error('Error closing session during rejection:', closeError);
        }
      }
      reject(error);
    };

    const cleanupAndResolve = (fullTranscription: string) => {
      console.log('Transcription finished, cleaning up and resolving.');
      cleanup();
      onProgressUpdate(100); // Ensure progress ends at 100%
      resolve({ fullTranscription });
    };

    try {
      session = await ai.live.connect({
        model: GEMINI_LIVE_MODEL,
        callbacks: {
          onopen: () => {
            console.log('Gemini Live session opened.');
            let currentOffset = 0;
            intervalId = window.setInterval(() => {
              if (currentOffset >= audioDataBuffer.length) {
                if (intervalId !== undefined) clearInterval(intervalId); // Stop sending interval
                console.log('Finished sending all audio chunks to Gemini Live.');
                allInputAudioSent = true; // All audio input has been sent

                // Start a fallback timeout to close the session if turnComplete doesn't arrive
                sessionClosureTimeoutId = window.setTimeout(() => {
                  console.log('Session closure timeout reached. Force-closing session.');
                  // Only close if the session hasn't been closed by turnComplete yet
                  if (session) session.close();
                }, SESSION_CLOSE_DELAY_MS);
                return;
              }

              const endOffset = Math.min(
                currentOffset + AUDIO_CHUNK_SIZE,
                audioDataBuffer.length,
              );
              const chunk = audioDataBuffer.slice(currentOffset, endOffset);
              const pcmBlob = createPcmBlob(chunk);

              try {
                if (session) session.sendRealtimeInput({ media: pcmBlob });
                currentOffset = endOffset;
                sentAudioLength = currentOffset; // Update sent length
                onProgressUpdate((sentAudioLength / audioDataBuffer.length) * 100);
              } catch (sendError) {
                console.error('Error sending audio chunk to Gemini Live:', sendError);
                cleanupAndReject(sendError);
              }
            }, SEND_INTERVAL_MS);
          },
          onmessage: (message: LiveServerMessage) => {
            console.log('Received message from Gemini Live:', message); // Log entire message for debugging

            let currentTurnIsComplete = false;

            if (message.serverContent?.inputTranscription) {
              // Fix: inputTranscription does not have isFinal. Accumulate text.
              latestNonFinalText += message.serverContent.inputTranscription.text;
            }

            // Important: Use turnComplete to signal the definitive end of the current interaction
            if (message.serverContent?.turnComplete) {
              currentTurnIsComplete = true;
              console.log('Gemini Live turn complete detected.');
              if (sessionClosureTimeoutId !== undefined) clearTimeout(sessionClosureTimeoutId); // Clear fallback timeout

              // Move accumulated non-final text to final segments if a turn completes
              if (latestNonFinalText.trim() !== '') {
                finalTranscriptionSegments.push(latestNonFinalText.trim());
                latestNonFinalText = ''; // Reset for the next turn
              }

              // Explicitly close the session if all input audio has been sent and turn is complete.
              // The onclose callback will then resolve the promise.
              if (allInputAudioSent && session) {
                console.log('All input audio sent and turn complete, closing session.');
                session.close();
              }
            }

            // Construct the full text for display: final segments + latest non-final (if any)
            const currentFullTextForDisplay =
              finalTranscriptionSegments.join(' ') +
              (latestNonFinalText ? ' ' + latestNonFinalText : '');

            // Only update UI if there's meaningful text or if it's the final update of a turn
            if (currentFullTextForDisplay.trim() !== '' || currentTurnIsComplete) {
              onTranscriptionUpdate({
                text: currentFullTextForDisplay.trim(),
                // Fix: isFinal is true only when the turn is explicitly marked complete by the API
                isFinal: currentTurnIsComplete,
              });
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Gemini Live session error:', e);
            cleanupAndReject(new Error(`Transcription failed: ${e.message}`));
          },
          onclose: (e: CloseEvent) => {
            console.log('Gemini Live session closed:', e);
            // This callback is always called when session.close() is invoked.
            // It's the final point to resolve the promise.
            const fullTranscription = finalTranscriptionSegments.join(' ').trim();
            console.log('Final accumulated transcription (onclose):', fullTranscription);
            cleanupAndResolve(fullTranscription);
          },
        },
        config: {
          // Fix: Use Modality.AUDIO from the SDK
          responseModalities: [Modality.AUDIO], // Even though we only care about text, audio is required.
          inputAudioTranscription: {}, // Enable transcription for user input audio.
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
        },
      });
    } catch (error) {
      console.error('Failed to connect to Gemini Live session:', error);
      // If connection fails, session might not be initialized, so check before trying to close.
      cleanupAndReject(error);
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