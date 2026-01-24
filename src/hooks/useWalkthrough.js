import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "crisscross_walkthrough_seen_v1";

const hasWindow = () => typeof window !== "undefined";

const readSeenFlag = () => {
  if (!hasWindow()) return true;
  try {
    return Boolean(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return true;
  }
};

const markSeen = () => {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // ignore storage failures (private browsing, etc.)
  }
};

const clearSeen = () => {
  if (!hasWindow()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

export default function useWalkthrough() {
  const [run, setRun] = useState(false);
  const [initialised, setInitialised] = useState(false);
  const delayedStart = useRef(null);

  useEffect(() => {
    if (initialised) return undefined;
    setInitialised(true);

    if (readSeenFlag()) {
      return undefined;
    }

    delayedStart.current = window.setTimeout(() => {
      setRun(true);
      delayedStart.current = null;
    }, 800);

    return () => {
      if (delayedStart.current) {
        window.clearTimeout(delayedStart.current);
        delayedStart.current = null;
      }
    };
  }, [initialised]);

  useEffect(() => () => {
    if (delayedStart.current) {
      window.clearTimeout(delayedStart.current);
    }
  }, []);

  const handleCallback = useCallback((data) => {
    const { status, type } = data;
    if (type === "tour:start") {
      return;
    }

    if (status === "finished" || status === "skipped") {
      markSeen();
      setRun(false);
    }
  }, []);

  const restart = useCallback(() => {
    clearSeen();
    setRun(true);
  }, []);

  const steps = useMemo(
    () => [
      {
        target: '[data-tour="navbar"]',
        title: "Welcome to CrissCross! 👋",
        disableBeacon: true,
        content:
          "Let's take a quick tour! The navbar gives you access to player lists, move history, theme switching, and voice chat controls in multiplayer mode.",
        placement: "bottom",
      },
      {
        target: '[data-tour="status"]',
        title: "Game Status",
        content:
          "Track your current game mode (local vs multiplayer), room code, live scoreboard, and whose turn it is. The pulsing indicator shows whose turn it is!",
        placement: "right",
      },
      {
        target: '[data-tour="board"]',
        title: "The Game Board",
        content:
          "Click any empty square to place your mark. Win by getting three in a row—horizontally, vertically, or diagonally. Winning lines celebrate with animations!",
        placement: "top",
      },
      {
        target: '[data-tour="menu"]',
        title: "Quick Actions Menu",
        content:
          "Use the floating menu to start new games, reset scores, find random opponents, create/share rooms, or leave multiplayer sessions. Click 'Find Match' to join the matchmaking queue!",
        placement: "top",
      },
      {
        target: '[data-tour="panels"]',
        title: "Side Panels & Shortcuts",
        content:
          "View connected players and spectators, or dive into move history for time-travel debugging. Pro tip: Press ESC to close modals, Enter to confirm actions!",
        placement: "bottom",
      },
    ],
    []
  );

  return {
    run,
    steps,
    restart,
    handleCallback,
  };
}
