import WebScene from '@arcgis/core/WebScene';
import Point from '@arcgis/core/geometry/Point';
import VectorTileLayer from '@arcgis/core/layers/VectorTileLayer';
import '@arcgis/map-components/components/arcgis-scene';
import '@arcgis/map-components/components/arcgis-zoom';

import { useEffect, useRef } from 'react';
import { concentricRipples } from './Map/utils';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';

export default function AppMap() {
  const sceneRef = useRef<HTMLArcgisSceneElement | null>(null);
  const lon = -5.544167;
  const lat = 56.346063;
  useEffect(() => {
    const sceneEl = sceneRef.current;
    if (!sceneEl) return;

    // Create and assign scene FIRST
    const scene = new WebScene({
      basemap: "dark-gray-vector",
      ground: 'world-elevation',
    });

    sceneEl.map = scene;

    sceneEl.viewOnReady().then(() => {
      // Fly to Oban
      sceneEl.view.goTo({
        center: [lon, lat],
        zoom: 14,
        tilt: 70,
      });

      sceneEl.view.environment = {
        lighting: {
          date: new Date('2024-12-01T22:00:00'),
          directShadowsEnabled: true,
          cameraTrackingEnabled: false,
        },
        atmosphereEnabled: false,
        starsEnabled: false,
        background: {
          type: 'color',
          color: [0, 0, 0, 1],
        },
      };

      scene.ground.surfaceColor = '#000000';

      scene.ground.layers.forEach((layer: any) => {
        layer.exaggeration = 1.8;
      });

      const contours = new FeatureLayer({
        url: 'https://services1.arcgis.com/KhIWHcV1w9na10q2/arcgis/rest/services/nm82_OST50CONT_20250529/FeatureServer/1',
        elevationInfo: { mode: 'on-the-ground' },
        renderer: {
          type: 'simple',
          symbol: {
            type: 'simple-line',
            color: [255, 255, 255, 0.95],
          },
        },
      });

      scene.add(contours);

      const obanPoint = new Point({
        longitude: lon,
        latitude: lat,
      });

      concentricRipples(scene, obanPoint);
    });
  }, []);

  return (
    <section className="section bg-secondary text-center">
      <div className="w-full h-[500px]">
        {/* @ts-ignore */}
        <arcgis-scene ref={sceneRef} style={{ width: '100%', height: '100%', display: 'block' }}>
          {/* @ts-ignore */}

          <arcgis-zoom position="top-left" />
          {/* @ts-ignore */}
        </arcgis-scene>
      </div>
    </section>
  );
}
