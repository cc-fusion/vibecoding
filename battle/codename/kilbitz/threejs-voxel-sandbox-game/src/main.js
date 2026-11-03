import './style.css';
import { createTextureAtlas } from './textures.js';
import { WorldStorage } from './storage.js';
import { UI } from './ui.js';
import { Game } from './game.js';

const atlas = createTextureAtlas();
const storage = new WorldStorage();
const ui = new UI(atlas, storage);

try {
  new Game(ui, atlas, storage);
} catch (error) {
  console.error(error);
  ui.showOnly('loading-screen');
  document.getElementById('loading-label').textContent = 'WebGL could not start';
  const content = document.querySelector('.loading-content');
  const message = document.createElement('p');
  message.className = 'subtle-help';
  message.textContent = 'Enable hardware acceleration in a WebGL-capable browser, then reload.';
  content.appendChild(message);
}
