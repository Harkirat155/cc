/* eslint-env browser */
import React, { useState } from 'react';

// Props expected:
// { roomId, isRoomCreator, createRoom, leaveRoom, isMultiplayer }
export default function RoomControls({ createRoom, leaveRoom, isMultiplayer, roomId, isRoomCreator }){
  const [copied, setCopied] = useState(false);

  // Build absolute share link like https://example.com/room/ABCDE
  // Respect any base path (e.g., GH Pages) using Vite's BASE_URL
  // Avoid duplicating current pathname when already under /room/:id
  const base = (import.meta && import.meta.env && import.meta.env.BASE_URL) || '/';
  const shareUrl = roomId
    ? new window.URL(`/room/${roomId}`, window.location.origin + base).toString()
    : '';

  // TODO react-share as a possible alternative
  // https://www.npmjs.com/package/react-share
  // https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share
  // https://caniuse.com/mdn-api_navigator_share
  // https://web.dev/web-share/
  // https://web.dev/trusted-types/
  // https://stackoverflow.com/questions/5717093/check-if-a-javascript-string-is-a-url
  const handleShare = async () => {
    if (!roomId) return;
    const title = 'Join my Tic Tac Toe room';
    const text = `Use this code ${roomId} or open this link to join:`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
  window.setTimeout(() => setCopied(false), 2000);
      if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl });
        return;
      }
    } catch (e) {
      // As last resort, open prompt for manual copy
      // window.prompt('Copy this link:', shareUrl);
      console.log(`Copy this link: ${shareUrl}`, e);
    }
  };

  const showShare = Boolean(isMultiplayer && isRoomCreator);

  return (
    <div className="flex flex-col sm:flex-row gap-3 mt-4 items-stretch sm:items-center">
      {!showShare && (
        <button
          onClick={createRoom}
          className="px-4 py-2 bg-green-500 text-white rounded shadow hover:bg-green-600 transition"
          type="button"
        >
          Create Room
        </button>
      )}
      {showShare && (
        <button
          onClick={handleShare}
          className="px-4 py-2 bg-purple-600 text-white rounded shadow hover:bg-purple-700 transition"
          type="button"
          aria-label="Share room link"
        >
          {copied ? 'Link Copied' : 'Share'}
        </button>
      )}
      {isMultiplayer && (
          <button
            type="button"
            onClick={leaveRoom}
            className="px-4 py-2 bg-red-500 text-white rounded shadow hover:bg-red-600 transition"
          >
            Leave
          </button>
        )}
    </div>
  );
}
