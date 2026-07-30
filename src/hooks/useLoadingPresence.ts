import { useEffect, useRef, useState } from 'react';

const LOADING_EXIT_DURATION = 200;
const LOADING_MINIMUM_VISIBLE_DURATION = 240;

export const useLoadingPresence = (active: boolean) => {
  const [present, setPresent] = useState(active);
  const [exiting, setExiting] = useState(false);
  const visibleSinceRef = useRef<number | null>(active ? Date.now() : null);

  useEffect(() => {
    if (active) {
      if (visibleSinceRef.current === null) {
        visibleSinceRef.current = Date.now();
      }
      setPresent(true);
      setExiting(false);
      return;
    }
    if (!present) {
      visibleSinceRef.current = null;
      return;
    }

    const elapsed = visibleSinceRef.current
      ? Date.now() - visibleSinceRef.current
      : LOADING_MINIMUM_VISIBLE_DURATION;
    const exitDelay = Math.max(LOADING_MINIMUM_VISIBLE_DURATION - elapsed, 0);
    let frame = 0;
    const exitTimer = window.setTimeout(() => {
      frame = window.requestAnimationFrame(() => setExiting(true));
    }, exitDelay);
    const removeTimer = window.setTimeout(() => {
      visibleSinceRef.current = null;
      setPresent(false);
    }, exitDelay + LOADING_EXIT_DURATION);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(exitTimer);
      window.clearTimeout(removeTimer);
    };
  }, [active, present]);

  return {
    exiting: !active && exiting,
    mounted: active || present,
  };
};
