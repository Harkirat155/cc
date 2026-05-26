import React from "react";
import { useSearchParams } from "react-router-dom";
import { listAll } from "@shared/games/registry.js";

const WRAPPER_CLASSES = {
  desktop:
    "hidden sm:flex items-center p-1 bg-foreground/[0.03] border border-foreground/5 rounded-full",
  mobile:
    "sm:hidden flex items-center p-1 bg-foreground/[0.03] border border-foreground/5 rounded-full mb-8",
};

const BUTTON_CLASSES = {
  desktop: "px-4 py-1.5 text-xs font-medium rounded-full transition-all",
  mobile: "px-3 py-1.5 text-xs font-medium rounded-full transition-all",
};

const GameSelector = ({
  isMultiplayer,
  currentGameId,
  onSwitchGame,
  disabled = false,
  variant = "desktop",
  className = "",
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  if (isMultiplayer && !onSwitchGame) return null;

  const games = listAll();
  if (games.length <= 1) return null;

  const active = currentGameId || searchParams.get("game") || games[0]?.id;

  const handleSelect = (next) => {
    if (!next || next === active || disabled) return;

    if (isMultiplayer) {
      onSwitchGame?.(next);
      return;
    }

    onSwitchGame?.(next);

    const params = new window.URLSearchParams(searchParams);
    if (!next || next === games[0]?.id) {
      params.delete("game");
    } else {
      params.set("game", next);
    }
    setSearchParams(params, { replace: true });
  };

  const wrapperClass = WRAPPER_CLASSES[variant] || WRAPPER_CLASSES.desktop;
  const buttonClass = BUTTON_CLASSES[variant] || BUTTON_CLASSES.desktop;

  return (
    <div
      className={`${wrapperClass} ${className}`}
      role="group"
      aria-label="Choose game"
    >
      {games.map((game) => {
        const selected = game.id === active;
        return (
          <button
            key={game.id}
            type="button"
            onClick={() => handleSelect(game.id)}
            disabled={disabled}
            aria-pressed={selected}
            className={`${buttonClass} whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 ${
              selected
                ? "bg-foreground/10 text-foreground shadow-sm"
                : "text-foreground/50 hover:text-foreground/80"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {game.displayName}
          </button>
        );
      })}
    </div>
  );
};

export default GameSelector;
