import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STATUS } from "react-joyride";

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

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
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
        title: "Top controls",
        disableBeacon: true,
        content:
          "Use the header to toggle the players list, review the move history, switch the theme, or control voice chat in multiplayer.",
        placement: "bottom",
      },
      {
        target: '[data-tour="status"]',
        title: "Match status",
        content:
          "Keep an eye on the current mode, room code, scoreboard, and whose turn it is. These update live as the game progresses.",
        placement: "right",
      },
      {
        target: '[data-tour="board"]',
        title: "Game board",
        content:
          "Play Tic Tac Toe here. Click a square to place your mark. Winning lines are highlighted automatically.",
        placement: "top",
      },
      {
        target: '[data-tour="menu"]',
        title: "Quick actions",
        content:
          "The floating menu lets you start a new game, reset scores, create or share rooms, and leave multiplayer rooms.",
        placement: "top",
      },
      {
        target: '[data-tour="panels"]',
        title: "People & history panels",
        content:
          "Open the player list or move history from here. Panels slide in so you can review details without leaving the board.",
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
