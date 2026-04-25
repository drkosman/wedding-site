import WebScene from '@arcgis/core/WebScene';
import Point from '@arcgis/core/geometry/Point';
import '@arcgis/map-components/components/arcgis-scene';
import '@arcgis/map-components/components/arcgis-zoom';
import Map from '@arcgis/core/Map';

import { useEffect, useRef } from 'react';
import { concentricRipples } from './Map/utils';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { CONTOUR_URLS } from './Map/constants';
import MapView from '@arcgis/core/views/MapView';
import Graphic from '@arcgis/core/Graphic';

const VENUE = {
  lon: -5.544167,
  lat: 56.346063,
};

type ExaggeratedGroundLayer = {
  exaggeration: number;
};

export default function AppMap() {
  const sceneRef = useRef<HTMLArcgisSceneElement | null>(null);
  const overviewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sceneEl = sceneRef.current;
    const overviewEl = overviewRef.current;
    if (!sceneEl || !overviewEl) return;

    let cancelled = false;
    let removeRipples: (() => void) | undefined;

    const overviewMap = new Map({
      basemap: {
        portalItem: {
          id: '7e2b9be8a9c94e45b7f87857d8d168d6', // Human geography dark
        },
      },
    });

    const overviewView = new MapView({
      container: overviewEl,
      map: overviewMap,

      center: [VENUE.lon, VENUE.lat],
      zoom: 4,
      ui: { components: [] },
    });

    overviewView.graphics.add(
      new Graphic({
        geometry: {
          type: 'point',
          longitude: VENUE.lon,
          latitude: VENUE.lat,
        },
        symbol: {
          type: 'simple-marker',
          color: 'gold',
          size: 8,
          outline: {
            color: 'white',
            width: 1,
          },
        },
      }),
    );

    overviewView.ui.components = [];

    // Create and assign scene FIRST
    const scene = new WebScene({
      basemap: 'navigation-dark-3d',
      ground: 'world-elevation',
    });

    sceneEl.map = scene;

    sceneEl.viewOnReady().then(() => {
      if (cancelled) {
        return;
      }

      // Fly to Oban
      sceneEl.view.goTo({
        center: [VENUE.lon, VENUE.lat],
        zoom: 15,
        tilt: 65,
      });

      sceneEl.view.environment = {
        atmosphereEnabled: false,
        starsEnabled: false,
        background: {
          type: 'color',
          color: [0, 0, 0, 1],
        },
      };

      sceneEl.view.ui.components = [];

      sceneEl.view.environment.lighting = {
        date: new Date('2024-12-01T08:00:00'),
        directShadowsEnabled: true,
      };

      sceneEl.view.qualityProfile = 'high';

      scene.ground.navigationConstraint = {
        type: 'none',
      };

      scene.ground.surfaceColor = '#000000';

      scene.ground.layers.forEach((layer) => {
        (layer as unknown as ExaggeratedGroundLayer).exaggeration = 3;
      });

      CONTOUR_URLS.forEach((URL) => {
        const contours = new FeatureLayer({
          url: URL,
          elevationInfo: { mode: 'on-the-ground' },
          renderer: {
            type: 'simple',
            symbol: {
              type: 'simple-line',
              color: [236, 217, 255, 0.95],
            },
          },
        });

        scene.add(contours);
      });

      const obanPoint = new Point({
        longitude: VENUE.lon,
        latitude: VENUE.lat,
      });

      const pin = new Graphic({
        geometry: {
          type: 'point',
          longitude: VENUE.lon,
          latitude: VENUE.lat,
          z: 0,
        },
        symbol: {
          type: 'point-3d',
          symbolLayers: [
            {
              type: 'object',
              resource: { primitive: 'diamond' },
              height: 75,
              width: 75,
              depth: 75,
              material: {
                color: [255, 215, 0, 25],
                emissive: { strength: 4, source: 'color' },
              },
            },
          ],
          verticalOffset: {
            screenLength: 8,
            maxWorldLength: 500,
          },
        },
      });

      sceneEl.view.graphics.add(pin);

      removeRipples = concentricRipples(scene, obanPoint);
    });

    return () => {
      cancelled = true;
      removeRipples?.();
      overviewView.destroy();
    };
  }, []);

  return (
    <section className="section bg-secondary text-center">
      <div className="w-full h-[500px] relative">
        <arcgis-scene
          ref={sceneRef}
          style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
        />

        <div
          ref={overviewRef}
          className="absolute top-2 right-2 w-35 h-35 border border-white/40 rounded overflow-hidden bg-black"
        />
      </div>
    </section>
  );
}
