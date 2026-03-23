'use client';

import { useEffect, useState } from 'react';
import { useSatellite } from './SatelliteContext';
import { LAYER_ORDER } from './SatelliteContext';

function UTCClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toUTCString().replace('GMT', 'UTC').replace(/^\w+, /, '').replace(/:\d\d UTC$/, ' UTC')
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="cyber-value">{time}</span>;
}

export default function TopBar() {
  const { layers, issPosition, weather } = useSatellite();

  const totalEnabled = LAYER_ORDER.filter((id) => layers[id].enabled).reduce(
    (sum, id) => sum + layers[id].count,
    0
  );

  const kpColor = weather
    ? {
        quiet: 'var(--cyber-green)',
        unsettled: '#88ff00',
        active: 'var(--cyber-yellow)',
        'minor-storm': 'var(--cyber-orange)',
        'major-storm': 'var(--cyber-red)',
        'severe-storm': 'var(--cyber-magenta)',
      }[weather.kpCategory]
    : 'var(--cyber-text-dim)';

  return (
    <div
      className="cyber-panel cyber-panel-glow"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 20px',
        borderLeft: 'none',
        borderRight: 'none',
        borderTop: 'none',
        gap: '24px',
        flexWrap: 'wrap',
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" fill="var(--cyber-cyan)" />
          <ellipse cx="12" cy="12" rx="11" ry="4.5" stroke="var(--cyber-cyan)" strokeWidth="1.5" fill="none" opacity="0.6" />
          <ellipse cx="12" cy="12" rx="11" ry="4.5" stroke="var(--cyber-cyan)" strokeWidth="1.5" fill="none" opacity="0.6" transform="rotate(60 12 12)" />
          <ellipse cx="12" cy="12" rx="11" ry="4.5" stroke="var(--cyber-cyan)" strokeWidth="1.5" fill="none" opacity="0.6" transform="rotate(120 12 12)" />
        </svg>
        <span
          className="cyber-heading"
          style={{ fontSize: '0.75rem', letterSpacing: '0.2em' }}
        >
          ORBITAL<span style={{ color: 'var(--cyber-violet)' }}>-</span>WATCH
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
        <StatItem label="TRACKING" value={totalEnabled.toLocaleString()} unit="SATS" color="var(--cyber-cyan)" />

        {issPosition && (
          <StatItem
            label="ISS ALT"
            value="~408"
            unit="KM"
            color="var(--layer-iss)"
          />
        )}

        {weather && (
          <>
            <StatItem
              label="Kp INDEX"
              value={weather.kpIndex.toFixed(1)}
              unit={weather.kpCategory.toUpperCase().replace('-', ' ')}
              color={kpColor}
            />
            <StatItem
              label="SOLAR WIND"
              value={weather.solarWindSpeed > 0 ? weather.solarWindSpeed.toString() : '---'}
              unit="KM/S"
              color="var(--cyber-orange)"
            />
          </>
        )}

        {weather && weather.bzGsm < -10 && (
          <div
            className="cyber-blink"
            style={{
              fontSize: '0.6rem',
              fontFamily: 'var(--font-orbitron)',
              letterSpacing: '0.1em',
              color: 'var(--cyber-red)',
              textShadow: '0 0 8px var(--cyber-red)',
              padding: '3px 8px',
              border: '1px solid var(--cyber-red)',
              background: 'rgba(255,0,64,0.1)',
            }}
          >
            ⚠ GEOMAGNETIC STORM
          </div>
        )}
      </div>

      {/* Clock */}
      <div style={{ textAlign: 'right' }}>
        <div className="cyber-label" style={{ marginBottom: '2px' }}>UTC</div>
        <UTCClock />
      </div>
    </div>
  );
}

function StatItem({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="cyber-label">{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span
          style={{
            fontFamily: 'var(--font-orbitron)',
            fontSize: '1rem',
            color,
            textShadow: `0 0 8px ${color}`,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
        <span className="cyber-label" style={{ fontSize: '0.55rem' }}>
          {unit}
        </span>
      </div>
    </div>
  );
}
