import './style.css';
import { Game } from './game/game.js';

const canvas = document.getElementById('game');
try {
  const game = new Game(canvas);
  window.__game = game;
} catch (err) {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;inset:0;display:grid;place-items:center;background:#111;color:#eee;font:16px system-ui;text-align:center;padding:24px;z-index:999">Blockhaven could not start: WebGL 2 is required.<br><small style="opacity:.6">${String(err && err.message || err)}</small></div>`);
}
