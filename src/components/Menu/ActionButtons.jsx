import React from "react";
import Button from "../ui/Button.jsx";

export default function ActionButtons({
  stacked = false,
  width,
  flags,
  onNewGame,
  onReset,
  onCreateRoom,
  onShare,
  onLeave,
  copied,
}) {
  const layout = stacked ? "flex-col w-auto" : width > 300 ? "flex-row w-full" : "flex-col w-full";
  return (
    <div className={`flex ${layout} gap-3 items-center justify-center`}>
      {flags.showNewGame && (
        <Button
          variant="primary"
          onClick={(e) => {
            e.stopPropagation();
            onNewGame?.();
          }}
        >
          <span className="px-2 whitespace-nowrap">New</span>
        </Button>
      )}

      {flags.showResetScore && (
        <Button
          variant="danger"
          onClick={(e) => {
            e.stopPropagation();
            onReset?.();
          }}
        >
          <span className="px-2 whitespace-nowrap">Reset</span>
        </Button>
      )}

      {flags.showCreateRoom && (
        <Button
          variant="success"
          onClick={(e) => {
            e.stopPropagation();
            onCreateRoom?.();
          }}
        >
          Create
        </Button>
      )}

      {flags.showShare && (
        <Button
          variant="purple"
          aria-label={copied ? "Link copied to clipboard" : "Share room link"}
          title={typeof flags.shareUrl === "string" ? flags.shareUrl : ""}
          onClick={(e) => {
            e.stopPropagation();
            onShare?.();
          }}
        >
          {copied ? "Copied" : "Share"}
        </Button>
      )}

      {flags.showLeave && (
        <Button
          variant="neutral"
          onClick={(e) => {
            e.stopPropagation();
            onLeave?.();
          }}
        >
          Leave
        </Button>
      )}
    </div>
  );
}
