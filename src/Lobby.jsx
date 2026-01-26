import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LobbyView from './components/LobbyView';
import useSocketGame from './hooks/useSocketGame';
import { getPersistedMode } from './utils/gameMode';

/**
 * Lobby Page - Matchmaking lobby container
 * Single Responsibility: Connect LobbyView to game hooks and handle routing
 * Uses the centralized display name from useSocketGame
 * Follows Dependency Inversion - depends on abstractions (hooks) not concrete implementations
 */
const Lobby = () => {
  const navigate = useNavigate();
  const {
    lobbyQueue,
    isInLobby,
    joinLobby,
    leaveLobby,
    socketId,
    roomId,
    displayName,
    connectionState,
    gameMode,
    changeGameMode,
  } = useSocketGame();

  const [selectedMode, setSelectedMode] = useState(() => getPersistedMode());
  const hasJoinedRef = useRef(false);

  // Handle mode change before joining lobby
  const handleModeChange = useCallback((mode) => {
    setSelectedMode(mode);
    changeGameMode(mode);
  }, [changeGameMode]);

  // Handle join lobby with selected mode
  const handleJoinLobby = useCallback(() => {
    if (!hasJoinedRef.current && displayName) {
      hasJoinedRef.current = true;
      
      joinLobby(displayName)
        .then(() => {
          console.log('[Lobby] Successfully joined lobby with mode:', selectedMode);
        })
        .catch((err) => {
          hasJoinedRef.current = false;
          console.error('Failed to join lobby:', err);
        });
    }
  }, [displayName, joinLobby, selectedMode]);

  // Leave lobby on unmount
  useEffect(() => {
    return () => {
      if (hasJoinedRef.current && isInLobby) {
        leaveLobby();
      }
    };
  }, [isInLobby, leaveLobby]);

  // Auto-redirect to game when matched
  useEffect(() => {
    if (roomId && !isInLobby) {
      navigate(`/room/${roomId}`, { replace: true });
    }
  }, [roomId, isInLobby, navigate]);

  // Handle manual leave
  const handleLeaveLobby = useCallback(() => {
    hasJoinedRef.current = false;
    leaveLobby().then(() => {
      navigate('/', { replace: true });
    });
  }, [leaveLobby, navigate]);

  return (
    <LobbyView
      lobbyQueue={lobbyQueue}
      isInLobby={isInLobby}
      onJoinLobby={handleJoinLobby}
      onLeaveLobby={handleLeaveLobby}
      socketId={socketId}
      displayName={displayName}
      connectionState={connectionState}
      gameMode={selectedMode}
      onGameModeChange={handleModeChange}
    />
  );
};

export default Lobby;
