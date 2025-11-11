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