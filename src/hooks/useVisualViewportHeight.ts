import { useEffect, useRef, useState } from 'react';

/**
 * Returns the visual viewport height that accounts for on-screen keyboards,
 * the browser address bar, and other browser chrome on mobile devices.
 *
 * Unlike `100vh` (which reflects the full layout viewport and does NOT shrink
 * when the soft keyboard opens), the visual viewport height is the actual
 * visible area of the screen. Using it keeps fixed chat inputs docked right
 * above the keyboard instead of leaving a large empty gap (or hiding the
 * input entirely behind the keyboard).
 *
 * Falls back to `window.innerHeight` on browsers without visualViewport support.
 */
export const useVisualViewportHeight = (): number => {
  const [height, setHeight] = useState<number>(() => {
    if (typeof window === 'undefined') return 800;
    return window.visualViewport?.height ?? window.innerHeight;
  });

  // Keep a ref of the latest height so the resize listener closure always
  // reads current values without needing to be re-subscribed.
  const heightRef = useRef(height);
  heightRef.current = height;

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    let rafId: number | null = null;

    const update = () => {
      rafId = null;
      try {
        const newHeight = vv ? vv.height : window.innerHeight;
        if (newHeight !== heightRef.current) {
          heightRef.current = newHeight;
          setHeight(newHeight);
        }
      } catch {
        // Fallback: keep the last known good value
      }
    };

    // Coalesce rapid events (keyboard toggle, scroll) into a single update.
    const scheduleUpdate = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(update);
      }
    };

    // Initial measurement
    update();

    if (vv) {
      // visualViewport.resize fires when the soft keyboard opens/closes
      // and when the address bar collapses/expands.
      vv.addEventListener('resize', scheduleUpdate);
      // Scroll events on some mobile browsers resize the visual viewport too.
      vv.addEventListener('scroll', scheduleUpdate, { passive: true });
    }
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('orientationchange', scheduleUpdate);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      if (vv) {
        vv.removeEventListener('resize', scheduleUpdate);
        vv.removeEventListener('scroll', scheduleUpdate);
      }
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('orientationchange', scheduleUpdate);
    };
  }, []);

  return height;
};

