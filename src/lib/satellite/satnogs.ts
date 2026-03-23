import type { SatNogsTransmitter, SatNogsSatellite } from './types';

const SATNOGS_BASE = 'https://db.satnogs.org/api';

export async function fetchSatNogsTransmitters(noradId: number): Promise<SatNogsTransmitter[]> {
  const res = await fetch(
    `${SATNOGS_BASE}/transmitters/?format=json&satellite__norad_cat_id=${noradId}&alive=true`,
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function fetchSatNogsSatellite(noradId: number): Promise<SatNogsSatellite | null> {
  const res = await fetch(
    `${SATNOGS_BASE}/satellites/?format=json&norad_cat_id=${noradId}`,
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const results = Array.isArray(data) ? data : data.results ?? [];
  return results[0] ?? null;
}

export function formatFrequency(hz?: number): string {
  if (!hz) return 'N/A';
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(3)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(3)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(1)} kHz`;
  return `${hz} Hz`;
}
