import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Button from './ui/Button';
import GameModeSelector from './GameModeSelector';
import { GAME_MODES, getPersistedMode } from '../utils/gameMode';

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
 * Supports game mode selection before joining
 */
const LobbyView = ({ 
  lobbyQueue = [], 
  isInLobby = false, 
  onJoinLobby,
  onLeaveLobby,
  socketId,
  displayName = '',
  connectionState = 'disconnected',
  gameMode: externalGameMode,
  onGameModeChange,
}) => {
  const [selectedMode, setSelectedMode] = useState(() => externalGameMode || getPersistedMode());

  const handleModeChange = useCallback((mode) => {
    setSelectedMode(mode);
    onGameModeChange?.(mode);
  }, [onGameModeChange]);

  const handleJoinLobby = useCallback(() => {
    onJoinLobby?.(selectedMode);
  }, [onJoinLobby, selectedMode]);

  const handleLeaveLobby = useCallback(() => {
    onLeaveLobby();
  }, [onLeaveLobby]);

  // Get mode display info
  const modeInfo = useMemo(() => GAME_MODES[selectedMode] || GAME_MODES.classic, [selectedMode]);

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

  // Calculate estimated wait time based on queue position
  const estimatedWait = useMemo(() => {
    if (userPosition < 0) return null;
    if (lobbyQueue.length >= 2 && userPosition === 0) return "Matching soon...";
    if (userPosition === 0) return "You're next!";
    return `~${Math.max(5, userPosition * 10)}s estimated`;
  }, [userPosition, lobbyQueue.length]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 to-indigo-100/80 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-stone-50 dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 px-8 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-white mb-2">Matchmaking Lobby</h1>
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
              <span className="text-sm text-blue-100">
                {connectionState === 'connected' ? 'Connected' : connectionState === 'connecting' ? 'Connecting...' : 'Disconnected'}
              </span>
            </div>
          </div>
          <p className="text-blue-100 dark:text-blue-200">
            {connectionState === 'connected' ? 'Finding an opponent for you...' : connectionState === 'connecting' ? 'Establishing connection...' : 'Connection lost, reconnecting...'}
          </p>
        </div>

        <div className="p-8">
          {!isInLobby ? (
            /* Pre-lobby: Show mode selector and join button */
            <div className="space-y-6">
              <div className="text-center py-4">
                <h2 className="text-2xl font-bold text-stone-800 dark:text-white mb-2">
                  Choose Your Game Mode
                </h2>
                <p className="text-stone-600 dark:text-gray-400">
                  Select a mode and find an opponent
                </p>
              </div>

              <GameModeSelector
                selectedMode={selectedMode}
                onModeChange={handleModeChange}
                disabled={false}
              />

              <div className="pt-4">
                <Button
                  onClick={handleJoinLobby}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-4 rounded-xl font-semibold text-lg shadow-lg transition-all hover:shadow-xl"
                >
                  🎮 Find Match
                </Button>
              </div>
            </div>
          ) : (
            /* In lobby: Waiting state */
            <div className="space-y-6">
              {/* Mode indicator */}
              <div className="flex justify-center">
                <span className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full text-sm font-medium">
                  {modeInfo.icon} {modeInfo.name}
                </span>
              </div>

              <div className="text-center py-8">
                <div className="relative inline-flex items-center justify-center w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
                  <svg 
                    className="animate-spin h-10 w-10 text-blue-600 dark:text-blue-400" 
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
                <span className="absolute inset-0 rounded-full bg-blue-400/30 animate-ping" />
              </div>
              <h2 className="text-2xl font-bold text-stone-800 dark:text-white mb-2">
                Searching for opponent...
              </h2>
              <p className="text-sm text-stone-500 dark:text-gray-400 mb-2">
                Playing as: <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{displayName}</span>
              </p>
              <div className="flex flex-col items-center gap-1">
                <p className="text-stone-600 dark:text-gray-400">
                  {userPosition >= 0 && `Position in queue: ${userPosition + 1}`}
                </p>
                {estimatedWait && (
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                    {estimatedWait}
                  </p>
                )}
              </div>
            </div>

            {/* Rotating Tips */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-xl p-4 border border-indigo-100 dark:border-indigo-800/50 transition-all duration-300">
              <p className="text-sm text-indigo-700 dark:text-indigo-300 text-center min-h-[2.5rem] flex items-center justify-center">
                {currentTip}
              </p>
            </div>

            {/* Waiting Players List */}
            <div className="bg-stone-100 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-stone-700 dark:text-gray-300 mb-3">
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
                          ? 'bg-blue-100 dark:bg-blue-900 border-2 border-blue-500'
                          : 'bg-stone-50 dark:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="flex-shrink-0 w-8 h-8 bg-stone-200 dark:bg-gray-600 rounded-full flex items-center justify-center text-sm font-semibold text-stone-700 dark:text-gray-300">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium text-stone-800 dark:text-white font-mono">
                            {player.displayName}
                            {isCurrentUser && (
                              <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 font-semibold font-sans">
                                (You)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Waiting {waitTime}s
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Button
              onClick={handleLeaveLobby}
              className="w-full border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 py-3 rounded-lg transition-colors"
            >
              Leave Lobby
            </Button>
            </div>
          )}
        </div>

        {/* Info Footer */}
        <div className="bg-stone-100 dark:bg-gray-900 px-8 py-4 border-t border-stone-200 dark:border-gray-700">
          <p className="text-xs text-stone-600 dark:text-gray-400 text-center">
            Players are matched automatically on a first-come, first-served basis
          </p>
        </div>
      </div>
    </div>
  );
};

export default LobbyView;
