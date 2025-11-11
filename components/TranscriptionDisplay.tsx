import React from 'react';

interface TranscriptionDisplayProps {
  transcription: string;
  summary: string;
  onReset: () => void;
}

const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({
  transcription,
  summary,
  onReset,
}) => {
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadTranscription = () => {
    downloadFile(transcription, 'video_transcription.txt', 'text/plain');
  };

  const handleDownloadSummary = () => {
    downloadFile(summary, 'video_summary.txt', 'text/plain');
  };

  return (
    <div className="w-full max-w-4xl bg-gray-800 rounded-lg shadow-xl p-8 space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-white mb-4 text-center">Results</h2>
        <div className="grid md:grid-cols-2 gap-8">
          {/* Transcription Section */}
          <div className="bg-gray-700 p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-indigo-300 mb-3 flex items-center">
              <svg
                className="w-6 h-6 mr-2 text-indigo-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                ></path>
              </svg>
              Transcription
            </h3>
            <div className="bg-gray-900 p-4 rounded-md h-64 overflow-y-auto text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
              {transcription || 'No transcription available.'}
            </div>
            <button
              onClick={handleDownloadTranscription}
              className="mt-4 w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              Download Transcription
            </button>
          </div>

          {/* Summary Section */}
          <div className="bg-gray-700 p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-indigo-300 mb-3 flex items-center">
              <svg
                className="w-6 h-6 mr-2 text-indigo-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M7 8h10M7 12h10M7 16h10M9 21h6a2 2 0 002-2V7a2 2 0 00-2-2H9a2 2 0 00-2 2v12a2 2 0 002 2z"
                ></path>
              </svg>
              Summary
            </h3>
            <div className="bg-gray-900 p-4 rounded-md h-64 overflow-y-auto text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
              {summary || 'No summary available.'}
            </div>
            <button
              onClick={handleDownloadSummary}
              // Fix: Changed `focus=` to `focus:` in the className
              className="mt-4 w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              Download Summary
            </button>
          </div>
        </div>
      </div>

      {/* Reset Button */}
      <div className="flex justify-center pt-4">
        <button
          onClick={onReset}
          className="px-8 py-3 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900"
        >
          Transcribe Another Video
        </button>
      </div>
    </div>
  );
};

export default TranscriptionDisplay;