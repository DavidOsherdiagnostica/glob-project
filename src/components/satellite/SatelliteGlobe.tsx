'use client';

// Import Cesium types for TypeScript — runtime import is dynamic (SSR safe)
import type * as CesiumType from 'cesium';
import { useEffect, useRef, useCallback, useState } from 'react';
import { useSatellite, LAYER_ORDER, LAYER_CONFIGS } from './SatelliteContext';
import { propagateSatellites, getOrbitalPeriod } from '@/lib/satellite/propagator';
import type { SatelliteLayerId, TLERecord, SelectedSatellite } from '@/lib/satellite/types';

interface SatPickData {
  noradId: number;
  layerId: SatelliteLayerId;
}

interface TooltipState {
  x: number;
  y: number;
  name: string;
  layerId: SatelliteLayerId;
  noradId: number;
  alt: number;
  velocity: number;
}

// ---- Per-layer icon factories (canvas) ----

function drawLayerIcon(
  layerId: SatelliteLayerId,
  color: string,
  size: number,
  ctx: CanvasRenderingContext2D
) {
  const cx = size / 2;
  const cy = size / 2;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  switch (layerId) {
    case 'iss': {
      // Central truss + 4 solar panel wings + node modules
      ctx.lineWidth = 1.5;
      ctx.fillRect(cx - 5, cy - 2.5, 10, 5);
      ctx.fillRect(cx - 12, cy - 1.5, 6, 3);
      ctx.fillRect(cx + 6, cy - 1.5, 6, 3);
      ctx.fillRect(cx - 2.5, cy - 7, 5, 4);
      ctx.fillRect(cx - 2.5, cy + 3, 5, 4);
      break;
    }
    case 'active': {
      // Generic satellite: rectangular bus + bilateral solar panels
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - 4, cy - 4, 8, 8);
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy); ctx.lineTo(cx - 5, cy);
      ctx.moveTo(cx + 5, cy);  ctx.lineTo(cx + 12, cy);
      ctx.stroke();
      ctx.fillRect(cx - 13.5, cy - 3, 2, 6);
      ctx.fillRect(cx + 11.5, cy - 3, 2, 6);
      break;
    }
    case 'starlink': {
      // Flat rectangular bus + one long deployable panel + phased arrays
      ctx.lineWidth = 1.5;
      ctx.fillRect(cx - 7, cy - 2.5, 14, 5);
      ctx.strokeRect(cx - 12, cy + 4, 24, 4);
      ctx.lineWidth = 0.8;
      for (let i = -5; i <= 5; i += 2.5) {
        ctx.beginPath();
        ctx.arc(cx + i, cy - 4.5, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'gps': {
      // Target reticle — GPS precision symbol
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy - 7);
      ctx.moveTo(cx, cy + 7);  ctx.lineTo(cx, cy + 12);
      ctx.moveTo(cx - 12, cy); ctx.lineTo(cx - 7, cy);
      ctx.moveTo(cx + 7, cy);  ctx.lineTo(cx + 12, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'glonass': {
      // Diamond + centre dot
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 9);
      ctx.lineTo(cx + 6, cy);
      ctx.lineTo(cx, cy + 9);
      ctx.lineTo(cx - 6, cy);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'beidou': {
      // Hexagon + centre dot (Chinese GNSS symbol)
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const r = 7;
        if (i === 0) ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
        else         ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'weather': {
      // Rectangular body + parabolic dish + solar panel
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - 5, cy - 2.5, 10, 5);
      ctx.beginPath();
      ctx.arc(cx, cy - 8, 5, 0.3, Math.PI - 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - 3); ctx.lineTo(cx, cy - 8);
      ctx.stroke();
      ctx.fillRect(cx + 6, cy - 1.5, 7, 3);
      break;
    }
    case 'oneweb': {
      // CubeSat body + inner cross + solar panel wing
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - 5, cy - 5, 10, 10);
      ctx.beginPath();
      ctx.moveTo(cx - 3, cy); ctx.lineTo(cx + 3, cy);
      ctx.moveTo(cx, cy - 3); ctx.lineTo(cx, cy + 3);
      ctx.stroke();
      ctx.strokeRect(cx + 6, cy - 2, 7, 4);
      break;
    }
    case 'debris': {
      // Fragmentation X + shrapnel lines
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy - 5); ctx.lineTo(cx + 5, cy + 5);
      ctx.moveTo(cx + 5, cy - 5); ctx.lineTo(cx - 5, cy + 5);
      ctx.stroke();
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx - 1, cy - 9); ctx.lineTo(cx + 1, cy - 6);
      ctx.moveTo(cx + 7, cy - 2); ctx.lineTo(cx + 10, cy - 5);
      ctx.stroke();
      break;
    }
  }
}

