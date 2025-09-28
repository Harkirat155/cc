import React, { useEffect, useMemo, useState } from "react";
import { Star, X } from "lucide-react";
import Button from "./ui/Button";

const MAX_RATING = 5;

const FeedbackDialog = ({
  open = false,
  onClose,
  onSubmit,
  submitting = false,
  errorMessage = "",
  initialRating = 0,
  initialMessage = "",
}) => {
  const [rating, setRating] = useState(initialRating);
  const [hoverRating, setHoverRating] = useState(null);
  const [message, setMessage] = useState(initialMessage);

  useEffect(() => {
    if (!open) return;
    setRating(initialRating);
    setMessage(initialMessage);
    setHoverRating(null);
  }, [open, initialRating, initialMessage]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const activeRating = hoverRating ?? rating;
  const canSubmit = useMemo(() => {
    const hasRating = rating > 0;
    const hasMessage = message.trim().length >= 5;
    return hasRating && hasMessage && !submitting;
  }, [rating, message, submitting]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit?.({ rating, message: message.trim() });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-dialog-title"
    >
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-white/80 p-6 shadow-2xl backdrop-blur-xl transition-all dark:border-white/5 dark:bg-slate-900/80">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-white/70 text-slate-700 transition hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-800"
          aria-label="Close feedback form"
        >
          <X size={18} strokeWidth={2} />
        </button>

        <form
          className="space-y-6"
          onSubmit={handleSubmit}
          aria-busy={submitting}
        >
          <div className="space-y-2 text-center sm:text-left">
            <h2
              id="feedback-dialog-title"
              className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100"
            >
              We value your feedback
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Help us make CrissCross even better. Share your experience and suggestions.
            </p>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Overall experience
            </legend>
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              {Array.from({ length: MAX_RATING }, (_, index) => {
                const value = index + 1;
                const isActive = value <= activeRating;
                return (
                  <button
                    key={value}
                    type="button"
                    className={`relative transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70 ${
                      isActive ? "scale-110" : "scale-100"
                    }`}
                    onMouseEnter={() => setHoverRating(value)}
                    onMouseLeave={() => setHoverRating(null)}
                    onFocus={() => setHoverRating(value)}
                    onBlur={() => setHoverRating(null)}
                    onClick={() => setRating(value)}
                    aria-label={`${value} star${value > 1 ? "s" : ""}`}
                    aria-pressed={value === rating}
                    disabled={submitting}
                  >
                    <Star
                      size={34}
                      strokeWidth={1.5}
                      className={`${
                        isActive
                          ? "fill-amber-400 text-amber-400 drop-shadow-sm"
                          : "text-slate-400 dark:text-slate-600"
                      } transition-colors duration-150`}
                    />
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Share more details
            </span>
            <textarea
              required
              minLength={5}
              rows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              disabled={submitting}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-900 shadow-inner transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-indigo-400"
              placeholder="Let us know what you enjoyed or what could be improved..."
            />
          </label>

          {errorMessage && (
            <p className="text-sm text-rose-500" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="neutral"
              className="sm:w-auto"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit} className="sm:w-auto">
              {submitting ? "Sending…" : "Send feedback"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FeedbackDialog;
