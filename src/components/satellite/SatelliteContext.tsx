'use client';

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react';
import type {
  SatelliteLayer,
  SatelliteLayerId,
  SelectedSatellite,
  SpaceWeatherData,
  ISSPosition,
  TLERecord,
  LayerFilters,
} from '@/lib/satellite/types';
import { DEFAULT_LAYER_FILTERS } from '@/lib/satellite/types';

// ---------- Layer config ----------

export const LAYER_CONFIGS: Record<
  SatelliteLayerId,
  Pick<SatelliteLayer, 'label' | 'group' | 'color' | 'glowColor'>
> = {
  iss:     { label: 'ISS',       group: 'iss',     color: '#ff6600', glowColor: 'rgba(255,102,0,0.6)' },
  active:  { label: 'Active',    group: 'active',  color: '#00ffff', glowColor: 'rgba(0,255,255,0.6)' },
  starlink:{ label: 'Starlink',  group: 'starlink',color: '#7b00ff', glowColor: 'rgba(123,0,255,0.6)' },
  gps:     { label: 'GPS',       group: 'gps',     color: '#00ff88', glowColor: 'rgba(0,255,136,0.6)' },
  glonass: { label: 'GLONASS',   group: 'glonass', color: '#ffe600', glowColor: 'rgba(255,230,0,0.6)' },
  beidou:  { label: 'BeiDou',    group: 'beidou',  color: '#ff8800', glowColor: 'rgba(255,136,0,0.6)' },
  weather: { label: 'Weather',   group: 'weather', color: '#00aaff', glowColor: 'rgba(0,170,255,0.6)' },
  oneweb:  { label: 'OneWeb',    group: 'oneweb',  color: '#ff00ff', glowColor: 'rgba(255,0,255,0.6)' },
  debris:  { label: 'Debris',    group: 'debris',  color: '#ff0040', glowColor: 'rgba(255,0,64,0.6)' },
};

export const LAYER_ORDER: SatelliteLayerId[] = [
  'iss', 'active', 'starlink', 'gps', 'glonass', 'beidou', 'weather', 'oneweb', 'debris',
];

// ---------- State ----------

interface LayerState {
  enabled: boolean;
  count: number;
  loaded: boolean;
  records: TLERecord[];
}

type LayersMap = Record<SatelliteLayerId, LayerState>;

type Action =
  | { type: 'TOGGLE_LAYER'; id: SatelliteLayerId }
  | { type: 'SET_LAYER_DATA'; id: SatelliteLayerId; records: TLERecord[] }
  | { type: 'SET_ALL_ENABLED'; enabled: boolean };

function initialLayerState(): LayersMap {
  const map = {} as LayersMap;
  for (const id of LAYER_ORDER) {
    map[id] = { enabled: id === 'iss' || id === 'active', count: 0, loaded: false, records: [] };
  }
  return map;
}

function layersReducer(state: LayersMap, action: Action): LayersMap {
  switch (action.type) {
    case 'TOGGLE_LAYER':
      return { ...state, [action.id]: { ...state[action.id], enabled: !state[action.id].enabled } };
    case 'SET_LAYER_DATA':
      return {
        ...state,
        [action.id]: {
          ...state[action.id],
          records: action.records,
          count: action.records.length,
          loaded: true,
        },
      };
    case 'SET_ALL_ENABLED': {
      const next = { ...state };
      for (const id of LAYER_ORDER) {
        next[id] = { ...next[id], enabled: action.enabled };
      }
      return next;
    }
    default:
      return state;
  }
}

// ---------- Context ----------

interface SatCtxValue {
  layers: LayersMap;
  dispatch: Dispatch<Action>;
  selected: SelectedSatellite | null;
  setSelected: (sat: SelectedSatellite | null) => void;
  weather: SpaceWeatherData | null;
  setWeather: (w: SpaceWeatherData | null) => void;
  issPosition: ISSPosition | null;
  setISSPosition: (p: ISSPosition | null) => void;
  filters: LayerFilters;
  setFilters: (f: LayerFilters) => void;
  showOrbits: boolean;
  setShowOrbits: (v: boolean) => void;
  trackSelected: boolean;
  setTrackSelected: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

const SatCtx = createContext<SatCtxValue | null>(null);

export function SatelliteProvider({ children }: { children: ReactNode }) {
  const [layers, dispatch] = useReducer(layersReducer, undefined, initialLayerState);
  const [selected, setSelected] = useState<SelectedSatellite | null>(null);
  const [weather, setWeather] = useState<SpaceWeatherData | null>(null);
  const [issPosition, setISSPosition] = useState<ISSPosition | null>(null);
  const [filters, setFilters] = useState<LayerFilters>(DEFAULT_LAYER_FILTERS);
  const [showOrbits, setShowOrbits] = useState(false);
  const [trackSelected, setTrackSelected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <SatCtx.Provider
      value={{
        layers,
        dispatch,
        selected,
        setSelected: useCallback((s) => setSelected(s), []),
        weather,
        setWeather: useCallback((w) => setWeather(w), []),
        issPosition,
        setISSPosition: useCallback((p) => setISSPosition(p), []),
        filters,
        setFilters: useCallback((f) => setFilters(f), []),
        showOrbits,
        setShowOrbits: useCallback((v) => setShowOrbits(v), []),
        trackSelected,
        setTrackSelected: useCallback((v) => setTrackSelected(v), []),
        searchQuery,
        setSearchQuery: useCallback((q) => setSearchQuery(q), []),
      }}
    >
      {children}
    </SatCtx.Provider>
  );
}

export function useSatellite() {
  const ctx = useContext(SatCtx);
  if (!ctx) throw new Error('useSatellite must be used within SatelliteProvider');
  return ctx;
}
