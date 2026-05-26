import React, { useEffect, useMemo, useRef, useState } from "react";
import useShare from "../hooks/useShare";
import useWindowSize from "../hooks/useWindowSize";
import {
  COMPACT_ACTION_BAR_WIDTH,
  getMatchActions,
  getMatchActionState,
  splitMatchActionsForLayout,
} from "../utils/matchActions";

const cx = (...classes) => classes.filter(Boolean).join(" ");

const buttonStyles = {
  primary:
    "bg-foreground text-background hover:opacity-90 shadow-[0_0_20px_rgba(0,0,0,0.1)] dark:shadow-[0_0_20px_rgba(255,255,255,0.2)]",
  ghost:
    "border border-foreground/10 bg-foreground/[0.03] text-foreground hover:bg-foreground/[0.08]",
  danger:
    "border border-rose-500/20 bg-rose-500/10 text-rose-600 hover:bg-rose-500/15 dark:text-rose-300",
};

const ActionButton = React.forwardRef(function ActionButton(
  { variant = "ghost", className = "", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cx(
        "inline-flex h-11 shrink-0 items-center justify-center rounded-full px-6 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:cursor-not-allowed disabled:opacity-50 sm:h-12 sm:px-8",
        buttonStyles[variant],
        className
      )}
      {...props}
    />
  );
});

const MatchActionBar = ({
  hasMoves,
  canResetScore,
  isMultiplayer,
  roomId,
  onNewGame,
  onResetScores,
  onCreateMatch,
  onFindMatch,
  onLeaveRoom,
}) => {
  const { copied, share } = useShare({ roomId });
  const { width } = useWindowSize();
  const isCompact = width > 0 && width < COMPACT_ACTION_BAR_WIDTH;
  const moreButtonRef = useRef(null);
  const overflowRef = useRef(null);
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);

  const actionState = useMemo(
    () => getMatchActionState({ hasMoves, canResetScore, isMultiplayer, roomId }),
    [canResetScore, hasMoves, isMultiplayer, roomId]
  );
  const actions = useMemo(
    () =>
      getMatchActions(
        actionState,
        {
          onCreateMatch,
          onFindMatch,
          onLeaveRoom,
          onNewGame,
          onResetScores,
          onShare: share,
        },
        { copied }
      ),
    [
      actionState,
      copied,
      onCreateMatch,
      onFindMatch,
      onLeaveRoom,
      onNewGame,
      onResetScores,
      share,
    ]
  );
  const { visibleActions, overflowActions } = useMemo(
    () => splitMatchActionsForLayout(actions, actionState, { compact: isCompact }),
    [actionState, actions, isCompact]
  );

  useEffect(() => {
    setIsOverflowOpen(false);
  }, [actionState.key, isCompact]);

  useEffect(() => {
    if (!isOverflowOpen) return undefined;

    const handlePointerDown = (event) => {
      const target = event.target;
      if (
        overflowRef.current?.contains(target) ||
        moreButtonRef.current?.contains(target)
      ) {
        return;
      }
      setIsOverflowOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsOverflowOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOverflowOpen]);

  const runAction = (action) => {
    setIsOverflowOpen(false);
    action.onClick?.();
  };

  if (actions.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-4 bottom-5 z-30 flex justify-center sm:bottom-6"
      data-tour="menu"
      data-state={actionState.key}
      aria-label="Match actions"
    >
      <div className="pointer-events-auto relative flex max-w-full items-center justify-center gap-3 px-1 py-1 sm:gap-4">
        {visibleActions.map((action) => (
          <ActionButton
            key={action.key}
            variant={action.variant}
            onClick={() => runAction(action)}
            aria-label={action.label}
          >
            {action.label}
          </ActionButton>
        ))}
        {overflowActions.length > 0 && (
          <ActionButton
            ref={moreButtonRef}
            variant="ghost"
            aria-expanded={isOverflowOpen}
            aria-haspopup="menu"
            aria-label="More match actions"
            onClick={() => setIsOverflowOpen((open) => !open)}
          >
            More
          </ActionButton>
        )}
        {overflowActions.length > 0 && isOverflowOpen && (
          <div
            ref={overflowRef}
            className="absolute bottom-[calc(100%+0.75rem)] left-1/2 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 rounded-[1.5rem] border border-foreground/10 bg-background/90 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.22)] backdrop-blur-xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
            role="menu"
            aria-label="More match actions"
          >
            <div className="flex flex-col gap-1">
              {overflowActions.map((action) => (
                <ActionButton
                  key={action.key}
                  role="menuitem"
                  variant={action.variant}
                  className="h-10 w-full justify-center px-4 text-xs sm:h-10"
                  onClick={() => runAction(action)}
                  aria-label={action.label}
                >
                  {action.label}
                </ActionButton>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchActionBar;
