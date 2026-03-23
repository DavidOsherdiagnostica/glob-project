'use client';

import dynamic from 'next/dynamic';
import { useRef } from 'react';
import { SatelliteProvider } from '@/components/satellite/SatelliteContext';
import TopBar from '@/components/satellite/TopBar';
import LayerPanel from '@/components/satellite/LayerPanel';
import InfoPanel from '@/components/satellite/InfoPanel';
import SpaceWeatherPanel from '@/components/satellite/SpaceWeatherPanel';
import FilterBar from '@/components/satellite/FilterBar';
import SearchBar from '@/components/satellite/SearchBar';

// Load Cesium globe client-side only (no SSR)
const SatelliteGlobe = dynamic(
  () => import('@/components/satellite/SatelliteGlobe'),
  {
    ssr: false,
    loading: () => <GlobeLoader />,
  }
);

export default function SatellitePage() {
  const flyToRef = useRef<((noradId: number) => void) | null>(null);

  return (
    <SatelliteProvider>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--cyber-bg)',
          overflow: 'hidden',
        }}
      >
        {/* Top bar */}
        <TopBar />

        {/* Middle section: panels + globe */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          {/* Left panel */}
          <LayerPanel />

          {/* Globe area */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <SatelliteGlobe onFlyToRef={flyToRef} />

            {/* Search bar overlay */}
            <div
              style={{
                position: 'absolute',
                top: '12px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 20,
              }}
            >
              <SearchBar onFlyTo={(id) => flyToRef.current?.(id)} />
            </div>

            {/* Globe corner decorations */}
            <CornerDecor position="top-left" />
            <CornerDecor position="top-right" />
            <CornerDecor position="bottom-left" />
            <CornerDecor position="bottom-right" />

            {/* Crosshair overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" opacity="0.15">
                <circle cx="20" cy="20" r="8" stroke="var(--cyber-cyan)" strokeWidth="0.5" />
                <line x1="20" y1="0" x2="20" y2="12" stroke="var(--cyber-cyan)" strokeWidth="0.5" />
                <line x1="20" y1="28" x2="20" y2="40" stroke="var(--cyber-cyan)" strokeWidth="0.5" />
                <line x1="0" y1="20" x2="12" y2="20" stroke="var(--cyber-cyan)" strokeWidth="0.5" />
                <line x1="28" y1="20" x2="40" y2="20" stroke="var(--cyber-cyan)" strokeWidth="0.5" />
              </svg>
            </div>
          </div>

          {/* Right panel */}
          <InfoPanel />
        </div>

        {/* Bottom section */}
        <SpaceWeatherPanel />
        <FilterBar />
      </div>
    </SatelliteProvider>
  );
}

function GlobeLoader() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        background: 'var(--cyber-bg)',
      }}
    >
      {/* Radar animation */}
      <div style={{ position: 'relative', width: '120px', height: '120px' }}>
        <svg width="120" height="120" viewBox="0 0 120 120">
          {/* Outer rings */}
          <circle cx="60" cy="60" r="55" stroke="var(--cyber-cyan)" strokeWidth="0.5" fill="none" opacity="0.3" />
          <circle cx="60" cy="60" r="40" stroke="var(--cyber-cyan)" strokeWidth="0.5" fill="none" opacity="0.3" />
          <circle cx="60" cy="60" r="25" stroke="var(--cyber-cyan)" strokeWidth="0.5" fill="none" opacity="0.3" />
          <circle cx="60" cy="60" r="10" stroke="var(--cyber-cyan)" strokeWidth="1" fill="none" />
          {/* Cross hairs */}
          <line x1="5" y1="60" x2="115" y2="60" stroke="var(--cyber-cyan)" strokeWidth="0.5" opacity="0.3" />
          <line x1="60" y1="5" x2="60" y2="115" stroke="var(--cyber-cyan)" strokeWidth="0.5" opacity="0.3" />
          {/* Sweep */}
          <g className="radar-sweep" style={{ transformOrigin: '60px 60px' }}>
            <path
              d="M60 60 L60 5 A55 55 0 0 1 115 60 Z"
              fill="url(#radarGrad)"
              opacity="0.4"
            />
          </g>
          <defs>
            <radialGradient id="radarGrad" cx="60" cy="60" r="55" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--cyber-cyan)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--cyber-cyan)" stopOpacity="0.6" />
            </radialGradient>
          </defs>
        </svg>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-orbitron)',
            fontSize: '0.85rem',
            letterSpacing: '0.3em',
            color: 'var(--cyber-cyan)',
            textShadow: 'var(--cyber-glow)',
            marginBottom: '8px',
          }}
        >
          INITIALIZING ORBITAL SYSTEMS
        </div>
        <div
          className="cyber-blink"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            color: 'var(--cyber-text-dim)',
            letterSpacing: '0.15em',
          }}
        >
          LOADING CESIUM ENGINE...
        </div>
      </div>
    </div>
  );
}

type CornerPos = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

function CornerDecor({ position }: { position: CornerPos }) {
  const style: React.CSSProperties = {
    position: 'absolute',
    width: '40px',
    height: '40px',
    pointerEvents: 'none',
    zIndex: 5,
  };

  const borderStyle = '2px solid rgba(0, 255, 255, 0.3)';

  const posStyles: Record<CornerPos, React.CSSProperties> = {
    'top-left':     { top: 8, left: 8, borderTop: borderStyle, borderLeft: borderStyle },
    'top-right':    { top: 8, right: 8, borderTop: borderStyle, borderRight: borderStyle },
    'bottom-left':  { bottom: 8, left: 8, borderBottom: borderStyle, borderLeft: borderStyle },
    'bottom-right': { bottom: 8, right: 8, borderBottom: borderStyle, borderRight: borderStyle },
  };

  return <div style={{ ...style, ...posStyles[position] }} />;
}
