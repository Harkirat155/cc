import React, { useState, useRef, useEffect } from "react";

const useWindowSize = () => {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  useEffect(() => {
    const handleResize = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return size;
};

const MenuPanel = ({
  onReset,
  onNewGame,
  // Visibility helpers
  hasMoves, // show New Game only when moves have been made
  canResetScore, // show Reset Score only when score != 0-0
  // Room controls
  createRoom,
  leaveRoom,
  isMultiplayer,
  roomId,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const menuRef = useRef(null);
  const { width } = useWindowSize();
  const [copied, setCopied] = useState(false);

  // Collapse menu if width < 500px or if overlapping board (simulate with small width)
  useEffect(() => {
    if (width < 300) {
      setCollapsed(true);
      setExpanded(false);
    } else {
      setCollapsed(false);
      setExpanded(true);
    }
  }, [width]);

  // Collapse when clicking outside or on button
  useEffect(() => {
    if (!collapsed || !expanded) return;
    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [collapsed, expanded]);

  // Collapse when either button is clicked in expanded/collapsed mode
  const handleButtonClick = (action) => {
    action();
    if (collapsed) setExpanded(false);
  };

  const handleExpand = () => {
    if (collapsed && !expanded) setExpanded(true);
  };

  // Share helpers (moved from RoomControls)
  const toAbsoluteUrl = (path) =>
    new window.URL(
      path.replace(/^\//, ""),
      window.location.origin + import.meta.env.BASE_URL
    ).toString();
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

  return (
    <div
      ref={menuRef}
      className={`fixed left-1/2 bottom-4 transform -translate-x-1/2 rounded-2xl shadow-2xl transition-all duration-300 ${
        expanded ? "p-2" : "p-1"
      } z-30 border border-white/20 dark:border-gray-700/50 backdrop-blur-xl bg-white/30 dark:bg-gray-800/30 supports-[backdrop-filter]:bg-white/35 supports-[backdrop-filter]:dark:bg-gray-800/35`}
      onClick={handleExpand}
    >
      {collapsed && !expanded ? (
        <div className="flex items-center justify-center cursor-pointer">
          <span className="text-base font-semibold text-gray-800 dark:text-gray-100">
            Menu
          </span>
          <span className="ml-2 text-xs text-blue-500">▲</span>
        </div>
      ) : (
        <div
          className={`flex ${
            width > 498 ? "flex-row" : "flex-col"
          } gap-3 items-center justify-center w-full`}
        >
          {/* Game actions */}
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
              aria-label={
                copied ? "Link copied to clipboard" : "Share room link"
              }
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
      )}
    </div>
  );
};

export default MenuPanel;
