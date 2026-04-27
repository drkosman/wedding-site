import WebScene from '@arcgis/core/WebScene';
import Point from '@arcgis/core/geometry/Point';
import '@arcgis/map-components/components/arcgis-scene';
import Map from '@arcgis/core/Map';
import { Maximize2, Minimize2 } from 'lucide-react';

import { useEffect, useRef, useState } from 'react';
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

const removeMapAttribution = (view: MapView | HTMLArcgisSceneElement['view']) => {
  view.attributionVisible = false;
  view.ui.components = [];
};

export default function AppMap() {
  const sceneRef = useRef<HTMLArcgisSceneElement | null>(null);
  const overviewRef = useRef<HTMLDivElement | null>(null);
  const overviewViewRef = useRef<MapView | null>(null);
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);

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
      constraints: { rotationEnabled: false },
      popupEnabled: false,
      ui: { components: [] },
    });
    overviewViewRef.current = overviewView;

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

    removeMapAttribution(overviewView);

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

      removeMapAttribution(sceneEl.view);

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
      overviewViewRef.current = null;
      overviewView.destroy();
    };
  }, []);

  useEffect(() => {
    const overviewView = overviewViewRef.current;
    if (!overviewView) return;

    overviewView.attributionVisible = false;
    overviewView.ui.components = [];

    const nextZoom = isOverviewExpanded ? 6 : 4;

    requestAnimationFrame(() => {
      overviewView.goTo({ center: [VENUE.lon, VENUE.lat], zoom: nextZoom }).catch(() => undefined);
    });
  }, [isOverviewExpanded]);

  return (
    <section className="section bg-secondary text-center">
      <div className="container-page max-w-3xl py-0">
        <div className="relative h-[360px] w-full overflow-hidden rounded-lg border border-[var(--color-border)] bg-black shadow-[0_10px_30px_rgba(0,0,0,0.08)] md:h-[500px]">
          <arcgis-scene
            ref={sceneRef}
            hideAttribution
            style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
          />

          <div
            className={`absolute z-10 overflow-hidden rounded-2xl border border-white/20 bg-black/80 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-sm transition-all duration-500 ease-out ${
              isOverviewExpanded
                ? 'inset-3 md:inset-4'
                : 'top-3 right-3 h-36 w-36 md:h-40 md:w-40'
            }`}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between bg-gradient-to-b from-black/85 via-black/45 to-transparent px-3 py-3 text-left">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-white/55">Location</p>
                <p className="text-sm font-medium text-white">Barnacarry Bay</p>
                <p className="text-xs text-white/65">
                  {isOverviewExpanded ? 'Explore the surrounding area' : 'Expand for context'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOverviewExpanded((expanded) => !expanded)}
                className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/65 text-white transition hover:border-white/40 hover:bg-black/80"
                aria-label={isOverviewExpanded ? 'Minimise overview map' : 'Maximise overview map'}
              >
                {isOverviewExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>

            <div
              ref={overviewRef}
              className={`h-full w-full transition-opacity duration-300 ${
                isOverviewExpanded ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-90'
              }`}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
