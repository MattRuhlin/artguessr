'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Leaderboard from '@/components/Leaderboard';

export default function Home() {
  const router = useRouter();
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-gray-900 mb-4">
            ArtGuessr
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Test your knowledge of art history! Guess where famous artworks were created 
            by clicking on the world map. Get points based on how close you are!
          </p>
          
          <div className="space-y-4">
            <button
              onClick={() => router.push('/game')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition-colors shadow-lg"
            >
              Start Game
            </button>
            
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => setShowLeaderboard(true)}
                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                View Leaderboard
              </button>
            </div>
          </div>
          
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">How to Play</h3>
              <p className="text-gray-600">
                Look at the artwork, then click on the map where you think it was created. 
                Get points based on accuracy!
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">5 Rounds</h3>
              <p className="text-gray-600">
                Each game consists of 5 different artworks. Try to get the highest 
                total score possible!
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Leaderboard</h3>
              <p className="text-gray-600">
                Compete with others and see if you can make it to the top 10 
                leaderboard!
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {showLeaderboard && (
        <Leaderboard onClose={() => setShowLeaderboard(false)} />
      )}
    </div>
  );
}