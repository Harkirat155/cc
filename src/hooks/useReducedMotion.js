import { useSyncExternalStore } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function getSnapshot() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function subscribe(callback) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }

  const mediaQueryList = window.matchMedia(REDUCED_MOTION_QUERY);
  const handleChange = () => callback();

  if (typeof mediaQueryList.addEventListener === "function") {
    mediaQueryList.addEventListener("change", handleChange);
    return () => mediaQueryList.removeEventListener("change", handleChange);
  }

  mediaQueryList.addListener(handleChange);
  return () => mediaQueryList.removeListener(handleChange);
}

export default function useReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
