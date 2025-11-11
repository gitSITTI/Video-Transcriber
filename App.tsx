import React, { useState, useCallback, useRef } from 'react';
import VideoUploader from './components/VideoUploader';
import TranscriptionDisplay from './components/TranscriptionDisplay';
import { AppState, TranscriptionChunk, TranscriptionService } from './types';
import {
  extractAudioBufferFromVideoFile,
  resampleAudioBuffer,
  formatDuration,
  createWavBlobFromAudioBuffer, // New import for WAV creation
} from './utils/audioUtils';
import { transcribeAudioStream, summarizeText } from './services/geminiService';
import { transcribeWithWhisper } from './services/openaiService'; // New import for OpenAI service
import { TARGET_SAMPLE_RATE } from './constants';

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [transcription, setTranscription] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcriptionProgress, setTranscriptionProgress] = useState<number>(0);
  const [totalAudioDuration, setTotalAudioDuration] = useState<number>(0);
  const [selectedTranscriptionService, setSelectedTranscriptionService] = useState<TranscriptionService>(
    TranscriptionService.GEMINI_LIVE, // Default to Gemini Live
  );
  const [openaiApiKey, setOpenaiApiKey] = useState<string | null>(null); // State for OpenAI API key

  const currentTranscriptionRef = useRef<string>('');

  const handleTranscriptionUpdate = useCallback((chunk: TranscriptionChunk) => {
    setTranscription(chunk.text);
    currentTranscriptionRef.current = chunk.text;
  }, []);

  const handleServiceSelect = useCallback((service: TranscriptionService) => {
    setSelectedTranscriptionService(service);
    setErrorMessage(null); // Clear errors when switching service
  }, []);

  const handleOpenaiApiKeyChange = useCallback((key: string) => {
    setOpenaiApiKey(key.trim());
    setErrorMessage(null); // Clear errors when API key changes
  }, []);

  const handleVideoSelect = useCallback(async (file: File) => {
    setAppState(AppState.UPLOADING);
    setErrorMessage(null);
    setTranscription('');
    setSummary('');
    setTranscriptionProgress(0);
    currentTranscriptionRef.current = '';
    setTotalAudioDuration(0);

    try {
      if (selectedTranscriptionService === TranscriptionService.OPENAI_WHISPER && !openaiApiKey) {
        throw new Error('Please provide your OpenAI API key to use Whisper transcription.');
      }

      // 1. Extract audio from video file
      const audioBuffer = await extractAudioBufferFromVideoFile(file);
      console.log('Original Audio Buffer:', audioBuffer);

      // Calculate total audio duration and store it
      const durationInSeconds = audioBuffer.length / audioBuffer.sampleRate;
      setTotalAudioDuration(durationInSeconds);
      console.log(`Video audio duration: ${formatDuration(durationInSeconds)}`);

      let transcriptionResult;

      // 2. Transcribe based on selected service
      setAppState(AppState.TRANSCRIBING);

      if (selectedTranscriptionService === TranscriptionService.GEMINI_LIVE) {
        console.log('Using Google Gemini Live for transcription.');
        const resampledAudioBuffer = await resampleAudioBuffer(
          audioBuffer,
          TARGET_SAMPLE_RATE,
        );
        const audioData = resampledAudioBuffer.getChannelData(0);
        transcriptionResult = await transcribeAudioStream(
          audioData,
          handleTranscriptionUpdate,
          setTranscriptionProgress,
        );
      } else { // TranscriptionService.OPENAI_WHISPER
        console.log('Using OpenAI Whisper for transcription.');
        // For Whisper, we need a WAV blob
        const wavBlob = createWavBlobFromAudioBuffer(audioBuffer);
        
        // Whisper API is not streaming; progress will update at start and end
        setTranscriptionProgress(1); // Set to a small value to show it's started
        transcriptionResult = await transcribeWithWhisper(
          openaiApiKey!, // Use the user-provided key
          wavBlob,
          handleTranscriptionUpdate,
          setTranscriptionProgress, // Will be called once with 100% on completion
        );
      }

      setTranscription(transcriptionResult.fullTranscription);
      setTranscriptionProgress(100); // Ensure it ends at 100%

      // 3. Summarize the transcription
      setAppState(AppState.SUMMARIZING);
      const generatedSummary = await summarizeText(transcriptionResult.fullTranscription);
      setSummary(generatedSummary);

      setAppState(AppState.COMPLETED);
    } catch (error) {
      console.error('Processing failed:', error);
      setErrorMessage(`Failed to process video: ${error instanceof Error ? error.message : String(error)}`);
      setAppState(AppState.ERROR);
    }
  }, [handleTranscriptionUpdate, selectedTranscriptionService, openaiApiKey]);

  const handleReset = useCallback(() => {
    setAppState(AppState.IDLE);
    setTranscription('');
    setSummary('');
    setErrorMessage(null);
    setTranscriptionProgress(0);
    currentTranscriptionRef.current = '';
    setTotalAudioDuration(0);
    // Do not reset selectedTranscriptionService or openaiApiKey here, user choice persists
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
          totalAudioDuration={totalAudioDuration}
          selectedService={selectedTranscriptionService}
          onServiceSelect={handleServiceSelect}
          openaiApiKey={openaiApiKey}
          onOpenaiApiKeyChange={handleOpenaiApiKeyChange}
        />
      ) : (
        <TranscriptionDisplay
          transcription={transcription}
          summary={summary}
          onReset={handleReset}
        />
      )}
    </div>
  );
}

export default App;