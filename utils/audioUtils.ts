import { TARGET_SAMPLE_RATE } from '../constants';

/**
 * Decodes a base64 string into a Uint8Array.
 * @param base64 The base64 string to decode.
 * @returns The decoded Uint8Array.
 */
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encodes a Uint8Array into a base64 string.
 * @param bytes The Uint8Array to encode.
 * @returns The base64 encoded string.
 */
export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Creates a PCM audio blob suitable for the Gemini Live API from Float32Array data.
 * Converts Float32Array to Int16Array and then base64 encodes it.
 * @param float32Data The audio data as a Float32Array.
 * @returns An object conforming to Blob interface for Gemini.
 */
export function createPcmBlob(float32Data: Float32Array): { data: string; mimeType: string } {
  const l = float32Data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = Math.min(1, Math.max(-1, float32Data[i])) * 32767; // Scale float to int16 range
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: `audio/pcm;rate=${TARGET_SAMPLE_RATE}`,
  };
}

/**
 * Resamples an AudioBuffer to a target sample rate.
 * @param audioBuffer The original AudioBuffer.
 * @param targetSampleRate The desired sample rate.
 * @returns A Promise that resolves with the resampled AudioBuffer.
 */
export async function resampleAudioBuffer(
  audioBuffer: AudioBuffer,
  targetSampleRate: number,
): Promise<AudioBuffer> {
  const sourceSampleRate = audioBuffer.sampleRate;
  if (sourceSampleRate === targetSampleRate) {
    return audioBuffer;
  }

  const numberOfChannels = audioBuffer.numberOfChannels;
  const originalLength = audioBuffer.length;
  const resampledLength = Math.ceil(originalLength * (targetSampleRate / sourceSampleRate));

  const offlineContext = new OfflineAudioContext(
    numberOfChannels,
    resampledLength,
    targetSampleRate,
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineContext.destination);
  source.start(0);

  return offlineContext.startRendering();
}

/**
 * Extracts the audio track from a video file and returns it as an AudioBuffer.
 * Uses a standard AudioContext to decode the audio data.
 * @param file The video File object.
 * @returns A Promise that resolves with the AudioBuffer containing the video's audio.
 */
export async function extractAudioBufferFromVideoFile(file: File): Promise<AudioBuffer> {
  // Fix: Use standard AudioContext and remove deprecated webkitAudioContext
  const audioContext = new AudioContext();
  const arrayBuffer = await file.arrayBuffer();
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBuffer;
  } catch (error) {
    console.error("Error decoding audio data from video file:", error);
    throw new Error("Failed to decode audio from video file. Please ensure it's a valid video format.");
  } finally {
    // It's good practice to close contexts when no longer needed, though for decodeAudioData,
    // the context often remains active implicitly until its resources are garbage collected.
    // For single-shot decoding, not strictly necessary to close immediately.
  }
}