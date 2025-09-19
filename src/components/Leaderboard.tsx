'use client';

import { useEffect, useState } from 'react';

interface LeaderboardEntry {
  name: string;
  score: number;
}

interface LeaderboardProps {
  onClose: () => void;
}

export default function Leaderboard({ onClose }: LeaderboardProps) {
  const [scores, setScores] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchLeaderboard();
  }, []);
  
  const fetchLeaderboard = async () => {
    try {
      const response = await fetch('/api/leaderboard');
      if (response.ok) {
        const data = await response.json();
        setScores(data.scores || []);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="metal-card rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-600">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold metal-title">LEADERBOARD</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>
        </div>
        
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
              <p className="mt-2 text-white">Loading...</p>
            </div>
          ) : scores.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-white">No scores yet. Be the first!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scores.map((entry, index) => (
                <div
                  key={index}
                  className={`flex justify-between items-center p-3 rounded-lg ${
                    index === 0 ? 'bg-yellow-900 border border-yellow-600' :
                    index === 1 ? 'bg-gray-700 border border-gray-500' :
                    index === 2 ? 'bg-orange-900 border border-orange-600' :
                    'bg-gray-800 border border-gray-600'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className={`text-lg font-bold ${
                      index === 0 ? 'text-yellow-400' :
                      index === 1 ? 'text-gray-300' :
                      index === 2 ? 'text-orange-400' :
                      'text-gray-400'
                    }`}>
                      #{index + 1}
                    </span>
                    <span className="font-medium text-white">{entry.name}</span>
                  </div>
                  <span className="text-lg font-bold metal-subtitle">
                    {entry.score.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

