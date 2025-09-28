import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const ToastStack = ({ messages = [], onDismiss }) => {
  const isBrowser = typeof document !== "undefined";
  const stackedMessages = useMemo(() => [...messages].reverse(), [messages]);
  const overlapOffset = 36;
  const timersRef = useRef(new Map());

  const handleDismiss = useCallback(
    (id) => {
      const timeoutId = timersRef.current.get(id);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        timersRef.current.delete(id);
      }
      onDismiss?.(id);
    },
    [onDismiss]
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const activeIds = new Set(stackedMessages.map((toast) => toast.id));
    const topToast = stackedMessages[0];

    timersRef.current.forEach((timeoutId, toastId) => {
      if (!activeIds.has(toastId) || (topToast && toastId !== topToast.id)) {
        window.clearTimeout(timeoutId);
        timersRef.current.delete(toastId);
      }
    });

    if (!topToast) return undefined;

    if (!timersRef.current.has(topToast.id)) {
      const timeoutId = window.setTimeout(() => {
        timersRef.current.delete(topToast.id);
        handleDismiss(topToast.id);
      }, topToast.duration ?? 5000);
      timersRef.current.set(topToast.id, timeoutId);
    }

    return undefined;
  }, [stackedMessages, handleDismiss]);

  useEffect(() => () => {
    timersRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timersRef.current.clear();
  }, []);

  if (!isBrowser || !stackedMessages.length) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed left-1/2 top-20 z-[60] w-full max-w-[min(92vw,420px)] -translate-x-1/2 px-4"
      role="status"
      aria-live="polite"
    >
      <div className="relative flex w-full flex-col items-stretch">
        {stackedMessages.map((toast, index) => {
          const depth = stackedMessages.length - index;
          const isTopToast = index === 0;
          return (
            <div
              key={toast.id}
              className="pointer-events-auto relative"
              style={{
                marginTop: isTopToast ? 0 : -overlapOffset,
                zIndex: depth,
              }}
            >
              <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 px-4 py-3 text-slate-800 shadow-[0_25px_60px_-28px_rgba(15,23,42,0.35)] ring-1 ring-white/70 backdrop-blur-xl transition-transform duration-300 hover:-translate-y-1 dark:border-slate-700/50 dark:bg-slate-950/90 dark:text-slate-100 dark:ring-slate-700/50">
                <button
                  type="button"
                  onClick={() => handleDismiss(toast.id)}
                  className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-white/50 text-slate-500 transition-colors duration-200 hover:bg-white/80 hover:text-slate-700 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-400 dark:hover:bg-slate-900/80"
                  aria-label="Dismiss message"
                >
                  <X size={14} />
                </button>
                <p className="pr-8 text-sm font-semibold leading-relaxed tracking-tight">
                  {toast.text}
                </p>
                <span
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-1 origin-left bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 opacity-70 will-change-transform"
                  style={{
                    animation: isTopToast
                      ? `shrink-bar ${(toast.duration || 5000)}ms linear forwards`
                      : "none",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
};

export default ToastStack;
