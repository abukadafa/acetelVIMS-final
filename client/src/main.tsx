import React from 'react';
import ReactDom from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { warmUpBackend } from './lib/api';

// Kick off a background ping immediately so the Render free-tier backend
// has time to wake up before the user finishes entering their credentials.
warmUpBackend();

// Register PWA service worker for offline support and installation
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('New content available. Reload?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App ready for offline use');
  },
});

ReactDom.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
