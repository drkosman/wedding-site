import type { DetailedHTMLProps, HTMLAttributes } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          action: string;
          theme: 'light';
          callback: (token: string) => void;
          'expired-callback': () => void;
          'error-callback': () => void;
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

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
