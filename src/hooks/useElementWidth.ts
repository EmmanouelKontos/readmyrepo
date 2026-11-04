import { useEffect, useRef, useState } from 'react';

/** Content-box width of an element, kept up to date with a ResizeObserver (0 until first measured). */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      // Round to whole pixels so sub-pixel jitter never re-runs the layout.
      setWidth((prev) => {
        const next = Math.floor(entry.contentRect.width);
        return Math.abs(next - prev) >= 2 ? next : prev;
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}
