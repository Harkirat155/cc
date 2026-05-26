import React from "react";
import { Link } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import Mic from "lucide-react/dist/esm/icons/mic.js";
import MicOff from "lucide-react/dist/esm/icons/mic-off.js";
import Wifi from "lucide-react/dist/esm/icons/wifi.js";
import WifiOff from "lucide-react/dist/esm/icons/wifi-off.js";
import { Tooltip } from "./ui/Tooltip";
import NavMenu from "./NavMenu";
import GameSelector from "./GameSelector";

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
  currentGameId = null,
  onSwitchGame,
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
  const connectionLabel =
    connectionState === 'connected'
      ? 'Connected to server'
      : connectionState === 'connecting'
      ? 'Connecting...'
      : 'Disconnected - trying to reconnect';

  return (
    <header
      className="sticky top-0 z-50 h-16 border-b border-foreground/5 bg-background/50 backdrop-blur-xl"
      data-tour="navbar"
    >
      <nav className="mx-auto flex h-full w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Tooltip content="Return to home">
          <Link
            to="/"
            className="shrink-0 select-none bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-lg font-semibold tracking-tight text-transparent transition hover:opacity-90 sm:text-xl"
            aria-label="CrissCross Home"
          >
            CrissCross
          </Link>
        </Tooltip>

        <div className="hidden min-w-0 flex-1 justify-center px-2 sm:flex">
          <GameSelector
            variant="desktop"
            isMultiplayer={isMultiplayer}
            currentGameId={currentGameId}
            onSwitchGame={onSwitchGame}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2" data-tour="panels">
          {isMultiplayer && (
            <Tooltip content={connectionLabel}>
              <div
                role="status"
                aria-label={connectionLabel}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-foreground/5 bg-foreground/[0.03] transition ${
                  connectionState === 'connected'
                    ? 'text-emerald-500 ring-1 ring-emerald-400/20'
                    : connectionState === 'connecting'
                    ? 'animate-pulse text-amber-500 ring-1 ring-amber-400/20'
                    : 'animate-connection-pulse text-red-500 ring-1 ring-red-400/20'
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
            <Tooltip content={micIsOn ? "Mute microphone" : "Enable microphone"}>
              <button
                type="button"
                onClick={onToggleMic}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-foreground/5 bg-foreground/[0.03] text-foreground/60 transition hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 ${
                  micIsOn ? "bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-400/25" : ""
                }`}
                aria-label={micIsOn ? "Mute microphone" : "Enable microphone"}
              >
                {micIsOn ? <Mic size={16} /> : <MicOff size={16} />}
              </button>
            </Tooltip>
          )}
          <ThemeToggle />
          <NavMenu actions={menuActions} panel={menuPanel} />
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
