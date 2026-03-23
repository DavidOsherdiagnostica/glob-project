'use client';

import { useState } from 'react';
import { useSatellite } from './SatelliteContext';

export default function FilterBar() {
  const { filters, setFilters } = useSatellite();
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="cyber-panel"
      style={{
        flexShrink: 0,
        borderLeft: 'none',
        borderRight: 'none',
        borderBottom: 'none',
        transition: 'all 0.2s',
      }}
    >
      {/* Toggle header */}
      <button
        style={{
          background: 'none',
          border: 'none',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          cursor: 'pointer',
          color: expanded ? 'var(--cyber-cyan)' : 'var(--cyber-text-dim)',
          transition: 'color 0.2s',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <span
          className="cyber-heading"
          style={{ fontSize: '0.58rem', color: 'inherit', textShadow: 'none' }}
        >
          ▼ FILTERS
        </span>
        <span style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
          ALT {filters.altMin.toLocaleString()}–{filters.altMax.toLocaleString()} km | INCL {filters.inclMin}°–{filters.inclMax}°
        </span>
      </button>

      {expanded && (
        <div
          style={{
            padding: '10px 16px',
            display: 'flex',
            gap: '24px',
            flexWrap: 'wrap',
            borderTop: '1px solid var(--cyber-border)',
          }}
        >
          <FilterGroup label="ALTITUDE MIN (km)">
            <input
              type="range"
              className="cyber-slider"
              min={0}
              max={40000}
              step={100}
              value={filters.altMin}
              onChange={(e) => setFilters({ ...filters, altMin: Number(e.target.value) })}
              style={{ width: '140px' }}
            />
            <SliderValue value={filters.altMin.toLocaleString()} />
          </FilterGroup>

          <FilterGroup label="ALTITUDE MAX (km)">
            <input
              type="range"
              className="cyber-slider"
              min={0}
              max={40000}
              step={100}
              value={filters.altMax}
              onChange={(e) => setFilters({ ...filters, altMax: Number(e.target.value) })}
              style={{ width: '140px' }}
            />
            <SliderValue value={filters.altMax.toLocaleString()} />
          </FilterGroup>

          <FilterGroup label="INCLINATION MIN (°)">
            <input
              type="range"
              className="cyber-slider"
              min={0}
              max={180}
              step={1}
              value={filters.inclMin}
              onChange={(e) => setFilters({ ...filters, inclMin: Number(e.target.value) })}
              style={{ width: '140px' }}
            />
            <SliderValue value={`${filters.inclMin}°`} />
          </FilterGroup>

          <FilterGroup label="INCLINATION MAX (°)">
            <input
              type="range"
              className="cyber-slider"
              min={0}
              max={180}
              step={1}
              value={filters.inclMax}
              onChange={(e) => setFilters({ ...filters, inclMax: Number(e.target.value) })}
              style={{ width: '140px' }}
            />
            <SliderValue value={`${filters.inclMax}°`} />
          </FilterGroup>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              className="cyber-btn"
              style={{ fontSize: '0.55rem' }}
              onClick={() =>
                setFilters({ altMin: 0, altMax: 40000, inclMin: 0, inclMax: 180 })
              }
            >
              RESET
            </button>
          </div>

          {/* Altitude presets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span className="cyber-label">ORBIT PRESETS</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { label: 'LEO', min: 160, max: 2000 },
                { label: 'MEO', min: 2000, max: 35786 },
                { label: 'GEO', min: 35000, max: 36500 },
                { label: 'HEO', min: 500, max: 40000 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  className="cyber-btn"
                  style={{ fontSize: '0.5rem' }}
                  onClick={() =>
                    setFilters({ ...filters, altMin: preset.min, altMax: preset.max })
                  }
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span className="cyber-label">{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{children}</div>
    </div>
  );
}

function SliderValue({ value }: { value: string }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.7rem',
        color: 'var(--cyber-cyan)',
        minWidth: '60px',
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {value}
    </span>
  );
}
