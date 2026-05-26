import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Button from './ui/Button';
import '@shared/games/index.js';
import { listAll } from '@shared/games/registry.js';

// Fun tips to show while waiting
const WAITING_TIPS = [
  "💡 Tip: The player who goes first (X) has a slight advantage!",
  "🎯 Pro tip: Control the center square for more winning opportunities",
  "🧠 Did you know? A perfect game of Tic Tac Toe always ends in a draw",
  "⚡ Quick fact: There are 255,168 possible games of Tic Tac Toe",
  "🎮 Tip: Corner squares are the second-best starting positions",
  "🏆 Fun fact: Tic Tac Toe dates back to ancient Egypt!",
  "💬 Voice chat is available once you're matched with an opponent",
  "📱 Share room links with friends for private matches",
];

/**
 * LobbyView - Matchmaking lobby interface
 * Single Responsibility: Display lobby UI and handle user interactions
 * Users are automatically placed in lobby with a generated name
 */
const LobbyView = ({ 
  lobbyQueue = [], 
  isInLobby = false, 
  onLeaveLobby,
  socketId,
  displayName = '',
  connectionState = 'disconnected',
  preferredGameId = 'ttt'
}) => {
  const handleLeaveLobby = useCallback(() => {
    onLeaveLobby();
  }, [onLeaveLobby]);

  // Calculate user's position in queue
  const userPosition = lobbyQueue.findIndex(p => p.socketId === socketId);

  // Current timestamp, updating every second
  const [now, setNow] = useState(Date.now());
  
  // Rotating tip index
  const [tipIndex, setTipIndex] = useState(0);
  
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Rotate tips every 5 seconds while in lobby
  useEffect(() => {
    if (!isInLobby) return;
    const tipTimer = window.setInterval(() => {
      setTipIndex((prev) => (prev + 1) % WAITING_TIPS.length);
    }, 5000);
    return () => window.clearInterval(tipTimer);
  }, [isInLobby]);

  const currentTip = useMemo(() => WAITING_TIPS[tipIndex], [tipIndex]);
  const gameNames = useMemo(
    () => new Map(listAll().map((game) => [game.id, game.displayName])),
    []
  );
  const gameName = useCallback(
    (gameId) => gameNames.get(gameId) || gameNames.get('ttt') || 'Tic-Tac-Toe',
    [gameNames]
  );

  // Calculate estimated wait time based on queue position
  const estimatedWait = useMemo(() => {
    if (userPosition < 0) return null;
    if (lobbyQueue.length >= 2 && userPosition === 0) return "Matching soon...";
    if (userPosition === 0) return "You're next!";
    return `~${Math.max(5, userPosition * 10)}s estimated`;
  }, [userPosition, lobbyQueue.length]);

  return (
    <div className="flex w-full items-center justify-center">
      <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-foreground/10 bg-background/80 shadow-[0_24px_90px_-48px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        {/* Header */}
        <div className="border-b border-foreground/5 bg-foreground/[0.03] px-8 py-6">
          <div className="flex items-center justify-between">
            <h1 className="mb-2 text-3xl font-semibold tracking-tight text-foreground">Matchmaking Lobby</h1>
            {/* Connection indicator */}
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  connectionState === 'connected'
                    ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]'
                    : connectionState === 'connecting'
                    ? 'bg-yellow-400 animate-pulse'
                    : 'bg-red-400'
                }`}
              />
              <span className="text-sm text-foreground/50">
                {connectionState === 'connected' ? 'Connected' : connectionState === 'connecting' ? 'Connecting...' : 'Disconnected'}
              </span>
            </div>
          </div>
          <p className="text-foreground/55">
            {connectionState === 'connected' ? 'Finding an opponent for you...' : connectionState === 'connecting' ? 'Establishing connection...' : 'Connection lost, reconnecting...'}
          </p>
        </div>

        <div className="p-8">
          {/* Waiting State */}
          <div className="space-y-6">
            <div className="text-center py-8">
              <div className="relative mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-foreground/[0.05]">
                <svg
                  className="h-10 w-10 animate-spin text-foreground/60"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                {/* Pulsing ring */}
                <span className="absolute inset-0 animate-ping rounded-full bg-foreground/10" />
              </div>
              <h2 className="mb-2 text-2xl font-semibold text-foreground">
                Searching for opponent...
              </h2>
              <p className="mb-2 text-sm text-foreground/55">
                Playing as: <span className="font-mono font-semibold text-foreground">{displayName}</span>
              </p>
              <p className="mb-2 text-sm text-foreground/55">
                Game: <span className="font-semibold text-foreground/80">{gameName(preferredGameId)}</span>
              </p>
              <div className="flex flex-col items-center gap-1">
                <p className="text-foreground/55">
                  {userPosition >= 0 && `Position in queue: ${userPosition + 1}`}
                </p>
                {estimatedWait && (
                  <p className="text-sm font-medium text-foreground/75">
                    {estimatedWait}
                  </p>
                )}
              </div>
            </div>

            {/* Rotating Tips */}
            <div className="rounded-2xl border border-foreground/5 bg-foreground/[0.03] p-4 transition-all duration-300">
              <p className="flex min-h-[2.5rem] items-center justify-center text-center text-sm text-foreground/65">
                {currentTip}
              </p>
            </div>

            {/* Waiting Players List */}
            <div className="rounded-2xl bg-foreground/[0.03] p-4">
              <h3 className="mb-3 text-sm font-semibold text-foreground/70">
                Waiting Players ({lobbyQueue.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {lobbyQueue.map((player, index) => {
                  const isCurrentUser = player.socketId === socketId;
                  const waitTime = Math.floor((now - player.joinedAt) / 1000);

                  return (
                    <div
                      key={player.socketId}
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                        isCurrentUser
                          ? 'border border-foreground/10 bg-foreground/10'
                          : 'bg-background/60'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-foreground/[0.06] text-sm font-semibold text-foreground/70">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-mono font-medium text-foreground">
                            {player.displayName}
                            {isCurrentUser && (
                              <span className="ml-2 font-sans text-xs font-semibold text-foreground/60">
                                (You)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-foreground/45">
                            Waiting {waitTime}s
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full bg-foreground/[0.06] px-2.5 py-1 text-xs font-semibold text-foreground/60">
                        {gameName(player.gameId)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <Button
              onClick={handleLeaveLobby}
              className="w-full rounded-full border border-foreground/10 py-3 transition-colors hover:bg-foreground/[0.05]"
            >
              Leave Lobby
            </Button>
          </div>
        </div>

        {/* Info Footer */}
        <div className="border-t border-foreground/5 bg-foreground/[0.03] px-8 py-4">
          <p className="text-center text-xs text-foreground/45">
            Players are matched automatically on a first-come, first-served basis
          </p>
        </div>
      </div>
    </div>
  );
};

export default LobbyView;
