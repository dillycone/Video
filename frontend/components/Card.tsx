'use client';

import React from 'react';
import Image from 'next/image';

interface CardProps {
  title: string;
  description: string;
  icon: string;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ 
  title, 
  description, 
  icon, 
  onClick 
}) => {
  return (
    <div className="bg-white shadow-lg rounded-lg p-8 text-center hover:shadow-xl transition-shadow duration-200">
      {/* Icon Container */}
      <div className="mb-6">
        <div className="inline-flex items-center justify-center w-20 h-20 
          bg-[#CC0000]/10 text-[#CC0000] rounded-full">
          <Image
            src={icon}
            alt={title}
            width={32}
            height={32}
            className="w-8 h-8"
          />
        </div>
      </div>

      {/* Content */}
      <h2 className="text-2xl font-bold mb-4 text-black">
        {title}
      </h2>
      <p className="text-gray-600 mb-8">
        {description}
      </p>

      {/* Button */}
      <button 
        onClick={onClick}
        className="ti-button px-6 py-2 rounded-md font-semibold flex items-center justify-center gap-2 w-full"
      >
        Get Started
        <span className="text-xl">→</span>
      </button>
    </div>
  );
}

export default Card;