function createLayerIcon(layerId: SatelliteLayerId, color: string, size = 28): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  drawLayerIcon(layerId, color, size, ctx);
  return canvas;
}

// ---- Component ----

export default function SatelliteGlobe({
  onFlyToRef,
}: {
  onFlyToRef?: React.MutableRefObject<((noradId: number) => void) | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumType.Viewer | null>(null);
  const primitivesRef = useRef<Map<SatelliteLayerId, CesiumType.BillboardCollection>>(new Map());
  const orbitLinesRef = useRef<Map<SatelliteLayerId, CesiumType.PolylineCollection>>(new Map());
  const animFrameRef = useRef<number | null>(null);
  const issEntityRef = useRef<CesiumType.Entity | null>(null);
  const iconsRef = useRef<Map<SatelliteLayerId, HTMLCanvasElement>>(new Map());
  const hoveredBillboardRef = useRef<CesiumType.Billboard | null>(null);

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Keep a ref to layers/filters so the animation loop always gets fresh state
  const layersRef = useRef(LAYER_ORDER.reduce(
    (acc, id) => ({ ...acc, [id]: { records: [] as TLERecord[], enabled: false } }),
    {} as Record<SatelliteLayerId, { records: TLERecord[]; enabled: boolean }>
  ));
  const filtersRef = useRef({ altMin: 0, altMax: 40000, inclMin: 0, inclMax: 180 });
  const showOrbitsRef = useRef(false);

  const {
    layers,
    dispatch,
    setSelected,
    setWeather,
    setISSPosition,
    filters,
    showOrbits,
    trackSelected,
    selected,
  } = useSatellite();

  // Keep refs in sync
  useEffect(() => {
    for (const id of LAYER_ORDER) {
      layersRef.current[id] = { records: layers[id].records, enabled: layers[id].enabled };
    }
  }, [layers]);

  useEffect(() => { filtersRef.current = filters; }, [filters]);
  useEffect(() => { showOrbitsRef.current = showOrbits; }, [showOrbits]);

  // ---- Initialize Cesium viewer ----
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;
    let destroyed = false;

    import('cesium').then(async (Cesium) => {
      if (destroyed || !containerRef.current) return;

      // Point Cesium to our copied static assets
      (window as typeof window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = '/cesium/';

      const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
      if (ionToken) Cesium.Ion.defaultAccessToken = ionToken;

      // Pre-build one canvas icon per layer type — reused for every billboard in that layer
      for (const id of LAYER_ORDER) {
        const size = id === 'debris' ? 14 : 28;
        iconsRef.current.set(id, createLayerIcon(id, LAYER_CONFIGS[id].color, size));
      }

      if (destroyed || !containerRef.current) return;

      // CartoDB Dark Matter — clean dark-themed tiles, free, no API key.
      // Far more readable than satellite imagery for a tracking interface.
      let baseImagery: CesiumType.ImageryLayer;
      try {
        const carto = new Cesium.UrlTemplateImageryProvider({
          url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          subdomains: 'abcd',
          credit: '© OpenStreetMap contributors © CARTO',
          minimumLevel: 0,
          maximumLevel: 19,
        });
        baseImagery = new Cesium.ImageryLayer(carto);
      } catch {
        // Fallback to bundled NaturalEarthII
        const tms = await Cesium.TileMapServiceImageryProvider.fromUrl(
          Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
          { fileExtension: 'jpg' }
        );
        baseImagery = new Cesium.ImageryLayer(tms);
      }

      if (destroyed || !containerRef.current) return;

      const viewer = new Cesium.Viewer(containerRef.current, {
        baseLayer: baseImagery,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        creditContainer: document.createElement('div'),
        skyBox: new Cesium.SkyBox({
          sources: {
            positiveX: '/cesium/Assets/Textures/SkyBox/tycho2t3_80_px.jpg',
            negativeX: '/cesium/Assets/Textures/SkyBox/tycho2t3_80_mx.jpg',
            positiveY: '/cesium/Assets/Textures/SkyBox/tycho2t3_80_py.jpg',
            negativeY: '/cesium/Assets/Textures/SkyBox/tycho2t3_80_my.jpg',
            positiveZ: '/cesium/Assets/Textures/SkyBox/tycho2t3_80_pz.jpg',
            negativeZ: '/cesium/Assets/Textures/SkyBox/tycho2t3_80_mz.jpg',
          },
        }),
      });

      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#020014');
      viewer.scene.globe.maximumScreenSpaceError = 1.5;
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#020014');
      viewer.resolutionScale = window.devicePixelRatio ?? 1;
      if (viewer.scene.skyAtmosphere) {
        viewer.scene.skyAtmosphere.show = true;
        viewer.scene.skyAtmosphere.atmosphereLightIntensity = 4.0;
      }

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(20, 20, 25000000),
        duration: 2.5,
      });

      viewerRef.current = viewer;

      // ---- Event handlers ----
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

      // Click → select satellite
      handler.setInputAction(
        (event: CesiumType.ScreenSpaceEventHandler.PositionedEvent) => {
          const picked = viewer.scene.pick(event.position);
          if (!Cesium.defined(picked) || !picked.id) return;

          const data = picked.id as SatPickData;
          if (data.noradId === undefined) return;

          const layerState = layersRef.current[data.layerId];
          const rec = layerState?.records.find((r) => r.NORAD_CAT_ID === data.noradId);
          if (!rec) return;

          const pos = propagateSatellites([rec], data.layerId);
          if (pos.length === 0) return;
          const p = pos[0];

          const sel: SelectedSatellite = {
            noradId: rec.NORAD_CAT_ID,
            name: rec.OBJECT_NAME,
            layerId: data.layerId,
            lat: p.lat,
            lon: p.lon,
            alt: p.alt,
            velocity: p.velocity,
            inclination: rec.INCLINATION,
            eccentricity: rec.ECCENTRICITY,
            period: getOrbitalPeriod(rec),
            epoch: rec.EPOCH,
            raan: rec.RA_OF_ASC_NODE,
            argPerigee: rec.ARG_OF_PERICENTER,
            bstar: rec.BSTAR,
          };
          setSelected(sel);
        },
        Cesium.ScreenSpaceEventType.LEFT_CLICK
      );

      // Hover → tooltip + scale highlight
      handler.setInputAction(
        (event: CesiumType.ScreenSpaceEventHandler.MotionEvent) => {
          // Reset previous hover
          if (hoveredBillboardRef.current) {
            try { hoveredBillboardRef.current.scale = 1.0; } catch { /* billboard may have been destroyed */ }
            hoveredBillboardRef.current = null;
            viewer.scene.canvas.style.cursor = 'default';
          }

          const picked = viewer.scene.pick(event.endPosition);
          if (!Cesium.defined(picked) || !picked.id) {
            setTooltip(null);
            return;
          }

          const data = picked.id as SatPickData;
          if (data.noradId === undefined) {
            setTooltip(null);
            return;
          }

          // Scale up hovered billboard
          if (picked.primitive && typeof (picked.primitive as CesiumType.Billboard).scale === 'number') {
            const bb = picked.primitive as CesiumType.Billboard;
            bb.scale = 2.0;
            hoveredBillboardRef.current = bb;
            viewer.scene.canvas.style.cursor = 'pointer';
          }

          const rec = layersRef.current[data.layerId]?.records.find(
            (r) => r.NORAD_CAT_ID === data.noradId
          );
          let alt = 0;
          let velocity = 0;
          try {
            const pos = rec ? propagateSatellites([rec], data.layerId) : [];
            if (pos.length > 0) { alt = pos[0].alt; velocity = pos[0].velocity; }
          } catch { /* ignore propagation errors */ }

          setTooltip({
            x: event.endPosition.x,
            y: event.endPosition.y,
            name: rec?.OBJECT_NAME ?? `NORAD #${data.noradId}`,
            layerId: data.layerId,
            noradId: data.noradId,
            alt,
            velocity,
          });
        },
        Cesium.ScreenSpaceEventType.MOUSE_MOVE
      );

      // ---- Initial data fetch ----
      fetchWeather();
      fetchISS(Cesium, viewer);
      loadEnabledLayers(Cesium, viewer);

      // ---- Animation loop ----
      const tick = () => {
        if (destroyed || viewer.isDestroyed()) return;
        const now = new Date();

        for (const id of LAYER_ORDER) {
          const state = layersRef.current[id];
          if (!state.enabled || state.records.length === 0) continue;

          const billboards = primitivesRef.current.get(id);
          if (!billboards || billboards.isDestroyed()) continue;

          const positions = propagateSatellites(state.records, id, now);
          const posMap = new Map(positions.map((pos) => [pos.noradId, pos]));

          for (let i = 0; i < billboards.length; i++) {
            const bb = billboards.get(i);
            const bbData = bb.id as SatPickData;
            const pos = posMap.get(bbData?.noradId);
            if (pos) {
              bb.position = Cesium.Cartesian3.fromDegrees(pos.lon, pos.lat, pos.alt * 1000);
            }
          }
        }

        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);

      // ISS refresh interval
      const issInterval = setInterval(() => fetchISS(Cesium, viewer), 5000);
      const weatherInterval = setInterval(() => fetchWeather(), 300000);

      return () => {
        destroyed = true;
        clearInterval(issInterval);
        clearInterval(weatherInterval);
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        handler.destroy();
        viewer.destroy();
      };
    });

    return () => { destroyed = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Sync layer enabled/data state to Cesium primitives ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    import('cesium').then((Cesium) => {
      for (const id of LAYER_ORDER) {
        const state = layers[id];

        const bbs = primitivesRef.current.get(id);
        if (bbs && !bbs.isDestroyed()) bbs.show = state.enabled;

        const lines = orbitLinesRef.current.get(id);
        if (lines && !lines.isDestroyed()) lines.show = state.enabled && showOrbits;

        if (state.enabled && !state.loaded) {
          fetchLayerTLE(id, Cesium, viewer);
        }

        if (state.loaded && state.records.length > 0 && !primitivesRef.current.has(id)) {
          renderLayer(id, state.records, Cesium, viewer);
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers]);

  // ---- Rebuild when records update ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    import('cesium').then((Cesium) => {
      for (const id of LAYER_ORDER) {
        const state = layers[id];
        if (state.loaded && state.records.length > 0) {
          renderLayer(id, state.records, Cesium, viewer);
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers]);

  // ---- Track selected satellite ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !selected || !trackSelected) return;

    import('cesium').then((Cesium) => {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          selected.lon,
          selected.lat,
          (selected.alt + 2000) * 1000
        ),
        duration: 1.5,
      });
    });
  }, [selected, trackSelected]);

  // ---- Orbit trails toggle ----
  useEffect(() => {
    for (const [, lines] of orbitLinesRef.current) {
      if (!lines.isDestroyed()) lines.show = showOrbits;
    }
  }, [showOrbits]);

  // ---- flyTo exposed to parent ----
  const flyToSatellite = useCallback(
    (noradId: number) => {
      const viewer = viewerRef.current;
      if (!viewer) return;

      import('cesium').then((Cesium) => {
        for (const id of LAYER_ORDER) {
          const rec = layersRef.current[id].records.find((r) => r.NORAD_CAT_ID === noradId);
          if (rec) {
            const pos = propagateSatellites([rec], id as SatelliteLayerId);
            if (pos.length > 0) {
              const p = pos[0];
              viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(p.lon, p.lat, (p.alt + 3000) * 1000),
                duration: 2,
              });
            }
            break;
          }
        }
      });
    },
    []
  );

  useEffect(() => {
    if (onFlyToRef) onFlyToRef.current = flyToSatellite;
  }, [flyToSatellite, onFlyToRef]);

  // ---- Helpers ----

  function loadEnabledLayers(
    Cesium: typeof CesiumType,
    viewer: CesiumType.Viewer
  ) {
    for (const id of LAYER_ORDER) {
      if (layersRef.current[id].enabled) {
        fetchLayerTLE(id, Cesium, viewer);
      }
    }
  }

  function fetchLayerTLE(
    id: SatelliteLayerId,
    Cesium: typeof CesiumType,
    viewer: CesiumType.Viewer
  ) {
    dispatch({ type: 'SET_LAYER_LOADING', id });
    fetch(`/api/satellite/tle?group=${id}`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (!Array.isArray(data)) {
          dispatch({ type: 'SET_LAYER_ERROR', id });
          return;
        }
        const records = data as TLERecord[];
        dispatch({ type: 'SET_LAYER_DATA', id, records });
        renderLayer(id, records, Cesium, viewer);
      })
      .catch(() => dispatch({ type: 'SET_LAYER_ERROR', id }));
  }

  function renderLayer(
    id: SatelliteLayerId,
    records: TLERecord[],
    Cesium: typeof CesiumType,
    viewer: CesiumType.Viewer
  ) {
    if (viewer.isDestroyed()) return;

    const cfg = LAYER_CONFIGS[id];
    const color = Cesium.Color.fromCssColorString(cfg.color);
    const filt = filtersRef.current;
    const isEnabled = layersRef.current[id]?.enabled ?? false;
    const icon = iconsRef.current.get(id) ?? createLayerIcon(id, cfg.color, id === 'debris' ? 14 : 28);

    // Remove old collection
    const existing = primitivesRef.current.get(id);
    if (existing && !existing.isDestroyed()) {
      viewer.scene.primitives.remove(existing);
      primitivesRef.current.delete(id);
    }

    const billboards = new Cesium.BillboardCollection();
    viewer.scene.primitives.add(billboards);
    primitivesRef.current.set(id, billboards);
    billboards.show = isEnabled;

    const positions = propagateSatellites(records, id);
    const isISS = id === 'iss';

    for (const pos of positions) {
      if (pos.alt < filt.altMin || pos.alt > filt.altMax) continue;
      const rec = records.find((r) => r.NORAD_CAT_ID === pos.noradId);
      if (rec && (rec.INCLINATION < filt.inclMin || rec.INCLINATION > filt.inclMax)) continue;

      billboards.add({
        position: Cesium.Cartesian3.fromDegrees(pos.lon, pos.lat, pos.alt * 1000),
        image: icon,
        color: color.withAlpha(isISS ? 1.0 : id === 'debris' ? 0.65 : 0.9),
        scale: isISS ? 1.4 : id === 'debris' ? 0.8 : 1.0,
        scaleByDistance: new Cesium.NearFarScalar(1.5e6, 1.5, 5.0e7, 0.4),
        translucencyByDistance: new Cesium.NearFarScalar(1e7, 1.0, 5e7, id === 'debris' ? 0.15 : 0.35),
        id: { noradId: pos.noradId, layerId: id } satisfies SatPickData,
      });
    }

    // Build orbit trails if currently enabled
    if (showOrbitsRef.current) {
      buildOrbitTrails(id, records, Cesium, viewer, isEnabled);
    }
  }

  function buildOrbitTrails(
    id: SatelliteLayerId,
    records: TLERecord[],
    Cesium: typeof CesiumType,
    viewer: CesiumType.Viewer,
    show: boolean
  ) {
    if (viewer.isDestroyed()) return;

    const existing = orbitLinesRef.current.get(id);
    if (existing && !existing.isDestroyed()) {
      viewer.scene.primitives.remove(existing);
    }

    const cfg = LAYER_CONFIGS[id];
    const color = Cesium.Color.fromCssColorString(cfg.color).withAlpha(0.2);
    const linesCollection = new Cesium.PolylineCollection();
    viewer.scene.primitives.add(linesCollection);
    orbitLinesRef.current.set(id, linesCollection);
    linesCollection.show = show && showOrbitsRef.current;

    // Sample only first 50 sats for performance
    const sample = records.slice(0, 50);
    const now = new Date();

    for (const rec of sample) {
      const period = getOrbitalPeriod(rec);
      if (period <= 0) continue;
      const steps = 90;
      const stepMs = (period * 60 * 1000) / steps;
      const cartesians: CesiumType.Cartesian3[] = [];

      for (let i = 0; i <= steps; i++) {
        const t = new Date(now.getTime() + i * stepMs);
        const pos = propagateSatellites([rec], id, t);
        if (pos.length > 0) {
          cartesians.push(
            Cesium.Cartesian3.fromDegrees(pos[0].lon, pos[0].lat, pos[0].alt * 1000)
          );
        }
      }

      if (cartesians.length >= 2) {
        linesCollection.add({
          positions: cartesians,
          width: 1,
          material: Cesium.Material.fromType('Color', { color }),
        });
      }
    }
  }

  async function fetchWeather() {
    try {
      const res = await fetch('/api/satellite/weather');
      const data = await res.json();
      setWeather(data);
    } catch {/* ignore */}
  }

  async function fetchISS(Cesium: typeof CesiumType, viewer: CesiumType.Viewer) {
    try {
      const res = await fetch('/api/satellite/iss');
      const data = await res.json();
      if (!data.position) return;

      setISSPosition({
        latitude: data.position.latitude,
        longitude: data.position.longitude,
        timestamp: data.position.timestamp,
      });

      if (viewer.isDestroyed()) return;

      const pos = Cesium.Cartesian3.fromDegrees(
        data.position.longitude,
        data.position.latitude,
        408000
      );

      if (!issEntityRef.current) {
        issEntityRef.current = viewer.entities.add({
          id: 'iss-label',
          position: pos,
          label: {
            text: '◉ ISS',
            font: '11px Orbitron, monospace',
            fillColor: Cesium.Color.fromCssColorString('#ff6600'),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -18),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 20000000),
          },
        });
      } else {
        issEntityRef.current.position = new Cesium.ConstantPositionProperty(pos);
      }
    } catch {/* ignore */}
  }

  // ---- Render ----
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#020014' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Hover tooltip */}
      {tooltip && (
        <HoverTooltip tooltip={tooltip} containerRef={containerRef} />
      )}
    </div>
  );
}

