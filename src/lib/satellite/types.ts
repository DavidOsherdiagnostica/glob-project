// Core types for satellite tracking dashboard

export interface TLERecord {
  OBJECT_NAME: string;
  OBJECT_ID?: string;
  NORAD_CAT_ID: number;
  CLASSIFICATION_TYPE?: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE?: number;
  ELEMENT_SET_NO?: number;
  REV_AT_EPOCH?: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
  // Computed TLE lines (built from GP elements)
  TLE_LINE1?: string;
  TLE_LINE2?: string;
}

export interface SatelliteLayer {
  id: SatelliteLayerId;
  label: string;
  group: string; // CelesTrak GROUP param or special
  color: string;
  glowColor: string;
  enabled: boolean;
  count: number;
  loaded: boolean;
  records: TLERecord[];
}

export type SatelliteLayerId =
  | 'iss'
  | 'active'
  | 'starlink'
  | 'gps'
  | 'glonass'
  | 'beidou'
  | 'weather'
  | 'oneweb'
  | 'debris';

export interface SatellitePosition {
  noradId: number;
  name: string;
  lat: number;
  lon: number;
  alt: number; // km
  velocity: number; // km/s
  layerId: SatelliteLayerId;
}

export interface SelectedSatellite {
  noradId: number;
  name: string;
  layerId: SatelliteLayerId;
  lat: number;
  lon: number;
  alt: number;
  velocity: number;
  inclination: number;
  eccentricity: number;
  period: number; // minutes
  epoch: string;
  raan: number; // right ascension of ascending node
  argPerigee: number;
  bstar: number;
  transmitters?: SatNogsTransmitter[];
}

export interface ISSPosition {
  latitude: number;
  longitude: number;
  altitude?: number;
  velocity?: number;
  timestamp: number;
}

export interface SpaceWeatherData {
  kpIndex: number;
  kpCategory: 'quiet' | 'unsettled' | 'active' | 'minor-storm' | 'major-storm' | 'severe-storm';
  solarWindSpeed: number; // km/s
  solarWindDensity: number; // protons/cm³
  btTotal: number; // nT
  bzGsm: number; // nT - southward component drives geomagnetic storms
  updated: string;
  history: SolarWindPoint[];
}

export interface SolarWindPoint {
  time: string;
  speed: number;
  density: number;
  bt: number;
  bz: number;
}

export interface SatNogsTransmitter {
  uuid: string;
  description: string;
  alive: boolean;
  type: string;
  uplink_low?: number;
  uplink_high?: number;
  downlink_low?: number;
  downlink_high?: number;
  mode?: string;
  sat_id: string;
}

export interface SatNogsSatellite {
  norad_cat_id: number;
  name: string;
  names?: string;
  image?: string;
  status: string;
  decayed?: string;
  launched?: string;
  deployed?: string;
  website?: string;
  operator?: string;
  countries?: string;
  telemetries?: unknown[];
}

export interface PassPrediction {
  startAz: number;
  startAzCompass: string;
  startEl: number;
  startUTC: number;
  maxAz: number;
  maxAzCompass: string;
  maxEl: number;
  maxUTC: number;
  endAz: number;
  endAzCompass: string;
  endEl: number;
  endUTC: number;
  mag?: number;
  duration: number;
}

export interface AISVessel {
  mmsi: string;
  shipName: string;
  lat: number;
  lon: number;
  speed: number; // knots
  course: number; // degrees
  heading?: number;
  shipType?: number;
  destination?: string;
  status?: number;
  timestamp: number;
}

export interface LayerFilters {
  altMin: number; // km
  altMax: number; // km
  inclMin: number;
  inclMax: number;
}

export const DEFAULT_LAYER_FILTERS: LayerFilters = {
  altMin: 0,
  altMax: 40000,
  inclMin: 0,
  inclMax: 180,
};
