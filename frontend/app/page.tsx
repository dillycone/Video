'use client';

import { useRouter } from 'next/navigation';
import Card from '../components/Card';

export default function Home() {
  const router = useRouter();

  const cards = [
    {
      title: "Generate a Transcript From a Video",
      description: "Convert video content into accurate text transcripts. Upload your video and get a detailed transcript in minutes.",
      icon: "/video.svg",
      path: "/video-transcription"
    },
    {
      title: "Generate Procedure From Video",
      description: "Transform video content into detailed, step-by-step procedures. Upload your video and get a comprehensive guide with prerequisites, steps, and verification points.",
      icon: "/document.svg",
      path: "/video-procedure"
    },
    {
      title: "Procedure Generation with Additional Context",
      description: "Create enhanced step-by-step procedures from videos with additional contextual PDF information, detailed annotations, and comprehensive guidance.",
      icon: "/image.svg",
      path: "/video-procedure-context"
    },
    {
      title: "Generate GUI-based Procedure",
      description: "Create detailed procedures from GUI demonstrations. Upload your screen recording to get comprehensive documentation with interface interactions, visual cues, and confirmation points.",
      icon: "/window.svg",
      path: "/gui-procedure"
    }
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <div className="bg-[#CC0000] text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-5xl font-bold mb-6">
              Video Processing Tools
            </h1>
            <p className="text-xl">
              Select a tool to get started with your specific use case
            </p>
          </div>
        </div>
      </div>
      
      <main className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {cards.map((card, index) => (
            <Card
              key={index}
              title={card.title}
              description={card.description}
              icon={card.icon}
              onClick={() => card.path ? router.push(card.path) : null}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
