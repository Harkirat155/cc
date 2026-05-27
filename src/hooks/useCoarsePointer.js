import { useSyncExternalStore } from "react";

const COARSE_POINTER_QUERY = "(pointer: coarse)";

function getSnapshot() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(COARSE_POINTER_QUERY).matches;
}

function subscribe(callback) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }

  const mediaQueryList = window.matchMedia(COARSE_POINTER_QUERY);
  const handleChange = () => callback();

  if (typeof mediaQueryList.addEventListener === "function") {
    mediaQueryList.addEventListener("change", handleChange);
    return () => mediaQueryList.removeEventListener("change", handleChange);
  }

  mediaQueryList.addListener(handleChange);
  return () => mediaQueryList.removeListener(handleChange);
}

export default function useCoarsePointer() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
