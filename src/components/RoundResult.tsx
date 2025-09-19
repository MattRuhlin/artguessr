'use client';

import Image from 'next/image';

interface GameObject {
  objectId: number;
  imageUrl: string;
  title: string;
  artist: string;
  year: string;
  country: string;
  locationDescription: string;
  medium?: string;
}

interface RoundResultProps {
  score: number;
  distanceKm: number;
  object: GameObject;
  onNext: () => void;
  isLastRound?: boolean;
}

export default function RoundResult({ 
  score, 
  distanceKm, 
  object,
  onNext, 
  isLastRound = false 
}: RoundResultProps) {
  const getScoreColor = (score: number) => {
    if (score >= 5000) return 'text-green-600';     // Perfect (0km)
    if (score >= 4000) return 'text-green-500';     // Excellent (0-2000km)
    if (score >= 2500) return 'text-yellow-600';    // Good job (2000-3750km)
    if (score >= 1000) return 'text-orange-600';    // Good guess (3750-7000km)
    if (score >= 500) return 'text-orange-500';     // Not bad (7000-8500km)
    return 'text-red-600';                          // Keep trying (8500km+)
  };
  

  const getKirbyImage = (score: number) => {
    if (score >= 5000) return { src: '/kirby/perfect.png', alt: 'Perfect Kirby' };
    if (score >= 4000) return { src: '/kirby/good.png', alt: 'Great Kirby' };
    if (score >= 1500) return { src: '/kirby/okay.png', alt: 'Okay Kirby' };
    return { src: '/kirby/bad.png', alt: 'Bad Kirby' };
  };
  
  const kirbyImage = getKirbyImage(score);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="metal-card rounded-lg shadow-lg p-6 text-center w-full max-w-md">
        <h3 className="text-2xl font-bold mb-4 metal-title">ROUND COMPLETE!</h3>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm text-white mb-1">Your Score</p>
            <p className={`text-4xl font-bold ${getScoreColor(score)}`}>
              {score.toLocaleString()}
            </p>
          </div>
          
          <div>
            <p className="text-sm text-white mb-1">Distance</p>
            <p className="text-xl font-semibold text-white">
              {distanceKm.toLocaleString()} km away
            </p>
          </div>
          
          <div>
            <p className="text-sm text-white mb-1">Correct Location</p>
            <p className="text-lg font-semibold text-white">
              {object.locationDescription}
            </p>
          </div>
        </div>
        
        <button
          onClick={onNext}
          className="mt-6 metal-button text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {isLastRound ? 'Finish Game' : 'Next Round'}
        </button>
      </div>
      
      <div className="w-full max-w-lg flex justify-center">
        <Image
          src={kirbyImage.src}
          alt={kirbyImage.alt}
          width={500}
          height={500}
          className="w-full h-auto"
          priority
        />
      </div>
    </div>
  );
}

