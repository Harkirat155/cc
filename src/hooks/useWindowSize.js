import { useEffect, useState } from "react";

// Lightweight window size hook with SSR safety and rAF-coalesced resize updates
export default function useWindowSize() {
  const getSize = () => {
    if (typeof window === "undefined") return { width: 0, height: 0 };
    return { width: window.innerWidth, height: window.innerHeight };
  };

  const [size, setSize] = useState(getSize);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let frame = null;
    const onResize = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        setSize({ width: window.innerWidth, height: window.innerHeight });
        frame = null;
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return size;
}
