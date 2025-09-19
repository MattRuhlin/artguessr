'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ArtworkPanel from '@/components/ArtworkPanel';
import GuessMap from '@/components/GuessMap';
import RoundResult from '@/components/RoundResult';
import Leaderboard from '@/components/Leaderboard';
import { LatLng } from '@/lib/scoring';
import { preloadNextGameObject } from '@/lib/met';

interface GameObject {
  objectId: number;
  imageUrl: string;
  title: string;
  artist: string;
  year: string;
  country: string;
  locationDescription: string;
  target: LatLng;
}

interface RoundScore {
  score: number;
  distanceKm: number;
  target: LatLng;
  object: GameObject;
}

export default function GamePage() {
  const router = useRouter();
  const [currentObject, setCurrentObject] = useState<GameObject | null>(null);
  const [guessPosition, setGuessPosition] = useState<LatLng | null>(null);
  const [roundScore, setRoundScore] = useState<RoundScore | null>(null);
  const [currentRound, setCurrentRound] = useState(1);
  const [totalScore, setTotalScore] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preloadedObject, setPreloadedObject] = useState<GameObject | null>(null);
  const preloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const TOTAL_ROUNDS = 5;
  
  useEffect(() => {
    loadNewObject();
    
    // Cleanup timeout on unmount
    return () => {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, []);
  
  const loadNewObject = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use preloaded object if available
      if (preloadedObject) {
        setCurrentObject(preloadedObject);
        setPreloadedObject(null);
        setGuessPosition(null);
        setRoundScore(null);
        setLoading(false);
        
        // Start preloading the next object
        startPreloading();
        return;
      }
      
      const response = await fetch('/api/random-object');
      
      if (!response.ok) {
        throw new Error('Failed to load artwork');
      }
      
      const object = await response.json();
      setCurrentObject(object);
      setGuessPosition(null);
      setRoundScore(null);
      
      // Start preloading the next object
      startPreloading();
    } catch (error) {
      console.error('Error loading object:', error);
      setError('Failed to load artwork. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const startPreloading = () => {
    // Clear any existing timeout
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }
    
    // Start preloading after a short delay to not interfere with current loading
    preloadTimeoutRef.current = setTimeout(async () => {
      try {
        const nextObject = await preloadNextGameObject();
        if (nextObject) {
          setPreloadedObject(nextObject);
        }
      } catch (error) {
        console.error('Error preloading next object:', error);
      }
    }, 1000);
  };
  
  const handleGuess = (lat: number, lng: number) => {
    setGuessPosition({ lat, lng });
  };
  
  const submitGuess = async () => {
    if (!currentObject || !guessPosition) return;
    
    try {
      const response = await fetch('/api/round/score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          objectId: currentObject.objectId,
          guess: guessPosition,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to calculate score');
      }
      
      const result = await response.json();
      setRoundScore(result);
      setTotalScore(prev => prev + result.score);
    } catch (error) {
      console.error('Error submitting guess:', error);
      setError('Failed to calculate score. Please try again.');
    }
  };
  
  const nextRound = () => {
    if (currentRound >= TOTAL_ROUNDS) {
      setGameComplete(true);
    } else {
      setCurrentRound(prev => prev + 1);
      loadNewObject();
    }
  };
  
  const submitToLeaderboard = async (name: string) => {
    try {
      const response = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, score: totalScore }),
      });
      
      if (response.ok) {
        setShowLeaderboard(true);
      }
    } catch (error) {
      console.error('Error submitting to leaderboard:', error);
    }
  };
  
  if (loading && !currentObject) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading artwork...</p>
        </div>
      </div>
    );
  }
  
  if (error && !currentObject) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadNewObject}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  if (gameComplete) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
          <h1 className="text-3xl font-bold text-center mb-6">Game Complete!</h1>
          <div className="text-center mb-6">
            <p className="text-lg text-gray-900 mb-2">Final Score</p>
            <p className="text-4xl font-bold text-blue-600">{totalScore.toLocaleString()}</p>
          </div>
          
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Enter your name"
              maxLength={24}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  const name = (e.target as HTMLInputElement).value.trim();
                  if (name) {
                    submitToLeaderboard(name);
                  }
                }
              }}
            />
            <button
              onClick={() => {
                const name = (document.querySelector('input') as HTMLInputElement)?.value.trim();
                if (name) {
                  submitToLeaderboard(name);
                }
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg"
            >
              Submit Score
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-lg"
            >
              Play Again
            </button>
          </div>
        </div>
        
        {showLeaderboard && (
          <Leaderboard onClose={() => setShowLeaderboard(false)} />
        )}
      </div>
    );
  }
  
  if (!currentObject) return null;
  
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="container mx-auto px-4 py-6 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
          <h1 className="text-2xl font-bold text-gray-900">ArtGuessr</h1>
          <div className="text-lg font-semibold text-gray-700">
            Round {currentRound} of {TOTAL_ROUNDS}
          </div>
        </div>
        
        {/* Main content area - takes remaining space */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-[400px]">
            {/* Artwork Panel */}
            <div className="h-full">
              <ArtworkPanel
                imageUrl={currentObject.imageUrl}
                title={currentObject.title}
                artist={currentObject.artist}
                year={currentObject.year}
                country={currentObject.country}
                locationDescription={currentObject.locationDescription}
                isRevealed={!!roundScore}
              />
            </div>
            
            {/* Map Panel */}
            <div className="h-full">
              <div className="h-full bg-white rounded-lg shadow-lg overflow-hidden">
                <GuessMap
                  onGuess={handleGuess}
                  guessPosition={guessPosition || undefined}
                  targetPosition={roundScore?.target || undefined}
                  isRevealed={!!roundScore}
                  className="h-full"
                />
              </div>
            </div>
          </div>
          
          {/* Controls - always at bottom */}
          <div className="mt-6 py-4 flex justify-center flex-shrink-0">
            {!roundScore ? (
              <div className="text-center">
                {guessPosition ? (
                  <button
                    onClick={submitGuess}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg"
                  >
                    Submit Guess
                  </button>
                ) : (
                  <p className="text-gray-600">Click on the map to place your guess</p>
                )}
              </div>
            ) : (
              <RoundResult
                score={roundScore.score}
                distanceKm={roundScore.distanceKm}
                object={roundScore.object}
                onNext={nextRound}
                isLastRound={currentRound >= TOTAL_ROUNDS}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

