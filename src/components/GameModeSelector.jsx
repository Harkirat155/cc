import React from 'react';
import { GAME_MODES, setPersistedMode } from '../utils/gameMode';

/**
 * Game mode selector with visual cards
 * Enhanced with beautiful styling and clear information hierarchy
 * @param {Object} props
 * @param {string} props.selectedMode - Current selected mode id
 * @param {function} props.onModeChange - Callback when mode changes
 * @param {boolean} props.disabled - Whether selection is disabled
 */
const GameModeSelector = ({ selectedMode, onModeChange, disabled = false }) => {
  const handleSelect = (modeId) => {
    if (disabled) return;
    setPersistedMode(modeId);
    onModeChange(modeId);
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="grid grid-cols-2 gap-4">
        {Object.values(GAME_MODES).map((mode) => {
          const isSelected = selectedMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              disabled={disabled}
              onClick={() => handleSelect(mode.id)}
              className={`
                relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 
                transition-all duration-300 ease-out group
                ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                ${
                  isSelected
                    ? 'border-transparent bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-500/30 scale-[1.02]'
                    : 'border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500 hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/10'
                }
              `}
              aria-pressed={isSelected}
            >
              {/* Selection indicator */}
              {isSelected && (
                <span className="absolute top-3 right-3 w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
              
              {/* Icon with animation */}
              <span 
                className={`text-4xl transition-transform duration-300 ${!isSelected && !disabled ? 'group-hover:scale-110 group-hover:rotate-3' : ''}`} 
                role="img" 
                aria-label={mode.name}
              >
                {mode.icon}
              </span>
              
              {/* Name */}
              <span className={`font-bold text-lg ${
                isSelected 
                  ? 'text-white' 
                  : 'text-stone-800 dark:text-slate-100'
              }`}>
                {mode.name}
              </span>
              
              {/* Board size badge */}
              <span className={`
                px-3 py-1 rounded-full text-xs font-semibold
                ${isSelected 
                  ? 'bg-white/20 text-white' 
                  : 'bg-stone-100 dark:bg-slate-700 text-stone-600 dark:text-slate-300'
                }
              `}>
                {mode.size}×{mode.size} board
              </span>
              
              {/* Win condition */}
              <span className={`text-sm ${
                isSelected 
                  ? 'text-white/80' 
                  : 'text-stone-500 dark:text-slate-400'
              }`}>
                {mode.streak} in a row to win
              </span>

              {/* Subtle description */}
              <span className={`text-xs mt-1 ${
                isSelected 
                  ? 'text-white/60' 
                  : 'text-stone-400 dark:text-slate-500'
              }`}>
                {mode.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default GameModeSelector;
