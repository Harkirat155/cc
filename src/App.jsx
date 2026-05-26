import React, { Suspense, lazy } from 'react';
import './index.css';
import { Routes, Route } from 'react-router-dom';
import { AppTooltipProvider } from './components/ui/Tooltip';

const Game = lazy(() => import('./Game'));
const Lobby = lazy(() => import('./Lobby'));
const Agents = lazy(() => import('./Agents'));

function LoadingScreen() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="h-[60vw] w-[60vw] rounded-full bg-indigo-500 opacity-[0.04] blur-[100px]" />
      </div>
      <div className="relative flex flex-col items-center gap-6 rounded-[2rem] border border-foreground/5 bg-foreground/[0.02] px-8 py-7 shadow-2xl backdrop-blur-sm">
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-foreground/5 bg-foreground/[0.03] p-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <span
              key={index}
              className={`h-3 w-3 rounded-full ${
                index === 0 || index === 4 || index === 8
                  ? "bg-foreground/50"
                  : "bg-foreground/10"
              }`}
            />
          ))}
        </div>
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-lg font-semibold tracking-tight text-transparent">
            CrissCross
          </span>
          <div className="flex items-center gap-1.5" aria-label="Loading CrissCross">
            {[0, 160, 320].map((delay) => (
              <span
                key={delay}
                className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-foreground/35"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AppTooltipProvider>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Game />} />
          <Route path="/room/:roomId" element={<Game />} />
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/agents" element={<Agents />} />
        </Routes>
      </Suspense>
    </AppTooltipProvider>
  );
}

export default App;
