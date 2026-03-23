import { NextRequest, NextResponse } from 'next/server';
import type { PassPrediction } from '@/lib/satellite/types';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const noradId = params.get('norad');
  const lat = params.get('lat');
  const lon = params.get('lon');
  const alt = params.get('alt') ?? '0';
  const days = params.get('days') ?? '3';
  const minEl = params.get('minEl') ?? '10';

  if (!noradId || !lat || !lon) {
    return NextResponse.json({ error: 'Missing norad, lat, lon params' }, { status: 400 });
  }

  const apiKey = process.env.N2YO_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'N2YO_API_KEY not configured', passes: [] },
      { status: 200 }
    );
  }

  try {
    const url = `https://api.n2yo.com/rest/v1/satellite/visualpasses/${noradId}/${lat}/${lon}/${alt}/${days}/${minEl}/&apiKey=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`N2YO error: ${res.status}`);

    const data = await res.json();
    const passes: PassPrediction[] = (data.passes ?? []).map(
      (p: Record<string, number | string>) => ({
        startAz: p.startAz,
        startAzCompass: p.startAzCompass,
        startEl: p.startEl,
        startUTC: p.startUTC,
        maxAz: p.maxAz,
        maxAzCompass: p.maxAzCompass,
        maxEl: p.maxEl,
        maxUTC: p.maxUTC,
        endAz: p.endAz,
        endAzCompass: p.endAzCompass,
        endEl: p.endEl,
        endUTC: p.endUTC,
        mag: p.mag,
        duration: (p.endUTC as number) - (p.startUTC as number),
      })
    );

    return NextResponse.json({ passes, satName: data.info?.satName });
  } catch (err) {
    console.error('[Passes API]', err);
    return NextResponse.json({ error: 'Pass prediction failed', passes: [] }, { status: 200 });
  }
}
