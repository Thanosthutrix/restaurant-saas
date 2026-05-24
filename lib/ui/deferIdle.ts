/** Exécute une callback quand le navigateur est disponible (évite de rivaliser avec le rendu initial). */
export function runWhenIdle(callback: () => void, options?: { timeoutMs?: number; fallbackDelayMs?: number }) {
  const timeoutMs = options?.timeoutMs ?? 4000;
  const fallbackDelayMs = options?.fallbackDelayMs ?? 1800;

  if (typeof window === "undefined") {
    return () => {};
  }

  const idle = window.requestIdleCallback;
  if (typeof idle === "function") {
    const id = idle.call(window, callback, { timeout: timeoutMs });
    return () => window.cancelIdleCallback(id);
  }

  const id = window.setTimeout(callback, fallbackDelayMs);
  return () => window.clearTimeout(id);
}

/** Prefetch séquentiel pour ne pas saturer le réseau. */
export function prefetchRoutesWhenIdle(
  prefetch: (href: string) => void,
  hrefs: string[],
  options?: { startDelayMs?: number; timeoutMs?: number }
) {
  if (hrefs.length === 0 || typeof window === "undefined") return () => {};

  const startDelayMs = options?.startDelayMs ?? 2500;
  let cancelled = false;
  let cancelIdle: (() => void) | undefined;
  let index = 0;

  const step = () => {
    if (cancelled || index >= hrefs.length) return;
    prefetch(hrefs[index]!);
    index += 1;
    if (index < hrefs.length) {
      cancelIdle = runWhenIdle(step, { timeoutMs: options?.timeoutMs ?? 5000, fallbackDelayMs: 400 });
    }
  };

  const startId = window.setTimeout(() => {
    if (cancelled) return;
    cancelIdle = runWhenIdle(step, { timeoutMs: options?.timeoutMs ?? 5000 });
  }, startDelayMs);

  return () => {
    cancelled = true;
    window.clearTimeout(startId);
    cancelIdle?.();
  };
}
