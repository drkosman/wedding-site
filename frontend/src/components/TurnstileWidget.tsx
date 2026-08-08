import { useEffect, useRef, useState } from 'react';

type TurnstileWidgetProps = {
  onToken: (token: string) => void;
  resetKey: number;
};

const SCRIPT_ID = 'cloudflare-turnstile-script';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export default function TurnstileWidget({ onToken, resetKey }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  const [unavailable, setUnavailable] = useState(!siteKey);

  useEffect(() => {
    if (!siteKey || !containerRef.current) {
      return;
    }

    let cancelled = false;
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

    const renderWidget = () => {
      if (cancelled || !containerRef.current || !window.turnstile || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action: 'rsvp',
        theme: 'light',
        callback: (token) => onToken(token),
        'expired-callback': () => onToken(''),
        'error-callback': () => {
          onToken('');
          setUnavailable(true);
        },
      });
    };

    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', renderWidget);
    script.addEventListener('error', () => setUnavailable(true), { once: true });
    renderWidget();

    return () => {
      cancelled = true;
      script?.removeEventListener('load', renderWidget);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [onToken, siteKey]);

  useEffect(() => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
      onToken('');
      queueMicrotask(() => setUnavailable(false));
    }
  }, [onToken, resetKey]);

  return (
    <div>
      <div ref={containerRef} className="min-h-[65px]" />
      {unavailable && (
        <p className="field-error mt-2 text-sm">
          The verification challenge could not load. Please check your connection and refresh.
        </p>
      )}
    </div>
  );
}
