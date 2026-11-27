import { useCallback, useState } from "react";
import { LEVELS } from "@shared/ai/bot.js";

const STORAGE_KEY = "cc.opponent";
const DEFAULTS = { mode: "human", level: "medium", humanSlot: 0 };

function load() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    return {
      mode: saved?.mode === "computer" ? "computer" : DEFAULTS.mode,
      level: LEVELS.includes(saved?.level) ? saved.level : DEFAULTS.level,
      humanSlot: saved?.humanSlot === 1 ? 1 : 0,
    };
  } catch {
    return DEFAULTS;
  }
}

// Local-screen opponent choice, persisted. botSlot is null for two humans.
export default function useOpponent() {
  const [opponent, setOpponent] = useState(load);
  const update = useCallback((patch) => {
    setOpponent((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch { /* storage unavailable */ }
      return next;
    });
  }, []);
  const botSlot = opponent.mode === "computer" ? 1 - opponent.humanSlot : null;
  return { opponent, botSlot, setOpponent: update };
}
