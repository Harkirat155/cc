import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from './ui/Button';

/**
 * LobbyView - Matchmaking lobby interface
 * Single Responsibility: Display lobby UI and handle user interactions
 */
const LobbyView = ({ 
  lobbyQueue = [], 
  isInLobby = false, 
  onJoinLobby, 
  onLeaveLobby,
  socketId 
}) => {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [nameError, setNameError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Load saved display name from localStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('cc_display_name');
        if (saved) {
          setDisplayName(saved);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const validateName = useCallback((name) => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      return 'Name must be at least 2 characters';
    }
    if (trimmed.length > 20) {
      return 'Name must be 20 characters or less';
    }
    return null;
  }, []);

  const handleJoinLobby = useCallback(async () => {
    const error = validateName(displayName);
    if (error) {
      setNameError(error);
      return;
    }

    setNameError('');
    setIsJoining(true);

    try {
      // Save display name for future use
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('cc_display_name', displayName.trim());
      }
      
      await onJoinLobby(displayName.trim());
    } catch (err) {
      setNameError(err.message || 'Failed to join lobby');
    } finally {
      setIsJoining(false);
    }
  }, [displayName, onJoinLobby, validateName]);

  const handleLeaveLobby = useCallback(() => {
    onLeaveLobby();
  }, [onLeaveLobby]);

  const handleInputChange = useCallback((e) => {
    setDisplayName(e.target.value);
    if (nameError) setNameError('');
  }, [nameError]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !isInLobby) {
      handleJoinLobby();
    }
  }, [isInLobby, handleJoinLobby]);

  // Calculate user's position in queue
  const userPosition = lobbyQueue.findIndex(p => p.socketId === socketId);

  // Current timestamp, updating every second
  const [now, setNow] = useState(Date.now());
  
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 px-8 py-6">
          <h1 className="text-3xl font-bold text-white mb-2">Matchmaking Lobby</h1>
          <p className="text-blue-100 dark:text-blue-200">
            Find an opponent and start playing!
          </p>
        </div>

        <div className="p-8">
          {!isInLobby ? (
            /* Join Lobby Form */
            <div className="space-y-6">
              <div>
                <label 
                  htmlFor="displayName" 
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Display Name
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyPress}
                  placeholder="Enter your name..."
                  maxLength={20}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                    nameError
                      ? 'border-red-500 focus:ring-red-500 dark:border-red-400'
                      : 'border-gray-300 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
                  }`}
                  disabled={isJoining}
                />
                {nameError && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {nameError}
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  2-20 characters • This will be shown to your opponent
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleJoinLobby}
                  disabled={isJoining || !displayName.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isJoining ? 'Joining...' : 'Join Lobby'}
                </Button>
                <Button
                  onClick={() => navigate('/')}
                  className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Back
                </Button>
              </div>

              {/* Current Queue Preview */}
              {lobbyQueue.length > 0 && (
                <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Players Waiting: {lobbyQueue.length}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {lobbyQueue.length === 1 
                      ? '1 player is waiting for an opponent'
                      : `${lobbyQueue.length} players are waiting`}
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* In Lobby - Waiting */
            <div className="space-y-6">
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
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
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                  Searching for opponent...
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {userPosition >= 0 && `Position in queue: ${userPosition + 1}`}
                </p>
              </div>

              {/* Waiting Players List */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
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
                            : 'bg-white dark:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <span className="flex-shrink-0 w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {player.displayName}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 font-semibold">
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
        <div className="bg-gray-50 dark:bg-gray-900 px-8 py-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
            Players are matched automatically on a first-come, first-served basis
          </p>
        </div>
      </div>
    </div>
  );
};

export default LobbyView;
