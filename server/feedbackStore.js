const MAX_ENTRIES = 200;
const feedbackEntries = [];

const clampRating = (value) => {
  if (!Number.isFinite(value)) return null;
  const clamped = Math.min(Math.max(value, 0), 5);
  return Math.round(clamped * 10) / 10;
};

const sanitizeText = (value, maxLength) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
};

const sanitizeContext = (context) => {
  if (!context || typeof context !== "object") return undefined;
  const safe = {};
  const roomId = sanitizeText(context.roomId, 32);
  if (roomId) safe.roomId = roomId;
  if (typeof context.isMultiplayer === "boolean") {
    safe.isMultiplayer = context.isMultiplayer;
  }
  const socketId = sanitizeText(context.socketId, 48);
  if (socketId) safe.socketId = socketId;
  const url = sanitizeText(context.url, 2048);
  if (url) safe.url = url;
  const userAgent = sanitizeText(context.userAgent, 512);
  if (userAgent) safe.userAgent = userAgent;
  return Object.keys(safe).length > 0 ? safe : undefined;
};

const sanitizeMeta = (meta) => {
  if (!meta || typeof meta !== "object") return undefined;
  const safe = {};
  const ip = sanitizeText(meta.ip, 64);
  if (ip) safe.ip = ip;
  const origin = sanitizeText(meta.origin, 256);
  if (origin) safe.origin = origin;
  const referer = sanitizeText(meta.referer, 2048);
  if (referer) safe.referer = referer;
  const userAgent = sanitizeText(meta.userAgent, 512);
  if (userAgent) safe.userAgent = userAgent;
  return Object.keys(safe).length > 0 ? safe : undefined;
};

const createId = () => {
  const random = Math.random().toString(36).slice(2, 8);
  return `${Date.now().toString(36)}-${random}`;
};

export function addFeedback({ rating, message, context, meta } = {}) {
  const entry = {
    id: createId(),
    rating: clampRating(Number(rating) || 0),
    message: sanitizeText(message, 2000) || "",
    context: sanitizeContext(context),
    meta: sanitizeMeta(meta),
    receivedAt: new Date().toISOString(),
  };

  feedbackEntries.push(entry);
  if (feedbackEntries.length > MAX_ENTRIES) {
    feedbackEntries.splice(0, feedbackEntries.length - MAX_ENTRIES);
  }

  return entry;
}

export function listFeedback(limit = 20) {
  if (limit <= 0) return [];
  const sliceStart = Math.max(feedbackEntries.length - limit, 0);
  return feedbackEntries.slice(sliceStart).reverse();
}

export function getFeedbackCount() {
  return feedbackEntries.length;
}

export function clearFeedbackStore() {
  feedbackEntries.length = 0;
}
