import { TerraVoxGame } from './game/TerraVoxGame.js';

function init() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const game = new TerraVoxGame(canvas);
  window.__TERRAVOX__ = game;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
