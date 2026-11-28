import { lazy } from "react";

const KEY = "cc.chunkReload";
const WINDOW_MS = 10 * 60_000;

// A lazy chunk that is gone (a deploy replaced it) means this tab runs an old bundle: reload to get the new one, at most
// once per 10 minutes. The time is never cleared by a success, so a healthy chunk cannot re-arm a loop on a broken one.
export function loadOrReload(factory, { storage = window.sessionStorage, reload = () => window.location.reload(), now = Date.now } = {}) {
  return factory().catch((err) => {
    try {
      const last = Number(storage.getItem(KEY));
      if (last && now() - last < WINDOW_MS) throw err;
      storage.setItem(KEY, String(now()));
    } catch { throw err; }
    reload();
    return new Promise(() => {}); // the page is going away
  });
}

export default (factory) => lazy(() => loadOrReload(factory));
