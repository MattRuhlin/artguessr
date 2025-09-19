import { NextRequest, NextResponse } from 'next/server';
import { haversineKm, roundScore } from '@/lib/scoring';

// In-memory store for current round targets
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

const currentTargets = new Map<number, { target: { lat: number; lng: number }; object: GameObject }>();

export async function POST(request: NextRequest) {
  try {
    const { objectId, guess } = await request.json();
    
    if (!objectId || !guess || typeof guess.lat !== 'number' || typeof guess.lng !== 'number') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
    
    // Get the target from our in-memory store
    let targetData = currentTargets.get(objectId);
    
    // If not found in memory (e.g., due to server restart), try to refetch the object
    if (!targetData) {
      try {
        // Import here to avoid circular dependency
        const { fetchObject } = await import('@/lib/met');
        const { getCountryCentroid } = await import('@/lib/location');
        
        const object = await fetchObject(objectId);
        
        if (!object.isPublicDomain) {
          throw new Error('Object not public domain');
        }
        
        if (!object.country || object.country.trim() === '') {
          throw new Error('Object does not have country data');
        }
        
        // Always use country centroid - no complex geocoding
        const target = getCountryCentroid(object.country);
        if (!target) {
          throw new Error(`Could not find country centroid for "${object.country}"`);
        }
        
        // Reconstruct the object data
        const reconstructedObject = {
          objectId: object.objectID,
          imageUrl: object.primaryImageSmall || object.primaryImage,
          title: object.title || 'Untitled',
          artist: object.artistDisplayName || 'Unknown Artist',
          year: object.objectDate || 'Unknown Date',
          country: object.country,
          locationDescription: object.country, // Just show the country
          medium: (object.medium || '').trim() || undefined
        };
        
        targetData = { target, object: reconstructedObject };
      } catch (error) {
        console.error('Failed to reconstruct target data:', error);
        return NextResponse.json(
          { error: 'Object not found or round expired' },
          { status: 404 }
        );
      }
    }
    
    const { target, object } = targetData;
    
    // Calculate distance and score
    const distanceKm = haversineKm(guess, target);
    const score = roundScore(distanceKm);
    
    console.log('Score calculation:', { distanceKm, score, scoreType: typeof score });
    
    // Clean up the target from memory
    currentTargets.delete(objectId);
    
    const response = {
      score,
      distanceKm: Math.round(distanceKm),
      target,
      object
    };
    
    console.log('Returning score response:', response);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error calculating score:', error);
    return NextResponse.json(
      { error: 'Failed to calculate score' },
      { status: 500 }
    );
  }
}

// Helper function to store target for a round
export function storeTarget(objectId: number, target: { lat: number; lng: number }, object: GameObject) {
  currentTargets.set(objectId, { target, object });
}

