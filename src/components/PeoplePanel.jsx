import React from "react";
import Eye from "lucide-react/dist/esm/icons/eye.js";
import Mic from "lucide-react/dist/esm/icons/mic.js";
import MicOff from "lucide-react/dist/esm/icons/mic-off.js";
import User from "lucide-react/dist/esm/icons/user.js";
import Users from "lucide-react/dist/esm/icons/users.js";
import ValueMark from "./marks/ValueMark";
import { Tooltip } from "./ui/Tooltip";

const EMPTY_VOICE_ROSTER = {};

// Props:
// - roster: { X: string|null, O: string|null, spectators: string[] }
// - socketId: string|null
// - isMultiplayer: boolean
// - roomId: string|null
// - voiceRoster: { [socketId]: { muted: boolean } }
const PeoplePanel = ({
  roster,
  socketId,
  isMultiplayer,
  roomId,
  voiceRoster = EMPTY_VOICE_ROSTER,
  variant = "panel",
  className = "",
}) => {
  const { X, O, spectators = [] } = roster || {};
  const isMenuVariant = variant === "menu";

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
          className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-sm ${
            isYou
              ? "border-emerald-500/20 bg-emerald-500/10"
              : "border-foreground/5 bg-foreground/[0.03]"
          }`}
          aria-label={`${baseLabel} ${isYou ? "(You)" : ""}`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <User size={14} className="shrink-0 text-muted-foreground" />
            <span className="truncate text-foreground">
              {id.slice(0, 6)}…
            </span>
            {isYou && (
              <span className="ml-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">
                You
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {mark && <ValueMark value={mark} />}
            <Tooltip content={isMuted ? "Muted or not publishing audio" : "Voice channel active"}>
              {isMuted ? (
                <MicOff size={14} className="text-red-600" />
              ) : (
                <Mic size={14} className="text-emerald-600" />
              )}
            </Tooltip>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {roleLabel}
            </span>
          </div>
        </li>
      </Tooltip>
    );
  };

  return (
    <div
      className={`flex flex-col ${isMenuVariant ? "gap-3" : "h-full"} ${className}`}
    >
      <div
        className={`flex items-center justify-between border-b border-foreground/5 ${
          isMenuVariant
            ? "px-2.5 py-2 text-sm text-foreground"
            : "bg-card/70 px-4 py-3 backdrop-blur-xl"
        }`}
      >
        <div className="flex items-center gap-2">
          <Users size={16} className="text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">People</h3>
        </div>
        {isMultiplayer && roomId && (
          <span className="rounded-full border border-foreground/5 bg-foreground/[0.03] px-2 py-0.5 text-[11px] text-muted-foreground">
            Room {roomId}
          </span>
        )}
      </div>
      <div
        className={`${
          isMenuVariant ? "px-2.5 pb-3 pt-1" : "p-4"
        } space-y-3 overflow-y-auto`}
      >
        {!isMultiplayer ? (
          <div className="text-sm text-muted-foreground">
            Local mode — no room members.
          </div>
        ) : (
          <>
            <ul className="space-y-2">
              {renderPerson(X, "Player", "X")}
              {renderPerson(O, "Player", "O")}
            </ul>
            <div className="pt-1">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Eye size={12} /> Spectators
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {spectators.length}
                </span>
              </div>
              {spectators.length ? (
                <ul className="space-y-2">
                  {spectators.map((sid) => renderPerson(sid, "Spectator", null))}
                </ul>
              ) : (
                <div className="text-sm text-muted-foreground">None</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PeoplePanel;
