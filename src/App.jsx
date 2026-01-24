import React, { Suspense, lazy } from 'react';
import './index.css';
import { Routes, Route } from 'react-router-dom';
import { AppTooltipProvider } from './components/ui/Tooltip';

const Game = lazy(() => import('./Game'));
const Lobby = lazy(() => import('./Lobby'));

function App() {
  return (
    <AppTooltipProvider>
      <Suspense
        fallback={
          <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 dark:bg-slate-950">
            {/* Animated logo placeholder */}
            <div className="relative">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 animate-pulse" />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 blur-xl opacity-50 animate-pulse" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                Loading CrissCross
              </span>
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-indigo-500 animate-typing-dot" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 rounded-full bg-purple-500 animate-typing-dot" style={{ animationDelay: '200ms' }} />
                <span className="h-2 w-2 rounded-full bg-pink-500 animate-typing-dot" style={{ animationDelay: '400ms' }} />
              </div>
            </div>
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Game />} />
          <Route path="/room/:roomId" element={<Game />} />
          <Route path="/lobby" element={<Lobby />} />
        </Routes>
      </Suspense>
    </AppTooltipProvider>
  );
}

export default App;
