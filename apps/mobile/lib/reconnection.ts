import { useEffect, useState } from "react";

/** Re-renderiza cada `intervalMs` para que los cálculos de "hace cuánto se
 * desconectó" (comparados contra un `Date.now()` fijo en el último render)
 * se mantengan al día sin depender de que lleguen datos nuevos. */
export function useNowTicker(intervalMs = 5_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);
  return now;
}

export function secondsSinceLastSeen(lastSeenAt: string, now: number): number {
  return Math.max(0, Math.round((now - new Date(lastSeenAt).getTime()) / 1000));
}

export function isDisconnected(lastSeenAt: string, reconnectTimeoutSeconds: number, now: number): boolean {
  return secondsSinceLastSeen(lastSeenAt, now) >= reconnectTimeoutSeconds;
}
