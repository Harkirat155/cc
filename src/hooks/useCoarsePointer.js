import { useEffect, useState } from "react";

const COARSE_POINTER_QUERY = "(pointer: coarse)";

export default function useCoarsePointer() {
  const getMatch = () => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia(COARSE_POINTER_QUERY).matches;
  };

  const [isCoarsePointer, setIsCoarsePointer] = useState(getMatch);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQueryList = window.matchMedia(COARSE_POINTER_QUERY);
    const handleChange = (event) => {
      setIsCoarsePointer(event.matches ?? mediaQueryList.matches);
    };

    handleChange(mediaQueryList);

    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", handleChange);
      return () => mediaQueryList.removeEventListener("change", handleChange);
    }

    mediaQueryList.addListener(handleChange);
    return () => mediaQueryList.removeListener(handleChange);
  }, []);

  return isCoarsePointer;
}
