'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useSatellite, LAYER_ORDER, LAYER_CONFIGS } from './SatelliteContext';

export default function SearchBar({
  onFlyTo,
}: {
  onFlyTo?: (noradId: number) => void;
}) {
  const { layers, searchQuery, setSearchQuery } = useSatellite();
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const q = searchQuery.toUpperCase();
    const found: Array<{ noradId: number; name: string; layerId: string; color: string }> = [];

    for (const id of LAYER_ORDER) {
      const layer = layers[id];
      if (!layer.loaded) continue;
      for (const rec of layer.records) {
        if (rec.OBJECT_NAME.toUpperCase().includes(q) || String(rec.NORAD_CAT_ID).includes(q)) {
          found.push({
            noradId: rec.NORAD_CAT_ID,
            name: rec.OBJECT_NAME,
            layerId: id,
            color: LAYER_CONFIGS[id as keyof typeof LAYER_CONFIGS]?.color ?? '#00ffff',
          });
          if (found.length >= 12) break;
        }
      }
      if (found.length >= 12) break;
    }
    return found;
  }, [searchQuery, layers]);

  useEffect(() => {
    setShowResults(results.length > 0 && searchQuery.length >= 2);
  }, [results.length, searchQuery]);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--cyber-text-dim)"
          strokeWidth="2"
          style={{ flexShrink: 0 }}
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          className="cyber-input"
          style={{ width: '200px', padding: '4px 8px', fontSize: '0.72rem' }}
          placeholder="Search satellite / NORAD ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 150)}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute',
              right: '6px',
              background: 'none',
              border: 'none',
              color: 'var(--cyber-text-dim)',
              cursor: 'pointer',
              fontSize: '0.9rem',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>

      {showResults && (
        <div
          className="cyber-panel cyber-scroll"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 100,
            maxHeight: '240px',
            overflow: 'auto',
            marginTop: '2px',
          }}
        >
          {results.map((r) => (
            <button
              key={r.noradId}
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                background: 'none',
                border: 'none',
                borderBottom: '1px solid var(--cyber-border)',
                cursor: 'pointer',
                transition: 'background 0.1s',
                color: 'var(--cyber-text)',
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background = 'var(--cyber-cyan-dim)')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background = 'none')
              }
              onClick={() => {
                onFlyTo?.(r.noradId);
                setShowResults(false);
                setSearchQuery(r.name);
              }}
            >
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: r.color,
                  boxShadow: `0 0 4px ${r.color}`,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.68rem',
                  flex: 1,
                  textAlign: 'left',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.name}
              </span>
              <span className="cyber-label" style={{ fontSize: '0.6rem', flexShrink: 0 }}>
                #{r.noradId}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
