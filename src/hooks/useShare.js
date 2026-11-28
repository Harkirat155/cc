import { useCallback, useMemo, useState } from "react";
import { badgeBase } from "../arenaShared";

// Names for the share title; an unknown id falls back to the id's own text.
const GAME_NAMES = { ttt: "Tic-Tac-Toe", connect4: "Connect Four", checkers: "Checkers", five: "Five in a Row" };

export default function useShare({ roomId, gameId }) {
  const [copied, setCopied] = useState(false);
  const game = gameId || "ttt";

  // The Worker's /j/ card unfurls as the game in chat, then sends the browser on to the room page.
  const shareUrl = useMemo(
    () => (roomId ? `${badgeBase()}/j/${encodeURIComponent(roomId)}?g=${encodeURIComponent(game)}` : null),
    [roomId, game]
  );

  const share = useCallback(async () => {
    if (!roomId || !shareUrl) return false;
    const title = `Join my ${GAME_NAMES[game] || game} game`;
    const text = `Use this code ${roomId} or open this link to join:`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl });
      }
      return true;
    } catch (e) {
      console.warn("Unable to copy share link", e);
      return false;
    }
  }, [roomId, shareUrl, game]);

  return { shareUrl, copied, share };
}
