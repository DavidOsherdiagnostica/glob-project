'use client';

// Import Cesium types for TypeScript — runtime import is dynamic (SSR safe)
import type * as CesiumType from 'cesium';
import { useEffect, useRef, useCallback } from 'react';
import { useSatellite, LAYER_ORDER, LAYER_CONFIGS } from './SatelliteContext';
import { propagateSatellites, getOrbitalPeriod } from '@/lib/satellite/propagator';
import type { SatelliteLayerId, TLERecord, SelectedSatellite } from '@/lib/satellite/types';

interface SatPickData {
  noradId: number;
  layerId: SatelliteLayerId;
}

export default function SatelliteGlobe({
  onFlyToRef,
}: {
  onFlyToRef?: React.MutableRefObject<((noradId: number) => void) | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumType.Viewer | null>(null);
  const primitivesRef = useRef<Map<SatelliteLayerId, CesiumType.PointPrimitiveCollection>>(new Map());
  const orbitLinesRef = useRef<Map<SatelliteLayerId, CesiumType.PolylineCollection>>(new Map());
  const animFrameRef = useRef<number | null>(null);
  const issEntityRef = useRef<CesiumType.Entity | null>(null);

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

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    showOrbitsRef.current = showOrbits;
  }, [showOrbits]);

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

      if (destroyed || !containerRef.current) return;

      // High-res Esri World Imagery (satellite photo tiles, free, no API key)
      let baseImagery: CesiumType.ImageryLayer;
      try {
        const esri = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
          'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
        );
        baseImagery = new Cesium.ImageryLayer(esri);
      } catch {
        // fallback to bundled NaturalEarthII
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
      viewer.scene.globe.maximumScreenSpaceError = 1.5; // sharper textures (default = 2)
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#020014');
      // Match device pixel ratio for crisp rendering on HiDPI/Retina screens
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

      // ---- Click handler ----
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
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

          const points = primitivesRef.current.get(id);
          if (!points || points.isDestroyed()) continue;

          const positions = propagateSatellites(state.records, id, now);
          const posMap = new Map(positions.map((pos) => [pos.noradId, pos]));

          for (let i = 0; i < points.length; i++) {
            const pt = points.get(i);
            const ptData = pt.id as SatPickData;
            const pos = posMap.get(ptData?.noradId);
            if (pos) {
              pt.position = Cesium.Cartesian3.fromDegrees(pos.lon, pos.lat, pos.alt * 1000);
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

        // Show/hide existing collection
        const pts = primitivesRef.current.get(id);
        if (pts && !pts.isDestroyed()) pts.show = state.enabled;

        const lines = orbitLinesRef.current.get(id);
        if (lines && !lines.isDestroyed()) lines.show = state.enabled && showOrbits;

        // Fetch if newly enabled and not yet loaded
        if (state.enabled && !state.loaded) {
          fetchLayerTLE(id, Cesium, viewer);
        }

        // Rebuild primitives when data arrives (records changed)
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

    // Remove old collection
    const existingPts = primitivesRef.current.get(id);
    if (existingPts && !existingPts.isDestroyed()) {
      viewer.scene.primitives.remove(existingPts);
      primitivesRef.current.delete(id);
    }

    const points = new Cesium.PointPrimitiveCollection();
    viewer.scene.primitives.add(points);
    primitivesRef.current.set(id, points);
    points.show = isEnabled;

    const positions = propagateSatellites(records, id);

    for (const pos of positions) {
      if (pos.alt < filt.altMin || pos.alt > filt.altMax) continue;
      const rec = records.find((r) => r.NORAD_CAT_ID === pos.noradId);
      if (rec && (rec.INCLINATION < filt.inclMin || rec.INCLINATION > filt.inclMax)) continue;

      const isISS = id === 'iss';
      points.add({
        position: Cesium.Cartesian3.fromDegrees(pos.lon, pos.lat, pos.alt * 1000),
        color: color.withAlpha(isISS ? 1.0 : 0.9),
        pixelSize: isISS ? 12 : id === 'debris' ? 2 : 4,
        outlineColor: isISS
          ? Cesium.Color.fromCssColorString('#ff6600').withAlpha(0.7)
          : color.withAlpha(0.35),
        outlineWidth: isISS ? 3 : 1,
        scaleByDistance: new Cesium.NearFarScalar(1.5e6, 1.5, 5.0e7, 0.5),
        translucencyByDistance: new Cesium.NearFarScalar(1e7, 1.0, 5e7, 0.4),
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

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', background: '#020014' }}
    />
  );
}
