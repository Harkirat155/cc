import React, { useEffect, useRef } from "react";

const EMPTY_STREAMS = {};

// Renders multiple remote audio streams as hidden audio elements
export default function AudioRenderer({ streamsById = EMPTY_STREAMS }) {
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
  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream;
    ref.current.play?.().catch((err) => {
      console.warn('Audio autoplay blocked for', id, err?.name || err);
    });
  }, [stream, id]);

  return <audio ref={ref} autoPlay aria-hidden="true" tabIndex={-1} />;
}
