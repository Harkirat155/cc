import React, { useCallback, useEffect, useRef, useState } from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";
import useCoarsePointer from "../../hooks/useCoarsePointer";

const baseTooltipClasses =
  "z-[60] rounded-lg border border-white/20 dark:border-slate-700/70 bg-slate-900/95 text-slate-100 shadow-lg backdrop-blur-md px-3 py-2 text-xs font-medium leading-relaxed";

const arrowClass = "fill-slate-900";
const arrowClassDark = "dark:fill-slate-900";

const LONG_PRESS_CLOSE_DELAY = 120;

export function AppTooltipProvider({ children }) {
  return (
    <RadixTooltip.Provider delayDuration={180} skipDelayDuration={0} disableHoverableContent>
      {children}
    </RadixTooltip.Provider>
  );
}

export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  sideOffset = 8,
  className = "",
  asChild = true,
  longPressDelay = 350,
  ...props
}) {
  const { open: controlledOpen, defaultOpen, onOpenChange, ...rootProps } = props;
  const isCoarsePointer = useCoarsePointer();
  const isControlled = controlledOpen !== undefined;
  const hasContent = Boolean(content);

  const [touchOpen, setTouchOpen] = useState(() => (defaultOpen && !isControlled ? defaultOpen : false));
  const triggerRef = useRef(null);
  const contentRef = useRef(null);
  const longPressTimeoutRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  const clearLongPressTimeout = useCallback(() => {
    if (longPressTimeoutRef.current !== null) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }, []);

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isCoarsePointer) {
      clearLongPressTimeout();
      clearCloseTimeout();
      if (!isControlled && touchOpen) {
        setTouchOpen(false);
      }
    }
  }, [isCoarsePointer, isControlled, touchOpen, clearCloseTimeout, clearLongPressTimeout]);

  useEffect(() => {
    if (isCoarsePointer && !isControlled && typeof defaultOpen === "boolean") {
      setTouchOpen(defaultOpen);
    }
  }, [defaultOpen, isCoarsePointer, isControlled]);

  useEffect(() => () => {
    clearLongPressTimeout();
    clearCloseTimeout();
  }, [clearCloseTimeout, clearLongPressTimeout]);

  const scheduleOpenForLongPress = useCallback(
    (event) => {
      if (!isCoarsePointer || isControlled) return;
      const pointerType = event.pointerType ?? "";
      if (pointerType && pointerType !== "touch" && pointerType !== "pen") return;

      clearLongPressTimeout();
      clearCloseTimeout();

      longPressTimeoutRef.current = window.setTimeout(() => {
        setTouchOpen(true);
      }, longPressDelay);
    },
    [clearCloseTimeout, clearLongPressTimeout, isCoarsePointer, isControlled, longPressDelay]
  );

  const closeTouchTooltip = useCallback(
    () => {
      if (!isCoarsePointer || isControlled) return;
      clearLongPressTimeout();
      clearCloseTimeout();
      closeTimeoutRef.current = window.setTimeout(() => {
        setTouchOpen(false);
      }, LONG_PRESS_CLOSE_DELAY);
    },
    [clearCloseTimeout, clearLongPressTimeout, isCoarsePointer, isControlled]
  );

  const handleRootOpenChange = useCallback(
    (nextOpen) => {
      if (isCoarsePointer && !isControlled) {
        setTouchOpen(nextOpen);
      }
      if (typeof onOpenChange === "function") {
        onOpenChange(nextOpen);
      }
    },
    [isCoarsePointer, isControlled, onOpenChange]
  );

  useEffect(() => {
    if (!isCoarsePointer || !touchOpen) return undefined;

    const handlePointerDown = (event) => {
      const target = event.target;
      if (
        (triggerRef.current && triggerRef.current.contains(target)) ||
        (contentRef.current && contentRef.current.contains(target))
      ) {
        return;
      }
      setTouchOpen(false);
    };

    const handleScroll = () => {
      setTouchOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("blur", handleScroll);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("blur", handleScroll);
    };
  }, [isCoarsePointer, touchOpen]);

  const open = isCoarsePointer ? (isControlled ? controlledOpen : touchOpen) : controlledOpen;
  const defaultOpenProp = isCoarsePointer ? undefined : defaultOpen;

  if (!hasContent) {
    return <>{children}</>;
  }

  return (
    <RadixTooltip.Root
      {...rootProps}
      open={open}
      defaultOpen={defaultOpenProp}
      onOpenChange={handleRootOpenChange}
    >
      <RadixTooltip.Trigger
        ref={triggerRef}
        asChild={asChild}
        onPointerDown={scheduleOpenForLongPress}
        onPointerUp={closeTouchTooltip}
        onPointerLeave={closeTouchTooltip}
        onPointerCancel={closeTouchTooltip}
      >
        {children}
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          ref={contentRef}
          side={side}
          align={align}
          sideOffset={sideOffset}
          className={`${baseTooltipClasses} ${className}`.trim()}
        >
          {typeof content === "string" ? <span>{content}</span> : content}
          <RadixTooltip.Arrow className={`${arrowClass} ${arrowClassDark}`} />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

export const TooltipTrigger = RadixTooltip.Trigger;
export const TooltipContent = RadixTooltip.Content;
export const TooltipArrow = RadixTooltip.Arrow;
export const TooltipPortal = RadixTooltip.Portal;
export const TooltipRoot = RadixTooltip.Root;
