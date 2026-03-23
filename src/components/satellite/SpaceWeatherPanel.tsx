'use client';

import { useEffect, useRef } from 'react';
import { useSatellite } from './SatelliteContext';

const KP_COLORS = ['#00ff88', '#44ff44', '#88ff00', '#ccff00', '#ffe600', '#ff8800', '#ff4400', '#ff0040', '#ff00ff', '#aa00ff'];

export default function SpaceWeatherPanel() {
  const { weather } = useSatellite();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw solar wind speed chart
  useEffect(() => {
    if (!weather || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const points = weather.history.filter((p) => p.speed > 0).slice(-288); // last 24h @ 5min
    if (points.length < 2) return;

    const speeds = points.map((p) => p.speed);
    const minS = Math.min(...speeds);
    const maxS = Math.max(...speeds);
    const range = maxS - minS || 1;

    // Background grid
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Line chart
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, 'rgba(0,255,136,0.3)');
    gradient.addColorStop(1, 'rgba(255,136,0,0.8)');

    ctx.beginPath();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.5;
    points.forEach((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p.speed - minS) / range) * (h - 4) - 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p.speed - minS) / range) * (h - 4) - 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
    fillGrad.addColorStop(0, 'rgba(255,136,0,0.2)');
    fillGrad.addColorStop(1, 'rgba(255,136,0,0)');
    ctx.fillStyle = fillGrad;
    ctx.fill();
  }, [weather]);

  if (!weather) {
    return (
      <div
        className="cyber-panel"
        style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <span className="cyber-label cyber-blink">LOADING SPACE WEATHER...</span>
      </div>
    );
  }

  const kpColor = KP_COLORS[Math.min(Math.floor(weather.kpIndex), 9)];
  const kpPercent = Math.min((weather.kpIndex / 9) * 100, 100);

  return (
    <div
      className="cyber-panel cyber-panel-glow cyber-scroll"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '8px 16px',
        flexWrap: 'wrap',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div className="cyber-heading" style={{ fontSize: '0.6rem', flexShrink: 0 }}>
        ⚡ SPACE WEATHER
      </div>

      {/* Kp Gauge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <span className="cyber-label">Kp</span>
        <div style={{ position: 'relative', width: '80px', height: '8px' }}>
          <div
            style={{
              width: '80px',
              height: '8px',
              background: 'var(--cyber-bg-3)',
              border: '1px solid var(--cyber-border)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `${kpPercent}%`,
                background: kpColor,
                boxShadow: `0 0 6px ${kpColor}`,
                transition: 'width 0.5s',
              }}
            />
          </div>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-orbitron)',
            fontSize: '0.8rem',
            color: kpColor,
            textShadow: `0 0 6px ${kpColor}`,
            minWidth: '28px',
          }}
        >
          {weather.kpIndex.toFixed(1)}
        </span>
        <span
          style={{
            fontSize: '0.6rem',
            fontFamily: 'var(--font-orbitron)',
            color: kpColor,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          {weather.kpCategory.replace('-', ' ')}
        </span>
      </div>

      {/* Solar wind */}
      <div style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
        <WeatherStat label="SW SPEED" value={`${weather.solarWindSpeed} km/s`} color="var(--cyber-orange)" />
        <WeatherStat label="DENSITY" value={`${weather.solarWindDensity} /cm³`} color="var(--cyber-yellow)" />
        <WeatherStat label="Bt" value={`${weather.btTotal} nT`} color="var(--cyber-text)" />
        <WeatherStat
          label="Bz GSM"
          value={`${weather.bzGsm > 0 ? '+' : ''}${weather.bzGsm} nT`}
          color={weather.bzGsm < -5 ? 'var(--cyber-red)' : 'var(--cyber-text)'}
        />
      </div>

      {/* Mini chart */}
      <canvas
        ref={canvasRef}
        width={180}
        height={36}
        style={{ flexShrink: 0, opacity: 0.8 }}
      />

      {/* Storm warning */}
      {weather.kpIndex >= 5 && (
        <div
          className="cyber-blink"
          style={{
            fontSize: '0.6rem',
            fontFamily: 'var(--font-orbitron)',
            color: 'var(--cyber-red)',
            textShadow: '0 0 8px var(--cyber-red)',
            padding: '3px 8px',
            border: '1px solid var(--cyber-red)',
            background: 'rgba(255,0,64,0.1)',
            flexShrink: 0,
          }}
        >
          ⚠ STORM ALERT Kp={weather.kpIndex.toFixed(1)}
        </div>
      )}
    </div>
  );
}

function WeatherStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="cyber-label">{label}</div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.72rem',
          color,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}
