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
      locationDescription: gameObject.locationDescription,
      medium: gameObject.medium
    });
    
    return NextResponse.json(gameObject);
  } catch (error) {
    console.error('Error fetching random object:', error);
    
    // Provide more specific error messages based on the error type
    let errorMessage = 'Failed to fetch random object';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('502') || error.message.includes('503') || error.message.includes('504')) {
        errorMessage = 'The Met Museum API is temporarily unavailable. Please try again in a few moments.';
        statusCode = 503; // Service Unavailable
      } else if (error.message.includes('timeout') || error.message.includes('aborted')) {
        errorMessage = 'Request timed out. The API is responding slowly. Please try again.';
        statusCode = 408; // Request Timeout
      } else if (error.message.includes('Failed to fetch object IDs')) {
        errorMessage = 'Unable to connect to the Met Museum API. Please check your internet connection and try again.';
        statusCode = 502; // Bad Gateway
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      },
      { status: statusCode }
    );
  }
}
