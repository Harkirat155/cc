// Move and result sounds, synthesized with Web Audio (no files). Client-only.
const KEY = "cc.sound";
const listeners = new Set();

export function isSoundOn() {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}
export function setSoundOn(on) {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // storage blocked: the choice lasts for this page only through the listeners
  }
  listeners.forEach((fn) => fn());
}
export function subscribeSound(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * The slot whose wins and losses are "mine": the X/O seat online (labels such as Red/Yellow differ per
 * game, so never match on them), the human's slot against the computer, else null (spectator, local).
 */
export function viewerSlotFor({ player, isMultiplayer, botSlot }) {
  if (isMultiplayer) return player === "X" ? 0 : player === "O" ? 1 : null;
  return botSlot === 0 || botSlot === 1 ? 1 - botSlot : null;
}

const sameBoard = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Which sound a state change deserves: "moveMine" | "moveTheirs" | "win" | "loss" | "draw" | null.
 * Only a step out of an active game of the same kind counts, so a first state, a reset, a game
 * switch and a replay of a finished game stay silent. viewerSlot is null for spectators.
 */
export function soundFor(prev, next, viewerSlot, muted = false) {
  if (muted || !prev || !next) return null;
  if (prev.gameId !== next.gameId || prev.status !== "active") return null;
  const moved = !sameBoard(prev.board, next.board);
  const seated = Number.isInteger(viewerSlot);
  if (next.status !== "active" && seated) {
    if (next.winnerSlot === "draw") return "draw";
    if (Number.isInteger(next.winnerSlot)) return next.winnerSlot === viewerSlot ? "win" : "loss";
  }
  if (!moved) return null;
  return seated && prev.turnSlot === viewerSlot ? "moveMine" : "moveTheirs";
}

// [frequency Hz, start offset s, duration s] per note.
const TUNES = {
  moveMine: [[660, 0, 0.09]],
  moveTheirs: [[494, 0, 0.1]],
  win: [[523, 0, 0.12], [659, 0.1, 0.12], [784, 0.2, 0.2]],
  loss: [[392, 0, 0.14], [294, 0.14, 0.22]],
  draw: [[440, 0, 0.12], [440, 0.16, 0.12]],
};

let ctx = null;
function context() {
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (Ctor) ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

// Browsers block audio until a user gesture, so create the context on the first one.
export function unlockOnGesture() {
  if (typeof window === "undefined") return () => {};
  const unlock = () => {
    const c = context();
    c?.resume?.().catch?.(() => {});
    if (c) off();
  };
  const off = () => ["pointerdown", "keydown"].forEach((e) => window.removeEventListener(e, unlock));
  ["pointerdown", "keydown"].forEach((e) => window.addEventListener(e, unlock));
  return off;
}

export function playSound(name) {
  const tune = TUNES[name];
  // Only a context made by a gesture plays; never create one here, and never throw.
  if (!tune || !ctx || ctx.state !== "running") return;
  try {
    const t0 = ctx.currentTime;
    for (const [freq, at, dur] of tune) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + at);
      gain.gain.exponentialRampToValueAtTime(0.06, t0 + at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + dur + 0.02);
    }
  } catch {
    // audio unavailable
  }
}
