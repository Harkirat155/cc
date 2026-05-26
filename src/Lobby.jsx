import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import LobbyView from './components/LobbyView';
import useSocketGame from './hooks/useSocketGame';
import '@shared/games/index.js';
import { get as getGameRules } from '@shared/games/registry.js';
import { getGamePalette } from './components/games/palette';

/**
 * Lobby Page - Matchmaking lobby container
 * Single Responsibility: Connect LobbyView to game hooks and handle routing
 * Uses the centralized display name from useSocketGame
 * Follows Dependency Inversion - depends on abstractions (hooks) not concrete implementations
 */
const Lobby = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    gameState,
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
  const preferredGameId = useMemo(() => {
    const requested = searchParams.get('game') || gameState?.gameId || 'ttt';
    const normalized = requested.trim().toLowerCase();
    try {
      getGameRules(normalized);
      return normalized;
    } catch {
      return 'ttt';
    }
  }, [gameState?.gameId, searchParams]);

  // Auto-join lobby on mount with generated name
  useEffect(() => {
    if (!hasJoinedRef.current && !isInLobby && displayName) {
      hasJoinedRef.current = true;
      
      joinLobby(displayName, preferredGameId).catch((err) => {
        hasJoinedRef.current = false;
        console.error('Failed to join lobby:', err);
      });
    }
  }, [displayName, isInLobby, joinLobby, preferredGameId]);

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

  const glowClass = getGamePalette(preferredGameId).p1.glow;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground font-sans selection:bg-foreground/10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
      >
        <div
          className={`h-[60vw] w-[60vw] rounded-full opacity-[0.04] blur-[100px] transition-colors duration-1000 ${glowClass}`}
        />
      </div>
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8">
        <LobbyView
          lobbyQueue={lobbyQueue}
          isInLobby={isInLobby}
          onLeaveLobby={handleLeaveLobby}
          socketId={socketId}
          displayName={displayName}
          connectionState={connectionState}
          preferredGameId={preferredGameId}
        />
      </main>
    </div>
  );
};

export default Lobby;
