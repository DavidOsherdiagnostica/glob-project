import { NextRequest, NextResponse } from 'next/server';
import { fetchCelesTrakGroup, CELESTRAK_GROUPS } from '@/lib/satellite/celestrak';
import type { SatelliteLayerId } from '@/lib/satellite/types';

export const revalidate = 900; // 15 minutes

export async function GET(req: NextRequest) {
  const group = req.nextUrl.searchParams.get('group') as SatelliteLayerId | null;

  if (!group || !CELESTRAK_GROUPS[group]) {
    return NextResponse.json({ error: 'Invalid group' }, { status: 400 });
  }

  try {
    const records = await fetchCelesTrakGroup(group);
    return NextResponse.json(records, {
      headers: {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    console.error('[TLE API]', err);
    return NextResponse.json({ error: 'Failed to fetch TLE data' }, { status: 502 });
  }
}
