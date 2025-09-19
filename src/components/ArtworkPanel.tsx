'use client';

import { useState } from 'react';

interface ArtworkPanelProps {
  imageUrl: string;
  title: string;
  artist: string;
  year: string;
  country: string;
  locationDescription?: string;
  isRevealed?: boolean;
}

export default function ArtworkPanel({ 
  imageUrl, 
  title, 
  artist, 
  year, 
  country, 
  locationDescription,
  isRevealed = false 
}: ArtworkPanelProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="flex-1 relative">
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Loading artwork...</p>
            </div>
          </div>
        )}
        {imageError ? (
          <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <p className="text-sm">Failed to load image</p>
            </div>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={title}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            loading="eager"
          />
        )}
      </div>
      <div className="p-4 bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-sm text-gray-600 mb-1">
          <span className="font-medium">Artist:</span> {artist}
        </p>
        <p className="text-sm text-gray-600 mb-1">
          <span className="font-medium">Date:</span> {year}
        </p>
        {isRevealed && (
          <p className="text-sm text-gray-600">
            <span className="font-medium">Location:</span> {locationDescription || country}
          </p>
        )}
      </div>
    </div>
  );
}

