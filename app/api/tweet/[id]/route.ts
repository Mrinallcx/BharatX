import { getTweet } from 'react-tweet/api';
import { NextResponse } from 'next/server';
import { normalizeSyndicationTweet } from '@/lib/normalize-syndication-tweet';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid tweet id' }, { status: 400 });
  }

  try {
    const tweet = await getTweet(id);
    if (!tweet) {
      return NextResponse.json({ error: 'Tweet not found' }, { status: 404 });
    }

    return NextResponse.json({
      data: normalizeSyndicationTweet(tweet as unknown as Parameters<typeof normalizeSyndicationTweet>[0]),
    });
  } catch (error) {
    console.error(`[api/tweet/${id}]`, error);
    return NextResponse.json({ error: 'Failed to fetch tweet' }, { status: 500 });
  }
}
