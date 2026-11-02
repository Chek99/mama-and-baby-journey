import { useCallback, useEffect, useState } from "react";

/** Seconds remaining until `restart()` may be used again. */
export function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) return;
    const id = window.setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left]);
  const restart = useCallback(() => setLeft(seconds), [seconds]);
  return { left, restart };
}
