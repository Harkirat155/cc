import "../../shared/games/index.js"; // registers ttt, connect4, checkers
import { has as hasGame } from "../../shared/games/registry.js";

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

// server/handlers/validation.js:34-47.
export const validateIndex = (i: unknown): i is number => Number.isInteger(i) && (i as number) >= 0 && (i as number) <= 8;

export function validateGameId(gameId: unknown): string | null {
  if (!gameId || typeof gameId !== "string") return null;
  const n = gameId.trim().toLowerCase();
  return hasGame(n) ? n : null;
}
