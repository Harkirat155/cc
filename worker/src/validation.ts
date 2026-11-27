// Same rules as server/handlers/validation.js:11-27.
export function validateRoomId(roomId: unknown): string | null {
  if (!roomId || typeof roomId !== "string") return null;
  const n = roomId.trim().toUpperCase();
  return n.length === 5 && /^[A-Z0-9]+$/.test(n) ? n : null;
}

export function validateDisplayName(name: unknown): string | null {
  if (!name || typeof name !== "string") return null;
  const t = name.trim().slice(0, 20);
  return t.length >= 2 ? t : null;
}

// server/gameLogic.js:21-27.
export function genCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}
