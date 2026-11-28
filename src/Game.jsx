import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import GameBoard from "./components/GameBoard";
import HistoryPanel from "./components/HistoryPanel";
import MatchActionBar from "./components/MatchActionBar";
import ResultModal from "./components/ResultModal";
import WinnerCard from "./components/WinnerCard";
import GameSelector from "./components/GameSelector";
import useSocketGame from "./hooks/useSocketGame";
import { reactionsSupported } from "./utils/socketManager";
import Navbar from "./components/Navbar";
import useVoiceChat from "./hooks/useVoiceChat";
import AudioRenderer from "./components/AudioRenderer";
import useWalkthrough from "./hooks/useWalkthrough";
import Walkthrough from "./components/Walkthrough";
import ScorePanel from "./components/ScorePanel";
import PeoplePanel from "./components/PeoplePanel";
import FeedbackDialog from "./components/FeedbackDialog";
import OpponentControl from "./components/OpponentControl";
import HomeDoors from "./components/HomeDoors";
import RoomActions from "./components/RoomActions";
import NoSignal from "./components/NoSignal";
import useOnline from "./hooks/useOnline";
import useGameSounds from "./hooks/useGameSounds";
import { viewerSlotFor } from "./utils/sound";
import useOpponent from "./hooks/useOpponent";
import useInviteArrival from "./hooks/useInviteArrival";
import { getGamePalette } from "./components/games/palette";
import { tally } from "./lib/tally";

