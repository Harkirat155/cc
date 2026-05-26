import React, { useEffect, useMemo, useRef, useState } from "react";
import { Tooltip } from "./ui/Tooltip";

const NavMenu = ({ actions = [], panel = null }) => {
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

  if (visibleActions.length === 0 && !panel) {
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
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-foreground/5 bg-foreground/[0.03] text-foreground/60 transition hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 ${
            open ? "bg-foreground/10 text-foreground ring-1 ring-foreground/10" : ""
          }`}
        >
          <span className="flex flex-col items-center justify-center gap-1">
            <span
              className={`block h-0.5 w-4 rounded-full bg-current transition-transform duration-200 ${
                open ? "translate-y-0.5" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-4 rounded-full bg-current transition-transform duration-200 ${
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
        className={`absolute right-0 mt-3 w-72 max-w-[85vw] origin-top-right rounded-2xl border border-foreground/10 bg-background/90 text-foreground shadow-[0_24px_80px_-40px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-150 ${
          open ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        {panel && (
          <div className="max-h-80 overflow-y-auto border-b border-foreground/10 p-3">
            {panel}
          </div>
        )}
        {visibleActions.length > 0 && (
          <ul className="py-2">
            {visibleActions.map(({ key, label, description, onSelect }) => (
              <li key={key}>
                <button
                  type="button"
                  role="menuitem"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-foreground/75 transition hover:bg-foreground/[0.05] hover:text-foreground focus-visible:bg-foreground/[0.05] focus-visible:text-foreground focus-visible:outline-none"
                  onClick={() => handleSelect(onSelect)}
                >
                  <span className="font-medium">{label}</span>
                  {description && (
                    <span className="mt-0.5 block text-xs text-foreground/45">
                      {description}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default NavMenu;
