import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LobbyView from './components/LobbyView';
import useSocketGame from './hooks/useSocketGame';

// Lobby retry configuration
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 5000;
const MAX_RETRY_ATTEMPTS = 3;

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
  const [retryCount, setRetryCount] = useState(0);
  const retryTimeoutRef = useRef(null);

  // Track mount state to prevent state updates on unmounted component
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Auto-join lobby on mount with generated name
  // Retries on failure with exponential backoff (up to MAX_RETRY_ATTEMPTS)
  useEffect(() => {
    if (!hasJoinedRef.current && !isInLobby && displayName && retryCount < MAX_RETRY_ATTEMPTS) {
      hasJoinedRef.current = true;
      
      joinLobby(displayName)
        .then(() => {
          if (isMountedRef.current) {
            console.log('[Lobby] Successfully joined lobby');
            setRetryCount(0); // Reset retry count on success
          }
        })
        .catch((err) => {
          if (isMountedRef.current) {
            hasJoinedRef.current = false;
            console.error(`Failed to join lobby (attempt ${retryCount + 1}):`, err);
            
            // Retry with exponential backoff if under max attempts
            if (retryCount < MAX_RETRY_ATTEMPTS - 1) {
              const delay = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, retryCount), MAX_RETRY_DELAY_MS);
              console.log(`Retrying in ${delay}ms...`);
              retryTimeoutRef.current = setTimeout(() => {
                setRetryCount(prev => prev + 1);
              }, delay);
            }
          }
        });
    }
  }, [displayName, isInLobby, joinLobby, retryCount]);

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
