// tally client: tally("cc", "view"). Never throws. Counts only, no identifiers.
// Sends only from the production host, so local, LAN and preview runs never count.
export const config = { base: "https://tally.harkirat-hira.workers.dev", host: "harkirat155.github.io" };

export function tally(product, event = "view") {
  try {
    if (window.location.hostname !== config.host) return;
    const day = new Date().toISOString().slice(0, 10);
    let u = false;
    try {
      const key = "tally:" + product;
      if (window.localStorage.getItem(key) !== day) { window.localStorage.setItem(key, day); u = true; }
    } catch { /* never throw */ }
    const url = `${config.base}/hit?p=${encodeURIComponent(product)}&e=${encodeURIComponent(event)}${u ? "&u=1" : ""}`;
    if (window.navigator.sendBeacon && window.navigator.sendBeacon(url)) return;
    window.fetch(url, { method: "POST", keepalive: true, mode: "cors", credentials: "omit" }).catch(() => {});
  } catch { /* never throw */ }
}
