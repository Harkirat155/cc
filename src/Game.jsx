import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import GameBoard from "./components/GameBoard";
import HistoryPanel from "./components/HistoryPanel";
import MenuPanel from "./components/MenuPanel";
import ResultModal from "./components/ResultModal";
import useSocketGame from "./hooks/useSocketGame";
import Navbar from "./components/Navbar";
import useVoiceChat from "./hooks/useVoiceChat";
import AudioRenderer from "./components/AudioRenderer";
import useWalkthrough from "./hooks/useWalkthrough";
import Walkthrough from "./components/Walkthrough";
import ScorePanel from "./components/ScorePanel";
import ToastStack from "./components/ui/ToastStack";
import PeoplePanel from "./components/PeoplePanel";

const Game = () => {
  const navigate = useNavigate();
  const { roomId: paramRoomId } = useParams();
  const {
    run: runWalkthrough,
    steps: walkthroughSteps,
    handleCallback: handleWalkthroughCallback,
    restart: restartWalkthrough,
  } = useWalkthrough();
  const {
    gameState,
    history,
    completedGames,
    viewIndex,
    displayedBoard,
    jumpTo,
    resumeLatest,
    message,
    roomId,
    player,
    isMultiplayer,
    showModal,
    newGameRequester,
    requestNewGame,
    cancelNewGameRequest,
    createRoom,
    joinRoom,
    handleSquareClick,
    resetGame,
    resetScores,
    leaveRoom,
    socketId,
    roster,
    voiceRoster,
    newGameRequestedAt,
    socket,
  } = useSocketGame();
  // Voice chat hook
  const { micEnabled, muted, remoteAudioStreams, enableMic, disableMic } =
    useVoiceChat({
      socket,
      roomId,
      selfId: socketId,
      roster,
      voiceRoster,
      initialMuted: true,
    });

  const handleToggleMic = () => {
    // Single-button behavior: ON = enabled + unmuted, OFF = disabled
    if (micEnabled && !muted) {
      // Currently ON -> turn OFF
      disableMic();
    } else {
      // Currently OFF -> turn ON (enable and unmute)
      enableMic(false);
    }
  };
  const winningSquares = gameState.winningLine || [];
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  // Prevent auto-join when user is actively leaving a room from a room URL
  const [suppressAutoJoin, setSuppressAutoJoin] = useState(false);
  const [toasts, setToasts] = useState([]);
  const lastToastRef = useRef({ text: null, at: 0 });

  const handleToggleHistory = () => {
    setIsHistoryOpen((prev) => !prev);
  };

  // winningSquares derived from multiplayer/local hook state

  useEffect(() => {
    if (!message) return undefined;
    const now = Date.now();
    const { text: lastText, at: lastAt } = lastToastRef.current || {};
    if (lastText === message && now - lastAt < 1500) return undefined;

    const id = `${now}-${Math.random().toString(36).slice(2)}`;
    const duration = 5000;

    setToasts((prev) => [...prev.slice(-3), { id, text: message, duration }]);
    lastToastRef.current = { text: message, at: now };

    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, duration);

    return () => window.clearTimeout(timer);
  }, [message]);

  const handleToastDismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // Auto-join a room when visiting /room/:roomId via a shared link
  useEffect(() => {
    const code = (paramRoomId || "").trim().toUpperCase();
    if (!code) return;
    // Only attempt auto-join if not already in a room
    if (!isMultiplayer && !suppressAutoJoin) {
      joinRoom(code);
    }
    // If already in a different room, do nothing for now to avoid multi-room state
  }, [paramRoomId, isMultiplayer, joinRoom, suppressAutoJoin]);

  // If room not found, redirect to root
  useEffect(() => {
    if ((paramRoomId || "").trim() && message === "Room not found") {
      navigate("/", { replace: true });
    }
  }, [paramRoomId, message, navigate]);

  // When we navigate away from a room URL, re-enable auto-join for future shares
  useEffect(() => {
    if (!paramRoomId && suppressAutoJoin) setSuppressAutoJoin(false);
  }, [paramRoomId, suppressAutoJoin]);

  // When a room is created (or joined manually), push the room URL so it matches the share link
  useEffect(() => {
    if (!roomId) return;
    const expected = `/room/${roomId}`;
    // Avoid redundant navigations if URL already has the same roomId
    if ((paramRoomId || "").toUpperCase() === (roomId || "").toUpperCase())
      return;
    navigate(expected);
  }, [roomId, navigate, paramRoomId]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-slate-100 text-slate-900 transition-colors duration-500 dark:bg-slate-950 dark:text-slate-100">
      <Walkthrough
        run={runWalkthrough}
        steps={walkthroughSteps}
        onCallback={handleWalkthroughCallback}
      />
      {/* Navbar with brand + actions */}
      <Navbar
        onToggleHistory={handleToggleHistory}
        isHistoryOpen={isHistoryOpen}
        isMultiplayer={isMultiplayer}
        onShowWalkthrough={restartWalkthrough}
        voiceEnabled={micEnabled}
        micMuted={muted}
        onToggleMic={handleToggleMic}
        menuPanel={
          isMultiplayer ? (
            <PeoplePanel
              roster={roster}
              socketId={socketId}
              isMultiplayer={isMultiplayer}
              roomId={roomId}
              voiceRoster={voiceRoster}
              variant="menu"
            />
          ) : null
        }
      />
      {/* push content below navbar height */}
      <div className="h-20" />
      {/* Hidden audio elements for remote peers */}
      <AudioRenderer streamsById={remoteAudioStreams} />
      <main className="relative z-0 flex w-full flex-1 justify-center px-4">
        <div className="flex w-full max-w-5xl flex-col items-center gap-10">
          <ScorePanel
            gameState={gameState}
            roster={roster}
            socketId={socketId}
            isMultiplayer={isMultiplayer}
            roomId={roomId}
          />
          <div className="relative flex w-full flex-col items-center gap-8">
            <GameBoard
              squares={displayedBoard}
              onSquareClick={handleSquareClick}
              winningSquares={winningSquares}
            />
            <MenuPanel
              onReset={resetScores}
              onNewGame={resetGame}
              hasMoves={history.length > 1}
              canResetScore={gameState.xScore !== 0 || gameState.oScore !== 0}
              createRoom={createRoom}
              leaveRoom={async () => {
                setSuppressAutoJoin(true);
                await leaveRoom();
                navigate("/", { replace: true });
              }}
              isMultiplayer={isMultiplayer}
              roomId={roomId}
            />
          </div>
        </div>
      </main>
      {/* Slide-over panels */}
      {/* History Panel (right slide-over) */}
      <div
        className={`fixed top-16 right-0 bottom-0 z-40 w-80 max-w-[85vw] transform border-l border-slate-200/70 bg-white/80 backdrop-blur-xl shadow-xl transition-transform duration-300 dark:border-slate-700/70 dark:bg-slate-950/70 ${
          isHistoryOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <HistoryPanel
          history={history}
          completedGames={completedGames}
          viewIndex={viewIndex}
          jumpTo={jumpTo}
          resumeLatest={resumeLatest}
          onClose={() => setIsHistoryOpen(false)}
          roster={roster}
          socketId={socketId}
          isMultiplayer={isMultiplayer}
          youAre={player}
          currentTurn={gameState.turn}
          winner={gameState.winner}
        />
      </div>
      {showModal && (
        <ResultModal
          result={
            gameState.winner === "draw"
              ? "Draw!"
              : gameState.winner
              ? `${gameState.winner} Wins!`
              : "Game Over"
          }
          onStartNewLocal={resetGame}
          onJoinNewGame={resetGame}
          onLeaveRoom={async () => {
            setSuppressAutoJoin(true);
            await leaveRoom();
            navigate("/", { replace: true });
          }}
          isMultiplayer={isMultiplayer}
          player={player}
          newGameRequester={newGameRequester}
          requestNewGame={requestNewGame}
          cancelNewGameRequest={() => {
            cancelNewGameRequest();
          }}
          socketId={socketId}
          newGameRequestedAt={newGameRequestedAt}
          rematchTimeoutSec={20}
        />
      )}
      <ToastStack messages={toasts} onDismiss={handleToastDismiss} />
    </div>
  );
};

export default Game;
