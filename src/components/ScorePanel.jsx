import React, { useState, useCallback } from "react";
import { Crown, Dot, Pencil, Check, X } from "lucide-react";
import ValueMark from "./marks/ValueMark";
import GameSelector from "./GameSelector";

const formatOccupant = (id, fallback) => {
  if (!id) return fallback;
  if (typeof id !== "string") return fallback;
  if (id.length <= 10) return id;
  return `${id.slice(0, 5)}…${id.slice(-3)}`;
};

const YouBadge = ({ variant = "default", showText = true, className = "" }) => {
  const sizeClasses =
    variant === "compact"
      ? showText ? "px-2.5 py-0.5 text-[9px]" : "p-1.5"
      : "px-3 py-1 text-[10px]";
  const iconSize = variant === "compact" ? 12 : 14;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 font-semibold uppercase tracking-[0.32em] text-white shadow-sm ${sizeClasses} ${className}`}
    >
      <Crown size={iconSize} className="drop-shadow-sm" />
      {showText && "You"}
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
  playerInfo,
}) => {
  const occupantLabel = formatOccupant(occupant, fallbackLabel);

  return (
    <div
      className={`group relative flex flex-col gap-4 rounded-2xl border border-stone-200/80 bg-stone-50/80 p-4 text-stone-800 shadow-[0_15px_45px_-30px_rgba(28,25,23,0.4)] transition duration-300 ease-out hover:-translate-y-1 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-100 sm:p-5 ${
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
            <ValueMark value={mark} playerInfo={playerInfo} />
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
            Turn
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
              className="w-24 px-2 py-1 text-sm font-semibold rounded border border-indigo-300 dark:border-indigo-600 bg-stone-50 dark:bg-slate-800 text-stone-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onEditSave();
                if (e.key === 'Escape') onEditCancel();
              }}
            />
            <button
              onClick={onEditSave}
              className="p-1 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 transition-colors"
              title="Save"
              aria-label="Save name"
            >
              <Check size={16} />
            </button>
            <button
              onClick={onEditCancel}
              className="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400 transition-colors"
              title="Cancel"
              aria-label="Cancel editing"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className={`flex items-center gap-2 ${isMirrored ? "flex-row-reverse" : ""}`}>
            <span
              className={`text-sm font-semibold text-stone-700 dark:text-slate-200 sm:text-base ${
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
                aria-label="Edit name"
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
  <div className="inline-flex items-center gap-2 rounded-full border border-stone-200/80 bg-stone-100/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500 backdrop-blur-lg dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-300 sm:px-4 sm:py-2">
    <span className="text-slate-400 dark:text-slate-500">{label}</span>
    <span className="text-stone-700 dark:text-slate-100">{value}</span>
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
  onSwitchGame,
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

  const playerInfo = Array.isArray(gameState?.playerInfo)
    ? gameState.playerInfo
    : [
        { slot: 0, label: 'X', color: 'sky' },
        { slot: 1, label: 'O', color: 'rose' },
      ];

  // Accent class per player color token. Mirrors COLOR_CLASSES in ValueMark.
  const ACCENT_BY_COLOR = {
    sky:     'bg-gradient-to-br from-indigo-500 via-indigo-600 to-sky-500',
    rose:    'bg-gradient-to-br from-rose-500 via-rose-600 to-orange-500',
    red:     'bg-gradient-to-br from-rose-500 via-rose-600 to-red-500',
    amber:   'bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-500',
    emerald: 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-500',
  };

  // Score lookup: prefer slot-indexed gameState.scores; fall back to legacy
  // xScore/oScore for older payloads.
  const scoreFor = (slot) => {
    if (Array.isArray(gameState?.scores)) return gameState.scores[slot] ?? 0;
    return slot === 0 ? gameState?.xScore ?? 0 : gameState?.oScore ?? 0;
  };

  // Whose seat is this? roster still uses legacy X/O slot keys.
  const seatKey = (slot) => (slot === 0 ? 'X' : 'O');
  const nameKey = (slot) => (slot === 0 ? 'XName' : 'OName');

  const turnSlot = Number.isInteger(gameState?.turnSlot)
    ? gameState.turnSlot
    : gameState?.turn === playerInfo[0].label ? 0
    : gameState?.turn === playerInfo[1].label ? 1
    : null;

  const cards = playerInfo.map((p) => ({
    mark: p.label,
    slot: p.slot,
    score: scoreFor(p.slot),
    occupant: roster?.[nameKey(p.slot)] || roster?.[seatKey(p.slot)],
    isTurn: turnSlot === p.slot,
    isYou: roster?.[seatKey(p.slot)] && socketId && roster[seatKey(p.slot)] === socketId,
    accent: ACCENT_BY_COLOR[p.color] || ACCENT_BY_COLOR.sky,
    fallbackLabel: isMultiplayer ? "Seat open" : `Player ${p.slot + 1}`,
    playerInfo,
  }));

  const chips = [
    { label: "Mode", value: isMultiplayer ? "Multiplayer" : "Local" },
    roomId ? { label: "Room", value: roomId } : null,
  ].filter(Boolean);

  const canSwitchGame = !isMultiplayer || cards.some((card) => card.isYou);

  const CompactScoreSummary = () => {
    const [xCard, oCard] = cards;

    const renderOccupant = (card, align) => {
      const isEditing = editingMark === card.mark;

      return (
        <div
          className={`flex flex-col gap-1 normal-case text-slate-500 dark:text-slate-300 ${
            align === "end" ? "items-end text-right" : "items-start text-left"
          }`}
        >
          <span className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-400/70 dark:text-slate-500/70">
            Occupied
          </span>
          {isEditing ? (
            <div className={`flex items-center gap-1.5 ${align === "end" ? "flex-row-reverse" : ""}`}>
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                maxLength={20}
                autoFocus
                className="w-20 px-2 py-0.5 text-xs font-semibold rounded border border-indigo-300 dark:border-indigo-600 bg-stone-50 dark:bg-slate-800 text-stone-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
              />
              <button
                onClick={handleSaveEdit}
                className="p-0.5 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 transition-colors"
                title="Save"
                aria-label="Save name"
              >
                <Check size={14} />
              </button>
              <button
                onClick={handleCancelEdit}
                className="p-0.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400 transition-colors"
                title="Cancel"
                aria-label="Cancel editing"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <span
              className={`text-sm font-medium text-stone-600 dark:text-slate-200 ${
                card.isYou ? "text-indigo-600 dark:text-indigo-300 cursor-pointer hover:underline" : ""
              }`}
              onClick={card.isYou && onUpdateDisplayName ? () => handleStartEdit(card.mark, _displayName || '') : undefined}
              role={card.isYou && onUpdateDisplayName ? "button" : undefined}
              tabIndex={card.isYou && onUpdateDisplayName ? 0 : undefined}
              onKeyDown={card.isYou && onUpdateDisplayName ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleStartEdit(card.mark, _displayName || '');
                }
              } : undefined}
            >
              {formatOccupant(card.occupant, card.fallbackLabel)}
            </span>
          )}
        </div>
      );
    };

    const renderPlayerPill = (card, align) => {
      const icon = (
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl text-white shadow-lg ${
            card.isTurn ? "ring-[3px] ring-emerald-400 dark:ring-emerald-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 animate-pulse-ring" : ""
          } ${card.accent}`}
        >
          <ValueMark value={card.mark} playerInfo={playerInfo} />
        </span>
      );

      const badge = card.isYou ? (
        <YouBadge variant="compact" showText={false} className="shrink-0" />
      ) : (
        <div className="w-[24px] shrink-0" />
      );

      if (align === "start") {
        return (
          <div className="flex items-center gap-2 justify-end min-w-[90px]">
            {badge}
            {icon}
          </div>
        );
      }

      return (
        <div className="flex items-center gap-2 justify-start min-w-[90px]">
          {icon}
          {badge}
        </div>
      );
    };

    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-stone-200/80 bg-stone-50/80 p-4 text-stone-800 shadow-[0_15px_45px_-30px_rgba(28,25,23,0.4)] backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-100 sm:hidden">
        <div className="flex items-center justify-center gap-4">
          {renderPlayerPill(xCard, "start")}
          <span className="text-2xl font-semibold">{xCard.score}</span>
          <span className="text-base font-semibold text-stone-400 dark:text-slate-500">-</span>
          <span className="text-2xl font-semibold">{oCard.score}</span>
          {renderPlayerPill(oCard, "end")}
        </div>
        <div className="flex items-start justify-between gap-3 text-xs uppercase tracking-wide text-stone-400 dark:text-slate-500">
          {renderOccupant(xCard, "start")}
          <div className="flex flex-col items-center gap-1 text-stone-500 dark:text-slate-300">
            <span className="text-[11px] font-medium uppercase tracking-[0.28em] text-stone-400/70 dark:text-slate-500/70">
              Turn
            </span>
            <span className="text-base font-semibold text-stone-700 dark:text-slate-200">
              {gameState?.turn ? <ValueMark value={gameState.turn} playerInfo={playerInfo} /> : "--"}
            </span>
          </div>
          {renderOccupant(oCard, "end")}
        </div>
      </div>
    );
  };

  return (
    <section className="relative w-full" data-tour="status">
      <div className="pointer-events-none absolute inset-0 -z-10 rounded-[28px] bg-gradient-to-br from-indigo-500/10 via-purple-500/8 to-emerald-400/15 blur-3xl" />
      <div className="relative mx-auto flex w-full max-w-[min(90vw,720px)] flex-col gap-5 rounded-[28px] border border-stone-200/80 bg-stone-50/70 p-4 backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/60 sm:gap-6 sm:p-6">
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
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {chips.map((chip, index) => (
                <StatChip key={`${chip.label}-${index}`} {...chip} />
              ))}
            </div>
            <GameSelector
              isMultiplayer={isMultiplayer}
              currentGameId={gameState?.gameId}
              onSwitchGame={canSwitchGame ? onSwitchGame : null}
            />
          </div>
        )}
      </div>
    </section>
  );
};

export default ScorePanel;