// ---- Tooltip sub-component ----

function HoverTooltip({
  tooltip,
  containerRef,
}: {
  tooltip: TooltipState;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const cfg = LAYER_CONFIGS[tooltip.layerId];
  const containerWidth = containerRef.current?.clientWidth ?? 9999;
  const flipX = tooltip.x > containerWidth - 230;

  return (
    <div
      style={{
        position: 'absolute',
        left: tooltip.x + (flipX ? -220 : 18),
        top: Math.max(4, tooltip.y - 10),
        pointerEvents: 'none',
        zIndex: 30,
      }}
    >
      <div style={{
        background: 'rgba(2, 0, 20, 0.93)',
        border: `1px solid ${cfg.color}55`,
        boxShadow: `0 0 18px ${cfg.glowColor}, inset 0 0 12px rgba(0,0,0,0.6)`,
        padding: '10px 14px',
        minWidth: '200px',
        backdropFilter: 'blur(10px)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Accent line */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '2px',
          background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)`,
        }} />

        {/* Layer badge + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '7px' }}>
          <div style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: cfg.color,
            boxShadow: `0 0 8px ${cfg.color}`,
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.5rem',
            color: cfg.color,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}>
            {cfg.label}
          </span>
        </div>

        <div style={{
          fontFamily: 'var(--font-orbitron, monospace)',
          fontSize: '0.65rem',
          color: '#dde0ff',
          letterSpacing: '0.04em',
          marginBottom: '8px',
          maxWidth: '190px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {tooltip.name}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <TooltipRow label="NORAD" value={`#${tooltip.noradId}`} color={cfg.color} />
          <TooltipRow label="ALTITUDE" value={`${tooltip.alt.toFixed(0)} km`} highlight />
          <TooltipRow label="VELOCITY" value={`${tooltip.velocity.toFixed(2)} km/s`} highlight />
        </div>

        <div style={{
          marginTop: '8px',
          paddingTop: '6px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '0.5rem',
          color: 'rgba(140, 150, 200, 0.6)',
          letterSpacing: '0.08em',
        }}>
          Click for full orbital data →
        </div>
      </div>
    </div>
  );
}

function TooltipRow({
  label,
  value,
  highlight,
  color,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  color?: string;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
      <span style={{
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: '0.56rem',
        color: 'rgba(130, 145, 190, 0.8)',
        letterSpacing: '0.1em',
        flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: '0.58rem',
        color: highlight ? '#00ffcc' : (color ?? '#c0c8e8'),
        letterSpacing: '0.05em',
      }}>
        {value}
      </span>
    </div>
  );
}
