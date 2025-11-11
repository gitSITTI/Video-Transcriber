export const GEMINI_LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';
export const GEMINI_SUMMARIZER_MODEL = 'gemini-2.5-flash';
export const TARGET_SAMPLE_RATE = 16000; // Required by Gemini Live API
export const AUDIO_CHUNK_SIZE = 4096; // Number of samples per chunk for processing
export const SEND_INTERVAL_MS = 200; // How often to send audio chunks to the live API