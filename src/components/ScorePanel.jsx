import React, { useCallback, useMemo, useState } from "react";
import ScorePlayerCard from "./ScorePlayerCard";
import { getGamePalette } from "./games/palette";

const cx = (...classes) => classes.filter(Boolean).join(" ");

const FALLBACK_PLAYER_INFO = [
  { slot: 0, label: "X", color: "sky" },
  { slot: 1, label: "O", color: "rose" },
];

const seatKey = (slot) => (slot === 0 ? "X" : "O");
const nameKey = (slot) => (slot === 0 ? "XName" : "OName");

const ScorePanel = ({
  gameState,
  roster,
  socketId,
  isMultiplayer,
  displayName,
  onUpdateDisplayName,
}) => {
  const [editingSlot, setEditingSlot] = useState(null);
  const [editValue, setEditValue] = useState("");

  const playerInfo = useMemo(() => {
    const info = Array.isArray(gameState?.playerInfo)
      ? gameState.playerInfo
      : FALLBACK_PLAYER_INFO;

    return info.slice(0, 2).map((player, index) => ({
      ...player,
      slot: Number.isInteger(player?.slot) ? player.slot : index,
      label: player?.label || FALLBACK_PLAYER_INFO[index]?.label,
    }));
  }, [gameState?.playerInfo]);

  const palette = getGamePalette(gameState?.gameId);
  const scoreFor = useCallback(
    (slot) => {
      if (Array.isArray(gameState?.scores)) return gameState.scores[slot] ?? 0;
      return slot === 0 ? gameState?.xScore ?? 0 : gameState?.oScore ?? 0;
    },
    [gameState?.oScore, gameState?.scores, gameState?.xScore]
  );

  const turnSlot = Number.isInteger(gameState?.turnSlot)
    ? gameState.turnSlot
    : gameState?.turn === playerInfo[0]?.label
      ? playerInfo[0]?.slot
      : gameState?.turn === playerInfo[1]?.label
        ? playerInfo[1]?.slot
        : null;

  const winnerExists = Boolean(gameState?.winner);
  const cards = playerInfo.map((player, index) => {
    const slot = player.slot;
    const paletteEntry = index === 0 ? palette.p1 : palette.p2;
    const occupant = roster?.[nameKey(slot)] || roster?.[seatKey(slot)];

    return {
      slot,
      label: paletteEntry?.label || `Player ${player.label}`,
      score: scoreFor(slot),
      occupant,
      fallbackLabel: isMultiplayer ? "Seat open" : `Player ${slot + 1}`,
      isActive: turnSlot === slot,
      isYou: Boolean(
        roster?.[seatKey(slot)] && socketId && roster[seatKey(slot)] === socketId
      ),
      palette: paletteEntry,
    };
  });

  const handleStartEdit = useCallback(
    (slot, currentName) => {
      setEditingSlot(slot);
      setEditValue(displayName || currentName || "");
    },
    [displayName]
  );

  const handleSaveEdit = useCallback(() => {
    if (editValue.trim() && onUpdateDisplayName) {
      onUpdateDisplayName(editValue.trim());
    }
    setEditingSlot(null);
    setEditValue("");
  }, [editValue, onUpdateDisplayName]);

  const handleCancelEdit = useCallback(() => {
    setEditingSlot(null);
    setEditValue("");
  }, []);

  const activeGlow =
    cards.find((card) => card.isActive)?.palette?.glow || palette.p1?.glow;

  return (
    <section className="relative w-full" data-tour="status" aria-label="Scoreboard">
      <div
        className={cx(
          "pointer-events-none absolute inset-x-10 -top-10 -z-10 h-32 rounded-full opacity-[0.08] blur-3xl transition-colors duration-500",
          activeGlow
        )}
      />
      <div className="relative mx-auto flex w-full max-w-2xl items-center justify-center px-2">
        <div className="flex items-center justify-center gap-8 text-sm font-medium sm:gap-12">
          {cards.map((card, index) => (
            <React.Fragment key={card.slot}>
              {index === 1 && (
                <div className="text-xl font-thin tracking-[0.35em] text-foreground/40 sm:text-2xl">
                  VS
                </div>
              )}
              <ScorePlayerCard
                {...card}
                isEditing={editingSlot === card.slot}
                editValue={editValue}
                onEditChange={setEditValue}
                onEditSave={handleSaveEdit}
                onEditCancel={handleCancelEdit}
                onEditName={
                  card.isYou && onUpdateDisplayName
                    ? () => handleStartEdit(card.slot, card.occupant)
                    : null
                }
                winnerExists={winnerExists}
              />
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ScorePanel;
