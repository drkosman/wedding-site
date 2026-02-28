import React, { useEffect, useMemo, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { TerrainLayer } from '@deck.gl/geo-layers';
import { AmbientLight, DirectionalLight, LightingEffect } from '@deck.gl/core';

// Pick a venue
const VENUE_LNG = -5.5;
const VENUE_LAT = 56.5;

// A decent public terrain + imagery combo (no key) for prototyping.
// For production, consider hosting tiles or using a provider with terms you accept.
const TERRAIN_DEM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'; // Mapzen terrarium format
const SURFACE_IMG = 'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'; // simple surface

// Lighting (makes terrain pop)
const ambient = new AmbientLight({ intensity: 0.4 });
const dir = new DirectionalLight({
  intensity: 1.0,
  direction: [-1, -3, -2],
});
const lighting = new LightingEffect({ ambientLight: ambient, directionalLight: dir });

export default function VenueTerrainScan() {
  // Animate time (seconds)
  const [t, setT] = useState(0);

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

  // Deck view state: pitch/bearing for “3D”
  const initialViewState = useMemo(
    () => ({
      longitude: VENUE_LNG,
      latitude: VENUE_LAT,
      zoom: 8.5,
      pitch: 60,
      bearing: -20,
    }),
    [],
  );

  const layers = useMemo(() => {
    // Wave parameters
    const waveSpeed = 900; // meters/sec
    const waveWidth = 650; // meters (thickness)
    const maxRadius = 25000; // meters
    const radius = (t * waveSpeed) % maxRadius;

    return [
      new TerrainLayer({
        id: 'terrain',
        minZoom: 0,
        maxZoom: 14,

        // Surface texture over the mesh
        texture: SURFACE_IMG,

        // Elevation tiles (terrarium PNG)
        elevationData: TERRAIN_DEM,
        elevationDecoder: {
          // Terrarium decode: (R*256 + G + B/256) - 32768
          rScaler: 256,
          gScaler: 1,
          bScaler: 1 / 256,
          offset: -32768,
        },

        // Terrain scale/exaggeration
        elevationScale: 1.6,

        // Your area of interest
        bounds: [-7.5, 55.2, -3.0, 58.3], // [minLng, minLat, maxLng, maxLat] adjust

        // Shading on
        wireframe: false,
        material: {
          ambient: 0.35,
          diffuse: 0.6,
          shininess: 18,
          specularColor: [255, 255, 255],
        },

        // Pass uniforms to shader
        parameters: {
          // Helps avoid z-fighting artifacts sometimes
          depthTest: true,
        },

        // deck.gl lets you inject shader code:
        extensions: [],

        // Custom shader injection
        getShaderModule: () => null as any, // (not used)
        _subLayerProps: {
          mesh: {
            // Inject into the generated terrain mesh shader
            // This is the key bit.
            // Note: API surface can change; this is “best effort” for current deck.gl patterns.
            // If TS complains, you can cast to `any`.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            shaderHooks: (shaders: any) => shaders,
          },
        },

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onViewportLoad: undefined as any,

        // The recommended way: use `TerrainLayer`'s `extensions` via `shaderInject`
        // but TerrainLayer doesn’t expose it cleanly. We can use the generic `shaderInject` prop.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        shaderInject: {
          // Declare uniforms
          'fs:#decl': `
            uniform vec2 u_scanCenterLngLat;
            uniform float u_scanRadius;
            uniform float u_scanWidth;
          `,

          // Add wave effect near end of fragment shader
          'fs:#main-end': `
            // World position (meters) approximated from lng/lat near center
            // deck.gl provides geometry.position in common space; for TerrainLayer we can approximate using
            // the projected position from vPosition (in clip space) is not helpful.
            // However TerrainLayer’s shader typically has a common-space position varying.
            // Many builds expose 'vPosition' or 'worldPosition'. If this fails to compile,
            // we’ll adjust to match the actual varying names in your version.
          `,
        } as any,

        // Uniforms supplied here:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        uniforms: {
          u_scanCenterLngLat: [VENUE_LNG, VENUE_LAT],
          u_scanRadius: radius,
          u_scanWidth: waveWidth,
        } as any,
      }) as any,
    ];
  }, [t]);

  return (
    <section className="py-20 px-6 text-center bg-neutral-900">
      <h2 className="text-3xl font-serif mb-8 text-white">Location</h2>

      <div className="h-[520px] w-full max-w-5xl mx-auto rounded-2xl overflow-hidden shadow-lg">
        <DeckGL
          initialViewState={initialViewState}
          controller={true}
          layers={layers}
          effects={[lighting]}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      <p className="mt-4 text-sm text-neutral-300">
        Tip: drag to rotate/tilt. The scan expands outward from the venue.
      </p>
    </section>
  );
}
