import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function GET() {
  try {
    // Get top 10 scores from KV store
    const scores = await kv.zrevrange('leaderboard', 0, 9, { withScores: true });
    
    const leaderboard = scores.map(([name, score]) => ({
      name: name as string,
      score: score as number
    }));
    
    return NextResponse.json({ scores: leaderboard });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, score } = await request.json();
    
    if (!name || typeof score !== 'number') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
    
    // Sanitize name
    const sanitizedName = name.trim().slice(0, 24).replace(/[^a-zA-Z0-9\s]/g, '');
    
    if (!sanitizedName) {
      return NextResponse.json(
        { error: 'Invalid name' },
        { status: 400 }
      );
    }
    
    // Add to leaderboard (using score as the score for sorting)
    await kv.zadd('leaderboard', { score, member: sanitizedName });
    
    // Keep only top 10
    await kv.zremrangebyrank('leaderboard', 0, -11);
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error adding to leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to add to leaderboard' },
      { status: 500 }
    );
  }
}

