'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';

interface TokenUsage {
  prompt_tokens: number;
  response_tokens: number;
  total_tokens: number;
  costs: {
    input_cost: number;
    output_cost: number;
    total_cost: number;
  };
}

export default function VideoTranscription() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [defaultPrompt, setDefaultPrompt] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);
  const [model, setModel] = useState('gemini-1.5-pro-002');

  useEffect(() => {
    fetch('/prompts/video_transcription_prompt.txt')
      .then(response => response.text())
      .then(text => {
        setDefaultPrompt(text);
        setCustomPrompt(text);
      })
      .catch(err => console.error('Failed to load default prompt:', err));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }

      setFile(selectedFile);
      setError('');
      setTranscript('');
      setTokenUsage(null);

      const newVideoUrl = URL.createObjectURL(selectedFile);
      setVideoUrl(newVideoUrl);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setError('');
    setTokenUsage(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', model);
      if (customPrompt !== defaultPrompt) {
        formData.append('prompt', customPrompt);
      }

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate transcript');
      }

      setTranscript(data.transcript);
      if (data.token_usage) {
        setTokenUsage(data.token_usage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsUploading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      let textToCopy = transcript;
      if (tokenUsage) {
        textToCopy += '\n\nToken Usage:\n';
        textToCopy += `Prompt Tokens: ${tokenUsage.prompt_tokens}\n`;
        textToCopy += `Response Tokens: ${tokenUsage.response_tokens}\n`;
        textToCopy += `Total Tokens: ${tokenUsage.total_tokens}\n\n`;
        textToCopy += `Cost Breakdown:\n`;
        textToCopy += `Input Cost: $${tokenUsage.costs.input_cost}\n`;
        textToCopy += `Output Cost: $${tokenUsage.costs.output_cost}\n`;
        textToCopy += `Total Cost: $${tokenUsage.costs.total_cost}`;
      }
      await navigator.clipboard.writeText(textToCopy);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const exportToPDF = () => {
    const pdf = new jsPDF();
    const fileName = file ? file.name.replace(/\.[^/.]+$/, '') : 'transcript';
    const title = `Transcript: ${fileName}`;
    const splitText = pdf.splitTextToSize(transcript, 180);
    
    pdf.setFontSize(16);
    pdf.text(title, 15, 15);
    
    pdf.setFontSize(10);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 15, 25);
    
    pdf.setFontSize(12);
    let yPosition = 35;
    
    splitText.forEach((line: string) => {
      if (yPosition > 280) {
        pdf.addPage();
        yPosition = 20;
      }
      pdf.text(line, 15, yPosition);
      yPosition += 7;
    });

    if (tokenUsage) {
      if (yPosition > 250) {
        pdf.addPage();
        yPosition = 20;
      }
      yPosition += 10;
      pdf.setFontSize(14);
      pdf.text('Token Usage & Cost', 15, yPosition);
      yPosition += 10;
      pdf.setFontSize(12);
      pdf.text(`Prompt Tokens: ${tokenUsage.prompt_tokens}`, 15, yPosition);
      yPosition += 7;
      pdf.text(`Response Tokens: ${tokenUsage.response_tokens}`, 15, yPosition);
      yPosition += 7;
      pdf.text(`Total Tokens: ${tokenUsage.total_tokens}`, 15, yPosition);
      yPosition += 10;
      pdf.text(`Input Cost: $${tokenUsage.costs.input_cost}`, 15, yPosition);
      yPosition += 7;
      pdf.text(`Output Cost: $${tokenUsage.costs.output_cost}`, 15, yPosition);
      yPosition += 7;
      pdf.text(`Total Cost: $${tokenUsage.costs.total_cost}`, 15, yPosition);
    }
    
    pdf.save(`${fileName}-transcript.pdf`);
  };

  return (
    <div className="min-h-screen bg-base-200">
      <div className="ti-nav py-16">
        <div className="container mx-auto px-4">
          <button
            onClick={() => router.push('/')}
            className="mb-4 flex items-center text-white hover:text-base-200 transition-colors"
          >
            <span className="mr-2">←</span>
            Back to Tools
          </button>
          <div className="max-w-2xl mx-auto text-center animate-fade-in">
            <h1 className="text-5xl font-bold">
              Video Transcription
            </h1>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto bg-base-100 rounded-lg shadow-lg p-8 animate-fade-in-up">
          <h2 className="text-3xl font-bold mb-6 text-center">
            Upload Your Video
          </h2>
          <p className="text-base-content/70 mb-8 text-center">
            Select a video file to generate an accurate transcript. We support most common video formats.
            Videos must be less than one hour in length.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="border-2 border-dashed border-base-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
                id="video-upload"
              />
              <label
                htmlFor="video-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                {videoUrl ? (
                  <div className="w-full max-w-md mx-auto">
                    <video
                      controls
                      src={videoUrl}
                      className="w-full rounded-lg shadow-md mb-4"
                    >
                      Your browser does not support the video tag.
                    </video>
                    <p className="text-sm text-base-content/70">Click to select a different video</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-4">
                      <img
                        src="/video.svg"
                        alt="Upload video"
                        className="w-12 h-12"
                      />
                    </div>
                    <span className="text-base-content/70">
                      Click to select or drag and drop your video file
                    </span>
                  </>
                )}
              </label>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowPrompt(!showPrompt)}
                className="text-sm text-base-content/70 hover:text-base-content transition-colors inline-flex items-center"
              >
                Show/Edit Prompt Used to Generate Transcript {showPrompt ? '↑' : '↓'}
              </button>
            </div>

            {showPrompt && (
              <div className="bg-base-200 p-4 rounded-lg border border-base-300 transition-all duration-200">
                <label className="block text-sm font-medium text-base-content mb-2">
                  Transcription Prompt
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="ti-input w-full font-mono"
                  rows={5}
                  placeholder="Enter custom transcription prompt..."
                />
                {customPrompt !== defaultPrompt && (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setCustomPrompt(defaultPrompt)}
                      className="text-sm ti-link"
                    >
                      Reset to Default
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium text-base-content">Model Selection</label>
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    value="gemini-1.5-pro-002"
                    checked={model === 'gemini-1.5-pro-002'}
                    onChange={(e) => setModel(e.target.value)}
                    className="form-radio text-primary h-4 w-4"
                  />
                  <span className="ml-2">Gemini 1.5 Pro</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    value="gemini-1.5-flash-002"
                    checked={model === 'gemini-1.5-flash-002'}
                    onChange={(e) => setModel(e.target.value)}
                    className="form-radio text-primary h-4 w-4"
                  />
                  <span className="ml-2">Gemini 1.5 Flash</span>
                </label>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!file || isUploading}
              className={`ti-button w-full py-3 rounded-md font-semibold
                ${(!file || isUploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isUploading ? 'Processing...' : 'Generate Transcript'}
            </button>
          </form>

          {transcript && (
            <div className="mt-8 animate-fade-in">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Transcript</h3>
                <div className="flex gap-2">
                  <button
                    onClick={copyToClipboard}
                    className="inline-flex items-center px-3 py-1 rounded-md bg-base-200 hover:bg-base-300 transition-colors"
                    title="Copy to clipboard"
                  >
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                      />
                    </svg>
                    {copySuccess ? 'Copied!' : 'Copy to Clipboard'}
                  </button>
                  <button
                    onClick={exportToPDF}
                    className="inline-flex items-center px-3 py-1 rounded-md bg-base-200 hover:bg-base-300 transition-colors"
                    title="Export to PDF"
                  >
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Export to PDF
                  </button>
                </div>
              </div>

              {tokenUsage && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
                  <h4 className="text-sm font-semibold text-blue-800 mb-2">Token Usage & Cost</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-blue-600">Prompt Tokens:</span>
                      <span className="ml-2 font-mono">{tokenUsage.prompt_tokens}</span>
                    </div>
                    <div>
                      <span className="text-blue-600">Response Tokens:</span>
                      <span className="ml-2 font-mono">{tokenUsage.response_tokens}</span>
                    </div>
                    <div>
                      <span className="text-blue-600">Total Tokens:</span>
                      <span className="ml-2 font-mono">{tokenUsage.total_tokens}</span>
                    </div>
                  </div>
                  <div className="border-t border-blue-200 pt-2 mt-2">
                    <h5 className="text-sm font-semibold text-blue-800 mb-2">Cost Breakdown</h5>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-blue-600">Input Cost:</span>
                        <span className="ml-2 font-mono">${tokenUsage.costs.input_cost}</span>
                      </div>
                      <div>
                        <span className="text-blue-600">Output Cost:</span>
                        <span className="ml-2 font-mono">${tokenUsage.costs.output_cost}</span>
                      </div>
                      <div>
                        <span className="text-blue-600">Total Cost:</span>
                        <span className="ml-2 font-mono">${tokenUsage.costs.total_cost}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="ti-input w-full min-h-[300px] font-mono text-sm"
                placeholder="Transcript will appear here..."
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
