'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';

interface Frame {
  timestamp: string;
  image: string;
}

interface Procedure {
  title: string;
  overview: string;
  prerequisites: string[];
  steps: {
    main: string;
    sub: string[];
    warnings: string[];
    tips: string[];
    frames?: { timestamp: string; image: string; }[];
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

interface TimestampMark {
  time: number;
  image: string;
  label: string;
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
  const [timestampMarks, setTimestampMarks] = useState<TimestampMark[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [frameExtractionMode, setFrameExtractionMode] = useState('uniform');
  const [numFrames, setNumFrames] = useState(10);
  const [threshold, setThreshold] = useState(0.5);
  const [frameDisplayMode, setFrameDisplayMode] = useState('inline');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const [imageScale, setImageScale] = useState(70);
  const [isExporting, setIsExporting] = useState(false);
  const [pdfImageSize, setPdfImageSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [exportFormat, setExportFormat] = useState<'pdf' | 'docx'>('pdf');

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

  const extractFrames = async () => {
    if (!file) return;

    try {
      console.log('Starting frame extraction...');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', frameExtractionMode);
      formData.append('numFrames', numFrames.toString());
      formData.append('threshold', threshold.toString());

      console.log('Sending request with params:', {
        numFrames,
        threshold
      });

      const response = await fetch('/api/extract-frames', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to extract frames');
      }

      const { frames } = await response.json();
      console.log('Extracted frames:', frames);
      return frames;
    } catch (err) {
      console.error('Failed to extract frames:', err);
      return null;
    }
  };

  // Handle video metadata loaded
  const handleVideoLoaded = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  // Handle video time update
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // Capture frame at current timestamp
  const captureFrame = async () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/jpeg');

    const hours = Math.floor(currentTime / 3600);
    const minutes = Math.floor((currentTime % 3600) / 60);
    const seconds = Math.floor(currentTime % 60);
    const timestamp = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    const newMark: TimestampMark = {
      time: currentTime,
      image: imageData,
      label: timestamp
    };

    setTimestampMarks(prev => [...prev, newMark].sort((a, b) => a.time - b.time));
  };

  // Format time for display
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle timeline click
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    videoRef.current.currentTime = newTime;
  };

  // Remove timestamp mark
  const removeMark = (index: number) => {
    setTimestampMarks(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      // Add timestamp marks to frames
      let frames: Frame[] = [];
      if (timestampMarks.length > 0) {
        timestampMarks.forEach(mark => {
          frames.push({
            timestamp: mark.label,
            image: mark.image
          });
        });
      }

      // Sort frames by timestamp
      frames.sort((a: Frame, b: Frame) => {
        const timeA = a.timestamp.split(':').reduce((acc: number, val: string) => acc * 60 + parseInt(val), 0);
        const timeB = b.timestamp.split(':').reduce((acc: number, val: string) => acc * 60 + parseInt(val), 0);
        return timeA - timeB;
      });

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

      // Distribute frames among steps
      if (frames.length > 0) {
        const procedureWithFrames = {
          ...data.procedure,
          steps: data.procedure.steps.map((step: any, index: number) => {
            const stepStartTime = (index / data.procedure.steps.length) * duration;
            const stepEndTime = ((index + 1) / data.procedure.steps.length) * duration;
            
            const stepFrames = frames.filter(frame => {
              const frameTime = frame.timestamp.split(':').reduce((acc: number, val: string) => acc * 60 + parseInt(val), 0);
              return frameTime >= stepStartTime && frameTime < stepEndTime;
            });

            return {
              ...step,
              frames: stepFrames
            };
          })
        };
        setProcedure(procedureWithFrames);
      } else {
        setProcedure(data.procedure);
      }
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

  // Update the stepFrame function
  const stepFrame = (forward: boolean) => {
    if (!videoRef.current) return;
    const frameTime = 1 / 30; // Assuming 30fps
    const newTime = videoRef.current.currentTime + (forward ? frameTime : -frameTime);
    videoRef.current.currentTime = Math.max(0, Math.min(newTime, duration));
  };

  // Add keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return;
      
      if (e.shiftKey) {
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            stepFrame(false);
            break;
          case 'ArrowRight':
            e.preventDefault();
            stepFrame(true);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [videoRef.current]); // Add videoRef.current to dependencies

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (exportFormat === 'pdf') {
        await exportToPDF(imageScale);
      } else {
        await exportToWord(imageScale);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
      setShowExportModal(false);
    }
  };

  const exportToPDF = async (scale: number) => {
    if (!procedure) return;

    // Initialize PDF with better formatting
    const pdf = new jsPDF();
    const fileName = procedure.title.toLowerCase().replace(/\s+/g, '-');
    const margin = 20;
    const pageWidth = pdf.internal.pageSize.width;
    const contentWidth = pageWidth - (2 * margin);
    let yPos = margin;

    // Helper function to add a new page
    const addNewPage = () => {
      pdf.addPage();
      yPos = margin;
      return yPos;
    };

    // Helper function to check and add new page if needed
    const checkNewPage = (requiredSpace: number) => {
      const pageHeight = pdf.internal.pageSize.height;
      if (yPos + requiredSpace > pageHeight - margin) {
        return addNewPage();
      }
      return yPos;
    };

    // Helper function for wrapped text with proper spacing
    const addWrappedText = (text: string, fontSize: number = 12, isBold: boolean = false): number => {
      pdf.setFontSize(fontSize);
      if (isBold) {
        pdf.setFont('helvetica', 'bold');
      } else {
        pdf.setFont('helvetica', 'normal');
      }
      
      const lines = pdf.splitTextToSize(text, contentWidth);
      yPos = checkNewPage(lines.length * fontSize * 0.5);
      
      // Add proper indentation for bullet points
      if (text.startsWith('•')) {
        pdf.text(lines.map((line: string) => `    ${line}`), margin, yPos); // 4 spaces indent for bullets
      } else if (text.startsWith('   •')) {
        pdf.text(lines.map((line: string) => `        ${line}`), margin, yPos); // 8 spaces indent for sub-bullets
      } else {
        pdf.text(lines, margin, yPos);
      }
      
      yPos += lines.length * fontSize * 0.5 + 4;
      return yPos;
    };

    // Title
    pdf.setFont('helvetica', 'bold');
    addWrappedText(procedure.title, 24, true);
    yPos += 10;

    // Overview section
    addWrappedText('Overview', 16, true);
    addWrappedText(procedure.overview);
    yPos += 10;

    // Prerequisites section
    addWrappedText('Prerequisites', 16, true);
    procedure.prerequisites.forEach((prereq, index) => {
      addWrappedText(`• ${prereq}`, 12);
    });
    yPos += 10;

    // Procedure steps
    addWrappedText('Procedure', 16, true);
    yPos += 5;

    procedure.steps.forEach((step, index) => {
      // Main step with proper numbering indentation
      addWrappedText(`${index + 1}. ${step.main}`, 14, true);
      
      // Sub-steps with increased indentation
      step.sub.forEach(subStep => {
        addWrappedText(`   • ${subStep}`);
      });

      // Warnings with matching indentation
      step.warnings.forEach(warning => {
        addWrappedText(`   ⚠️ ${warning}`, 12);
      });

      // Tips with matching indentation
      step.tips.forEach(tip => {
        addWrappedText(`   💡 ${tip}`, 12);
      });

      // Add frames if available
      if (step.frames && step.frames.length > 0) {
        for (const frame of step.frames) {
          try {
            const imageData = frame.image.split(',')[1];
            const img = new Image();
            img.src = frame.image;
            
            const aspectRatio = img.height / img.width;
            let imgWidth = contentWidth * (scale / 100);
            let imgHeight = imgWidth * aspectRatio;

            if (imgHeight > pdf.internal.pageSize.height * 0.4) {
              imgHeight = pdf.internal.pageSize.height * 0.4;
              imgWidth = imgHeight / aspectRatio;
            }

            yPos = checkNewPage(imgHeight + 20);
            const xPos = margin + (contentWidth - imgWidth) / 2;
            
            pdf.addImage(imageData, 'JPEG', xPos, yPos, imgWidth, imgHeight);
            yPos += imgHeight + 5;

            // Add timestamp caption
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'italic');
            const timeText = `Step ${index + 1} - ${frame.timestamp}`;
            const timeWidth = pdf.getTextWidth(timeText);
            pdf.text(timeText, margin + (contentWidth - timeWidth) / 2, yPos);
            yPos += 15;
          } catch (err) {
            console.error('Failed to add image to PDF:', err);
          }
        }
      }
      yPos += 10;
    });

    // Verification section
    addWrappedText('Verification', 16, true);
    addWrappedText(procedure.verification);
    yPos += 10;

    // Troubleshooting section
    addWrappedText('Troubleshooting', 16, true);
    procedure.troubleshooting.forEach((item, index) => {
      addWrappedText(`• ${item}`);
    });

    // Add token usage if available
    if (procedure.token_usage) {
      yPos = checkNewPage(80);
      addWrappedText('Token Usage & Cost Analysis', 14, true);
      yPos += 5;
      addWrappedText(`Prompt Tokens: ${procedure.token_usage.prompt_tokens}`);
      addWrappedText(`Response Tokens: ${procedure.token_usage.response_tokens}`);
      addWrappedText(`Total Tokens: ${procedure.token_usage.total_tokens}`);
      yPos += 5;
      addWrappedText('Cost Breakdown:', 12, true);
      addWrappedText(`Input Cost: $${procedure.token_usage.costs.input_cost}`);
      addWrappedText(`Output Cost: $${procedure.token_usage.costs.output_cost}`);
      addWrappedText(`Total Cost: $${procedure.token_usage.costs.total_cost}`);
    }

    // Save the PDF
    pdf.save(`${fileName}-procedure.pdf`);
  };

  const exportToWord = async (scale: number) => {
    if (!procedure) return;
    
    const sizeMappings = {
      small: { width: 854 },
      medium: { width: 1280 },
      large: { width: 1920 }
    };

    try {
      const response = await fetch('/api/export-word', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          procedure,
          imageScale: scale,
          imageSize: sizeMappings[pdfImageSize]
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate Word document');
      }

      // Get the blob from the response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${procedure.title.toLowerCase().replace(/\s+/g, '-')}-procedure.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export to Word failed:', error);
    }
  };

  // Add this component for better video controls
  const VideoControls = () => {
    return (
      <div className="space-y-4">
        {/* Frame controls */}
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={() => stepFrame(false)}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Previous Frame (Shift + Left Arrow)"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous Frame
          </button>
          <button
            onClick={captureFrame}
            className="flex items-center px-6 py-2 bg-[#CC0000] text-white rounded-lg shadow-sm hover:bg-[#AA0000] transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Capture Frame
          </button>
          <button
            onClick={() => stepFrame(true)}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Next Frame (Shift + Right Arrow)"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Next Frame
          </button>
        </div>

        {/* Timeline */}
        <div className="relative h-8 group">
          {/* Progress bar background */}
          <div 
            className="absolute top-3 left-0 right-0 h-2 bg-gray-200 rounded-full overflow-hidden cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percentage = x / rect.width;
              if (videoRef.current) {
                videoRef.current.currentTime = percentage * duration;
              }
            }}
          >
            <div
              className="h-full bg-[#CC0000] transition-all duration-150"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
          </div>

          {/* Timestamp marks */}
          {timestampMarks.map((mark, index) => (
            <div
              key={index}
              className="absolute w-1 h-4 bg-[#CC0000] top-2 -translate-x-1/2 cursor-pointer hover:bg-[#AA0000]"
              style={{ left: `${(mark.time / duration) * 100}%` }}
              title={mark.label}
              onClick={(e) => {
                e.stopPropagation();
                if (videoRef.current) {
                  videoRef.current.currentTime = mark.time;
                }
              }}
            />
          ))}

          {/* Hover effect and click area */}
          <div 
            className="absolute inset-0 cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percentage = x / rect.width;
              if (videoRef.current) {
                videoRef.current.currentTime = percentage * duration;
              }
            }}
          />
        </div>

