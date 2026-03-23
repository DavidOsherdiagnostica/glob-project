import { NextRequest, NextResponse } from 'next/server';
import { fetchSatNogsTransmitters, fetchSatNogsSatellite } from '@/lib/satellite/satnogs';

export async function GET(req: NextRequest) {
  const noradId = req.nextUrl.searchParams.get('norad');
  if (!noradId) {
    return NextResponse.json({ error: 'Missing norad param' }, { status: 400 });
  }

  const id = parseInt(noradId);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid norad id' }, { status: 400 });
  }

  try {
    const [transmitters, satellite] = await Promise.allSettled([
      fetchSatNogsTransmitters(id),
      fetchSatNogsSatellite(id),
    ]);

    return NextResponse.json({
      transmitters: transmitters.status === 'fulfilled' ? transmitters.value : [],
      satellite: satellite.status === 'fulfilled' ? satellite.value : null,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600' },
    });
  } catch (err) {
    console.error('[SatNOGS API]', err);
    return NextResponse.json({ transmitters: [], satellite: null }, { status: 200 });
  }
}
