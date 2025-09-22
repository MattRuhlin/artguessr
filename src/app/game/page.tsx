'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ArtworkPanel from '@/components/ArtworkPanel';
import GuessMap from '@/components/GuessMap';
import RoundResult from '@/components/RoundResult';
import Leaderboard from '@/components/Leaderboard';
import { LatLng } from '@/lib/scoring';

interface GameObject {
  objectId: number;
  imageUrl: string;
  title: string;
  artist: string;
  year: string;
  country: string;
  locationDescription: string;
  target: LatLng;
  medium?: string;
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
  const [leaderboardRefreshTrigger, setLeaderboardRefreshTrigger] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const TOTAL_ROUNDS = 5;
  
  const loadNewObject = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/random-object');
      
      if (!response.ok) {
        throw new Error('Failed to load artwork');
      }
      
      const object = await response.json();
      setCurrentObject(object);
      setGuessPosition(null);
      setRoundScore(null);
      
    } catch (error) {
      console.error('Error loading object:', error);
      setError('Failed to load artwork. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    loadNewObject();
  }, [loadNewObject]);
  
  
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
      console.log('Score API result:', result);
      console.log('Result score value:', result.score, 'Type:', typeof result.score);
      setRoundScore(result);
      setTotalScore((prev: number) => {
        const newTotal = prev + result.score;
        console.log('Updating total score:', prev, '+', result.score, '=', newTotal);
        return newTotal;
      });
    } catch (error) {
      console.error('Error submitting guess:', error);
      setError('Failed to calculate score. Please try again.');
    }
  };
  
  const nextRound = () => {
    if (currentRound >= TOTAL_ROUNDS) {
      setGameComplete(true);
    } else {
      setCurrentRound((prev: number) => prev + 1);
      loadNewObject();
    }
  };
  
  const submitToLeaderboard = async (name: string) => {
    try {
      console.log('Submitting to leaderboard:', { name, score: totalScore, scoreType: typeof totalScore });
      const response = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, score: totalScore }),
      });
      
      if (response.ok) {
        // Wait a bit for Redis to sync, then trigger leaderboard refresh and show the modal
        setTimeout(() => {
          setLeaderboardRefreshTrigger(prev => prev + 1);
          setShowLeaderboard(true);
        }, 500);
      } else {
        const errorData = await response.json();
        console.error('Leaderboard submission failed:', errorData);
      }
    } catch (error) {
      console.error('Error submitting to leaderboard:', error);
    }
  };
  
  if (loading && !currentObject) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-white">Loading artwork...</p>
        </div>
      </div>
    );
  }
  
  if (error && !currentObject) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={loadNewObject}
            className="metal-button text-white font-semibold py-2 px-4 rounded-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  if (gameComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center">
        <div className="metal-card rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
          <h1 className="text-3xl font-bold text-center mb-6 metal-title">GAME COMPLETE!</h1>
          <div className="text-center mb-6">
            <p className="text-lg text-white mb-2">Final Score</p>
            <p className="text-4xl font-bold metal-subtitle">{totalScore.toLocaleString()}</p>
          </div>
          
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Enter your name"
              maxLength={24}
              className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-white placeholder-gray-400"
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
              className="w-full metal-button text-white font-semibold py-3 px-4 rounded-lg"
            >
              Submit Score
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full metal-button text-white font-semibold py-3 px-4 rounded-lg"
            >
              Play Again
            </button>
          </div>
        </div>
        
        {showLeaderboard && (
          <Leaderboard 
            onClose={() => {
              setShowLeaderboard(false);
              router.push('/');
            }} 
            refreshTrigger={leaderboardRefreshTrigger}
          />
        )}
      </div>
    );
  }
  
  if (!currentObject) return null;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex flex-col">
      <div className="container mx-auto px-4 py-6 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
          <h1 className="text-2xl font-bold metal-title">METGUESSR</h1>
          <div className="text-lg font-semibold metal-subtitle">
            Round {currentRound} of {TOTAL_ROUNDS}
          </div>
        </div>
        
        {/* Main content area - takes remaining space */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[400px]">
            {/* Controls - left side */}
            <div className="lg:col-span-2 h-full flex flex-col justify-center">
              {!roundScore ? (
                <div className="text-center">
                  {guessPosition ? (
                    <button
                      onClick={submitGuess}
                      className="metal-button text-white font-semibold py-3 px-6 rounded-lg"
                    >
                      Submit Guess
                    </button>
                  ) : (
                    <p className="text-white">Click on the map to place your guess</p>
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
            
            {/* Artwork Panel */}
            <div className="lg:col-span-5 h-full">
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
            <div className="lg:col-span-5 h-full">
              <div className="h-full metal-card rounded-lg shadow-lg overflow-hidden">
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
        </div>
      </div>
    </div>
  );
}

