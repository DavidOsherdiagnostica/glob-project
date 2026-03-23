'use client';

import { useEffect, useState } from 'react';
import { useSatellite, LAYER_CONFIGS } from './SatelliteContext';
import { formatFrequency } from '@/lib/satellite/satnogs';
import type { SatNogsTransmitter } from '@/lib/satellite/types';

export default function InfoPanel() {
  const { selected, setSelected, setTrackSelected, trackSelected } = useSatellite();
  const [transmitters, setTransmitters] = useState<SatNogsTransmitter[]>([]);
  const [passes, setPasses] = useState<PassData[]>([]);
  const [tab, setTab] = useState<'orbital' | 'radio' | 'passes'>('orbital');

  useEffect(() => {
    if (!selected) return;
    setTransmitters([]);
    fetch(`/api/satellite/satnogs?norad=${selected.noradId}`)
      .then((r) => r.json())
      .then((d) => setTransmitters(d.transmitters ?? []))
      .catch(() => {});
  }, [selected?.noradId]);

  if (!selected) {
    return (
      <div
        className="cyber-panel cyber-panel-glow"
        style={{
          width: '240px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '24px 16px',
          color: 'var(--cyber-text-dim)',
        }}
      >
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.3">
          <circle cx="24" cy="24" r="8" stroke="var(--cyber-cyan)" strokeWidth="2" />
          <path d="M24 4 Q32 12 32 24 Q32 36 24 44 Q16 36 16 24 Q16 12 24 4Z" stroke="var(--cyber-cyan)" strokeWidth="1.5" fill="none" />
          <path d="M4 24 Q12 16 24 16 Q36 16 44 24 Q36 32 24 32 Q12 32 4 24Z" stroke="var(--cyber-cyan)" strokeWidth="1.5" fill="none" />
        </svg>
        <div style={{ textAlign: 'center' }}>
          <div
            className="cyber-heading"
            style={{ fontSize: '0.6rem', marginBottom: '4px' }}
          >
            NO OBJECT SELECTED
          </div>
          <div className="cyber-label" style={{ fontSize: '0.55rem' }}>
            Click a satellite on the globe
          </div>
        </div>
      </div>
    );
  }

  const cfg = LAYER_CONFIGS[selected.layerId];

  return (
    <div
      className="cyber-panel cyber-panel-glow cyber-panel-active cyber-scroll"
      style={{
        width: '240px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--cyber-border)',
          background: `rgba(${hexToRgb(cfg.color)}, 0.08)`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-orbitron)',
                fontSize: '0.7rem',
                color: cfg.color,
                textShadow: `0 0 8px ${cfg.color}`,
                letterSpacing: '0.08em',
                marginBottom: '2px',
                maxWidth: '160px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {selected.name}
            </div>
            <div className="cyber-label">NORAD #{selected.noradId}</div>
          </div>
          <button
            onClick={() => {
              setSelected(null);
              setTrackSelected(false);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--cyber-text-dim)',
              cursor: 'pointer',
              fontSize: '1rem',
              lineHeight: 1,
              padding: '0 4px',
            }}
          >
            ×
          </button>
        </div>

        {/* Track button */}
        <button
          className={`cyber-btn ${trackSelected ? 'cyber-btn-primary' : ''}`}
          style={{ marginTop: '8px', width: '100%', fontSize: '0.55rem' }}
          onClick={() => setTrackSelected(!trackSelected)}
        >
          {trackSelected ? '⊙ TRACKING' : '◎ TRACK SATELLITE'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--cyber-border)' }}>
        {(['orbital', 'radio', 'passes'] as const).map((t) => (
          <button
            key={t}
            className={`cyber-tab ${tab === t ? 'active' : ''}`}
            style={{ flex: 1 }}
            onClick={() => setTab(t)}
          >
            {t === 'orbital' ? 'ORB' : t === 'radio' ? 'RF' : 'PASS'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="cyber-scroll" style={{ flex: 1, overflow: 'auto', padding: '10px 14px' }}>
        {tab === 'orbital' && (
          <OrbitalTab selected={selected} />
        )}
        {tab === 'radio' && (
          <RadioTab transmitters={transmitters} />
        )}
        {tab === 'passes' && (
          <PassesTab noradId={selected.noradId} passes={passes} setPasses={setPasses} />
        )}
      </div>
    </div>
  );
}

interface SelectedSat {
  noradId: number;
  name: string;
  lat: number;
  lon: number;
  alt: number;
  velocity: number;
  inclination: number;
  eccentricity: number;
  period: number;
  epoch: string;
  raan: number;
  argPerigee: number;
}

function OrbitalTab({ selected }: { selected: SelectedSat }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <Section label="LIVE POSITION">
        <DataRow label="LAT" value={`${selected.lat.toFixed(4)}°`} />
        <DataRow label="LON" value={`${selected.lon.toFixed(4)}°`} />
        <DataRow label="ALT" value={`${selected.alt.toFixed(1)} km`} highlight />
        <DataRow label="VEL" value={`${selected.velocity.toFixed(2)} km/s`} highlight />
      </Section>
      <Section label="ORBITAL ELEMENTS">
        <DataRow label="INCL" value={`${selected.inclination.toFixed(4)}°`} />
        <DataRow label="ECCEN" value={selected.eccentricity.toFixed(7)} />
        <DataRow label="RAAN" value={`${selected.raan.toFixed(4)}°`} />
        <DataRow label="ARG-P" value={`${selected.argPerigee.toFixed(4)}°`} />
        <DataRow label="PERIOD" value={`${selected.period.toFixed(2)} min`} />
      </Section>
      <Section label="EPOCH">
        <div className="cyber-value" style={{ fontSize: '0.65rem', wordBreak: 'break-all' }}>
          {selected.epoch}
        </div>
      </Section>
    </div>
  );
}

function RadioTab({ transmitters }: { transmitters: SatNogsTransmitter[] }) {
  if (transmitters.length === 0) {
    return (
      <div className="cyber-label" style={{ textAlign: 'center', padding: '20px 0' }}>
        No active transmitters in SatNOGS DB
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {transmitters.slice(0, 6).map((tx) => (
        <div
          key={tx.uuid}
          style={{
            padding: '8px',
            border: '1px solid var(--cyber-border)',
            background: 'var(--cyber-bg-3)',
          }}
        >
          <div
            style={{
              fontSize: '0.65rem',
              fontFamily: 'var(--font-orbitron)',
              color: 'var(--cyber-text)',
              marginBottom: '4px',
            }}
          >
            {tx.description || tx.mode || 'Unknown'}
          </div>
          {tx.downlink_low && (
            <DataRow label="DL" value={formatFrequency(tx.downlink_low)} />
          )}
          {tx.uplink_low && (
            <DataRow label="UL" value={formatFrequency(tx.uplink_low)} />
          )}
          {tx.mode && <DataRow label="MODE" value={tx.mode} />}
        </div>
      ))}
    </div>
  );
}

interface PassData {
  startUTC: number;
  maxEl: number;
  duration: number;
  maxAzCompass: string;
}

function PassesTab({
  noradId,
  passes,
  setPasses,
}: {
  noradId: number;
  passes: PassData[];
  setPasses: (p: PassData[]) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      });
    }
  }, []);

  const fetchPasses = async () => {
    if (!location) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/satellite/passes?norad=${noradId}&lat=${location.lat}&lon=${location.lon}&days=3`
      );
      const data = await res.json();
      setPasses(data.passes ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  if (!location) {
    return (
      <div className="cyber-label" style={{ textAlign: 'center', padding: '20px 0' }}>
        Enable location for pass predictions
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <button
        className="cyber-btn cyber-btn-primary"
        style={{ width: '100%', fontSize: '0.55rem' }}
        onClick={fetchPasses}
        disabled={loading}
      >
        {loading ? 'COMPUTING...' : '▶ GET PASSES (3 DAYS)'}
      </button>
      {passes.length === 0 && !loading && (
        <div className="cyber-label" style={{ textAlign: 'center', padding: '12px 0' }}>
          {passes.length === 0 ? 'No passes or N2YO_API_KEY not set' : ''}
        </div>
      )}
      {passes.map((pass, i) => (
        <div
          key={i}
          style={{
            padding: '6px 8px',
            border: '1px solid var(--cyber-border)',
            background: 'var(--cyber-bg-3)',
          }}
        >
          <DataRow
            label="TIME"
            value={new Date(pass.startUTC * 1000).toLocaleString()}
          />
          <DataRow label="MAX EL" value={`${pass.maxEl.toFixed(0)}°`} highlight />
          <DataRow label="DIR" value={pass.maxAzCompass} />
          <DataRow label="DUR" value={`${pass.duration}s`} />
        </div>
      ))}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="cyber-label"
        style={{
          marginBottom: '4px',
          borderBottom: '1px solid var(--cyber-border)',
          paddingBottom: '2px',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function DataRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '2px 0',
        fontSize: '0.68rem',
      }}
    >
      <span className="cyber-label">{label}</span>
      <span
        className={highlight ? 'cyber-value-highlight' : 'cyber-value'}
        style={{ fontSize: '0.68rem' }}
      >
        {value}
      </span>
    </div>
  );
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
