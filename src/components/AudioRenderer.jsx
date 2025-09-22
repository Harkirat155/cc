import React, { useEffect, useRef } from "react";

// Renders multiple remote audio streams as hidden audio elements
export default function AudioRenderer({ streamsById = {} }) {
  return (
    <div className="sr-only">
      {Object.entries(streamsById).map(([id, stream]) => (
        <AudioEl key={id} id={id} stream={stream} />
      ))}
    </div>
  );
}

function AudioEl({ id, stream }) {
  const ref = useRef(null);
  const blockedRef = useRef(false);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream;
    ref.current.play?.().catch((err) => {
      // Autoplay may be blocked until a user gesture
      blockedRef.current = true;
      console.warn('Audio autoplay blocked for', id, err?.name || err);
    });
  }, [stream, id]);
  const retry = () => {
    if (!ref.current) return;
    ref.current.play?.().catch(() => {});
  };
  // Keep element accessible but visually hidden (sr-only wrapper)
  return (
    <>
      <audio ref={ref} autoPlay />
      {/* Fallback retry button (still visually hidden due to parent), useful if dev toggles sr-only in inspector */}
      {blockedRef.current ? (
        <button type="button" onClick={retry} aria-label={`Play audio from ${id}`}></button>
      ) : null}
    </>
  );
}
