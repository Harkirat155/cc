import { useCallback, useMemo, useState } from "react";

function toAbsoluteUrl(path) {
  if (typeof window === "undefined") return "";
  // Share helpers
  const toAbsoluteUrl = (path) =>
    new window.URL(
      path.replace(/^\//, ""),
      window.location.origin + import.meta.env.BASE_URL
    ).toString();
  return toAbsoluteUrl(path);
}

export default function useShare({ roomId }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(
    () => (roomId ? toAbsoluteUrl(`/room/${roomId}`) : null),
    [roomId]
  );

  const share = useCallback(async () => {
    if (!roomId || !shareUrl) return false;
    const title = "Join my Tic Tac Toe room";
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
      console.log(`Copy this link: ${shareUrl}`, e);
      return false;
    }
  }, [roomId, shareUrl]);

  return { shareUrl, copied, share };
}
