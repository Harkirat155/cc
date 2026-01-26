import React, { useEffect, useRef, useState } from 'react';
import { GAME_MODES } from '../utils/gameMode';
import { Tooltip } from './ui/Tooltip';

/**
 * 9-dot Google-style App Launcher for game mode switching
 * Appears in navbar with a beautiful dropdown grid
 */
const AppLauncher = ({ 
  currentMode, 
  onModeChange, 
  disabled = false,
  isMultiplayer = false,
  modeChangeRequest = null,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  
  // Check if there's a pending mode change request
  const hasPendingRequest = !!modeChangeRequest;

  // Close on outside click or escape
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target)) return;
      setOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus({ preventScroll: true });
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleToggle = () => {
    if (!disabled) {
      setOpen((prev) => !prev);
    }
  };

  const handleSelect = (modeId) => {
    if (disabled || hasPendingRequest) return;
    // Allow mode change in both local and multiplayer
    // In multiplayer, onModeChange will send a request
    if (modeId !== currentMode) {
      onModeChange(modeId);
    }
    setOpen(false);
  };

  const currentModeInfo = GAME_MODES[currentMode] || GAME_MODES.classic;
  
  const tooltipText = hasPendingRequest 
    ? 'Mode change pending...' 
    : isMultiplayer 
      ? 'Request mode change' 
      : 'Switch game mode';

  return (
    <div className="relative" ref={containerRef}>
      <Tooltip content={tooltipText}>
        <button
          type="button"
          ref={buttonRef}
          onClick={handleToggle}
          disabled={disabled}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Game mode selector"
          className={`
            relative inline-flex items-center justify-center w-10 h-10 rounded-full 
            border border-stone-200 dark:border-gray-700 
            bg-stone-50/80 dark:bg-gray-800/70 
            hover:bg-stone-100 dark:hover:bg-gray-800 
            transition-all duration-200
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60
            ${open ? 'ring-2 ring-indigo-500/40 bg-stone-100 dark:bg-gray-800' : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          {/* 9-dot grid icon */}
          <div className="grid grid-cols-3 gap-[3px]">
            {[...Array(9)].map((_, i) => (
              <span
                key={i}
                className={`
                  w-[5px] h-[5px] rounded-full transition-all duration-200
                  ${open 
                    ? 'bg-indigo-500 dark:bg-indigo-400' 
                    : 'bg-gray-500 dark:bg-gray-400'
                  }
                `}
              />
            ))}
          </div>
          
          {/* Mode indicator dot */}
          <span 
            className={`
              absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full 
              flex items-center justify-center text-[8px]
              bg-white dark:bg-gray-900 
              border-2 border-stone-200 dark:border-gray-700
              shadow-sm
            `}
          >
            {currentModeInfo.icon}
          </span>
        </button>
      </Tooltip>

      {/* Dropdown Menu */}
      <div
        role="menu"
        aria-hidden={!open}
        className={`
          absolute right-0 mt-3 w-72 origin-top-right rounded-2xl 
          border border-stone-200/80 dark:border-gray-700/80 
          bg-white/95 dark:bg-gray-900/95 
          backdrop-blur-xl shadow-2xl
          transition-all duration-200 ease-out
          ${open 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
          }
        `}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-stone-100 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-stone-700 dark:text-gray-200">
            Game Mode
          </h3>
          <p className="text-xs text-stone-500 dark:text-gray-400 mt-0.5">
            {hasPendingRequest 
              ? 'Waiting for opponent to respond...'
              : isMultiplayer 
                ? 'Select a mode to request a change' 
                : 'Choose your preferred board size'
            }
          </p>
        </div>

        {/* Mode Grid */}
        <div className="p-3 grid grid-cols-2 gap-2">
          {Object.values(GAME_MODES).map((mode) => {
            const isSelected = currentMode === mode.id;
            const isPendingThisMode = hasPendingRequest && modeChangeRequest?.newMode === mode.id;
            const isDisabled = disabled || hasPendingRequest || isSelected;
            
            return (
              <button
                key={mode.id}
                type="button"
                role="menuitem"
                disabled={isDisabled}
                onClick={() => handleSelect(mode.id)}
                className={`
                  relative flex flex-col items-center gap-2 p-4 rounded-xl
                  transition-all duration-200 ease-out group
                  ${isDisabled && !isSelected && !isPendingThisMode ? 'opacity-50 cursor-not-allowed' : ''}
                  ${isPendingThisMode
                    ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/25 animate-pulse'
                    : isSelected
                      ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 scale-[1.02]'
                      : isDisabled 
                        ? 'bg-stone-50 dark:bg-gray-800/50'
                        : 'bg-stone-50 dark:bg-gray-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:scale-105 hover:shadow-md cursor-pointer'
                  }
                `}
              >
                {/* Selection check or pending indicator */}
                {isPendingThisMode ? (
                  <span className="absolute top-2 right-2 w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                    <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                  </span>
                ) : isSelected && (
                  <span className="absolute top-2 right-2 w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}

                {/* Icon */}
                <span className={`text-3xl transition-transform duration-200 ${!isSelected && !isDisabled ? 'group-hover:scale-110' : ''}`}>
                  {mode.icon}
                </span>

                {/* Name */}
                <span className={`font-semibold text-sm ${
                  isPendingThisMode || isSelected 
                    ? 'text-white' 
                    : 'text-stone-700 dark:text-gray-200'
                }`}>
                  {isPendingThisMode ? 'Requesting...' : mode.name}
                </span>

                {/* Board size badge */}
                <span className={`
                  px-2 py-0.5 rounded-full text-[10px] font-medium
                  ${isPendingThisMode || isSelected 
                    ? 'bg-white/20 text-white' 
                    : 'bg-stone-200/70 dark:bg-gray-700/70 text-stone-600 dark:text-gray-300'
                  }
                `}>
                  {mode.size}×{mode.size} • {mode.streak} in row
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2.5 border-t border-stone-100 dark:border-gray-800 bg-stone-50/50 dark:bg-gray-800/30 rounded-b-2xl">
          <p className="text-[10px] text-stone-400 dark:text-gray-500 text-center">
            {isMultiplayer 
              ? 'Mode changes require opponent approval'
              : 'Mode applies to new local games and room creation'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default AppLauncher;
