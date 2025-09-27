import React from "react";
import { Users, User, Eye, Mic, MicOff } from "lucide-react";
import ValueMark from "./marks/ValueMark";
import { Tooltip } from "./ui/Tooltip";

// Props:
// - roster: { X: string|null, O: string|null, spectators: string[] }
// - socketId: string|null
// - isMultiplayer: boolean
// - roomId: string|null
// - voiceRoster: { [socketId]: { muted: boolean } }
const PeoplePanel = ({ roster, socketId, isMultiplayer, roomId, voiceRoster = {} }) => {
  const { X, O, spectators = [] } = roster || {};

  const renderPerson = (id, roleLabel, mark) => {
    if (!id) return null;
    const isYou = socketId && id === socketId;
    const voice = voiceRoster[id];
    const isMuted = !voice || voice.muted; // show red crossed if not publishing or muted
    const baseLabel = `${roleLabel} ${mark ? `(${mark})` : ""}`.trim();
    const tooltipContent = `${baseLabel}${isYou ? " • You" : ""}\n${id}`;

    return (
      <Tooltip key={id + roleLabel} content={tooltipContent} side="right" align="start">
        <li
          className={`flex items-center justify-between px-3 py-2 rounded border text-sm ${
            isYou
              ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800"
              : "bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700"
          }`}
          aria-label={`${baseLabel} ${isYou ? "(You)" : ""}`}
        >
        <div className="flex items-center gap-2 min-w-0">
          <User size={14} className="text-gray-600 dark:text-gray-300 shrink-0" />
          <span className="truncate text-gray-800 dark:text-gray-100">
            {id.slice(0, 6)}…
          </span>
          {isYou && (
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              You
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {mark && <ValueMark value={mark} />}
          {/* Mic status */}
            <Tooltip content={isMuted ? "Muted or not publishing audio" : "Voice channel active"}>
              {isMuted ? (
                <MicOff size={14} className="text-red-600" />
              ) : (
                <Mic size={14} className="text-emerald-600" />
              )}
            </Tooltip>
          <span className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {roleLabel}
          </span>
        </div>
        </li>
      </Tooltip>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/50">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-gray-700 dark:text-gray-200" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">People</h3>
        </div>
        {isMultiplayer && roomId && (
          <span className="text-[11px] text-gray-500 dark:text-gray-400">Room {roomId}</span>
        )}
      </div>
      <div className="p-4 space-y-3 overflow-y-auto">
        {!isMultiplayer ? (
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Local mode — no room members.
          </div>
        ) : (
          <>
            <ul className="space-y-2">
              {renderPerson(X, "Player", "X")}
              {renderPerson(O, "Player", "O")}
            </ul>
            <div className="pt-1">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                <Eye size={12} /> Spectators
                <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500">
                  {spectators.length}
                </span>
              </div>
              {spectators.length ? (
                <ul className="space-y-2">
                  {spectators.map((sid) => renderPerson(sid, "Spectator", null))}
                </ul>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400">None</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PeoplePanel;
