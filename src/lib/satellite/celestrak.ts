import type { TLERecord, SatelliteLayerId } from './types';

const CELESTRAK_BASE = 'https://celestrak.org/NORAD/elements/gp.php';

export const CELESTRAK_GROUPS: Record<SatelliteLayerId, string> = {
  iss: 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=json',
  active: `${CELESTRAK_BASE}?GROUP=active&FORMAT=json`,
  starlink: `${CELESTRAK_BASE}?GROUP=starlink&FORMAT=json`,
  gps: `${CELESTRAK_BASE}?GROUP=gps-ops&FORMAT=json`,
  glonass: `${CELESTRAK_BASE}?GROUP=glonass-ops&FORMAT=json`,
  beidou: `${CELESTRAK_BASE}?GROUP=beidou&FORMAT=json`,
  weather: `${CELESTRAK_BASE}?GROUP=weather&FORMAT=json`,
  oneweb: `${CELESTRAK_BASE}?GROUP=oneweb&FORMAT=json`,
  debris: `${CELESTRAK_BASE}?GROUP=fengyun-1c-debris&FORMAT=json`,
};

/**
 * Fetch TLE/GP data from CelesTrak for a given layer.
 * Returns array of GP records with TLE_LINE1/TLE_LINE2.
 * Retries up to 3 times with a 10 s timeout per attempt.
 */
export async function fetchCelesTrakGroup(layerId: SatelliteLayerId): Promise<TLERecord[]> {
  const url = CELESTRAK_GROUPS[layerId];
  const TIMEOUT_MS = 10_000;
  const MAX_ATTEMPTS = 3;

  let lastError: Error | undefined;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        next: { revalidate: 900 },
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`CelesTrak fetch failed: ${res.status}`);
      const data: CelesTrakGPRecord[] = await res.json();
      if (!Array.isArray(data)) throw new Error('CelesTrak returned non-array response');
      return data.map(convertGPToTLE);
    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

interface CelesTrakGPRecord {
  OBJECT_NAME: string;
  OBJECT_ID?: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE: number;
  CLASSIFICATION_TYPE: string;
  NORAD_CAT_ID: number;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
  // CelesTrak may also return pre-built TLE lines
  TLE_LINE1?: string;
  TLE_LINE2?: string;
}

function pad(n: number, width: number, decimals = 0): string {
  const s = n.toFixed(decimals);
  return s.padStart(width);
}

function formatScientific(n: number): string {
  // TLE scientific notation: ±NNNNN±N  (e.g., 00000-0 or 12345-3)
  if (n === 0) return ' 00000-0';
  const exp = Math.floor(Math.log10(Math.abs(n))) + 1;
  const mantissa = Math.round(Math.abs(n) * Math.pow(10, 5 - exp));
  const sign = n < 0 ? '-' : '+';
  const expSign = exp <= 0 ? '-' : '+';
  return `${sign}${String(mantissa).padStart(5, '0')}${expSign}${Math.abs(exp)}`;
}

/**
 * Build TLE Line 1 and Line 2 from CelesTrak GP JSON fields.
 * CelesTrak GP JSON provides all the orbital elements needed.
 */
function convertGPToTLE(gp: CelesTrakGPRecord): TLERecord {
  // If CelesTrak provides pre-built TLE lines, use them directly
  if (gp.TLE_LINE1 && gp.TLE_LINE2) {
    return {
      ...gp,
      TLE_LINE1: gp.TLE_LINE1,
      TLE_LINE2: gp.TLE_LINE2,
    };
  }

  // Build TLE lines from numeric fields
  const epoch = new Date(gp.EPOCH);
  const year = epoch.getUTCFullYear() % 100;
  const startOfYear = new Date(Date.UTC(epoch.getUTCFullYear(), 0, 1));
  const dayOfYear = (epoch.getTime() - startOfYear.getTime()) / 86400000 + 1;
  const epochStr = `${String(year).padStart(2, '0')}${dayOfYear.toFixed(8).padStart(12, '0')}`;

  const noradStr = String(gp.NORAD_CAT_ID).padStart(5, '0');
  const classType = gp.CLASSIFICATION_TYPE || 'U';
  const intlDesig = (gp.OBJECT_ID || '').replace(/-/g, '').substring(0, 8).padEnd(8, ' ');
  const elemSetNo = String(gp.ELEMENT_SET_NO || 999).padStart(4);

  // Line 1
  const line1Body = `1 ${noradStr}${classType} ${intlDesig} ${epochStr} ${formatScientific(gp.MEAN_MOTION_DOT)} ${formatScientific(gp.MEAN_MOTION_DDOT)} ${formatScientific(gp.BSTAR)} ${gp.EPHEMERIS_TYPE || 0} ${elemSetNo}`;
  const line1 = line1Body + checksum(line1Body);

  // Line 2
  const incl = gp.INCLINATION.toFixed(4).padStart(8);
  const raan = gp.RA_OF_ASC_NODE.toFixed(4).padStart(8);
  const ecc = gp.ECCENTRICITY.toFixed(7).substring(2); // remove "0."
  const argP = gp.ARG_OF_PERICENTER.toFixed(4).padStart(8);
  const ma = gp.MEAN_ANOMALY.toFixed(4).padStart(8);
  const mm = gp.MEAN_MOTION.toFixed(8).padStart(11);
  const rev = String(Math.round(gp.REV_AT_EPOCH || 0)).padStart(5);
  const line2Body = `2 ${noradStr} ${incl} ${raan} ${ecc} ${argP} ${ma} ${mm}${rev}`;
  const line2 = line2Body + checksum(line2Body);

  return {
    ...gp,
    TLE_LINE1: line1,
    TLE_LINE2: line2,
  };
}

function checksum(line: string): number {
  let sum = 0;
  for (const c of line) {
    if (c === '-') sum += 1;
    else if (c >= '0' && c <= '9') sum += parseInt(c);
  }
  return sum % 10;
}
