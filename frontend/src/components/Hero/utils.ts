import { useEffect, useState } from "react";

const MINIMUM_SWIPE_DISTANCE = 50;

export type SwipeDirection = 'left' | 'right' | null;

export function getSwipeDirection(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): SwipeDirection {
  const horizontalDistance = endX - startX;
  const verticalDistance = endY - startY;

  if (
    Math.abs(horizontalDistance) < MINIMUM_SWIPE_DISTANCE ||
    Math.abs(horizontalDistance) <= Math.abs(verticalDistance)
  ) {
    return null;
  }

  return horizontalDistance < 0 ? 'left' : 'right';
}

export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    window.innerWidth < breakpoint
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);

  return isMobile;
}
