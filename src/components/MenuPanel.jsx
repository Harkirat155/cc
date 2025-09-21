import React, { useState, useRef, useEffect, useMemo } from "react";

const useWindowSize = () => {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const handleResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return size;
};

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
  const [copied, setCopied] = useState(false);

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

  // Share helpers
  const toAbsoluteUrl = (path) => new window.URL(path.replace(/^\//, ""), window.location.origin + import.meta.env.BASE_URL).toString();
  const shareUrl = roomId ? toAbsoluteUrl(`/room/${roomId}`) : null;
  const handleShare = async () => {
    if (!roomId) return;
    const title = "Join my Tic Tac Toe room";
    const text = `Use this code ${roomId} or open this link to join:`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl });
        return;
      }
    } catch (e) {
      console.log(`Copy this link: ${shareUrl}`, e);
    }
  };

  // Visibility rules
  const showNewGame = Boolean(hasMoves);
  const showResetScore = Boolean(canResetScore);
  const showCreateRoom = Boolean(!isMultiplayer);
  const showShare = Boolean(isMultiplayer && roomId);
  const showLeave = Boolean(isMultiplayer);

  const Buttons = ({ stacked = false }) => (
    <div className={`flex ${stacked ? "flex-col" : width > 300 ? "flex-row" : "flex-col"} gap-3 items-center justify-center ${stacked ? "w-auto" : "w-full"}`}>
      {showNewGame && (
        <button
          className={`py-2 px-5 min-w-[120px] rounded-xl border whitespace-nowrap text-center bg-blue-600 text-white border-blue-700/20 dark:border-blue-400/20 shadow-sm hover:bg-blue-700 hover:border-blue-800/30 active:bg-blue-600 transition-all duration-200 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-blue-400/40`}
          onClick={(e) => {
            e.stopPropagation();
            handleButtonClick(onNewGame);
          }}
          type="button"
        >
          <span className="px-2 whitespace-nowrap">New</span>
        </button>
      )}
      {showResetScore && (
        <button
          className={`py-2 px-5 min-w-[120px] rounded-xl border whitespace-nowrap text-center bg-rose-500 text-white border-rose-700/20 dark:border-rose-400/20 shadow-sm hover:bg-rose-600 hover:border-rose-800/30 active:bg-rose-500 transition-all duration-200 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-rose-400/40`}
          onClick={(e) => {
            e.stopPropagation();
            handleButtonClick(onReset);
          }}
          type="button"
        >
          <span className="px-2 whitespace-nowrap">Reset</span>
        </button>
      )}
      {showCreateRoom && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleButtonClick(createRoom);
          }}
          className="py-2 px-5 min-w-[120px] rounded-xl border bg-emerald-600 text-white border-emerald-700/20 dark:border-emerald-400/20 shadow-sm hover:bg-emerald-700 hover:border-emerald-800/30 active:bg-emerald-600 transition-all duration-200 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          type="button"
        >
          Create
        </button>
      )}
      {showShare && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleShare();
            if (collapsed) setExpanded(false);
          }}
          className="py-2 px-5 min-w-[120px] rounded-xl border bg-purple-600 text-white border-purple-700/20 dark:border-purple-400/20 shadow-sm hover:bg-purple-700 hover:border-purple-800/30 active:bg-purple-600 transition-all duration-200 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-purple-400/40"
          type="button"
          aria-label={copied ? "Link copied to clipboard" : "Share room link"}
          title={shareUrl || ""}
        >
          {copied ? "Copied" : "Share"}
        </button>
      )}
      {showLeave && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleButtonClick(leaveRoom);
          }}
          className="py-2 px-5 min-w-[120px] rounded-xl border bg-gray-700 text-white border-gray-700/30 dark:border-gray-500/20 shadow-sm hover:bg-gray-800 hover:border-gray-900/40 active:bg-gray-700 transition-all duration-200 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-gray-400/40"
          type="button"
        >
          Leave
        </button>
      )}
    </div>
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
        <button
          type="button"
          aria-label={expanded ? "Close menu" : "Open menu"}
          title={expanded ? "Close menu" : "Open menu"}
          aria-expanded={expanded}
          aria-controls="menu-panel-popover"
          onClick={() => setExpanded((v) => !v)}
          className="group fixed bottom-4 right-4 z-40 outline-none"
          tabIndex={expanded ? -1 : 0}
        >
          {/* Cylinder body */}
          <span
            className={`relative block w-[58px] rounded-full shadow-2xl ring-1 ring-white/25 border border-white/20 dark:border-gray-700/50 backdrop-blur-xl backdrop-saturate-150 bg-white/25 dark:bg-gray-800/25 supports-[backdrop-filter]:bg-white/35 supports-[backdrop-filter]:dark:bg-gray-800/35 transition-transform duration-200 ${
              expanded ? "opacity-0 pointer-events-none scale-90 translate-y-1" : "opacity-100 scale-100"
            }`}
            style={{ height: `${cylHeight}px` }}
          >
            {/* Top rim highlight */}
            <span className="pointer-events-none absolute inset-x-2 top-1 h-3 rounded-full bg-white/25 blur-[2px] opacity-70" />
            {/* Bottom shadow */}
            <span className="pointer-events-none absolute inset-x-2 bottom-1 h-3 rounded-full bg-black/30 dark:bg-black/40 blur-[2px] opacity-60" />

            {/* Colored indicators (reflect visible actions) */}
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              {/* Tailwind safelist via explicit class strings above */}
              {indicatorClasses.map((cls, i) => (
                <span key={i} className={`w-7 h-7 rounded-full ring-2 ring-white/70 dark:ring-white/50 shadow-md opacity-95 ${cls}`} />
              ))}
            </span>

            {/* Subtle hover glow */}
            <span className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_28px_6px_rgba(255,255,255,0.22)] opacity-0 group-hover:opacity-100 transition-opacity" />

            {/* Focus ring for a11y */}
            <span className="pointer-events-none absolute -inset-1 rounded-[999px] ring-2 ring-blue-300/40 opacity-0 group-focus-visible:opacity-100 transition-opacity" />
          </span>
        </button>

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
  return (
    <div
      ref={menuRef}
      className={`fixed left-1/2 bottom-4 transform -translate-x-1/2 rounded-2xl shadow-2xl transition-all duration-300 ${expanded ? "p-2" : "p-1"} z-30 border border-white/20 dark:border-gray-700/50 backdrop-blur-xl bg-white/30 dark:bg-gray-800/30 supports-[backdrop-filter]:bg-white/35 supports-[backdrop-filter]:dark:bg-gray-800/35`}
      onClick={handleExpand}
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
  );
};

export default MenuPanel;
