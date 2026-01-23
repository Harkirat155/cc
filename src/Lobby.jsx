import React, { useEffect, useRef, useCallback } from 'react';
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
    connectionState,
  } = useSocketGame();

  const hasJoinedRef = useRef(false);
  const isMountedRef = useRef(true);

  // Track mount state to prevent state updates on unmounted component
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Auto-join lobby on mount with generated name
  // The joinLobby function now handles waiting for connection internally
  useEffect(() => {
    if (!hasJoinedRef.current && !isInLobby && displayName) {
      hasJoinedRef.current = true;
      
      joinLobby(displayName)
        .then(() => {
          if (isMountedRef.current) {
            console.log('[Lobby] Successfully joined lobby');
          }
        })
        .catch((err) => {
          if (isMountedRef.current) {
            hasJoinedRef.current = false;
            console.error('Failed to join lobby:', err);
          }
        });
    }
  }, [displayName, isInLobby, joinLobby]);

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
      onLeaveLobby={handleLeaveLobby}
      socketId={socketId}
      displayName={displayName}
      connectionState={connectionState}
    />
  );
};

export default Lobby;