        {/* Time display and keyboard hint */}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <span className="font-medium">{formatTime(currentTime)} / {formatTime(duration)}</span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-500">Use Shift + ←/→ for frame-by-frame</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-gray-500">Captured Frames:</span>
            <span className="font-medium text-[#CC0000]">{timestampMarks.length}</span>
          </div>
        </div>
      </div>
    );
  };

  // Update the captured frames display
  const CapturedFrames = () => {
    if (timestampMarks.length === 0) return null;

    return (
      <div className="mt-6">
        <h4 className="text-lg font-semibold mb-4">Captured Frames</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {timestampMarks.map((mark, index) => (
            <div key={index} className="group relative rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow">
              <img
                src={mark.image}
                alt={`Frame at ${mark.label}`}
                className="w-full h-auto"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-0 left-0 right-0 p-3 flex justify-between items-center">
                  <span className="text-white font-medium">
                    {mark.label}
                  </span>
                  <button
                    onClick={() => removeMark(index)}
                    className="text-white hover:text-red-400 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
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
            {/* File Upload Area */}
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
                {!videoUrl ? (
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
                ) : (
                  <p className="text-sm text-gray-600">Click to select a different video</p>
                )}
              </label>
            </div>

            {/* Video Player and Controls - Outside the file upload area */}
            {videoUrl && (
              <div 
                className="space-y-6 bg-gray-50 p-6 rounded-xl border border-gray-200"
                tabIndex={0} // Make div focusable
                onKeyDown={(e) => {
                  if (e.shiftKey) {
                    switch (e.key) {
                      case 'ArrowLeft':
                        e.preventDefault();
                        stepFrame(false);
                        break;
                      case 'ArrowRight':
                        e.preventDefault();
                        stepFrame(true);
                        break;
                    }
                  }
                }}
              >
                {/* Video player */}
                <div className="relative rounded-lg overflow-hidden shadow-lg">
                  <video
                    ref={videoRef}
                    controls
                    src={videoUrl}
                    className="w-full aspect-video bg-black"
                    onLoadedMetadata={handleVideoLoaded}
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>

                {/* Video controls */}
                <VideoControls />

                {/* Captured frames */}
                <CapturedFrames />
              </div>
            )}

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
                    title="Copy text only to clipboard"
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
                    {copySuccess ? 'Copied!' : 'Copy Text Only to Clipboard'}
                  </button>
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="inline-flex items-center px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"
                    title="Export to Word or PDF"
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
                    Export to Word or PDF
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
                      {frameDisplayMode === 'inline' && step.frames && step.frames.length > 0 && (
                        <div className="mt-4 grid grid-cols-2 gap-4">
                          {step.frames.map((frame, fIndex) => (
                            <div key={fIndex} className="relative">
                              <img
                                src={frame.image}
                                alt={`Frame at ${frame.timestamp}`}
                                className="w-full rounded-lg shadow-md"
                              />
                              <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                                {frame.timestamp}
                              </div>
                            </div>
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

      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-semibold text-gray-800">Export Options</h3>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors p-2 hover:bg-gray-100 rounded-full"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-8 space-y-8">
              {/* Export format selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  Export Format
                </label>
                <div className="grid grid-cols-2 gap-6">
                  <button
                    onClick={() => setExportFormat('pdf')}
                    className={`flex items-center justify-center p-6 rounded-xl border-2 transition-all
                      ${exportFormat === 'pdf' 
                        ? 'border-[#CC0000] bg-red-50 text-[#CC0000]' 
                        : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <svg className="w-8 h-8 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span className="text-lg">PDF Document</span>
                  </button>
                  <button
                    onClick={() => setExportFormat('docx')}
                    className={`flex items-center justify-center p-6 rounded-xl border-2 transition-all
                      ${exportFormat === 'docx' 
                        ? 'border-[#CC0000] bg-red-50 text-[#CC0000]' 
                        : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <svg className="w-8 h-8 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-lg">Word Document</span>
                  </button>
                </div>
              </div>

              {/* Image quality selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  Image Quality
                </label>
                <div className="grid grid-cols-3 gap-6">
                  {[
                    { value: 'small', label: 'Standard', desc: '854px (480p)', detail: 'Good for smaller files' },
                    { value: 'medium', label: 'High', desc: '1280px (720p)', detail: 'Recommended' },
                    { value: 'large', label: 'Ultra', desc: '1920px (1080p)', detail: 'Best quality' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setPdfImageSize(option.value as 'small' | 'medium' | 'large')}
                      className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all
                        ${pdfImageSize === option.value 
                          ? 'border-[#CC0000] bg-red-50' 
                          : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <span className="text-base font-medium mb-1">{option.label}</span>
                      <span className="text-sm text-gray-500">{option.desc}</span>
                      <span className="text-xs text-gray-400 mt-2">{option.detail}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Document layout scale */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="text-sm font-medium text-gray-700">
                    Layout Scale
                  </label>
                  <span className="text-sm font-medium text-[#CC0000]">{imageScale}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={imageScale}
                  onChange={(e) => setImageScale(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#CC0000] mb-3"
                />
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Compact</span>
                  <span>Full Width</span>
                </div>
                <p className="text-sm text-gray-500 mt-3">
                  Adjusts how much space images take up in your document
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-6 bg-gray-50 rounded-b-xl">
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-6 py-3 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="px-8 py-3 text-sm font-medium text-white bg-[#CC0000] hover:bg-[#AA0000] rounded-lg transition-colors disabled:opacity-50 flex items-center"
                >
                  {isExporting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Exporting...
                    </>
                  ) : (
                    `Export ${exportFormat.toUpperCase()}`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
