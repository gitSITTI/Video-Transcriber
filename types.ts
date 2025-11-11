export enum AppState {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  TRANSCRIBING = 'TRANSCRIBING',
  SUMMARIZING = 'SUMMARIZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface TranscriptionChunk {
  text: string;
  isFinal: boolean;
}

export enum TranscriptionService {
  GEMINI_LIVE = 'GEMINI_LIVE',
  OPENAI_WHISPER = 'OPENAI_WHISPER',
}