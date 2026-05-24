import React from "react";
import { useSearchParams } from "react-router-dom";
import { listAll } from "@shared/games/registry.js";

const GameSelector = ({ isMultiplayer, currentGameId, onSwitchGame, disabled = false }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  if (isMultiplayer && !onSwitchGame) return null;

  const games = listAll();
  if (games.length <= 1) return null;

  const active = currentGameId || searchParams.get("game") || games[0]?.id;

  const handleChange = (e) => {
    const next = e.target.value;
    if (isMultiplayer) {
      if (next && next !== active) onSwitchGame?.(next);
      return;
    }

    const params = new window.URLSearchParams(searchParams);
    if (!next || next === games[0]?.id) {
      params.delete("game");
    } else {
      params.set("game", next);
    }
    setSearchParams(params, { replace: true });
    // Hard reload so the local-mode initial state is recreated against the
    // selected rules. Cheaper than threading game switching through
    // useSocketGame today — revisit if game-switching becomes hot.
    window.location.reload();
  };

  return (
    <label className="inline-flex items-center gap-2 rounded-full border border-stone-200/80 bg-stone-100/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500 backdrop-blur-lg dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-300 sm:px-4 sm:py-2">
      <span className="text-slate-400 dark:text-slate-500">Game</span>
      <select
        value={active}
        onChange={handleChange}
        disabled={disabled}
        className="cursor-pointer bg-transparent text-stone-700 dark:text-slate-100 focus:outline-none"
        aria-label="Choose game"
      >
        {games.map((g) => (
          <option key={g.id} value={g.id}>
            {g.displayName}
          </option>
        ))}
      </select>
    </label>
  );
};

export default GameSelector;
