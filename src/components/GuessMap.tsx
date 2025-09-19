'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useMap } from 'react-leaflet';
import { LatLng } from '@/lib/scoring';
import { reverseGeocode, getCountryCentroid } from '@/lib/location';

// Dynamically import MapContainer to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-200 flex items-center justify-center">Loading map...</div>
});

const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then((mod) => mod.Polyline), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((mod) => mod.Popup), { ssr: false });

// Fix for default markers in React Leaflet - only on client side
const setupLeafletIcons = () => {
  if (typeof window !== 'undefined') {
    import('leaflet').then((L) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });
    });
  }
};

interface GuessMapProps {
  onGuess: (lat: number, lng: number) => void;
  guessPosition?: LatLng;
  targetPosition?: LatLng;
  isRevealed?: boolean;
  className?: string;
}

function MapClickHandler({ onGuess, onProcessingChange }: { 
  onGuess: (lat: number, lng: number) => void;
  onProcessingChange: (processing: boolean) => void;
}) {
  const map = useMap();
  
  useEffect(() => {
    if (!map) return;
    
    const handleClick = async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      onProcessingChange(true);
      
      try {
        // Try to detect the country at the clicked location
        const country = await reverseGeocode(lat, lng);
        
        if (country) {
          // Get the country's centroid and place the pin there
          const countryCentroid = getCountryCentroid(country);
          if (countryCentroid) {
            console.log(`Detected country: ${country}, using centroid:`, countryCentroid);
            onGuess(countryCentroid.lat, countryCentroid.lng);
            onProcessingChange(false);
            return;
          }
        }
        
        // Fallback: use the exact click location if country detection fails
        console.log('Country detection failed, using click location');
        onGuess(lat, lng);
      } catch (error) {
        console.error('Error in country detection:', error);
        // Fallback: use the exact click location
        onGuess(lat, lng);
      } finally {
        onProcessingChange(false);
      }
    };
    
    map.on('click', handleClick);
    return () => {
      if (map && map.off) {
        map.off('click', handleClick);
      }
    };
  }, [map, onGuess, onProcessingChange]);
  
  return null;
}

export default function GuessMap({ 
  onGuess, 
  guessPosition, 
  targetPosition, 
  isRevealed = false,
  className = ''
}: GuessMapProps) {
  const [isClient, setIsClient] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
    setupLeafletIcons();
  }, []);
  
  if (!isClient) {
    return (
      <div className={`w-full h-full bg-gray-800 flex items-center justify-center ${className}`}>
        <span className="text-white">Loading map...</span>
      </div>
    );
  }
  
  return (
    <div className={`w-full h-full relative ${className}`}>
      {/* Loading overlay */}
      {isProcessing && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="metal-card rounded-lg p-4 flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
            <span className="text-white font-medium">Detecting country...</span>
          </div>
        </div>
      )}
      
      <MapContainer
        center={[20, 0]}
        zoom={2}
        className="w-full h-full"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        
        {!isRevealed && (
          <MapClickHandler 
            onGuess={onGuess} 
            onProcessingChange={setIsProcessing}
          />
        )}
        
        {guessPosition && (
          <Marker 
            position={[guessPosition.lat, guessPosition.lng]}
            icon={typeof window !== 'undefined' ? (() => {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const L = require('leaflet');
              return new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
              });
            })() : undefined}
          >
            <Popup>
              <div className="text-center">
                <strong>Your Guess</strong><br />
                {guessPosition.lat.toFixed(4)}, {guessPosition.lng.toFixed(4)}
              </div>
            </Popup>
          </Marker>
        )}
        
        {isRevealed && targetPosition && (
          <Marker 
            position={[targetPosition.lat, targetPosition.lng]}
            icon={typeof window !== 'undefined' ? (() => {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const L = require('leaflet');
              return new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
              });
            })() : undefined}
          >
            <Popup>
              <div className="text-center">
                <strong>Correct Location</strong><br />
                {targetPosition.lat.toFixed(4)}, {targetPosition.lng.toFixed(4)}
              </div>
            </Popup>
          </Marker>
        )}
        
        {isRevealed && guessPosition && targetPosition && (
          <Polyline
            positions={[
              [guessPosition.lat, guessPosition.lng],
              [targetPosition.lat, targetPosition.lng]
            ]}
            color="red"
            weight={3}
            opacity={0.7}
          />
        )}
      </MapContainer>
    </div>
  );
}

