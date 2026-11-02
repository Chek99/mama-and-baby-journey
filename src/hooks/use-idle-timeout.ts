import { useEffect, useRef } from "react";

const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "visibilitychange"] as const;
const LAST_KEY = "mnm.lastActivity";

/** Calls onIdle after `minutes` without activity in any open tab. */
export function useIdleTimeout(minutes: number, onIdle: () => void) {
  const cb = useRef(onIdle);
  cb.current = onIdle;

  useEffect(() => {
    if (!minutes || minutes <= 0) return;
    const limit = minutes * 60_000;
    let lastWrite = 0;
    const touch = () => {
      const now = Date.now();
      if (now - lastWrite > 5_000) {
        lastWrite = now;
        try {
          window.localStorage.setItem(LAST_KEY, String(now));
        } catch {
          /* ignore */
        }
      }
    };
    touch();
    const timer = window.setInterval(() => {
      let last = lastWrite;
      try {
        last = Math.max(last, Number(window.localStorage.getItem(LAST_KEY)) || 0);
      } catch {
        /* ignore */
      }
      if (Date.now() - last >= limit) cb.current();
    }, 15_000);
    EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    return () => {
      window.clearInterval(timer);
      EVENTS.forEach((e) => window.removeEventListener(e, touch));
    };
  }, [minutes]);
}
