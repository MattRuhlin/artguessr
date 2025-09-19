import { NextResponse } from 'next/server';
import { getRandomGameObject } from '@/lib/met';
import { storeTarget } from '../round/score/route';

export async function GET() {
  try {
    const gameObject = await getRandomGameObject();
    
    // Store the target for scoring
    storeTarget(gameObject.objectId, gameObject.target, {
      objectId: gameObject.objectId,
      imageUrl: gameObject.imageUrl,
      title: gameObject.title,
      artist: gameObject.artist,
      year: gameObject.year,
      country: gameObject.country,
      locationDescription: gameObject.locationDescription
    });
    
    return NextResponse.json(gameObject);
  } catch (error) {
    console.error('Error fetching random object:', error);
    return NextResponse.json(
      { error: 'Failed to fetch random object' },
      { status: 500 }
    );
  }
}
