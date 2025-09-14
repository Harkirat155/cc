import React from 'react';
import Game from './Game';
import './index.css';
import { Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Game />} />
  <Route path="/room/:roomId" element={<Game />} />
    </Routes>
  );
}

export default App;
