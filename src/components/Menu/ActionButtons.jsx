import React from "react";
import Button from "../ui/Button.jsx";
import { Tooltip } from "../ui/Tooltip.jsx";

const truncate = (value, length = 36) => {
  if (!value) return value;
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1)}…`;
};

export default function ActionButtons({
  stacked = false,
  width,
  flags,
  onNewGame,
  onReset,
  onCreateRoom,
  onFindMatch,
  onShare,
  onLeave,
  copied,
}) {
  const layout = stacked ? "flex-col w-auto" : width > 300 ? "flex-row w-full" : "flex-col w-full";
  const tooltipSide = stacked ? "left" : "top";
  const tooltipOffset = stacked ? 12 : 8;
  const tooltipAlign = "center";

  const shareTooltip = copied
    ? "Link copied to clipboard"
    : typeof flags.shareUrl === "string" && flags.shareUrl.length > 0
      ? truncate(flags.shareUrl)
      : "Share this room link";

  const actions = [
    {
      key: "new",
      show: flags.showNewGame,
      variant: "primary",
      tooltip: "Start a new game from the beginning",
      onClick: onNewGame,
      label: "New",
      children: <span className="px-2 whitespace-nowrap">New</span>,
    },
    {
      key: "reset",
      show: flags.showResetScore,
      variant: "danger",
      tooltip: "Reset the scoreboard for both players",
      onClick: onReset,
      label: "Reset",
      children: <span className="px-2 whitespace-nowrap">Reset</span>,
    },
    {
      key: "create",
      show: flags.showCreateRoom,
      variant: "success",
      tooltip: "Create a multiplayer room",
      onClick: onCreateRoom,
      label: "Create",
    },
    {
      key: "findmatch",
      show: flags.showFindMatch,
      variant: "indigo",
      tooltip: "Find a random opponent in matchmaking lobby",
      onClick: onFindMatch,
      label: "Find Match",
      children: <span className="px-2 whitespace-nowrap">Find Match</span>,
    },
    {
      key: "share",
      show: flags.showShare,
      variant: "purple",
      tooltip: shareTooltip,
      onClick: onShare,
      label: copied ? "Copied" : "Share",
      ariaLabel: copied ? "Link copied to clipboard" : "Share room link",
    },
    {
      key: "leave",
      show: flags.showLeave,
      variant: "neutral",
      tooltip: "Leave the current room",
      onClick: onLeave,
      label: "Leave",
    },
  ].filter((action) => action.show);

  return (
    <div className={`flex ${layout} gap-3 items-center justify-center`}>
      {actions.map(({ key, tooltip, variant, onClick, label, ariaLabel, children }) => (
        <Tooltip key={key} content={tooltip} side={tooltipSide} align={tooltipAlign} sideOffset={tooltipOffset}>
          <Button
            variant={variant}
            aria-label={ariaLabel || label}
            data-tooltip-action={key}
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
          >
            {children ?? label}
          </Button>
        </Tooltip>
      ))}
    </div>
  );
}
