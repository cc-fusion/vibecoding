import { Game } from './Game.js';

function init() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const game = new Game(canvas);
  window.__voxterra = game;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
