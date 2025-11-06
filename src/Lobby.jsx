import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LobbyView from './components/LobbyView';
import useSocketGame from './hooks/useSocketGame';

/**
 * Lobby Page - Matchmaking lobby container
 * Single Responsibility: Connect LobbyView to game hooks and handle routing
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
  } = useSocketGame();

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
      onJoinLobby={joinLobby}
      onLeaveLobby={leaveLobby}
      socketId={socketId}
    />
  );
};

export default Lobby;
