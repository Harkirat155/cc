import React, { useState, useRef, useEffect, useMemo } from "react";
import useWindowSize from "../hooks/useWindowSize.js";
import useShare from "../hooks/useShare.js";
import ActionButtons from "./Menu/ActionButtons.jsx";
import FabCylinder from "./Menu/FabCylinder.jsx";
import { Tooltip } from "./ui/Tooltip.jsx";

const MenuPanel = ({
  onReset,
  onNewGame,
  hasMoves,
  canResetScore,
  createRoom,
  leaveRoom,
  isMultiplayer,
  roomId,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const menuRef = useRef(null);
  const { width, height } = useWindowSize();
  const { shareUrl, copied, share } = useShare({ roomId });

  // Layout mode
  const useSideDrawer = width < 410 || height < 650;

  useEffect(() => {
    if (useSideDrawer) {
      setCollapsed(true);
      setExpanded(false);
    } else {
      setCollapsed(false);
      setExpanded(true);
    }
  }, [useSideDrawer]);

  // Close drawer when clicking outside
  useEffect(() => {
    if (!(useSideDrawer && expanded)) return;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setExpanded(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [useSideDrawer, expanded]);

  // Collapse when either button is clicked in collapsed mode
  const handleButtonClick = (action) => {
    action();
    if (collapsed) setExpanded(false);
  };

  const handleExpand = () => {
    if (collapsed && !expanded) setExpanded(true);
  };

  // Share handler wrapper to collapse when needed
  const handleShare = async () => {
    await share();
    if (collapsed) setExpanded(false);
  };

  // Visibility rules
  const showNewGame = Boolean(hasMoves);
  const showResetScore = Boolean(canResetScore);
  const showCreateRoom = Boolean(!isMultiplayer);
  const showShare = Boolean(isMultiplayer && roomId);
  const showLeave = Boolean(isMultiplayer);

  const Buttons = ({ stacked = false }) => (
    <ActionButtons
      stacked={stacked}
      width={width}
      flags={{
        showNewGame,
        showResetScore,
        showCreateRoom,
        showShare,
        showLeave,
        shareUrl,
      }}
      onNewGame={() => handleButtonClick(onNewGame)}
      onReset={() => handleButtonClick(onReset)}
      onCreateRoom={() => handleButtonClick(createRoom)}
      onShare={handleShare}
      onLeave={() => handleButtonClick(leaveRoom)}
      copied={copied}
    />
  );

  // Build indicator list for the traffic-light FAB (order matches visual importance)
  const indicatorClasses = useMemo(() => {
    const list = [];
    if (showResetScore) list.push("bg-rose-500"); // Reset
    if (showCreateRoom) list.push("bg-emerald-600"); // Create
    if (showNewGame) list.push("bg-blue-600"); // New
    if (showShare) list.push("bg-purple-600"); // Share
    if (showLeave) list.push("bg-gray-700"); // Leave
    return list;
  }, [showResetScore, showCreateRoom, showNewGame, showShare, showLeave]);

  // Dynamically size the cylinder to comfortably fit the indicators
  const DOT = 28; // px diameter
  const GAP = 8; // px gap between dots
  const PAD = 24; // vertical padding inside the cylinder
  const cylHeight = Math.max(72, indicatorClasses.length * DOT + Math.max(0, indicatorClasses.length - 1) * GAP + PAD);

  if (useSideDrawer) {
    // In compact mode, show a frosted glass stack panel instead of a right drawer
    return (
      <>
        {/* Overlay */}
        <div
          className={`fixed inset-0 z-20 bg-black/30 transition-opacity duration-200 ${expanded ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          onClick={() => setExpanded(false)}
        />

        {/* FAB toggle - cylindrical traffic-light icon */}
        <FabCylinder
          height={`${cylHeight}px`}
          indicators={indicatorClasses}
          expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
          data-tour="menu"
        />

        {/* Stacked frosted panel (anchored to FAB bottom-right) */}
        <div
          ref={menuRef}
          className={`fixed right-4 z-30 transform transition-all duration-200 origin-bottom-right ${
            expanded ? "opacity-100 scale-100" : "opacity-0 pointer-events-none scale-50"
          } rounded-2xl border border-white/20 dark:border-gray-700/50 backdrop-blur-xl bg-white/30 dark:bg-gray-800/30 supports-[backdrop-filter]:bg-white/35 supports-[backdrop-filter]:dark:bg-gray-800/35 p-3 shadow-2xl w-fit`}
          style={{ bottom: `${cylHeight + 24}px` }}
          onClick={handleExpand}
          id="menu-panel-popover"
        >
          <Buttons stacked />
        </div>
      </>
    );
  }

  // Bottom-centered pill for comfortable screens
  const menuTooltip = collapsed && !expanded ? "Open quick menu" : undefined;

  return (
    <Tooltip content={menuTooltip} sideOffset={14} side="top">
      <div
        ref={menuRef}
        className={`fixed left-1/2 bottom-4 transform -translate-x-1/2 rounded-2xl shadow-2xl transition-all duration-300 ${expanded ? "p-2" : "p-1"} z-30 border border-white/20 dark:border-gray-700/50 backdrop-blur-xl bg-white/30 dark:bg-gray-800/30 supports-[backdrop-filter]:bg-white/35 supports-[backdrop-filter]:dark:bg-gray-800/35`}
        onClick={handleExpand}
        data-tour="menu"
      >
        {collapsed && !expanded ? (
          <div className="flex items-center justify-center cursor-pointer">
            <span className="text-base font-semibold text-gray-800 dark:text-gray-100">Menu</span>
            <span className="ml-2 text-xs text-blue-500">▲</span>
          </div>
        ) : (
          <Buttons />
        )}
      </div>
    </Tooltip>
  );
};

export default MenuPanel;
