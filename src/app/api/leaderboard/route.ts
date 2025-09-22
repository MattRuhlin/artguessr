import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET() {
  try {
    // Get top 10 scores from Redis sorted set (highest first)
    const scores = await redis.zrange('leaderboard', 0, 9, { withScores: true, rev: true });

    console.log('Raw scores from Redis:', scores);
    console.log('Raw scores type:', typeof scores, 'is Array:', Array.isArray(scores));
    
    let leaderboard: Array<{ name: string; score: number }> = [];
    
    // Helper function to extract name from unique member string
    const extractNameFromMember = (member: string): string => {
      // Member format: "name|timestamp|randomId" or just "name" for old entries
      const parts = member.split('|');
      return parts[0] || member; // Return the first part (name) or the whole string if no separator
    };
    
    if (Array.isArray(scores)) {
      // Handle different return formats from Redis
      if (scores.length > 0 && Array.isArray(scores[0])) {
        // Format: [['name1', score1], ['name2', score2], ...]
        leaderboard = scores.map((item: unknown) => {
          const [member, score] = item as [string, number];
          const name = extractNameFromMember(String(member || ''));
          const processed = { name, score: Number(score) };
          console.log('Processing array item:', item, '->', processed);
          return processed;
        }).filter(entry => entry.name && !isNaN(entry.score));
      } else if (typeof scores[0] === 'string' && scores.length === 2) {
        // Format: ['name', score] for single entry
        const [member, score] = scores;
        const name = extractNameFromMember(String(member || ''));
        const processed = { name, score: Number(score) };
        console.log('Processing single entry:', scores, '->', processed);
        if (processed.name && !isNaN(processed.score)) {
          leaderboard = [processed];
        }
      } else {
        // Try to process alternated format: ['name1', score1, 'name2', score2, ...]
        leaderboard = [];
        for (let i = 0; i < scores.length; i += 2) {
          if (typeof scores[i] === 'string' && typeof scores[i + 1] === 'number') {
            const name = extractNameFromMember(String(scores[i]));
            const processed = { name, score: Number(scores[i + 1]) };
            console.log('Processing alternated item:', [scores[i], scores[i + 1]], '->', processed);
            if (processed.name && !isNaN(processed.score)) {
              leaderboard.push(processed);
            }
          }
        }
      }
    }
    
    console.log('Final leaderboard:', leaderboard);
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
    
    console.log('Leaderboard POST received:', { name, score, scoreType: typeof score, isNaN: isNaN(score) });
    
    if (!name || typeof score !== 'number' || isNaN(score) || score < 0) {
      console.log('Invalid request body:', { name, score, scoreType: typeof score, isNaN: isNaN(score) });
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
    
    // Create a unique member ID using timestamp and random string to allow multiple entries with same name
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const uniqueMember = `${sanitizedName}|${timestamp}|${randomId}`;
    
    // Add to leaderboard (using score as the score for sorting)
    console.log('Adding to Redis:', { score, member: uniqueMember });
    await redis.zadd('leaderboard', { score, member: uniqueMember });
    
    // Keep only top 10 to manage storage
    // Since the sorted set keeps highest scores first, we remove ranks 10 to end (keeping 0-9)
    const currentSize = await redis.zcard('leaderboard');
    if (currentSize > 10) {
      await redis.zremrangebyrank('leaderboard', 10, -1);
    }
    
    console.log('Successfully added to leaderboard');
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error adding to leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to add to leaderboard' },
      { status: 500 }
    );
  }
}

