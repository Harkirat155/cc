import { lazy } from "react";

const FLAG = "cc.chunkReload";

// A lazy chunk that is gone (a deploy replaced it) means this tab runs an old bundle: reload once to get the new one.
export function loadOrReload(factory, { storage = window.sessionStorage, reload = () => window.location.reload() } = {}) {
  const get = () => { try { return storage.getItem(FLAG); } catch { return "1"; } };
  return factory().then(
    (mod) => { try { storage.removeItem(FLAG); } catch { /* ignore */ } return mod; },
    (err) => {
      if (get()) throw err;
      try { storage.setItem(FLAG, "1"); } catch { throw err; }
      reload();
      return new Promise(() => {}); // the page is going away
    },
  );
}

export default (factory) => lazy(() => loadOrReload(factory));
