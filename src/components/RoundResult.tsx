'use client';

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
    if (score >= 7500) return 'text-green-600';     // 0-500km (excellent)
    if (score >= 4500) return 'text-green-500';     // 500-1500km (very good)
    if (score >= 2500) return 'text-yellow-600';    // 1500-2500km (good)
    if (score >= 1000) return 'text-orange-600';    // 2500-3500km (okay)
    if (score >= 500) return 'text-orange-500';     // 3500-4500km (not great)
    return 'text-red-600';                          // 4500km+ (poor/zero)
  };
  
  const getScoreMessage = (score: number) => {
    if (score >= 7500) return 'Perfect!';
    if (score >= 4500) return 'Excellent!';
    if (score >= 2500) return 'Good job!';
    if (score >= 1000) return 'Good guess!';
    if (score >= 500) return 'Not bad!';
    return 'Keep trying!';
  };
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 text-center">
      <h3 className="text-2xl font-bold mb-4">Round Complete!</h3>
      
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-600 mb-1">Your Score</p>
          <p className={`text-4xl font-bold ${getScoreColor(score)}`}>
            {score.toLocaleString()}
          </p>
        </div>
        
        <div>
          <p className="text-sm text-gray-600 mb-1">Distance</p>
          <p className="text-xl font-semibold text-gray-800">
            {distanceKm.toLocaleString()} km away
          </p>
        </div>
        
        <div>
          <p className="text-sm text-gray-600 mb-1">Correct Location</p>
          <p className="text-lg font-semibold text-gray-800">
            {object.locationDescription}
          </p>
        </div>
      </div>
      
      <button
        onClick={onNext}
        className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
      >
        {isLastRound ? 'Finish Game' : 'Next Round'}
      </button>
    </div>
  );
}

