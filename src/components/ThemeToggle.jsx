/* eslint-env browser */
import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

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

const ThemeToggle = ({ className = '' }) => {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === 'dark';
    root.classList.toggle('dark', isDark);
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    try { window.localStorage.setItem('theme', theme); } catch {
      // ignore write errors
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

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={toggle}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-md bg-white/80 dark:bg-gray-800/80 backdrop-blur border border-gray-200 dark:border-gray-700 shadow hover:bg-white dark:hover:bg-gray-800 transition text-gray-700 dark:text-gray-200 ${className}`}
      style={{ zIndex: 40 }}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      <span className="text-xs font-medium hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
    </button>
  );
};

export default ThemeToggle;
