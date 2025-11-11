import React, { useCallback, useRef, useState } from 'react';
import { AppState, TranscriptionService } from '../types';
import { formatDuration } from '../utils/audioUtils';

interface VideoUploaderProps {
  onVideoSelect: (file: File) => void;
  appState: AppState;
  errorMessage: string | null;
  transcriptionProgress: number;
  totalAudioDuration: number;
  selectedService: TranscriptionService; // New prop
  onServiceSelect: (service: TranscriptionService) => void; // New prop
  openaiApiKey: string | null; // New prop for OpenAI API key
  onOpenaiApiKeyChange: (key: string) => void; // New prop for API key change handler
}

const VideoUploader: React.FC<VideoUploaderProps> = ({
  onVideoSelect,
  appState,
  errorMessage,
  transcriptionProgress,
  totalAudioDuration,
  selectedService,
  onServiceSelect,
  openaiApiKey,
  onOpenaiApiKeyChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        onVideoSelect(e.dataTransfer.files[0]);
      }
    },
    [onVideoSelect],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        onVideoSelect(e.target.files[0]);
      }
    },
    [onVideoSelect],
  );

  const onClick = () => {
    fileInputRef.current?.click();
  };

  const isLoading =
    appState === AppState.UPLOADING ||
    appState === AppState.TRANSCRIBING ||
    appState === AppState.SUMMARIZING;

  // Disable "Browse Files" if OpenAI is selected and key is missing
  const isBrowseDisabled = isLoading || (selectedService === TranscriptionService.OPENAI_WHISPER && !openaiApiKey);

  const getLoadingMessage = () => {
    let serviceName = '';
    if (selectedService === TranscriptionService.GEMINI_LIVE) {
      serviceName = 'Gemini Live';
    } else if (selectedService === TranscriptionService.OPENAI_WHISPER) {
      serviceName = 'OpenAI Whisper';
    }

    switch (appState) {
      case AppState.UPLOADING:
        return 'Extracting audio...';
      case AppState.TRANSCRIBING:
        const formattedTotalDuration = formatDuration(totalAudioDuration);
        const elapsedSeconds = (totalAudioDuration * transcriptionProgress) / 100;
        const formattedElapsed = formatDuration(elapsedSeconds);
        return `Transcribing audio (${serviceName}): ${transcriptionProgress.toFixed(0)}% (${formattedElapsed} / ${formattedTotalDuration})`;
      case AppState.SUMMARIZING:
        return 'Generating summary...';
      default:
        return 'Processing video...';
    }
  };

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg shadow-xl transition-colors duration-200 w-full max-w-lg ${
        dragActive
          ? 'border-indigo-400 bg-indigo-900/20'
          : 'border-gray-600 bg-gray-800/20 hover:border-indigo-500 hover:bg-gray-700/30'
      } ${isLoading ? 'pointer-events-none opacity-75' : ''}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleChange}
        accept="video/*"
        disabled={isBrowseDisabled}
      />

      <div className="mb-6 w-full text-center">
        <label className="block text-gray-300 text-lg font-semibold mb-3">
          Choose Transcription Service:
        </label>
        <div className="flex justify-center space-x-4">
          <label className="inline-flex items-center">
            <input
              type="radio"
              className="form-radio text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              name="transcriptionService"
              value={TranscriptionService.GEMINI_LIVE}
              checked={selectedService === TranscriptionService.GEMINI_LIVE}
              onChange={() => onServiceSelect(TranscriptionService.GEMINI_LIVE)}
              disabled={isLoading}
            />
            <span className="ml-2 text-gray-200">Google Gemini Live</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              className="form-radio text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              name="transcriptionService"
              value={TranscriptionService.OPENAI_WHISPER}
              checked={selectedService === TranscriptionService.OPENAI_WHISPER}
              onChange={() => onServiceSelect(TranscriptionService.OPENAI_WHISPER)}
              disabled={isLoading}
            />
            <span className="ml-2 text-gray-200">OpenAI Whisper</span>
          </label>
        </div>
      </div>

      {selectedService === TranscriptionService.OPENAI_WHISPER && (
        <div className="mb-6 w-full px-4">
          <label htmlFor="openai-api-key" className="block text-gray-300 text-sm font-semibold mb-2">
            OpenAI API Key:
          </label>
          <input
            id="openai-api-key"
            type="password"
            className="w-full p-2 bg-gray-700 text-white rounded-md border border-gray-600 focus:outline-none focus:border-indigo-500"
            placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={openaiApiKey || ''}
            onChange={(e) => onOpenaiApiKeyChange(e.target.value)}
            disabled={isLoading}
            aria-label="OpenAI API Key"
          />
          {!openaiApiKey && !isLoading && selectedService === TranscriptionService.OPENAI_WHISPER && (
            <p className="text-red-400 text-xs mt-1">
              An OpenAI API key is required for Whisper transcription. Get one at{' '}
              <a href="https://platform.openai.com/account/api-keys" target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:underline">
                OpenAI API Keys
              </a>.
            </p>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center text-indigo-300">
          <svg
            className="animate-spin h-10 w-10 text-indigo-400 mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004 13V4m7 16l-4-4m0 0l-4-4m4 4v5h.582m15.356-2A8.001 8.001 0 004 13V4"
            />
          </svg>
          <p className="text-xl font-semibold">{getLoadingMessage()}</p>
          {appState === AppState.TRANSCRIBING && (
            <div className="w-full bg-gray-600 rounded-full h-2.5 mt-4">
              <div
                className="bg-indigo-500 h-2.5 rounded-full"
                style={{ width: `${transcriptionProgress}%` }}
              ></div>
            </div>
          )}
        </div>
      ) : (
        <>
          <svg
            className="w-16 h-16 text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            ></path>
          </svg>
          <p className="text-lg text-gray-300 mb-2">Drag & Drop your video here</p>
          <p className="text-gray-400 mb-4">or</p>
          <button
            onClick={onClick}
            className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            disabled={isBrowseDisabled}
          >
            Browse Files
          </button>
          <p className="text-sm text-gray-500 mt-4">Supports MP4, MOV, WebM, etc.</p>
        </>
      )}
      {errorMessage && (
        <p className="text-red-400 mt-4 text-center text-sm">{errorMessage}</p>
      )}
    </div>
  );
};

export default VideoUploader;