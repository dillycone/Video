'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';

interface Procedure {
  title: string;
  overview: string;
  prerequisites: string[];
  steps: {
    main: string;
    sub: string[];
    warnings: string[];
    tips: string[];
  }[];
  verification: string;
  troubleshooting: string[];
  token_usage?: {
    prompt_tokens: number;
    response_tokens: number;
    total_tokens: number;
    costs: {
      input_cost: number;
      output_cost: number;
      total_cost: number;
    };
  };
}

export default function VideoProcedure() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [procedure, setProcedure] = useState<Procedure | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [defaultPrompt, setDefaultPrompt] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [model, setModel] = useState('gemini-1.5-pro-002');

  useEffect(() => {
    // Load the default prompt
    fetch('/prompts/procedure_from_video_prompt.txt')
      .then(response => response.text())
      .then(text => {
        setDefaultPrompt(text);
        setCustomPrompt(text);
      })
      .catch(err => {
        console.error('Failed to load default prompt:', err);
        setError('Failed to load prompt template');
      });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Cleanup previous URL if it exists
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }

      setFile(selectedFile);
      setError(null);
      setProcedure(null);

      // Create new video URL
      const newVideoUrl = URL.createObjectURL(selectedFile);
      setVideoUrl(newVideoUrl);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', model);
      if (customPrompt !== defaultPrompt) {
        formData.append('prompt', customPrompt);
      }

      const response = await fetch('/api/procedure', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate procedure');
      }

      setProcedure(data.procedure);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const procedureToText = (proc: Procedure): string => {
    let text = `${proc.title}\n\n`;
    text += `OVERVIEW:\n${proc.overview}\n\n`;
    text += `PREREQUISITES:\n${proc.prerequisites.map(p => `- ${p}`).join('\n')}\n\n`;
    text += `PROCEDURE:\n`;
    proc.steps.forEach((step, index) => {
      text += `${index + 1}. ${step.main}\n`;
      step.sub.forEach(sub => text += `   ${sub}\n`);
      step.warnings.forEach(warning => text += `   ⚠️ ${warning}\n`);
      step.tips.forEach(tip => text += `   💡 ${tip}\n`);
      text += '\n';
    });
    text += `VERIFICATION:\n${proc.verification}\n\n`;
    text += `TROUBLESHOOTING:\n${proc.troubleshooting.map(t => `- ${t}`).join('\n')}`;

    if (proc.token_usage) {
      text += '\n\nToken Usage:\n';
      text += `Prompt Tokens: ${proc.token_usage.prompt_tokens}\n`;
      text += `Response Tokens: ${proc.token_usage.response_tokens}\n`;
      text += `Total Tokens: ${proc.token_usage.total_tokens}\n\n`;
      text += `Cost Breakdown:\n`;
      text += `Input Cost: $${proc.token_usage.costs.input_cost}\n`;
      text += `Output Cost: $${proc.token_usage.costs.output_cost}\n`;
      text += `Total Cost: $${proc.token_usage.costs.total_cost}`;
    }
    return text;
  };

  const copyToClipboard = async () => {
    if (!procedure) return;
    try {
      await navigator.clipboard.writeText(procedureToText(procedure));
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const exportToPDF = () => {
    if (!procedure || !file) return;

    const pdf = new jsPDF();
    const fileName = file.name.replace(/\.[^/.]+$/, '');
    const title = `Procedure: ${fileName}`;
    
    // PDF Styling
    const titleSize = 16;
    const headingSize = 14;
    const textSize = 12;
    const margin = 15;
    let yPosition = margin;
    
    // Title
    pdf.setFontSize(titleSize);
    pdf.text(procedure.title, margin, yPosition);
    yPosition += 15;
    
    // Timestamp
    pdf.setFontSize(10);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, yPosition);
    yPosition += 15;
    
    // Overview
    pdf.setFontSize(headingSize);
    pdf.text('Overview', margin, yPosition);
    yPosition += 10;
    pdf.setFontSize(textSize);
    const overviewLines = pdf.splitTextToSize(procedure.overview, 180);
    pdf.text(overviewLines, margin, yPosition);
    yPosition += overviewLines.length * 7 + 10;
    
    // Prerequisites
    pdf.setFontSize(headingSize);
    pdf.text('Prerequisites', margin, yPosition);
    yPosition += 10;
    pdf.setFontSize(textSize);
    procedure.prerequisites.forEach(prereq => {
      const lines = pdf.splitTextToSize(`• ${prereq}`, 180);
      pdf.text(lines, margin, yPosition);
      yPosition += lines.length * 7;
    });
    yPosition += 10;
    
    // Steps
    pdf.setFontSize(headingSize);
    pdf.text('Procedure', margin, yPosition);
    yPosition += 10;
    pdf.setFontSize(textSize);
    
    procedure.steps.forEach((step, index) => {
      if (yPosition > 270) {
        pdf.addPage();
        yPosition = margin;
      }
      
      const stepNum = `${index + 1}. `;
      pdf.text(stepNum, margin, yPosition);
      const mainStepLines = pdf.splitTextToSize(step.main, 170);
      pdf.text(mainStepLines, margin + 10, yPosition);
      yPosition += mainStepLines.length * 7;
      
      step.sub.forEach(sub => {
        const subLines = pdf.splitTextToSize(`• ${sub}`, 160);
        pdf.text(subLines, margin + 15, yPosition);
        yPosition += subLines.length * 7;
      });
      
      step.warnings.forEach(warning => {
        const warningLines = pdf.splitTextToSize(`⚠️ ${warning}`, 160);
        pdf.text(warningLines, margin + 15, yPosition);
        yPosition += warningLines.length * 7;
      });
      
      step.tips.forEach(tip => {
        const tipLines = pdf.splitTextToSize(`💡 ${tip}`, 160);
        pdf.text(tipLines, margin + 15, yPosition);
        yPosition += tipLines.length * 7;
      });
      
      yPosition += 5;
    });
    
    // Verification
    if (yPosition > 250) {
      pdf.addPage();
      yPosition = margin;
    }
    pdf.setFontSize(headingSize);
    pdf.text('Verification', margin, yPosition);
    yPosition += 10;
    pdf.setFontSize(textSize);
    const verificationLines = pdf.splitTextToSize(procedure.verification, 180);
    pdf.text(verificationLines, margin, yPosition);
    yPosition += verificationLines.length * 7 + 10;
    
    // Troubleshooting
    if (yPosition > 250) {
      pdf.addPage();
      yPosition = margin;
    }
    pdf.setFontSize(headingSize);
    pdf.text('Troubleshooting', margin, yPosition);
    yPosition += 10;
    pdf.setFontSize(textSize);
    procedure.troubleshooting.forEach(issue => {
      const lines = pdf.splitTextToSize(`• ${issue}`, 180);
      pdf.text(lines, margin, yPosition);
      yPosition += lines.length * 7;
    });

    // Token Usage & Cost
    if (procedure.token_usage) {
      if (yPosition > 250) {
        pdf.addPage();
        yPosition = margin;
      }
      yPosition += 10;
      pdf.setFontSize(headingSize);
      pdf.text('Token Usage & Cost', margin, yPosition);
      yPosition += 10;
      pdf.setFontSize(textSize);
      pdf.text(`Prompt Tokens: ${procedure.token_usage.prompt_tokens}`, margin, yPosition);
      yPosition += 7;
      pdf.text(`Response Tokens: ${procedure.token_usage.response_tokens}`, margin, yPosition);
      yPosition += 7;
      pdf.text(`Total Tokens: ${procedure.token_usage.total_tokens}`, margin, yPosition);
      yPosition += 10;
      pdf.text(`Input Cost: $${procedure.token_usage.costs.input_cost}`, margin, yPosition);
      yPosition += 7;
      pdf.text(`Output Cost: $${procedure.token_usage.costs.output_cost}`, margin, yPosition);
      yPosition += 7;
      pdf.text(`Total Cost: $${procedure.token_usage.costs.total_cost}`, margin, yPosition);
    }
    
    pdf.save(`${fileName}-procedure.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <div className="bg-[#CC0000] text-white py-16">
        <div className="container mx-auto px-4">
          <button
            onClick={() => router.push('/')}
            className="mb-4 flex items-center text-white hover:text-gray-200"
          >
            <span className="mr-2">←</span>
            Back to Tools
          </button>
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-5xl font-bold">
              Generate Procedure From Video
            </h1>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-3xl font-bold mb-6 text-center">
            Upload Your Video
          </h2>
          <p className="text-gray-600 mb-8 text-center">
            Upload a video to generate a detailed, step-by-step procedure. The tool will analyze the content and create a comprehensive guide.
            Videos must be less than one hour in length.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
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
                    <p className="text-sm text-gray-600">Click to select a different video</p>
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
                    <span className="text-gray-600">
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
                className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center"
              >
                Show/Edit Prompt Used to Generate Procedure {showPrompt ? '↑' : '↓'}
              </button>
            </div>

            {showPrompt && (
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 transition-all duration-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Procedure Generation Prompt
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="w-full p-3 rounded border border-gray-200 text-sm font-mono"
                  rows={20}
                  placeholder="Loading prompt template..."
                />
                {customPrompt !== defaultPrompt && (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setCustomPrompt(defaultPrompt)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Reset to Default
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Model Selection */}
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium text-gray-700">Model Selection</label>
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    value="gemini-1.5-pro-002"
                    checked={model === 'gemini-1.5-pro-002'}
                    onChange={(e) => setModel(e.target.value)}
                    className="form-radio text-[#CC0000] h-4 w-4"
                  />
                  <span className="ml-2">Gemini 1.5 Pro</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    value="gemini-1.5-flash-002"
                    checked={model === 'gemini-1.5-flash-002'}
                    onChange={(e) => setModel(e.target.value)}
                    className="form-radio text-[#CC0000] h-4 w-4"
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
              disabled={!file || isLoading}
              className={`ti-button w-full py-3 rounded-md font-semibold
                ${(!file || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isLoading ? 'Generating Procedure...' : 'Generate Procedure'}
            </button>
          </form>

          {procedure && (
            <div className="mt-8 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Generated Procedure</h3>
                <div className="flex gap-2">
                  <button
                    onClick={copyToClipboard}
                    className="inline-flex items-center px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"
                    title="Copy to clipboard"
                  >
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
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
                    className="inline-flex items-center px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"
                    title="Export to PDF"
                  >
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
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

              {procedure.token_usage && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="text-sm font-semibold text-blue-800 mb-2">Token Usage & Cost</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-blue-600">Prompt Tokens:</span>
                      <span className="ml-2 font-mono">{procedure.token_usage.prompt_tokens}</span>
                    </div>
                    <div>
                      <span className="text-blue-600">Response Tokens:</span>
                      <span className="ml-2 font-mono">{procedure.token_usage.response_tokens}</span>
                    </div>
                    <div>
                      <span className="text-blue-600">Total Tokens:</span>
                      <span className="ml-2 font-mono">{procedure.token_usage.total_tokens}</span>
                    </div>
                  </div>
                  <div className="border-t border-blue-200 pt-2 mt-2">
                    <h5 className="text-sm font-semibold text-blue-800 mb-2">Cost Breakdown</h5>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-blue-600">Input Cost:</span>
                        <span className="ml-2 font-mono">${procedure.token_usage.costs.input_cost}</span>
                      </div>
                      <div>
                        <span className="text-blue-600">Output Cost:</span>
                        <span className="ml-2 font-mono">${procedure.token_usage.costs.output_cost}</span>
                      </div>
                      <div>
                        <span className="text-blue-600">Total Cost:</span>
                        <span className="ml-2 font-mono">${procedure.token_usage.costs.total_cost}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-6 bg-gray-50 p-6 rounded-lg">
                <div>
                  <h2 className="text-2xl font-bold">{procedure.title}</h2>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Overview</h3>
                  <p className="text-gray-600">{procedure.overview}</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Prerequisites</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {procedure.prerequisites.map((item, index) => (
                      <li key={index} className="text-gray-600">{item}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Procedure</h3>
                  {procedure.steps.map((step, index) => (
                    <div key={index} className="mb-6">
                      <h4 className="font-semibold">{index + 1}. {step.main}</h4>
                      <ul className="list-disc pl-5 mt-2 space-y-1">
                        {step.sub.map((subStep, subIndex) => (
                          <li key={subIndex} className="text-gray-600">{subStep}</li>
                        ))}
                      </ul>
                      {step.warnings.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {step.warnings.map((warning, wIndex) => (
                            <p key={wIndex} className="text-red-600">⚠️ {warning}</p>
                          ))}
                        </div>
                      )}
                      {step.tips.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {step.tips.map((tip, tIndex) => (
                            <p key={tIndex} className="text-blue-600">💡 {tip}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Verification</h3>
                  <p className="text-gray-600">{procedure.verification}</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Troubleshooting</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {procedure.troubleshooting.map((item, index) => (
                      <li key={index} className="text-gray-600">{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
