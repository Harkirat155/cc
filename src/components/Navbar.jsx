import React from "react";
import { Link } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import { History, Users, Mic, MicOff } from "lucide-react";
import { Tooltip } from "./ui/Tooltip";
import NavMenu from "./NavMenu";

const Navbar = ({
  onToggleHistory,
  isHistoryOpen = false,
  onTogglePeople,
  isPeopleOpen = false,
  voiceEnabled = false,
  micMuted = true,
  onToggleMic,
  isMultiplayer = false,
  onShowWalkthrough,
}) => {
  // Single-button voice control: consider voice "on" only when enabled and not muted
  const isVoiceOn = Boolean(voiceEnabled && !micMuted);
  const menuActions = [];

  if (typeof onShowWalkthrough === "function") {
    menuActions.push({
      key: "tour",
      label: "Tour",
      description: "Replay the guided walkthrough",
      onSelect: onShowWalkthrough,
    });
  }
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 bg-white/70 dark:bg-gray-900/70 backdrop-blur border-b border-gray-200 dark:border-gray-800"
      data-tour="navbar"
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="h-16 flex items-center justify-between">
          {/* Brand */}
          <Tooltip content="Return to home">
            <Link
              to="/"
              className="text-2xl font-extrabold tracking-tight select-none bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent hover:opacity-90 transition"
              aria-label="CrissCross Home"
            >
              CrissCross
            </Link>
          </Tooltip>

          {/* Actions: History + Theme */}
          <div className="flex items-center gap-2" data-tour="panels">
            {isMultiplayer && (
              <div className="flex items-center gap-2 mr-1">
                {/* Single voice toggle (on/off) */}
                <Tooltip
                  content={isVoiceOn ? "Turn voice off" : "Turn voice on"}
                >
                  <button
                    type="button"
                    onClick={onToggleMic}
                    className={`inline-flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 hover:bg-white dark:hover:bg-gray-800 transition ${
                      isVoiceOn ? "ring-2 ring-emerald-500/50" : ""
                    }`}
                    aria-label={isVoiceOn ? "Turn voice off" : "Turn voice on"}
                  >
                    {isVoiceOn ? (
                      <Mic
                        size={16}
                        strokeWidth={2}
                        className="text-emerald-600 dark:text-emerald-300"
                      />
                    ) : (
                      <MicOff
                        size={16}
                        strokeWidth={2}
                        className="text-gray-700 dark:text-gray-200"
                      />
                    )}
                  </button>
                </Tooltip>
              </div>
            )}
            {isMultiplayer && (
              <div className="flex items-center gap-2 mr-1">
                <Tooltip
                  content={
                    isPeopleOpen ? "Close people panel" : "Open people panel"
                  }
                >
                  <button
                    type="button"
                    onClick={onTogglePeople}
                    className={`inline-flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 hover:bg-white dark:hover:bg-gray-800 transition ${
                      isPeopleOpen ? "ring-2 ring-indigo-500/50" : ""
                    }`}
                    aria-label={isPeopleOpen ? "Close people" : "Open people"}
                  >
                    <Users
                      size={16}
                      strokeWidth={2}
                      className="text-gray-700 dark:text-gray-200"
                    />
                  </button>
                </Tooltip>
              </div>
            )}
            <Tooltip
              content={
                isHistoryOpen ? "Close move history" : "Open move history"
              }
            >
              <button
                type="button"
                onClick={onToggleHistory}
                className={`inline-flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 hover:bg-white dark:hover:bg-gray-800 transition ${
                  isHistoryOpen ? "ring-2 ring-purple-500/50" : ""
                }`}
                aria-label={isHistoryOpen ? "Close history" : "Open history"}
              >
                {/* History icon */}
                <History
                  size={16}
                  strokeWidth={2}
                  className="text-gray-700 dark:text-gray-200"
                />
              </button>
            </Tooltip>

            <ThemeToggle />
            <NavMenu actions={menuActions} />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
