import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import LobbyView from './components/LobbyView';
import useSocketGame from './hooks/useSocketGame';

/**
 * Lobby Page - Matchmaking lobby container
 * Single Responsibility: Connect LobbyView to game hooks and handle routing
 * Uses the centralized display name from useSocketGame
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
  } = useSocketGame();

  const hasJoinedRef = useRef(false);

  // Auto-join lobby on mount with generated name
  useEffect(() => {
    if (!hasJoinedRef.current && !isInLobby && displayName) {
      hasJoinedRef.current = true;
      joinLobby(displayName).catch((err) => {
        console.error('Failed to join lobby:', err);
      });
    }
  }, [displayName, isInLobby, joinLobby]);

  // Auto-redirect to game when matched
  useEffect(() => {
    if (roomId && !isInLobby) {
      navigate(`/room/${roomId}`, { replace: true });
    }
  }, [roomId, isInLobby, navigate]);

  return (
    <LobbyView
      lobbyQueue={lobbyQueue}
      isInLobby={isInLobby}
      onLeaveLobby={leaveLobby}
      socketId={socketId}
      displayName={displayName}
    />
  );
};

export default Lobby;
