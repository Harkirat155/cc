/* eslint-env browser */
import React, { useEffect, useState } from 'react';
import { Tooltip } from './ui/Tooltip';

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = window.localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // ignore read errors
  }
  const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

// Vivid icons
const VividSun = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-hidden="true"
  >
    <defs>
      <radialGradient id="sunGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#fde68a"/>
        <stop offset="60%" stopColor="#fbbf24"/>
        <stop offset="100%" stopColor="#f59e0b"/>
      </radialGradient>
    </defs>
    <circle cx="12" cy="12" r="5" fill="url(#sunGrad)" />
    <g stroke="#f59e0b" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
      <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
      <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
      <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
    </g>
  </svg>
);

const VividMoon = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-hidden="true"
  >
    {/* Crescent via masking two circles */}
    <defs>
      <mask id="crescentMask">
        <rect width="100%" height="100%" fill="#fff" />
        <circle cx="19" cy="7" r="10" fill="#000" />
      </mask>
    </defs>
    <circle cx="12" cy="12" r="9" fill="#ffffff" mask="url(#crescentMask)" />
  </svg>
);

const ThemeToggle = ({ className = '' }) => {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === 'dark';
    root.classList.toggle('dark', isDark);
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    try {
      window.localStorage.setItem('theme', theme);
      const meta = document.querySelector("meta[name='theme-color']");
      if (meta) meta.setAttribute('content', isDark ? '#0f172a' : '#ffffff');
    } catch {
      console.warn('Could not save theme preference');
    }
  }, [theme]);

  // Sync with system changes if user hasn't explicitly chosen
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      try {
        const saved = window.localStorage.getItem('theme');
        if (!saved) setTheme(e.matches ? 'dark' : 'light');
      } catch {
        // ignore
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };
  }, []);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const tooltip = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        aria-label="Toggle theme"
        aria-pressed={theme === 'dark'}
        onClick={toggle}
        className={`inline-flex items-center justify-center h-10 w-10 rounded-full border transition z-40 
        bg-slate-900 text-white border-slate-800 hover:bg-slate-800 
        dark:bg-white dark:text-slate-900 dark:border-slate-200 dark:hover:bg-slate-50 
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 dark:focus-visible:ring-slate-600 ${className}`}
      >
        {theme === 'dark' ? <VividSun size={20} /> : <VividMoon size={20} />}
      </button>
    </Tooltip>
  );
};

export default ThemeToggle;
