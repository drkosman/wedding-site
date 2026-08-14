import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { getSwipeDirection, useIsMobile } from './Hero/utils';

const heroPhotoModules = import.meta.glob<string>(
  '../assets/hero-photos/*.{jpg,jpeg,png,webp,avif}',
  { eager: true, import: 'default', query: '?url' },
);

const heroPhotos = Object.entries(heroPhotoModules)
  .sort(([firstPath], [secondPath]) => firstPath.localeCompare(secondPath))
  .map(([path, src]) => {
    const fileName = path.split('/').pop() ?? 'Wedding photo';
    const label = fileName
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .trim();

    return {
      src,
      alt: label ? `Lucy and Kosta wedding photo: ${label}` : 'Lucy and Kosta wedding photo',
    };
  });

export default function Hero() {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const isMobile = useIsMobile();
  useEffect(() => {
    if (heroPhotos.length <= 1) {
      return;
    }

    const rotation = window.setInterval(() => {
      setActivePhotoIndex((currentIndex) => (currentIndex + 1) % heroPhotos.length);
    }, 5500);

    return () => window.clearInterval(rotation);
  }, []);

  const hasPhotos = heroPhotos.length > 0;

  const showPreviousPhoto = () => {
    setActivePhotoIndex((currentIndex) =>
      currentIndex === 0 ? heroPhotos.length - 1 : currentIndex - 1,
    );
  };

  const showNextPhoto = () => {
    setActivePhotoIndex((currentIndex) => (currentIndex + 1) % heroPhotos.length);
  };

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (event.touches.length !== 1) {
      touchStart.current = null;
      return;
    }

    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = touchStart.current;
    touchStart.current = null;

    if (!start || event.changedTouches.length !== 1) {
      return;
    }

    const touch = event.changedTouches[0];
    const direction = getSwipeDirection(start.x, start.y, touch.clientX, touch.clientY);

    if (direction === 'left') {
      showNextPhoto();
    } else if (direction === 'right') {
      showPreviousPhoto();
    }
  };

  return (
    <section
      className="relative min-h-screen touch-pan-y overflow-hidden bg-secondary text-white"
      onTouchStart={heroPhotos.length > 1 ? handleTouchStart : undefined}
      onTouchEnd={heroPhotos.length > 1 ? handleTouchEnd : undefined}
      onTouchCancel={() => {
        touchStart.current = null;
      }}
    >
      {hasPhotos ? (
        <div className="absolute inset-0" aria-hidden="true">
          {heroPhotos.map((photo, index) =>
            isMobile ? (
              <img
                key={photo.src}
                src={photo.src}
                alt=""
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${
                  index === activePhotoIndex ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ) : (
              <div
                key={photo.src}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                  index === activePhotoIndex ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <img
                  src={photo.src}
                  alt=""
                  className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl"
                />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12),rgba(0,0,0,0.5))]" />
                <img
                  src={photo.src}
                  alt=""
                  className="absolute inset-0 h-full w-full object-contain"
                />
              </div>
            ),
          )}
        </div>
      ) : (
        <div
          className="absolute inset-0 bg-[linear-gradient(135deg,var(--color-surface)_0%,var(--color-secondary)_52%,var(--color-accent)_100%)]"
          aria-hidden="true"
        />
      )}

      <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
      <div
        className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-white/45 to-transparent"
        aria-hidden="true"
      />

      <p className="pointer-events-none absolute inset-x-0 bottom-20 z-20 animate-pulse px-6 text-center text-base text-white/80 drop-shadow">
        Scroll to continue ↓
      </p>

      {heroPhotos.length > 1 ? (
        <div className="absolute inset-x-0 bottom-6 z-20 flex items-center justify-center gap-4 px-6">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-black/20 text-2xl leading-none text-white backdrop-blur-sm transition hover:bg-black/35 focus:outline-none focus:ring-2 focus:ring-white"
            onClick={showPreviousPhoto}
            aria-label="Show previous hero photo"
          >
            ‹
          </button>

          <div className="flex items-center gap-2" aria-label="Hero photo carousel">
            {heroPhotos.map((photo, index) => (
              <button
                key={photo.src}
                type="button"
                className={`h-2.5 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-white ${
                  index === activePhotoIndex
                    ? 'w-8 bg-white'
                    : 'w-2.5 bg-white/55 hover:bg-white/80'
                }`}
                onClick={() => setActivePhotoIndex(index)}
                aria-label={`Show hero photo ${index + 1}`}
                aria-current={index === activePhotoIndex ? 'true' : undefined}
              />
            ))}
          </div>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-black/20 text-2xl leading-none text-white backdrop-blur-sm transition hover:bg-black/35 focus:outline-none focus:ring-2 focus:ring-white"
            onClick={showNextPhoto}
            aria-label="Show next hero photo"
          >
            ›
          </button>
        </div>
      ) : null}

      {hasPhotos ? (
        <img
          className="sr-only"
          src={heroPhotos[activePhotoIndex].src}
          alt={heroPhotos[activePhotoIndex].alt}
        />
      ) : null}
    </section>
  );
}
