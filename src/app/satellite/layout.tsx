import type { Metadata } from 'next';
import './satellite.css';

export const metadata: Metadata = {
  title: 'ORBITAL-WATCH | Satellite Tracker',
  description: 'Real-time satellite tracking with live orbital data from multiple sources',
};

export default function SatelliteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Fonts loaded via CDN link — bypasses build-time fetch */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=JetBrains+Mono:wght@300;400;500&display=swap"
      />
      <div className="satellite-root" suppressHydrationWarning>
        {children}
      </div>
    </>
  );
}
