import React from "react";
import { Link } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import { Mic, MicOff, Wifi, WifiOff } from "lucide-react";
import { Tooltip } from "./ui/Tooltip";
import NavMenu from "./NavMenu";

const Navbar = ({
  onToggleHistory,
  isHistoryOpen = false,
  isMultiplayer = false,
  onShowWalkthrough,
  voiceEnabled = false,
  micMuted = true,
  onToggleMic,
  connectionState = 'disconnected',
  menuPanel = null,
  menuItems = [],
}) => {
  const menuActions = [...menuItems];

  if (typeof onToggleHistory === "function") {
    menuActions.push({
      key: "history",
      label: isHistoryOpen ? "Close History" : "Open History",
      description: "View move history for this game",
      onSelect: onToggleHistory,
    });
  }

  if (typeof onShowWalkthrough === "function") {
    menuActions.push({
      key: "tour",
      label: "Tour",
      description: "Replay the guided walkthrough",
      onSelect: onShowWalkthrough,
    });
  }
  const showVoiceControl = isMultiplayer && typeof onToggleMic === "function";
  const micIsOn = showVoiceControl && voiceEnabled && !micMuted;

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 bg-stone-50/80 dark:bg-gray-900/70 backdrop-blur border-b border-stone-200 dark:border-gray-800"
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

          {/* Actions: Connection Status + History + Theme */}
          <div className="flex items-center gap-2" data-tour="panels">
            {/* Connection Status Indicator (only in multiplayer) */}
            {isMultiplayer && (
              <Tooltip
                content={
                  connectionState === 'connected'
                    ? 'Connected to server'
                    : connectionState === 'connecting'
                    ? 'Connecting...'
                    : 'Disconnected - trying to reconnect'
                }
              >
                <div
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-all ${
                    connectionState === 'connected'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : connectionState === 'connecting'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 animate-pulse'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 animate-connection-pulse'
                  }`}
                >
                  {connectionState === 'connected' ? (
                    <Wifi size={16} />
                  ) : (
                    <WifiOff size={16} />
                  )}
                </div>
              </Tooltip>
            )}
            {showVoiceControl && (
              <Tooltip
                content={micIsOn ? "Mute microphone" : "Enable microphone"}
              >
                <button
                  type="button"
                  onClick={onToggleMic}
                  className={`inline-flex items-center justify-center w-10 h-10 rounded-full border border-stone-200 dark:border-gray-700 bg-stone-50/80 dark:bg-gray-800/70 hover:bg-stone-100 dark:hover:bg-gray-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 ${
                    micIsOn ? "ring-2 ring-emerald-500/50 dark:ring-emerald-500/60" : ""
                  }`}
                  aria-label={micIsOn ? "Mute microphone" : "Enable microphone"}
                >
                  {micIsOn ? (
                    <Mic size={16} className="text-emerald-600 dark:text-emerald-300" />
                  ) : (
                    <MicOff size={16} className="text-gray-700 dark:text-gray-200" />
                  )}
                </button>
              </Tooltip>
            )}
            <ThemeToggle />
            <NavMenu actions={menuActions} panel={menuPanel} />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
