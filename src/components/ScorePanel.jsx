import React, { useState, useCallback } from "react";
import { Crown, Dot, Pencil, Check, X } from "lucide-react";
import ValueMark from "./marks/ValueMark";

const formatOccupant = (id, fallback) => {
  if (!id) return fallback;
  if (typeof id !== "string") return fallback;
  if (id.length <= 10) return id;
  return `${id.slice(0, 5)}…${id.slice(-3)}`;
};

const YouBadge = ({ variant = "default", className = "" }) => {
  const sizeClasses =
    variant === "compact"
      ? "px-2.5 py-0.5 text-[9px]"
      : "px-3 py-1 text-[10px]";
  const iconSize = variant === "compact" ? 12 : 14;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 font-semibold uppercase tracking-[0.32em] text-white shadow-sm ${sizeClasses} ${className}`}
    >
      <Crown size={iconSize} className="drop-shadow-sm" />
      You
    </span>
  );
};

const ScoreCard = ({
  mark,
  score,
  occupant,
  isTurn,
  isYou,
  accent,
  fallbackLabel,
  isMirrored = false,
  onEditName,
  isEditing,
  editValue,
  onEditChange,
  onEditSave,
  onEditCancel,
}) => {
  const occupantLabel = formatOccupant(occupant, fallbackLabel);

  return (
    <div
      className={`group relative flex flex-col gap-4 rounded-2xl border border-slate-200/70 bg-white/70 p-4 text-slate-900 shadow-[0_15px_45px_-30px_rgba(15,23,42,0.65)] transition duration-300 ease-out hover:-translate-y-1 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-100 sm:p-5 ${
        isTurn ? "ring-2 ring-emerald-400/80 dark:ring-emerald-500/60" : ""
      } ${isMirrored ? "text-right" : ""}`}
    >
      {isYou && (
        <span
          className={`absolute -top-3 ${
            isMirrored ? "right-6" : "left-6"
          } drop-shadow-[0_8px_18px_rgba(79,70,229,0.35)]`}
        >
          <YouBadge variant="compact" />
        </span>
      )}
      <div className={`flex items-start justify-between gap-3 ${isMirrored ? "flex-row-reverse" : ""}`}>
        <div className={`flex items-center gap-3 ${isMirrored ? "flex-row-reverse text-right" : ""}`}>
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl font-semibold text-white shadow-lg sm:h-12 sm:w-12 sm:text-2xl ${accent}`}
          >
            <ValueMark value={mark} />
          </span>
          <div className={`${isMirrored ? "text-right" : "text-left"}`}>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
              Player {mark}
            </p>
            <p className="text-2xl font-semibold leading-tight sm:text-3xl">{score}</p>
          </div>
        </div>
        {isTurn && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300 animate-pulse-ring">
            <Dot size={16} className="animate-gentle-bounce" />
            Your turn
          </span>
        )}
      </div>
      <div
        className={`mt-auto flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 ${
          isMirrored ? "items-end text-right" : "items-start text-left"
        }`}
      >
        <span className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-400/70 dark:text-slate-500/70">
          Occupied
        </span>
        {isEditing ? (
          <div className={`flex items-center gap-2 ${isMirrored ? "flex-row-reverse" : ""}`}>
            <input
              type="text"
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              maxLength={20}
              autoFocus
              className="w-24 px-2 py-1 text-sm font-semibold rounded border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onEditSave();
                if (e.key === 'Escape') onEditCancel();
              }}
            />
            <button
              onClick={onEditSave}
              className="p-1 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 transition-colors"
              title="Save"
            >
              <Check size={16} />
            </button>
            <button
              onClick={onEditCancel}
              className="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400 transition-colors"
              title="Cancel"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className={`flex items-center gap-2 ${isMirrored ? "flex-row-reverse" : ""}`}>
            <span
              className={`text-sm font-semibold text-slate-700 dark:text-slate-200 sm:text-base ${
                isYou ? "text-indigo-600 dark:text-indigo-300" : ""
              }`}
            >
              {occupantLabel}
            </span>
            {isYou && onEditName && (
              <button
                onClick={onEditName}
                className="p-1 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100"
                title="Edit name"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const StatChip = ({ label, value }) => (
  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/65 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 backdrop-blur-lg dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-300 sm:px-4 sm:py-2">
    <span className="text-slate-400 dark:text-slate-500">{label}</span>
    <span className="text-slate-700 dark:text-slate-100">{value}</span>
  </div>
);

const ScorePanel = ({
  gameState,
  roster,
  socketId,
  isMultiplayer,
  roomId,
  displayName: _displayName, // Used for initial edit value fallback
  onUpdateDisplayName,
}) => {
  const [editingMark, setEditingMark] = useState(null); // 'X' | 'O' | null
  const [editValue, setEditValue] = useState('');

  const handleStartEdit = useCallback((mark, currentName) => {
    setEditingMark(mark);
    setEditValue(currentName || '');
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editValue.trim() && onUpdateDisplayName) {
      onUpdateDisplayName(editValue.trim());
    }
    setEditingMark(null);
    setEditValue('');
  }, [editValue, onUpdateDisplayName]);

  const handleCancelEdit = useCallback(() => {
    setEditingMark(null);
    setEditValue('');
  }, []);

  const cards = [
    {
      mark: "X",
      score: gameState?.xScore ?? 0,
      occupant: roster?.XName || roster?.X,
      isTurn: gameState?.turn === "X",
      isYou: roster?.X && socketId && roster.X === socketId,
      accent: "bg-gradient-to-br from-indigo-500 via-indigo-600 to-sky-500",
      fallbackLabel: isMultiplayer ? "Seat open" : "Player One",
    },
    {
      mark: "O",
      score: gameState?.oScore ?? 0,
      occupant: roster?.OName || roster?.O,
      isTurn: gameState?.turn === "O",
      isYou: roster?.O && socketId && roster.O === socketId,
      accent: "bg-gradient-to-br from-rose-500 via-rose-600 to-orange-500",
      fallbackLabel: isMultiplayer ? "Seat open" : "Player Two",
    },
  ];

  const chips = [
    { label: "Mode", value: isMultiplayer ? "Multiplayer" : "Local" },
    roomId ? { label: "Room", value: roomId } : null,
  ].filter(Boolean);

  const CompactScoreSummary = () => {
    const [xCard, oCard] = cards;

    const renderOccupant = (card, align) => (
      <div
        className={`flex flex-col gap-1 normal-case text-slate-500 dark:text-slate-300 ${
          align === "end" ? "items-end text-right" : "items-start text-left"
        }`}
      >
        <span className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-400/70 dark:text-slate-500/70">
          Occupied
        </span>
        <span
          className={`text-sm font-medium text-slate-700 dark:text-slate-200 ${
            card.isYou ? "text-indigo-600 dark:text-indigo-300" : ""
          }`}
        >
          {formatOccupant(card.occupant, card.fallbackLabel)}
        </span>
      </div>
    );

    const renderPlayerPill = (card, align) => {
      const icon = (
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl text-white shadow-lg ${
            card.isTurn ? "ring-2 ring-emerald-400/80 dark:ring-emerald-500/60" : ""
          } ${card.accent}`}
        >
          <ValueMark value={card.mark} />
        </span>
      );

      if (align === "start") {
        return (
          <div className="flex items-center gap-2">
            {card.isYou ? (
              <YouBadge variant="compact" className="shrink-0" />
            ) : null}
            {icon}
          </div>
        );
      }

      return (
        <div className="flex items-center gap-2 justify-end">
          {icon}
          {card.isYou ? (
            <YouBadge variant="compact" className="shrink-0" />
          ) : null}
        </div>
      );
    };

    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white/70 p-4 text-slate-900 shadow-[0_15px_45px_-30px_rgba(15,23,42,0.65)] backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-100 sm:hidden">
        <div className="flex items-center justify-center gap-4">
          {renderPlayerPill(xCard, "start")}
          <span className="text-2xl font-semibold">{xCard.score}</span>
          <span className="text-base font-semibold text-slate-400 dark:text-slate-500">-</span>
          <span className="text-2xl font-semibold">{oCard.score}</span>
          {renderPlayerPill(oCard, "end")}
        </div>
        <div className="flex items-start justify-between gap-3 text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {renderOccupant(xCard, "start")}
          <div className="flex flex-col items-center gap-1 text-slate-500 dark:text-slate-300">
            <span className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-400/70 dark:text-slate-500/70">
              Turn
            </span>
            <span className="text-base font-semibold text-slate-700 dark:text-slate-200">
              {gameState?.turn ? <ValueMark value={gameState.turn} /> : "--"}
            </span>
          </div>
          {renderOccupant(oCard, "end")}
        </div>
      </div>
    );
  };

  return (
    <section className="relative w-full" data-tour="status">
      <div className="pointer-events-none absolute inset-0 -z-10 rounded-[28px] bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-emerald-400/20 blur-3xl" />
      <div className="relative mx-auto flex w-full max-w-[min(90vw,720px)] flex-col gap-5 rounded-[28px] border border-slate-200/70 bg-white/60 p-4 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/60 sm:gap-6 sm:p-6">
        <CompactScoreSummary />
        <div className="hidden gap-3 sm:grid sm:grid-cols-2 sm:gap-4">
          {cards.map((card) => (
            <ScoreCard 
              key={card.mark} 
              {...card} 
              isMirrored={card.mark === "O"}
              isEditing={editingMark === card.mark}
              editValue={editValue}
              onEditChange={setEditValue}
              onEditSave={handleSaveEdit}
              onEditCancel={handleCancelEdit}
              onEditName={card.isYou && onUpdateDisplayName ? () => handleStartEdit(card.mark, _displayName || '') : null}
            />
          ))}
        </div>
        {!!chips.length && (
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-between sm:gap-3">
            {chips.map((chip, index) => (
              <StatChip key={`${chip.label}-${index}`} {...chip} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default ScorePanel;
