import React, { Suspense, lazy } from 'react';
import './index.css';
import { Routes, Route } from 'react-router-dom';
import { AppTooltipProvider } from './components/ui/Tooltip';

const Game = lazy(() => import('./Game'));

function App() {
  return (
    <AppTooltipProvider>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300">
            Loading...
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Game />} />
          <Route path="/room/:roomId" element={<Game />} />
        </Routes>
      </Suspense>
    </AppTooltipProvider>
  );
}

export default App;
