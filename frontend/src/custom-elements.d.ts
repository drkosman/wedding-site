import type { DetailedHTMLProps, HTMLAttributes } from 'react';

declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'arcgis-scene': DetailedHTMLProps<
        HTMLAttributes<HTMLArcgisSceneElement> & { hideAttribution?: boolean },
        HTMLArcgisSceneElement
      >;
    }
  }
}
