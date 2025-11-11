import React, { useState, useCallback, useRef } from 'react';
import VideoUploader from './components/VideoUploader';
import TranscriptionDisplay from './components/TranscriptionDisplay';
import { AppState, TranscriptionChunk } from './types';
import {
  extractAudioBufferFromVideoFile,
  resampleAudioBuffer,
} from './utils/audioUtils';
import { transcribeAudioStream, summarizeText } from './services/geminiService';
import { TARGET_SAMPLE_RATE } from './constants';
import { GoogleGenAI, LiveServerMessage } from '@google/genai';


function App() {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [transcription, setTranscription] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcriptionProgress, setTranscriptionProgress] = useState<number>(0);

  // Using a ref to accumulate transcription chunks for a smoother UI update experience
  // This ref is no longer directly used for accumulation in App.tsx after refactoring transcribeAudioStream
  // but it's fine to keep it if there's other potential future use.
  const currentTranscriptionRef = useRef<string>('');

  const handleTranscriptionUpdate = useCallback((chunk: TranscriptionChunk) => {
    // `text` from `transcribeAudioStream` is now cumulative for display.
    // We simply update the transcription state with the provided text.
    setTranscription(chunk.text);
    currentTranscriptionRef.current = chunk.text; // Keep ref updated for consistency if needed elsewhere
  }, []);

  const handleVideoSelect = useCallback(async (file: File) => {
    setAppState(AppState.UPLOADING);
    setErrorMessage(null);
    setTranscription('');
    setSummary('');
    setTranscriptionProgress(0);
    currentTranscriptionRef.current = ''; // Reset ref

    try {
      // 1. Extract audio from video file
      const audioBuffer = await extractAudioBufferFromVideoFile(file);
      console.log('Original Audio Buffer:', audioBuffer);

      // 2. Resample audio to target sample rate for Gemini Live API
      const resampledAudioBuffer = await resampleAudioBuffer(
        audioBuffer,
        TARGET_SAMPLE_RATE,
      );
      console.log('Resampled Audio Buffer:', resampledAudioBuffer);

      // Get the audio data as a Float32Array
      const audioData = resampledAudioBuffer.getChannelData(0);

      // 3. Transcribe the audio stream using Gemini Live API
      setAppState(AppState.TRANSCRIBING);

      // Call the refactored transcribeAudioStream function
      const transcriptionResult = await transcribeAudioStream(
        audioData,
        handleTranscriptionUpdate, // Callback for displaying intermediate/final transcription
        setTranscriptionProgress,    // Callback for progress updates
      );

      // `transcriptionResult.fullTranscription` now contains the complete concatenated transcription
      setTranscription(transcriptionResult.fullTranscription);
      setTranscriptionProgress(100); // Ensure it ends at 100%

      // 4. Summarize the transcription
      setAppState(AppState.SUMMARIZING);
      const generatedSummary = await summarizeText(transcriptionResult.fullTranscription);
      setSummary(generatedSummary);

      setAppState(AppState.COMPLETED);
    } catch (error) {
      console.error('Processing failed:', error);
      setErrorMessage(`Failed to process video: ${error instanceof Error ? error.message : String(error)}`);
      setAppState(AppState.ERROR);
    }
  }, [handleTranscriptionUpdate]); // handleTranscriptionUpdate is stable due to useCallback

  const handleReset = useCallback(() => {
    setAppState(AppState.IDLE);
    setTranscription('');
    setSummary('');
    setErrorMessage(null);
    setTranscriptionProgress(0);
    currentTranscriptionRef.current = '';
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-gray-900 to-indigo-900 text-white font-sans">
      <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-600 mb-12 drop-shadow-lg">
        Video AI Assistant
      </h1>

      {appState === AppState.IDLE || appState === AppState.UPLOADING || appState === AppState.TRANSCRIBING || appState === AppState.SUMMARIZING || appState === AppState.ERROR ? (
        <VideoUploader
          onVideoSelect={handleVideoSelect}
          appState={appState}
          errorMessage={errorMessage}
          transcriptionProgress={transcriptionProgress}
        />
      ) : (
        <TranscriptionDisplay
          transcription={transcription}
          summary={summary}
          onReset={handleReset}
        />
      )}

      {/* Persistent Call-to-Action (Example - if needed, for simplicity kept within main flow for now) */}
      {/* <div className="fixed bottom-0 left-0 right-0 bg-gray-900 bg-opacity-80 p-4 text-center">
        <p className="text-gray-400 text-sm">Need help? Contact support.</p>
      </div> */}
    </div>
  );
}

export default App;