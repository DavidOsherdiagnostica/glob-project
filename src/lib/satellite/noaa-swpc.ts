import type { SpaceWeatherData, SolarWindPoint } from './types';

const SWPC_SOLAR_WIND_MAG = 'https://services.swpc.noaa.gov/json/solar-wind/mag-7-day.json';
const SWPC_SOLAR_WIND_PLASMA = 'https://services.swpc.noaa.gov/json/solar-wind/plasma-7-day.json';
const SWPC_KP = 'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json';

type SWPCMagRow = [string, string, number, number, number, number, number, number, number];
type SWPCPlasmaRow = [string, string, number, number, number];
type SWPCKpRow = { time_tag: string; kp: number; estimated_kp: number; data_type: string };

function getKpCategory(kp: number): SpaceWeatherData['kpCategory'] {
  if (kp < 2) return 'quiet';
  if (kp < 3) return 'unsettled';
  if (kp < 4) return 'active';
  if (kp < 5) return 'minor-storm';
  if (kp < 7) return 'major-storm';
  return 'severe-storm';
}

export async function fetchSpaceWeather(): Promise<SpaceWeatherData> {
  const [magRes, plasmaRes, kpRes] = await Promise.allSettled([
    fetch(SWPC_SOLAR_WIND_MAG, { next: { revalidate: 300 } }),
    fetch(SWPC_SOLAR_WIND_PLASMA, { next: { revalidate: 300 } }),
    fetch(SWPC_KP, { next: { revalidate: 60 } }),
  ]);

  // Parse magnetic field data
  let bzGsm = 0;
  let btTotal = 0;
  const magHistory: Map<string, { bt: number; bz: number }> = new Map();
  if (magRes.status === 'fulfilled' && magRes.value.ok) {
    const magData: SWPCMagRow[] = await magRes.value.json();
    // Last valid entry
    for (let i = magData.length - 1; i >= 0; i--) {
      const row = magData[i];
      if (row[2] !== null && row[6] !== null) {
        btTotal = row[6]; // Bt
        bzGsm = row[3]; // Bz GSM
        break;
      }
    }
    // Build history (last 24h, 1/5min = ~288 points)
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    for (const row of magData) {
      const t = new Date(row[0] + 'Z').getTime();
      if (t >= cutoff && row[6] !== null) {
        magHistory.set(row[0], { bt: row[6], bz: row[3] });
      }
    }
  }

  // Parse solar wind plasma data
  let solarWindSpeed = 0;
  let solarWindDensity = 0;
  const plasmaHistory: Map<string, { speed: number; density: number }> = new Map();
  if (plasmaRes.status === 'fulfilled' && plasmaRes.value.ok) {
    const plasmaData: SWPCPlasmaRow[] = await plasmaRes.value.json();
    for (let i = plasmaData.length - 1; i >= 0; i--) {
      const row = plasmaData[i];
      if (row[2] !== null && row[3] !== null) {
        solarWindSpeed = row[2];
        solarWindDensity = row[3];
        break;
      }
    }
    for (const row of plasmaData) {
      if (row[2] !== null) {
        plasmaHistory.set(row[0], { speed: row[2], density: row[3] });
      }
    }
  }

  // Parse Kp index
  let kpIndex = 0;
  if (kpRes.status === 'fulfilled' && kpRes.value.ok) {
    const kpData: SWPCKpRow[] = await kpRes.value.json();
    for (let i = kpData.length - 1; i >= 0; i--) {
      if (kpData[i].estimated_kp !== null) {
        kpIndex = kpData[i].estimated_kp;
        break;
      }
    }
  }

  // Build history array
  const allTimes = new Set([...magHistory.keys(), ...plasmaHistory.keys()]);
  const history: SolarWindPoint[] = [];
  for (const t of Array.from(allTimes).sort()) {
    const mag = magHistory.get(t);
    const plasma = plasmaHistory.get(t);
    history.push({
      time: t,
      bt: mag?.bt ?? 0,
      bz: mag?.bz ?? 0,
      speed: plasma?.speed ?? 0,
      density: plasma?.density ?? 0,
    });
  }

  return {
    kpIndex: Math.round(kpIndex * 10) / 10,
    kpCategory: getKpCategory(kpIndex),
    solarWindSpeed: Math.round(solarWindSpeed),
    solarWindDensity: Math.round(solarWindDensity * 10) / 10,
    btTotal: Math.round(btTotal * 10) / 10,
    bzGsm: Math.round(bzGsm * 10) / 10,
    updated: new Date().toISOString(),
    history: history.slice(-2016), // last 7 days at 5min intervals
  };
}
