import React, { useEffect, useMemo, useState } from "react";
import Star from "lucide-react/dist/esm/icons/star.js";
import X from "lucide-react/dist/esm/icons/x.js";
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
      <div className="absolute inset-0 bg-foreground/15 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-foreground/5 bg-card/85 p-6 text-foreground shadow-2xl backdrop-blur-xl transition-all supports-[backdrop-filter]:bg-card/75">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-foreground/5 bg-foreground/[0.03] text-muted-foreground transition hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
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
              className="text-2xl font-semibold tracking-tight text-foreground"
            >
              We value your feedback
            </h2>
            <p className="text-sm text-muted-foreground">
              Help us make CrissCross even better. Share your experience and suggestions.
            </p>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-foreground">
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
                    className={`relative rounded-full transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 ${
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
                          : "text-muted-foreground/45"
                      } transition-colors duration-150`}
                    />
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">
              Share more details
            </span>
            <textarea
              required
              minLength={5}
              rows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              disabled={submitting}
              className="w-full resize-none rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-foreground shadow-inner transition placeholder:text-muted-foreground/70 focus:border-foreground/20 focus:outline-none focus:ring-2 focus:ring-foreground/10"
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
