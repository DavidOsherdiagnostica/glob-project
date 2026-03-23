'use client';

import { useSatellite, LAYER_ORDER, LAYER_CONFIGS } from './SatelliteContext';

export default function LayerPanel() {
  const { layers, dispatch, showOrbits, setShowOrbits } = useSatellite();

  const totalSats = LAYER_ORDER.reduce((sum, id) => sum + (layers[id].count ?? 0), 0);
  const enabledSats = LAYER_ORDER.filter((id) => layers[id].enabled).reduce(
    (sum, id) => sum + (layers[id].count ?? 0),
    0
  );

  return (
    <div
      className="cyber-panel cyber-panel-glow cyber-scroll"
      style={{
        width: '220px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        overflow: 'hidden auto',
        padding: '12px 0',
      }}
    >
      {/* Header */}
      <div style={{ padding: '0 14px 10px', borderBottom: '1px solid var(--cyber-border)' }}>
        <div
          className="cyber-heading"
          style={{ fontSize: '0.65rem', marginBottom: '4px' }}
        >
          ◈ DATA LAYERS
        </div>
        <div style={{ display: 'flex', gap: '8px', fontSize: '0.65rem' }}>
          <span style={{ color: 'var(--cyber-cyan)' }}>{enabledSats.toLocaleString()}</span>
          <span className="cyber-label">/ {totalSats.toLocaleString()} loaded</span>
        </div>
      </div>

      {/* Layers list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {LAYER_ORDER.map((id) => {
          const cfg = LAYER_CONFIGS[id];
          const state = layers[id];
          return (
            <LayerRow
              key={id}
              id={id}
              label={cfg.label}
              color={cfg.color}
              enabled={state.enabled}
              count={state.count}
              loaded={state.loaded}
              loading={state.loading}
              error={state.error}
              onToggle={() => dispatch({ type: 'TOGGLE_LAYER', id })}
            />
          );
        })}
      </div>

      {/* Controls */}
      <div
        style={{
          padding: '10px 14px',
          borderTop: '1px solid var(--cyber-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <label
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          <span className="cyber-label">ORBIT TRAILS</span>
          <CyberToggle
            checked={showOrbits}
            onChange={() => setShowOrbits(!showOrbits)}
          />
        </label>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className="cyber-btn"
            style={{ flex: 1, fontSize: '0.55rem' }}
            onClick={() => dispatch({ type: 'SET_ALL_ENABLED', enabled: true })}
          >
            ALL ON
          </button>
          <button
            className="cyber-btn"
            style={{ flex: 1, fontSize: '0.55rem' }}
            onClick={() => dispatch({ type: 'SET_ALL_ENABLED', enabled: false })}
          >
            ALL OFF
          </button>
        </div>
      </div>
    </div>
  );
}

function LayerRow({
  id,
  label,
  color,
  enabled,
  count,
  loaded,
  loading,
  error,
  onToggle,
}: {
  id: string;
  label: string;
  color: string;
  enabled: boolean;
  count: number;
  loaded: boolean;
  loading: boolean;
  error: boolean;
  onToggle: () => void;
}) {
  const badge = () => {
    if (loading) return <LoadingDots />;
    if (error) return <span style={{ color: 'var(--cyber-red)', fontSize: '0.55rem' }}>ERR</span>;
    if (loaded) return count.toLocaleString();
    return null;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 14px',
        cursor: 'pointer',
        transition: 'background 0.1s',
        borderLeft: `2px solid ${enabled ? (error ? 'var(--cyber-red)' : color) : 'transparent'}`,
        background: enabled ? `rgba(${hexToRgb(color)}, 0.05)` : 'transparent',
      }}
      onClick={onToggle}
    >
      {/* Color dot */}
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: error ? 'var(--cyber-red)' : enabled ? color : 'var(--cyber-bg-3)',
          border: `1px solid ${error ? 'var(--cyber-red)' : color}`,
          boxShadow: enabled && !error ? `0 0 6px ${color}` : 'none',
          flexShrink: 0,
          transition: 'all 0.2s',
        }}
      />

      {/* Label */}
      <span
        style={{
          flex: 1,
          fontSize: '0.72rem',
          fontFamily: 'var(--font-orbitron)',
          letterSpacing: '0.08em',
          color: error ? 'var(--cyber-red)' : enabled ? 'var(--cyber-text-bright)' : 'var(--cyber-text-dim)',
          transition: 'color 0.2s',
        }}
      >
        {label}
      </span>

      {/* Count / status badge */}
      <span
        style={{
          fontSize: '0.6rem',
          fontFamily: 'var(--font-mono)',
          color: enabled ? color : 'var(--cyber-text-dim)',
          minWidth: '32px',
          textAlign: 'right',
        }}
      >
        {badge()}
      </span>

      {/* Toggle */}
      <CyberToggle checked={enabled} onChange={onToggle} />
    </div>
  );
}

function CyberToggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <label className="cyber-toggle" onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="cyber-toggle-track" />
    </label>
  );
}

function LoadingDots() {
  return (
    <span
      style={{ color: 'var(--cyber-text-dim)', animation: 'cyber-blink 1s ease-in-out infinite' }}
    >
      ...
    </span>
  );
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
