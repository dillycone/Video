'use client';

import Card from '../components/Card';

export default function Home() {
  const cards = [
    {
      title: "Generate a Transcript From a Video",
      description: "Convert video content into accurate text transcripts. Upload your video and get a detailed transcript in minutes.",
      icon: "/video.svg"
    },
    {
      title: "Analyze Documents",
      description: "Coming soon: Extract insights and key information from your documents using advanced AI analysis.",
      icon: "/document.svg"
    },
    {
      title: "Image Recognition",
      description: "Coming soon: Identify objects, text, and patterns in images using state-of-the-art computer vision.",
      icon: "/image.svg"
    },
    {
      title: "Audio Processing",
      description: "Coming soon: Process and analyze audio files for speech recognition, music analysis, and more.",
      icon: "/audio.svg"
    }
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <nav className="ti-nav py-4 px-6">
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold">AI Tools</h1>
        </div>
      </nav>

      <div className="bg-white py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-5xl font-bold text-black mb-6">
              AI-Powered Tools
            </h1>
            <p className="text-xl text-gray-600">
              Select a tool to get started with our advanced AI capabilities
            </p>
          </div>
        </div>
      </div>
      
      <main className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {cards.map((card, index) => (
            <div 
              key={index} 
              className="animate-fade-in-up" 
              style={{ 
                animationDelay: `${index * 150}ms`,
                animationFillMode: 'backwards'
              }}
            >
              <Card
                title={card.title}
                description={card.description}
                icon={card.icon}
                onClick={() => console.log(`Clicked ${card.title}`)}
              />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
