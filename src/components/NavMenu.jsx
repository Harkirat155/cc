import React, { useEffect, useMemo, useRef, useState } from "react";
import { Tooltip } from "./ui/Tooltip";

const NavMenu = ({ actions = [] }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);

  const visibleActions = useMemo(
    () => actions.filter(({ hidden }) => !hidden),
    [actions]
  );

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target)) return;
      setOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus({ preventScroll: true });
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (visibleActions.length === 0) {
    return null;
  }

  const handleToggle = () => setOpen((prev) => !prev);

  const handleSelect = (onSelect) => {
    setOpen(false);
    onSelect?.();
  };

  return (
    <div className="relative" ref={containerRef}>
      <Tooltip content={open ? "Hide quick menu" : "Show quick menu"}>
        <button
          type="button"
          ref={buttonRef}
          onClick={handleToggle}
          aria-haspopup="menu"
          aria-expanded={open}
          className={`inline-flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 hover:bg-white dark:hover:bg-gray-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 ${
            open ? "ring-2 ring-indigo-500/40" : ""
          }`}
        >
          <span className="flex flex-col items-center justify-center gap-1">
            <span
              className={`block h-0.5 w-4 rounded-full transition-transform duration-200 bg-gray-700 dark:bg-gray-200 ${
                open ? "translate-y-0.5" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-4 rounded-full transition-transform duration-200 bg-gray-700 dark:bg-gray-200 ${
                open ? "-translate-y-0.5" : ""
              }`}
            />
          </span>
          <span className="sr-only">Toggle quick actions</span>
        </button>
      </Tooltip>

      <div
        role="menu"
        aria-hidden={!open}
        className={`absolute right-0 mt-3 w-48 origin-top-right rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl transition-all duration-150 ${
          open ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <ul className="py-2">
          {visibleActions.map(({ key, label, description, onSelect }) => (
            <li key={key}>
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 focus-visible:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 dark:focus-visible:bg-gray-800 rounded-lg transition"
                onClick={() => handleSelect(onSelect)}
              >
                <span className="font-medium">{label}</span>
                {description && (
                  <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {description}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default NavMenu;
