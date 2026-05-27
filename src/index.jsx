import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BrowserRouter } from 'react-router-dom';

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);

function renderApp() {
  rootElement.textContent = '';
  root.render(
    <React.StrictMode>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
}

if (rootElement.hasChildNodes()) {
  window.requestAnimationFrame(() => window.requestAnimationFrame(renderApp));
} else {
  renderApp();
}