const Game = () => {
  const navigate = useNavigate();
  const online = useOnline();
  const { roomId: paramRoomId } = useParams();
  const [searchParams] = useSearchParams();
  // Allow deep-linking a game variant: /?game=connect4 will create rooms with
  // gameId='connect4'. Unknown values fall through and the server picks the
  // default ('ttt'), so this is safe to feed user input.
  const requestedGameId = searchParams.get("game") || null;
  useInviteArrival();
  const { opponent, botSlot, setOpponent } = useOpponent();
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
    selection,
    legalTargets,
    resetGame,
    resetScores,
    switchGame,
    leaveRoom,
    socketId,
    roster,
    voiceRoster,
    newGameRequestedAt,
    emote,
    sendRoomAction,
    socket,
    connectionState,
    displayName,
    updateDisplayName,
  } = useSocketGame({ botSlot, botLevel: opponent.level });

  // Usage counts for the progress board (tally: counts only, no identifiers).
  useEffect(() => { tally("cc", "view"); }, []);
  const finishedGameId = gameState?.winner ? gameState.gameId || "ttt" : null;
  const finishedMode = isMultiplayer ? "online_game" : botSlot !== null ? "vs_computer" : "local_game";
  useEffect(() => {
    if (!finishedGameId) return;
    tally("cc", finishedMode);
    tally("cc", `finished_${finishedGameId}`);
  }, [finishedGameId]); // eslint-disable-line react-hooks/exhaustive-deps
  useGameSounds(gameState, viewerSlotFor({ player, isMultiplayer, botSlot }), `${roomId}|${connectionState}`);
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
  // The cell filled by the move shown on the board: diff with the previous snapshot.
  const prevSquares = history?.[Math.min(viewIndex, history.length - 1) - 1]?.squares;
  const lastIdx = prevSquares ? displayedBoard.findIndex((v, i) => v && !prevSquares[i]) : -1;
  const lastMove = lastIdx >= 0 ? lastIdx : null;
  const activeGlowClass = useMemo(() => {
    const palette = getGamePalette(gameState?.gameId);
    const turnSlot = Number.isInteger(gameState?.turnSlot)
      ? gameState.turnSlot
      : gameState?.turn === gameState?.playerInfo?.[1]?.label
      ? 1
      : 0;
    return turnSlot === 1 ? palette.p2.glow : palette.p1.glow;
  }, [gameState?.gameId, gameState?.playerInfo, gameState?.turn, gameState?.turnSlot]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const suppressAutoJoinRef = useRef(false);
  const feedbackAbortRef = useRef(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const feedbackEndpoint = useMemo(() => {
    const resolveBase = () => {
      const apiBase = import.meta.env.VITE_API_BASE?.trim();
      if (apiBase) return apiBase;
      const socketBase = import.meta.env.VITE_SOCKET_SERVER?.trim();
      if (socketBase) return socketBase;
      if (typeof window !== "undefined") {
        const origin = window.location.origin || "";
        if (/:\d+$/.test(origin)) {
          return origin.replace(/:\d+$/, ":5123");
        }
        return origin;
      }
      return "";
    };

    const base = resolveBase();
    if (!base) return "/feedback";
    const normalized = base.endsWith("/") ? base.slice(0, -1) : base;
    return `${normalized}/feedback`;
  }, []);

  const handleToggleHistory = () => {
    setIsHistoryOpen((prev) => !prev);
  };

  // winningSquares derived from multiplayer/local hook state

  const openFeedbackForm = useCallback(() => {
    setFeedbackError("");
    setIsFeedbackOpen(true);
  }, []);

  const closeFeedbackForm = useCallback(() => {
    if (feedbackAbortRef.current) {
      feedbackAbortRef.current.abort?.();
      feedbackAbortRef.current = null;
    }
    setIsFeedbackSubmitting(false);
    setIsFeedbackOpen(false);
  }, []);

  const handleFeedbackSubmit = useCallback(
    async ({ rating, message: feedbackMessage }) => {
      setFeedbackError("");
      setIsFeedbackSubmitting(true);

      if (feedbackAbortRef.current) {
        feedbackAbortRef.current.abort();
      }

      const abortCtor = globalThis.AbortController;
      const controller = abortCtor ? new abortCtor() : null;
      feedbackAbortRef.current = controller;

      try {
        const payload = {
          rating,
          message: feedbackMessage,
          context: {
            roomId,
            isMultiplayer,
            socketId,
            url:
              typeof window !== "undefined" ? window.location.href : undefined,
            userAgent:
              typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          },
        };

        const fetchFn = globalThis.fetch;
        if (!fetchFn) {
          throw new Error("Feedback API unavailable in this browser.");
        }

        const response = await fetchFn(feedbackEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller?.signal,
        });

        feedbackAbortRef.current = null;

        if (!response.ok) {
          let errorDetail = "";
          try {
            const data = await response.json();
            errorDetail = data?.error || data?.message || "";
          } catch (parseError) {
            console.error("Failed to parse feedback response", parseError);
          }
          throw new Error(
            errorDetail || "We couldn't send your feedback. Please try again."
          );
        }
        setIsFeedbackSubmitting(false);
        setIsFeedbackOpen(false);
      } catch (error) {
        feedbackAbortRef.current = null;
        if (error?.name === "AbortError") {
          setIsFeedbackSubmitting(false);
          return;
        }
        console.error("Feedback submission failed", error);
        const description =
          error?.message || "We couldn't send your feedback. Please try again.";
        setFeedbackError(description);
        setIsFeedbackSubmitting(false);
      }
    },
    [feedbackEndpoint, isMultiplayer, roomId, socketId]
  );

  const menuItems = useMemo(
    () => [
      {
        key: "live",
        label: "Watch live games",
        description: "See games in progress and join as a spectator",
        onSelect: () => navigate("/live"),
      },
      {
        key: "feedback",
        label: "Send feedback",
        description: "Rate your experience and share ideas",
        onSelect: openFeedbackForm,
      },
    ],
    [openFeedbackForm, navigate]
  );

  // Auto-join a room when visiting /room/:roomId via a shared link
  useEffect(() => {
    const code = (paramRoomId || "").trim().toUpperCase();
    if (!code) return;
    // Only attempt auto-join if not already in a room
    if (!isMultiplayer && !suppressAutoJoinRef.current) {
      joinRoom(code);
    }
    // If already in a different room, do nothing for now to avoid multi-room state
  }, [paramRoomId, isMultiplayer, joinRoom]);

  // If room not found, redirect to root
  useEffect(() => {
    if ((paramRoomId || "").trim() && message === "Room not found") {
      navigate("/", { replace: true });
    }
  }, [paramRoomId, message, navigate]);

  // When we navigate away from a room URL, re-enable auto-join for future shares
  useEffect(() => {
    if (!paramRoomId) suppressAutoJoinRef.current = false;
  }, [paramRoomId]);

  // When a room is created (or joined manually), push the room URL so it matches the share link
  useEffect(() => {
    if (!roomId) return;
    const expected = `/room/${roomId}`;
    // Avoid redundant navigations if URL already has the same roomId
    if ((paramRoomId || "").toUpperCase() === (roomId || "").toUpperCase())
      return;
    navigate(expected);
  }, [roomId, navigate, paramRoomId]);

  const handleCreateMatch = useCallback(() => {
    const gameId = gameState?.gameId || requestedGameId;
    tally("cc", `room_create_${gameId || "ttt"}`);
    createRoom(gameId);
  }, [createRoom, gameState?.gameId, requestedGameId]);

  const handleFindMatch = useCallback(() => {
    const gameId = gameState?.gameId || requestedGameId;
    navigate({
      pathname: "/lobby",
      search: gameId && gameId !== "ttt" ? `?game=${encodeURIComponent(gameId)}` : "",
    });
  }, [gameState?.gameId, navigate, requestedGameId]);
  const canResetScore = Array.isArray(gameState?.scores)
    ? gameState.scores.some((score) => score !== 0)
    : gameState.xScore !== 0 || gameState.oScore !== 0;
  const winnerCardResult = !isMultiplayer ? gameState.winner : null;
  const shouldShowResultModal =
    isMultiplayer && showModal && Boolean(gameState.winner);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground font-sans selection:bg-foreground/10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
      >
        <div
          className={`h-[60vw] w-[60vw] rounded-full opacity-[0.04] blur-[100px] transition-colors duration-1000 ${activeGlowClass}`}
        />
      </div>
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
        connectionState={connectionState}
        currentGameId={gameState?.gameId}
        onSwitchGame={!isMultiplayer || player ? switchGame : null}
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
        menuItems={menuItems}
      />
      {/* Hidden audio elements for remote peers */}
      <AudioRenderer streamsById={remoteAudioStreams} />
      <main className="relative z-10 flex w-full flex-1 justify-center px-4 pb-28 pt-7 sm:pb-32 sm:pt-8">
        <div className="flex w-full max-w-5xl flex-col items-center gap-8 sm:gap-10">
          <GameSelector
            variant="mobile"
            isMultiplayer={isMultiplayer}
            currentGameId={gameState?.gameId}
            onSwitchGame={!isMultiplayer || player ? switchGame : null}
          />
          {!isMultiplayer && (
            <OpponentControl
              opponent={opponent}
              onChange={(patch) => {
                setOpponent(patch);
                // A new seat or opponent mid-game would hand one side's pieces to the other.
                if ("humanSlot" in patch || "mode" in patch) resetGame();
              }}
            />
          )}
          {paramRoomId && !online && <NoSignal>This room needs a connection.</NoSignal>}
          {!isMultiplayer && history.length <= 1 && (
            <HomeDoors
              onComputer={() => { setOpponent({ mode: "computer" }); resetGame(); }}
              onFriend={handleCreateMatch}
            />
          )}
          {!isMultiplayer && history.length > 1 && (
            <p className="-mt-4 text-sm text-foreground/60">
              Daily puzzle: win in 2 or 3. <Link to="/daily" className="underline underline-offset-4">Play today&apos;s</Link>
              {" · "}<Link to="/rush" className="underline underline-offset-4">Puzzle Rush</Link>
            </p>
          )}
          <ScorePanel
            gameState={gameState}
            roster={roster}
            socketId={socketId}
            isMultiplayer={isMultiplayer}
            displayName={displayName}
            onUpdateDisplayName={updateDisplayName}
            emote={emote}
          />
          <div className="relative flex w-full flex-col items-center gap-8">
            <div className="relative w-full">
              <GameBoard
                squares={displayedBoard}
                onSquareClick={handleSquareClick}
                winningSquares={winningSquares}
                rows={gameState?.boardSpec?.rows}
                cols={gameState?.boardSpec?.cols}
                playerInfo={gameState?.playerInfo}
                boardSpec={gameState?.boardSpec}
                moveStyle={gameState?.moveStyle}
                selection={selection}
                legalTargets={legalTargets}
                lastMove={lastMove}
              />
              <WinnerCard
                winner={winnerCardResult}
                winnerSlot={gameState.winnerSlot}
                gameId={gameState?.gameId}
                playerInfo={gameState?.playerInfo}
                onReset={resetGame}
                onFriend={handleCreateMatch}
              />
            </div>
          </div>
          {isMultiplayer && player && (
            <RoomActions
              gameState={gameState}
              socketId={socketId}
              roster={roster}
              onAction={sendRoomAction}
              reactions={reactionsSupported()}
            />
          )}
        </div>
      </main>
      <MatchActionBar
        hasMoves={history.length > 1}
        canResetScore={canResetScore}
        isMultiplayer={isMultiplayer}
        roomId={roomId}
        gameId={gameState?.gameId || requestedGameId}
        onNewGame={resetGame}
        onResetScores={resetScores}
        onCreateMatch={handleCreateMatch}
        onFindMatch={handleFindMatch}
        onLeaveRoom={async () => {
          suppressAutoJoinRef.current = true;
          await leaveRoom();
          navigate("/", { replace: true });
        }}
      />
      {/* Slide-over panels */}
      {/* History Panel (right slide-over) */}
      <div
        className={`fixed top-16 right-0 bottom-0 z-40 w-80 max-w-[85vw] transform border-l border-foreground/10 bg-background/90 shadow-xl backdrop-blur-xl transition-transform duration-300 ${
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
      {shouldShowResultModal && (
        <ResultModal
          result={
            gameState.winner === "draw"
              ? "Draw!"
              : gameState.winner
              ? `${gameState.winner} Wins!`
              : "Game Over"
          }
          onAcceptRematch={resetGame}
          onLeaveRoom={async () => {
            suppressAutoJoinRef.current = true;
            await leaveRoom();
            navigate("/", { replace: true });
          }}
          player={player}
          roster={roster}
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
      <FeedbackDialog
        open={isFeedbackOpen}
        onClose={closeFeedbackForm}
        onSubmit={handleFeedbackSubmit}
        submitting={isFeedbackSubmitting}
        errorMessage={feedbackError}
      />
    </div>
  );
};

export default Game;
