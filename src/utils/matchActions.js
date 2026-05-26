export const COMPACT_ACTION_BAR_WIDTH = 640;

const SCOPE_ACTIONS = {
  local: ["create", "find"],
  room: ["share", "leave"],
};

const ACTION_TEMPLATES = {
  new: {
    key: "new",
    label: "New Game",
    variant: "primary",
  },
  reset: {
    key: "reset",
    label: "Reset Scores",
    variant: "danger",
  },
  create: {
    key: "create",
    label: "Create Match",
    variant: "ghost",
  },
  find: {
    key: "find",
    label: "Find Match",
    variant: "primary",
  },
  share: {
    key: "share",
    label: "Share Room",
    copiedLabel: "Copied",
    variant: "primary",
  },
  leave: {
    key: "leave",
    label: "Leave",
    variant: "ghost",
  },
};

const ACTION_HANDLERS = {
  new: "onNewGame",
  reset: "onResetScores",
  create: "onCreateMatch",
  find: "onFindMatch",
  share: "onShare",
  leave: "onLeaveRoom",
};

export function getMatchActionState({
  hasMoves = false,
  canResetScore = false,
  isMultiplayer = false,
  roomId = null,
} = {}) {
  const scope = isMultiplayer ? "room" : "local";
  const activity = hasMoves ? "active" : "ready";
  const score = canResetScore ? "scored" : "clean";

  return {
    key: `${scope}.${activity}.${score}`,
    scope,
    activity,
    score,
    hasMoves: Boolean(hasMoves),
    canResetScore: Boolean(canResetScore),
    canShare: Boolean(isMultiplayer && roomId),
  };
}

export function getMatchActions(state, handlers = {}, shareState = {}) {
  const actionKeys = [
    ...(state.hasMoves ? ["new"] : []),
    ...(state.canResetScore ? ["reset"] : []),
    ...SCOPE_ACTIONS[state.scope],
  ].filter((key) => key !== "share" || state.canShare);

  return actionKeys.map((key) => {
    const template = ACTION_TEMPLATES[key];
    const label =
      key === "share" && shareState.copied ? template.copiedLabel : template.label;

    return {
      key,
      label,
      variant: template.variant,
      onClick: handlers[ACTION_HANDLERS[key]],
    };
  });
}

export function splitMatchActionsForLayout(actions, state, { compact = false } = {}) {
  if (!compact || actions.length <= 2) {
    return { visibleActions: actions, overflowActions: [] };
  }

  const primaryKey = state.hasMoves
    ? "new"
    : state.scope === "local"
      ? "find"
      : "share";
  const primaryAction =
    actions.find((action) => action.key === primaryKey) ??
    actions.find((action) => action.variant === "primary") ??
    actions[0];

  return {
    visibleActions: primaryAction ? [primaryAction] : [],
    overflowActions: actions.filter((action) => action.key !== primaryAction?.key),
  };
}
