import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Tooltip } from "./ui/Tooltip";

const EMPTY_ACTIONS = [];
const MENU_GAP = 12;
const VIEWPORT_GUTTER = 12;

const NavMenu = ({ actions = EMPTY_ACTIONS, panel = null }) => {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const menuId = useId();

  const visibleActions = useMemo(
    () => actions.filter(({ hidden }) => !hidden),
    [actions]
  );

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const top = Math.max(VIEWPORT_GUTTER, Math.round(rect.bottom + MENU_GAP));
    const right = Math.max(
      VIEWPORT_GUTTER,
      Math.round(window.innerWidth - rect.right)
    );

    setMenuPosition({
      top: `${top}px`,
      right: `${right}px`,
      left: "auto",
      maxHeight: `calc(100vh - ${top + VIEWPORT_GUTTER}px)`,
    });
  }, []);

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

  useLayoutEffect(() => {
    if (!open) return undefined;

    updateMenuPosition();

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    window.visualViewport?.addEventListener("resize", updateMenuPosition);
    window.visualViewport?.addEventListener("scroll", updateMenuPosition);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.visualViewport?.removeEventListener("resize", updateMenuPosition);
      window.visualViewport?.removeEventListener("scroll", updateMenuPosition);
    };
  }, [open, updateMenuPosition]);

  if (visibleActions.length === 0 && !panel) {
    return null;
  }

  const handleToggle = () => {
    if (!open) {
      updateMenuPosition();
    }
    setOpen((prev) => !prev);
  };

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
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
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

      {open && (
        <div
          id={menuId}
          role="dialog"
          aria-label="Quick actions"
          className="fixed z-50 m-0 w-max min-w-48 max-w-[calc(100vw-1.5rem)] origin-top-right animate-menu-in overflow-hidden rounded-2xl border border-foreground/10 bg-background/90 p-0 text-foreground shadow-[0_24px_80px_-40px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:min-w-56 sm:max-w-72"
          style={menuPosition ?? undefined}
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
      )}
    </div>
  );
};

export default NavMenu;
