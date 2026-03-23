import * as satellite from 'satellite.js';
import type { TLERecord, SatellitePosition, SatelliteLayerId } from './types';

/**
 * Build TLE lines from GP element set (CelesTrak JSON format).
 * CelesTrak GP JSON already contains TLE_LINE1/TLE_LINE2 if requested.
 */
export function buildTleLines(rec: TLERecord): [string, string] | null {
  if (rec.TLE_LINE1 && rec.TLE_LINE2) {
    return [rec.TLE_LINE1, rec.TLE_LINE2];
  }
  return null;
}

/**
 * Propagate a batch of satellites to the given time.
 * Returns only successfully propagated positions.
 */
export function propagateSatellites(
  records: TLERecord[],
  layerId: SatelliteLayerId,
  now: Date = new Date()
): SatellitePosition[] {
  const positions: SatellitePosition[] = [];

  for (const rec of records) {
    const lines = buildTleLines(rec);
    if (!lines) continue;

    try {
      const satrec = satellite.twoline2satrec(lines[0], lines[1]);
      if (satrec.error !== 0) continue;

      const pv = satellite.propagate(satrec, now);
      if (pv === null || pv === undefined) continue;
      if (!pv.position || typeof pv.position === 'boolean') continue;

      const posVec = pv.position as satellite.EciVec3<number>;
      const gmst = satellite.gstime(now);
      const geo = satellite.eciToGeodetic(posVec, gmst);

      const latDeg = satellite.degreesLat(geo.latitude);
      const lonDeg = satellite.degreesLong(geo.longitude);
      const altKm = geo.height;

      if (!isFinite(latDeg) || !isFinite(lonDeg) || !isFinite(altKm)) continue;
      if (altKm < -100 || altKm > 300000) continue;

      let vel = 0;
      if (pv.velocity && typeof pv.velocity !== 'boolean') {
        const v = pv.velocity as satellite.EciVec3<number>;
        vel = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
      }

      positions.push({
        noradId: rec.NORAD_CAT_ID,
        name: rec.OBJECT_NAME,
        lat: latDeg,
        lon: lonDeg,
        alt: altKm,
        velocity: vel,
        layerId,
      });
    } catch {
      // Skip malformed TLEs
    }
  }

  return positions;
}

/**
 * Get orbital period in minutes from TLE record.
 */
export function getOrbitalPeriod(rec: TLERecord): number {
  return rec.MEAN_MOTION > 0 ? 1440 / rec.MEAN_MOTION : 0;
}

/**
 * Compute detailed orbital parameters for a specific satellite.
 */
export function computeOrbitalDetails(
  rec: TLERecord,
  now: Date = new Date()
): {
  lat: number;
  lon: number;
  alt: number;
  velocity: number;
  period: number;
} | null {
  const lines = buildTleLines(rec);
  if (!lines) return null;

  try {
    const satrec = satellite.twoline2satrec(lines[0], lines[1]);
    if (satrec.error !== 0) return null;

    const pv = satellite.propagate(satrec, now);
    if (pv === null || pv === undefined) return null;
    if (!pv.position || typeof pv.position === 'boolean') return null;

    const posVec = pv.position as satellite.EciVec3<number>;
    const gmst = satellite.gstime(now);
    const geo = satellite.eciToGeodetic(posVec, gmst);

    let vel = 0;
    if (pv.velocity && typeof pv.velocity !== 'boolean') {
      const v = pv.velocity as satellite.EciVec3<number>;
      vel = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    }

    return {
      lat: satellite.degreesLat(geo.latitude),
      lon: satellite.degreesLong(geo.longitude),
      alt: geo.height,
      velocity: vel,
      period: getOrbitalPeriod(rec),
    };
  } catch {
    return null;
  }
}
