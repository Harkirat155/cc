import React, { useEffect, useRef } from "react";
import Check from "lucide-react/dist/esm/icons/check.js";
import Pencil from "lucide-react/dist/esm/icons/pencil.js";
import X from "lucide-react/dist/esm/icons/x.js";

const cx = (...classes) => classes.filter(Boolean).join(" ");

const formatOccupant = (id, fallback) => {
  if (!id) return fallback;
  if (typeof id !== "string") return fallback;
  if (id.length <= 10) return id;
  return `${id.slice(0, 5)}…${id.slice(-3)}`;
};

const EditButton = ({ label, onClick, children, className }) => (
  <button
    type="button"
    onClick={onClick}
    className={cx(
      "rounded-full p-1 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50",
      className
    )}
    aria-label={label}
    title={label}
  >
    {children}
  </button>
);

const ScorePlayerCard = ({
  label,
  score,
  occupant,
  fallbackLabel,
  isActive,
  isYou,
  palette,
  isEditing,
  editValue,
  onEditChange,
  onEditSave,
  onEditCancel,
  onEditName,
  winnerExists,
}) => {
  const inputRef = useRef(null);
  const occupantLabel = formatOccupant(occupant, fallbackLabel);
  const canEdit = Boolean(isYou && onEditName);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.select();
    }
  }, [isEditing]);

  return (
    <article
      className={cx(
        "min-w-0 text-center transition-all duration-300",
        isActive
          ? "scale-105 opacity-100"
          : "scale-100 opacity-40"
      )}
      aria-current={isActive && !winnerExists ? "true" : undefined}
      aria-label={`${label} score ${score}`}
    >
      <div className="flex min-w-24 flex-col items-center gap-2 sm:min-w-32">
        <div className={cx("text-[10px] font-semibold uppercase tracking-[0.28em] sm:text-xs", palette?.color)}>
          {label}
        </div>
        <div className="text-3xl font-light leading-none text-foreground sm:text-4xl">
          {score}
        </div>
        <div
          className={cx(
            "mt-1 h-1 w-6 rounded-full transition-opacity sm:w-8",
            isActive && !winnerExists ? palette?.glow : "opacity-0"
          )}
        />

        <div className="flex min-h-7 max-w-28 items-center justify-center sm:max-w-36">
          {isEditing ? (
            <div className="flex items-center justify-center gap-1.5">
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(event) => onEditChange(event.target.value)}
                maxLength={20}
                className="h-8 w-24 rounded-full border border-input bg-input-background px-3 text-center text-xs font-medium text-foreground outline-none transition focus:ring-2 focus:ring-ring/50"
                onKeyDown={(event) => {
                  if (event.key === "Enter") onEditSave();
                  if (event.key === "Escape") onEditCancel();
                }}
                aria-label={`${label} display name`}
              />
              <EditButton label="Save name" onClick={onEditSave}>
                <Check size={15} aria-hidden="true" />
              </EditButton>
              <EditButton label="Cancel editing" onClick={onEditCancel}>
                <X size={15} aria-hidden="true" />
              </EditButton>
            </div>
          ) : canEdit ? (
            <button
              type="button"
              onClick={onEditName}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-foreground/70 transition hover:bg-foreground/10 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
              aria-label={`Edit ${label} name`}
              title="Edit name"
            >
              <span className="truncate">{occupantLabel}</span>
              {isYou && (
                <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-foreground/60">
                  You
                </span>
              )}
              <Pencil size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          ) : (
            <span className="max-w-full truncate px-2 py-1 text-xs font-medium text-muted-foreground">
              {occupantLabel}
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

export default ScorePlayerCard;
