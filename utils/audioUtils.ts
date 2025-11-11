import { TARGET_SAMPLE_RATE } from '../constants';

/**
 * Decodes a base64 string into a Uint8Array.
 * @param base64 The base64 string to decode.
 * @returns The decoded Uint8Array.
 */
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  // Fix: Declare bytes as a Uint8Array
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

/**
 * Formats a duration in seconds into a MM:SS string.
 * @param seconds The duration in seconds.
 * @returns The formatted duration string (e.g., "02:30").
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) {
    return '00:00';
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  const pad = (num: number) => num.toString().padStart(2, '0');
  return `${pad(minutes)}:${pad(remainingSeconds)}`;
}

/**
 * Creates a WAV audio Blob from an AudioBuffer.
 * @param audioBuffer The AudioBuffer to convert.
 * @returns A Blob containing the WAV audio data.
 */
export function createWavBlobFromAudioBuffer(audioBuffer: AudioBuffer): Blob {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16; // 16-bit PCM

  let totalLength = audioBuffer.length * numberOfChannels * (bitDepth / 8);
  let buffer = new ArrayBuffer(44 + totalLength); // 44 bytes for header

  let view = new DataView(buffer);
  let offset = 0;

  /* RIFF identifier */
  writeString(view, offset, 'RIFF'); offset += 4;
  /* file length */
  view.setUint32(offset, 36 + totalLength, true); offset += 4;
  /* RIFF type */
  writeString(view, offset, 'WAVE'); offset += 4;
  /* format chunk identifier */
  writeString(view, offset, 'fmt '); offset += 4;
  /* format chunk length */
  view.setUint32(offset, 16, true); offset += 4;
  /* sample format (raw) */
  view.setUint16(offset, format, true); offset += 2;
  /* channel count */
  view.setUint16(offset, numberOfChannels, true); offset += 2;
  /* sample rate */
  view.setUint32(offset, sampleRate, true); offset += 4;
  /* byte rate (sampleRate * blockAlign) */
  view.setUint32(offset, sampleRate * numberOfChannels * (bitDepth / 8), true); offset += 4;
  /* block align (channelCount * bytesPerSample) */
  view.setUint16(offset, numberOfChannels * (bitDepth / 8), true); offset += 2;
  /* bits per sample */
  view.setUint16(offset, bitDepth, true); offset += 2;
  /* data chunk identifier */
  writeString(view, offset, 'data'); offset += 4;
  /* data chunk length */
  view.setUint32(offset, totalLength, true); offset += 4;

  // Write audio data
  let dataOffset = offset;
  for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
    const channelData = audioBuffer.getChannelData(i);
    for (let j = 0; j < channelData.length; j++) {
      // Convert float to 16-bit signed integer
      let s = Math.max(-1, Math.min(1, channelData[j]));
      s = s < 0 ? s * 0x8000 : s * 0x7FFF; // Scale to Int16 range
      view.setInt16(dataOffset, s, true);
      dataOffset += 2; // 2 bytes for 16-bit
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}