import { useEffect, useMemo, useRef, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { TerrainLayer } from '@deck.gl/geo-layers';
import { SolidPolygonLayer } from '@deck.gl/layers';
import { AmbientLight, DirectionalLight, LightingEffect } from '@deck.gl/core';
import { _TerrainExtension as TerrainExtension } from '@deck.gl/extensions';
import { ScanWaveExtension } from './ScanWaveExtension';

type LngLat = [number, number];

const VENUE: LngLat = [-5.5, 56.5];
// A generous bounding box around the venue (minLng, minLat, maxLng, maxLat)
const BOUNDS: [number, number, number, number] = [-7.5, 55.2, -3.0, 58.3];

// DEM (Terrarium format) – good for prototyping.
// (If you pref*/er MapTiler/Mapbox Terrain-RGB later, swap decoder + URLs.)
const DEM_TERRARIUM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const OSM_TEXTURE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const CARTO_VOYAGER = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
function boundsPolygon([minLng, minLat, maxLng, maxLat]: [number, number, number, number]) {
  // Closed ring
  return [
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat],
    [minLng, minLat],
  ];
}

export default function VenueMap3DScan() {
  const [centerCommon, setCenterCommon] = useState<[number, number, number]>([0, 0, 0]);

  const [t, setT] = useState(0);
const computedRef = useRef(false);

const handleAfterRender = ({ viewports }: any) => {
  if (computedRef.current) return;

  const viewport = viewports?.[0];
  if (!viewport) return;

  const projected = viewport.projectPosition([...VENUE, 0]);

  setCenterCommon(projected);   // ONE TIME
  computedRef.current = true;   // prevents future calls
};

  // Animate time (seconds)
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      setT((now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Lighting to make terrain feel “3D”
  const effects = useMemo(() => {
    const ambient = new AmbientLight({ intensity: 0.35 });
    const dir = new DirectionalLight({ intensity: 1.0, direction: [-1, -3, -2] });
    return [new LightingEffect({ ambientLight: ambient, directionalLight: dir })];
  }, []);

  const initialViewState = useMemo(
    () => ({
      longitude: VENUE[0],
      latitude: VENUE[1],
      zoom: 8.6,
      pitch: 62,
      bearing: -20,
    }),
    [],
  );

  // Scan wave params (meters)
  const waveSpeed = 1400; // meters per second
  const maxRadius = 40000; // loop
  const scanRadiusMeters = (t * waveSpeed) % maxRadius;

  const layers = useMemo(() => {
    const terrain = new TerrainLayer({
      id: 'terrain',
      bounds: BOUNDS,
      elevationData: DEM_TERRARIUM,
      texture: CARTO_VOYAGER,
      elevationDecoder: {
        // Terrarium decode: (R*256 + G + B/256) - 32768
        rScaler: 256,
        gScaler: 1,
        bScaler: 1 / 256,
        offset: -32768,
      },
      elevationScale: 1.8,
      wireframe: false,

      // IMPORTANT for TerrainExtension: this layer becomes the "terrain source"
      // and also draws itself.
      operation: 'terrain+draw',
    });

    // This polygon is just a canvas: the shader discards everything except the ring
    const scan = new SolidPolygonLayer({
      id: 'scan-wave',
      data: [{ polygon: boundsPolygon(BOUNDS) }],
      getPolygon: (d: any) => d.polygon,
      filled: true,
      stroked: false,

      // Base fill (mostly irrelevant — shader overrides/discards)
      getFillColor: [0, 0, 0, 0],

      // Drape the layer onto the terrain surface (no true 3D mesh here—GPU repositions)
      extensions: [new TerrainExtension({ terrainDrawMode: 'drape' }), new ScanWaveExtension()],

      // Props consumed by ScanWaveExtension uniforms
      scanCenterLngLat: VENUE,
      scanRadiusMeters,
      scanWidthMeters: 1200,
      scanGlow: 3.2,
      scanColorRgb: [0.3, 1.0, 0.7], // minty green (0..1)
      scanAlpha: 0.38,

      // Prevent z-fighting with the terrain
      parameters: { depthTest: true },
    } as any);

    return [terrain, scan];
  }, [scanRadiusMeters]);

  return (
    <section className="py-20 px-6 text-center bg-neutral-950">
      <h2 className="text-3xl font-serif mb-8 text-white">Location</h2>

      <div className="relative w-full h-[400px] overflow-hidden rounded-2xl">
         <DeckGL
          // onAfterRender={handleAfterRender}
          initialViewState={initialViewState}
          controller={true}
          layers={layers}
          effects={effects}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      <p className="mt-4 text-sm text-neutral-300">
        Drag to tilt/rotate. The scan wave is shaded by a real 3D terrain mesh and draped on the
        surface.
      </p>
    </section>
  );
}
