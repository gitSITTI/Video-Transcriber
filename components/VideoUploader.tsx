import React, { useCallback, useRef, useState } from 'react';
import { AppState } from '../types';

interface VideoUploaderProps {
  onVideoSelect: (file: File) => void;
  appState: AppState;
  errorMessage: string | null;
  transcriptionProgress: number;
}

const VideoUploader: React.FC<VideoUploaderProps> = ({
  onVideoSelect,
  appState,
  errorMessage,
  transcriptionProgress,
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

  const getLoadingMessage = () => {
    switch (appState) {
      case AppState.UPLOADING:
        return 'Extracting audio...';
      case AppState.TRANSCRIBING:
        return `Transcribing audio: ${transcriptionProgress.toFixed(0)}%`;
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
        disabled={isLoading}
      />
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
            disabled={isLoading}
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