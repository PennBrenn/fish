/**
 * Main entry point.
 * Imports Game and initializes it.
 * Registers service worker for PWA offline support.
 * Settings are already loaded synchronously in Settings.js constructor.
 */

import Game from './core/Game.js';

// Register service worker for PWA
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration failed:', err);
    });
  });
}

const game = new Game();
game.init().catch((err) => {
  console.error('Failed to initialize game:', err);
  const loadingText = document.getElementById('loading-text');
  if (loadingText) {
    loadingText.textContent = 'Error: ' + err.message;
    loadingText.style.color = '#ef4444';
  }
});
