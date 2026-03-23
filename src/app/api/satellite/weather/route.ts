import { NextResponse } from 'next/server';
import { fetchSpaceWeather } from '@/lib/satellite/noaa-swpc';

export const revalidate = 300; // 5 minutes

export async function GET() {
  try {
    const data = await fetchSpaceWeather();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
    });
  } catch (err) {
    console.error('[Weather API]', err);
    return NextResponse.json({ error: 'Failed to fetch space weather' }, { status: 502 });
  }
}
