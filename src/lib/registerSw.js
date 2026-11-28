// Offline shell (src/sw/worker.js). Production builds only: in dev a worker would serve stale modules.
export function registerSw({ prod = import.meta.env.PROD, base = import.meta.env.BASE_URL, nav = typeof navigator === "undefined" ? undefined : navigator } = {}) {
  if (!prod || !nav || !("serviceWorker" in nav)) return false;
  const go = () => nav.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => { /* offline shell is a bonus */ });
  if (document.readyState === "complete") go(); else window.addEventListener("load", go, { once: true });
  return true;
}
