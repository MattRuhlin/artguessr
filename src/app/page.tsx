'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Leaderboard from '@/components/Leaderboard';

export default function Home() {
  const router = useRouter();
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 relative overflow-hidden">
      {/* Muted metal background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(139,0,0,0.1),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(184,134,11,0.03)_25%,rgba(184,134,11,0.03)_50%,transparent_50%,transparent_75%,rgba(184,134,11,0.03)_75%)] bg-[length:30px_30px]"></div>
      </div>
      
      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="text-center">
          <h1 className="text-8xl metal-title metal-glow mb-6">
            METGUESSR
          </h1>
          
          <p className="text-2xl metal-subtitle mb-8 max-w-3xl mx-auto leading-relaxed">
            TEST YOUR KNOWLEDGE OF ART/OBJECT HISTORY  <br /> <br /> GUESS WHERE THINGS FROM THE MET WERE CREATED 
            BY CLICKING ON THE WORLD MAP. GET POINTS BASED ON HOW CLOSE YOU ARE.
          </p>
          
          <div className="flex items-center justify-center space-x-8 mb-8">
            {/* Left spooky frame */}
            <div className="w-32 h-32 spooky-frame spooky-float spooky-glow hidden lg:block">
              <Image 
                src="/spooky/Saturn-Francisco-de-Goya-Museo-del-Prado-Madrid.webp" 
                alt="Saturn Devouring His Son" 
                width={128}
                height={128}
                className="w-full h-full object-cover"
              />
            </div>
            
            <div className="space-y-6">
              <button
                onClick={() => router.push('/game')}
                className="metal-button text-white font-bold py-6 px-12 text-2xl rounded-lg uppercase tracking-wider"
              >
                START GAME
              </button>
              
              <div className="flex justify-center space-x-6">
                <button
                  onClick={() => setShowLeaderboard(true)}
                  className="metal-button text-white font-semibold py-4 px-8 text-lg rounded-lg uppercase tracking-wide"
                >
                  LEADERBOARD
                </button>
              </div>
            </div>
            
            {/* Right spooky frame */}
            <div className="w-32 h-32 spooky-frame spooky-float spooky-glow hidden lg:block" style={{ animationDelay: '1s' }}>
              <Image 
                src="/spooky/goya.webp" 
                alt="Goya Artwork" 
                width={128}
                height={128}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="metal-card rounded-lg p-8 transform hover:scale-105 transition-transform duration-300">
              <h3 className="text-2xl font-bold metal-subtitle mb-4 uppercase tracking-wide">HOW TO PLAY</h3>
              <p className="text-white text-lg leading-relaxed">
                Look at the artwork, then click on the map where you think it was created. 
                Get points based on accuracy! The closer you are, the higher your score!
              </p>
            </div>
            
            <div className="metal-card rounded-lg p-8 transform hover:scale-105 transition-transform duration-300">
              <h3 className="text-2xl font-bold metal-subtitle mb-4 uppercase tracking-wide">5 ROUNDS</h3>
              <p className="text-white text-lg leading-relaxed">
                Each game consists of 5 different artworks. Try to get the highest 
                total score possible and prove your art history knowledge!
              </p>
            </div>
            
            <div className="metal-card rounded-lg p-8 transform hover:scale-105 transition-transform duration-300">
              <h3 className="text-2xl font-bold metal-subtitle mb-4 uppercase tracking-wide">LEADERBOARD</h3>
              <p className="text-white text-lg leading-relaxed">
                Compete with others and see if you can make it to the top 10 
                leaderboard! Only the most knowledgeable art historians will reign supreme!
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