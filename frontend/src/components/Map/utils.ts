import Circle from '@arcgis/core/geometry/Circle';
import type Point from '@arcgis/core/geometry/Point';
import Graphic from '@arcgis/core/Graphic';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Color from '@arcgis/core/Color';
import type WebScene from '@arcgis/core/WebScene';
import type SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';

export function concentricRipples(scene: WebScene, center: Point) {
  const layer = new GraphicsLayer();
  scene.add(layer);

  const rippleCount = 10;
  const maxRadius = 9000;
  const growthPerFrame = 6;
  const startAlphaBG = 0.0;
  const startAlphaOutline = 1;

  // Create initial radii spaced apart
  const radii = Array.from({ length: rippleCount }, (_, i) => (i * maxRadius) / rippleCount);

  const graphics = radii.map((radius) => {
    const graphic = new Graphic({
      geometry: new Circle({
        center,
        radius,
        radiusUnit: 'meters',
        numberOfPoints: 128,
      }),
      symbol: {
        type: 'simple-fill',
        color: new Color([245, 210, 55, startAlphaBG]),
        outline: {
          type: 'simple-line',
          color: new Color([245, 210, 55, startAlphaOutline]),
          width: 2,
        },
      },
      elevationInfo: { mode: 'on-the-ground' },
    });

    layer.add(graphic);
    return graphic;
  });

  let frameId: number;

  function animate() {
    graphics.forEach((graphic, i) => {
      radii[i] += growthPerFrame;

      if (radii[i] > maxRadius) {
        radii[i] = 0;
      }

      graphic.geometry = new Circle({
        center,
        radius: radii[i],
        radiusUnit: 'meters',
        numberOfPoints: 128,
      });

    });

    frameId = requestAnimationFrame(animate);
  }

  animate();

  return () => {
    cancelAnimationFrame(frameId);
    scene.remove(layer);
  };
}
