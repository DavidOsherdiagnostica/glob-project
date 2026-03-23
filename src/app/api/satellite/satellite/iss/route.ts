import { NextResponse } from 'next/server';

export const revalidate = 0; // Always fresh

interface OpenNotifyResponse {
  iss_position: { latitude: string; longitude: string };
  message: string;
  timestamp: number;
}

interface AstronautResponse {
  people: { name: string; craft: string }[];
  message: string;
  number: number;
}

export async function GET() {
  try {
    const [posRes, astroRes] = await Promise.allSettled([
      fetch('http://api.open-notify.org/iss-now.json', { cache: 'no-store' }),
      fetch('http://api.open-notify.org/astros.json', { next: { revalidate: 3600 } }),
    ]);

    let position = null;
    if (posRes.status === 'fulfilled' && posRes.value.ok) {
      const data: OpenNotifyResponse = await posRes.value.json();
      position = {
        latitude: parseFloat(data.iss_position.latitude),
        longitude: parseFloat(data.iss_position.longitude),
        timestamp: data.timestamp,
      };
    }

    let crew: string[] = [];
    if (astroRes.status === 'fulfilled' && astroRes.value.ok) {
      const data: AstronautResponse = await astroRes.value.json();
      crew = data.people.filter((p) => p.craft === 'ISS').map((p) => p.name);
    }

    return NextResponse.json({ position, crew }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[ISS API]', err);
    return NextResponse.json({ error: 'Failed to fetch ISS data' }, { status: 502 });
  }
}
