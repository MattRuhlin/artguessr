import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET() {
  try {
    // Get top 10 scores from Redis sorted set (highest first)
    const scores = (await redis.zrange('leaderboard', 0, 9, { withScores: true, rev: true })) as Array<
      [string, number] | { member: string; score: number }
    >;

    const leaderboard = scores.map((item: [string, number] | { member: string; score: number }) => {
      if (Array.isArray(item)) {
        const [name, score] = item;
        return { name, score: Number(score) };
      }
      return { name: String(item.member), score: Number(item.score) };
    });
    
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
    await redis.zadd('leaderboard', { score, member: sanitizedName });
    
    // Keep only top 10
    await redis.zremrangebyrank('leaderboard', 0, -11);
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error adding to leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to add to leaderboard' },
      { status: 500 }
    );
  }
}

