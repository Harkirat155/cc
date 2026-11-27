// Port of server/feedbackStore.js sanitisers (:6-60). Storage lives in the Lobby DO.
export const MAX_ENTRIES = 200;

export interface FeedbackInput {
  rating?: unknown;
  message?: unknown;
  context?: unknown;
  meta?: unknown;
}
export interface FeedbackEntry {
  id: string;
  rating: number | null;
  message: string;
  context?: Record<string, string | boolean>;
  meta?: Record<string, string>;
  receivedAt: string;
}

const clampRating = (v: number) =>
  Number.isFinite(v) ? Math.round(Math.min(Math.max(v, 0), 5) * 10) / 10 : null;

const text = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
};

// Copies each field that survives its sanitiser; undefined when none do.
function pick(src: unknown, fields: Record<string, number>, bool?: string) {
  if (!src || typeof src !== "object") return undefined;
  const s = src as Record<string, unknown>;
  const out: Record<string, string | boolean> = {};
  for (const [k, max] of Object.entries(fields)) {
    const v = text(s[k], max);
    if (v) out[k] = v;
  }
  if (bool && typeof s[bool] === "boolean") out[bool] = s[bool];
  return Object.keys(out).length ? out : undefined;
}

export function buildEntry({ rating, message, context, meta }: FeedbackInput): FeedbackEntry {
  return {
    // feedbackStore.js:49 (Date.now base36 + 6 random chars)
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    rating: clampRating(Number(rating) || 0),
    message: text(message, 2000) || "",
    context: pick(context, { roomId: 32, socketId: 48, url: 2048, userAgent: 512 }, "isMultiplayer"),
    meta: pick(meta, { ip: 64, origin: 256, referer: 2048, userAgent: 512 }) as Record<string, string> | undefined,
    receivedAt: new Date().toISOString(),
  };
}
