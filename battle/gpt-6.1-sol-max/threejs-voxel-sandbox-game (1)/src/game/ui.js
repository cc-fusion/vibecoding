import { B, BLOCKS, RECIPES, iconHTML, itemName } from './blocks.js';
import { listWorlds, loadWorld, createWorld, deleteWorld, saveSettings } from './storage.js';

const paths = {
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  back: '<path d="m14 6-6 6 6 6M8 12h12"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  gear: '<path d="m9 3-.5 3-2 1.2-2.8-1-2 3.5L4 12l-2.3 2.3 2 3.5 2.8-1 2 1.2.5 3h4l.5-3 2-1.2 2.8 1 2-3.5L18 12l2.3-2.3-2-3.5-2.8 1-2-1.2-.5-3z"/><circle cx="11" cy="12" r="3"/>',
  sound: '<path d="M10 4 5 8H2v8h3l5 4zM14 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="M10 4 5 8H2v8h3l5 4zM15 9l6 6m0-6-6 6"/>',
  book: '<path d="M12 5C8 2 4 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-2-10 1Zm0 0v15"/>',
  worlds: '<path d="m3 7 9-5 9 5v10l-9 5-9-5zM3 7l9 5 9-5M12 12v10"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  shuffle: '<path d="m17 3 4 4-4 4M3 17l6-6m5-4h7M3 7h3l12 10h3m-4-4 4 4-4 4"/>',
  fullscreen: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  heart: '<path d="M20.5 5.5a5 5 0 0 0-7 0L12 7l-1.5-1.5a5 5 0 0 0-7 7L12 21l8.5-8.5a5 5 0 0 0 0-7Z"/>',
  leaf: '<path d="M20 3C8 2 2 8 5 15c3 7 16 3 15-12ZM4 21 16 9"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5z"/>',
  mouse: '<rect x="5" y="2" width="14" height="20" rx="7"/><path d="M12 2v7M5 9h14"/>',
};
export const svg = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.leaf}</svg>`;
const logo = '<svg viewBox="0 0 40 44" fill="none" aria-hidden="true"><path d="m20 1 15 8-15 8L5 9 20 1Z" fill="currentColor"/><path d="m5 13 15 8 15-8v8l-15 8-15-8v-8Z" fill="currentColor" opacity=".8"/><path d="m5 25 15 8 15-8v8l-15 8-15-8v-8Z" fill="currentColor" opacity=".6"/></svg>';
const escapeHTML = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class GameUI {
  constructor(host, game) {
    this.host = host; this.game = game; this.panel = null; this.slotFrom = null; this.recipe = 'planks'; this.createMode = 'survival'; this.creativeTab = false;
    host.innerHTML = `
      <div class="viewport" aria-label="Wildwood voxel world"></div>
      <div class="scene-shade"></div><div class="underwater-overlay"></div><div class="damage-overlay"></div>
      <header class="topbar">
        <button class="brand" data-action="brand" aria-label="Wildwood home">${logo}<span>WILDWOOD<span class="brand-sub">A WORLD OF YOUR OWN</span></span></button>
        <nav class="top-actions" aria-label="Game menu">
          <button class="text-button guide-button" data-action="help">${svg('book')}<span>Field guide</span></button>
          <span class="nav-divider"></span>
          <button class="icon-button sound-button" data-action="sound" aria-label="Mute audio">${svg('sound')}</button>
          <button class="icon-button" data-action="settings" aria-label="Settings">${svg('gear')}</button>
        </nav>
      </header>
      <section class="landing" aria-label="Welcome to Wildwood">
        <div class="landing-copy">
          <div class="eyebrow hero-reveal">GO A LITTLE OFF THE GRID</div>
          <h1 class="hero-reveal">Wildwood<span class="title-period">.</span></h1>
          <h2 class="hero-reveal">Nowhere to be.<br>Everything to discover.</h2>
          <p class="hero-reveal">A world to wander. A place to build.<br>A little something to call your own.</p>
          <div class="hero-actions hero-reveal">
            <button class="button button-light" data-action="play" id="enter-world">Enter the world ${svg('arrow')}</button>
            <button class="button button-ghost" data-action="worlds">${svg('worlds')} Your worlds</button>
          </div>
        </div>
        <div class="landing-bottom"><span class="keyboard-note">${svg('mouse')} A little curiosity. A keyboard &amp; mouse.</span><button data-action="new-world" class="new-world-link">Make a new world ${svg('plus')}</button></div>
      </section>
      <section class="hud" aria-label="Game heads-up display" hidden>
        <div class="world-info"><span class="biome-name">The Meadowlands</span><span class="world-clock">${svg('sun')} <span>Day 1 &nbsp; 08:10</span></span><span class="coordinates" hidden></span></div>
        <div class="compass"><span>W</span><i></i><b>N</b><i></i><span>E</span><div class="compass-needle"></div></div>
        <div class="hud-actions"><button class="hud-button" data-action="journal" title="Field notes (J)">${svg('book')}<span>Field notes</span><kbd>J</kbd></button><button class="icon-button" data-action="pause" aria-label="Pause game">${svg('gear')}</button></div>
        <div class="crosshair"><span></span><svg class="mining-ring" viewBox="0 0 40 40"><circle cx="20" cy="20" r="16"/></svg></div>
        <div class="target-name"></div>
        <div class="vitals"><div class="breath-meter" hidden><span>AIR</span><div><i></i></div></div><div class="hearts"></div><div class="stamina-track"><div></div></div><span class="flight-hint" hidden>FLYING &nbsp; SPACE / C</span></div>
        <div class="hotbar-area"><div class="selected-name">Meadow grass</div><div class="hotbar" role="toolbar" aria-label="Hotbar"></div><div class="hotbar-caption"><span><kbd>1</kbd> &ndash; <kbd>9</kbd> select</span><span class="caption-divider"></span><span>Scroll to switch</span></div></div>
        <div class="inventory-hint"><button data-action="inventory"><kbd>E</kbd> Backpack</button><button data-action="pause"><kbd>Esc</kbd> Pause</button></div>
        <div class="first-hint"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Wander</span><span>${svg('mouse')} Hold to break &nbsp; / &nbsp; Right-click to place</span><button data-action="dismiss-hint" aria-label="Dismiss controls">${svg('close')}</button></div>
        <div class="touch-controls"><div class="touch-stick" aria-label="Move"><i></i></div><div class="touch-buttons"><button data-touch="break" aria-label="Break block">${svg('mouse')}</button><button data-touch="place" aria-label="Place block">${svg('plus')}</button><button data-touch="interact" aria-label="Use table or feed sheep">${svg('leaf')}</button><button data-touch="jump" aria-label="Jump">${svg('arrow')}</button></div></div>
      </section>
      <div class="modal-root"></div><div class="toast-container" role="status" aria-live="polite"></div>
      <div class="loading-screen"><div class="loading-logo">${logo}</div><p>Growing your little corner of the world<span class="loading-dots"></span></p><div class="loading-track"><span></span></div></div>
      <div class="save-indicator">${svg('check')} World saved</div>
    `;
    this.viewport = host.querySelector('.viewport'); this.modalRoot = host.querySelector('.modal-root');
    this.hud = host.querySelector('.hud'); this.landing = host.querySelector('.landing');
    this.clickHandler = e => this.handleClick(e);
    host.addEventListener('click', this.clickHandler);
    this.inputHandler = e => this.handleInput(e); host.addEventListener('input', this.inputHandler); host.addEventListener('change', this.inputHandler);
    this.submitHandler = e => { if (e.target.id === 'new-world-form') { e.preventDefault(); this.submitWorld(e.target); } }; host.addEventListener('submit', this.submitHandler);
    this.dragHandler = e => { const slot = e.target.closest('[data-slot]'); if (slot) { e.dataTransfer.setData('text/plain', slot.dataset.slot); e.dataTransfer.effectAllowed = 'move'; } }; host.addEventListener('dragstart', this.dragHandler);
    this.overHandler = e => { if (e.target.closest('[data-slot]')) e.preventDefault(); }; host.addEventListener('dragover', this.overHandler);
    this.dropHandler = e => { const slot = e.target.closest('[data-slot]'); if (!slot) return; e.preventDefault(); this.game.moveSlot(Number(e.dataTransfer.getData('text/plain')), Number(slot.dataset.slot)); this.slotFrom = null; this.renderInventory(); }; host.addEventListener('drop', this.dropHandler);
    const saved = listWorlds(); if (saved.length) host.querySelector('#enter-world').innerHTML = `Continue exploring ${svg('arrow')}`;
    this.updateSound();
  }

  ready() { this.host.querySelector('.loading-screen').classList.add('loaded'); this.host.classList.add('world-ready'); }
  showLoading(text) { const el = this.host.querySelector('.loading-screen'); el.querySelector('p').textContent = text; el.classList.remove('loaded'); }
  showPlaying() {
    this.panel = null; this.modalRoot.innerHTML = ''; this.landing.hidden = true; this.hud.hidden = false;
    this.host.classList.add('is-playing'); this.host.classList.remove('is-menu'); this.host.querySelector('.topbar').classList.add('game-topbar');
    this.renderHotbar();
  }
  showLanding() {
    this.panel = null; this.modalRoot.innerHTML = ''; this.landing.hidden = false; this.hud.hidden = true;
    this.host.classList.remove('is-playing', 'is-menu'); this.host.querySelector('.topbar').classList.remove('game-topbar');
    const saved = listWorlds(); this.host.querySelector('#enter-world').innerHTML = `${saved.length ? 'Continue exploring' : 'Enter the world'} ${svg('arrow')}`;
  }
  open(panel) {
    this.panel = panel; this.slotFrom = null; this.game.openPanel(panel);
    this.host.classList.add('is-menu'); this.host.classList.remove('is-playing');
    this.renderPanel();
    requestAnimationFrame(() => this.modalRoot.querySelector('input, button')?.focus({ preventScroll: true }));
  }
  close() {
    if (this.panel === 'death') return;
    this.panel = null; this.modalRoot.innerHTML = ''; this.host.classList.remove('is-menu');
    if (this.game.hasSession) this.game.resume();
  }
  renderPanel() {
    if (this.panel === 'inventory') return this.renderInventory();
    if (this.panel === 'settings') return this.renderSettings();
    if (this.panel === 'worlds') return this.renderWorlds();
    if (this.panel === 'new-world') return this.renderNewWorld();
    if (this.panel === 'journal') return this.renderJournal();
    if (this.panel === 'help') return this.renderHelp();
    if (this.panel === 'pause') return this.renderPause();
  }
  shell(content, classes = '') {
    this.modalRoot.innerHTML = `<div class="modal-backdrop"><section class="panel ${classes}" role="dialog" aria-modal="true" aria-label="${this.panel}"><button class="close-button" data-action="close" aria-label="Close dialog">${svg('close')}</button>${content}</section></div>`;
  }

  handleClick(e) {
    const button = e.target.closest('[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action; this.game.audio?.ui();
    if (action === 'play') { const saved = listWorlds(); this.game.startWorld(saved.length ? loadWorld(saved[0].id) : this.game.data); }
    else if (action === 'close' || action === 'resume') this.close();
    else if (action === 'brand') { if (this.game.hasSession) this.open('pause'); else this.showLanding(); }
    else if (['inventory', 'settings', 'worlds', 'new-world', 'journal', 'help', 'pause'].includes(action)) this.open(action);
    else if (action === 'sound') { const volume = this.game.settings.volume > 0 ? 0 : 0.45; this.game.updateSetting('volume', volume); this.updateSound(); }
    else if (action === 'fullscreen') { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => this.toast('Fullscreen is not available in this browser.')); else document.exitFullscreen?.(); }
    else if (action === 'save-exit') this.game.returnToTitle();
    else if (action === 'save') { this.game.save(); this.toast('Your world is saved. Pick up right here next time.', 'check'); }
    else if (action === 'dismiss-hint') this.host.querySelector('.first-hint').classList.add('dismissed');
    else if (action === 'hotbar') this.game.selectSlot(Number(button.dataset.index));
    else if (action === 'slot') this.clickSlot(Number(button.dataset.slot), e.shiftKey);
    else if (action === 'recipe') { this.recipe = button.dataset.recipe; this.renderInventory(); }
    else if (action === 'craft') { this.game.craft(this.recipe); this.renderInventory(); }
    else if (action === 'creative-tab') { this.creativeTab = !this.creativeTab; this.renderInventory(); }
    else if (action === 'supply') { this.game.addItem(Number(button.dataset.item), 64); this.game.audio.craft(); this.renderInventory(); }
    else if (action === 'load-world') this.game.startWorld(loadWorld(button.dataset.id));
    else if (action === 'delete-world') this.renderDeleteWorld(button.dataset.id);
    else if (action === 'confirm-delete') { deleteWorld(button.dataset.id); this.renderWorlds(); }
    else if (action === 'shuffle-seed') this.modalRoot.querySelector('[name="seed"]').value = ['fern', 'river', 'cedar', 'moss', 'cloud', 'bloom'][Math.floor(Math.random() * 6)] + '-' + Math.floor(Math.random() * 99999);
    else if (action === 'game-mode') { this.createMode = button.dataset.mode; this.modalRoot.querySelectorAll('[data-action="game-mode"]').forEach(el => { el.classList.toggle('selected', el.dataset.mode === this.createMode); el.setAttribute('aria-pressed', String(el.dataset.mode === this.createMode)); }); }
    else if (action === 'respawn') { this.game.respawn(); this.panel = null; this.close(); }
  }

  handleInput(e) {
    const input = e.target;
    if (!input.dataset.setting) return;
    const key = input.dataset.setting;
    const value = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value;
    this.game.updateSetting(key, value); saveSettings(this.game.settings); this.updateSound();
    const output = this.modalRoot.querySelector(`[data-value="${key}"]`);
    if (output) output.textContent = this.settingValue(key, value);
  }

  renderHotbar() {
    if (!this.game.data) return;
    const data = this.game.data;
    this.host.querySelector('.hotbar').innerHTML = data.inventory.slice(0, 9).map((slot, i) => `<button class="hotbar-slot ${data.selected === i ? 'active' : ''}" data-action="hotbar" data-index="${i}" aria-label="${slot ? itemName(slot.id) + ', ' + slot.count : 'Empty slot'}" aria-pressed="${data.selected === i}"><span class="slot-key">${i + 1}</span>${slot ? iconHTML(slot.id) + `<span class="slot-count">${data.mode === 'creative' && !BLOCKS[slot.id].item ? '&infin;' : slot.count}</span>` : ''}</button>`).join('');
    this.host.querySelector('.selected-name').textContent = data.inventory[data.selected] ? itemName(data.inventory[data.selected].id) : 'Empty hand';
    this.host.querySelector('.selected-name').classList.remove('item-change');
    requestAnimationFrame(() => this.host.querySelector('.selected-name')?.classList.add('item-change'));
  }

  updateHUD() {
    if (!this.game.player) return;
    const { player, data, world, environment } = this.game;
    const col = world.column(Math.floor(player.position.x), Math.floor(player.position.z));
    const names = { Meadow: 'The Meadowlands', Woodland: 'Whispering Woods', Dunes: 'The Amber Dunes', Alpine: 'The High Country' };
    this.host.querySelector('.biome-name').textContent = names[col.biome];
    const minutes = Math.floor(data.time * 24 * 60), h = Math.floor(minutes / 60).toString().padStart(2, '0'), m = (minutes % 60).toString().padStart(2, '0');
    this.host.querySelector('.world-clock').innerHTML = `${svg(environment.daylight > 0.3 ? 'sun' : 'moon')}<span>Day ${Math.floor(data.elapsed / 720) + 1} &nbsp; ${h}:${m}${environment.rain > 0.5 ? ' &nbsp; Rain' : ''}</span>`;
    const coords = this.host.querySelector('.coordinates'); coords.hidden = !this.game.settings.showCoordinates; coords.textContent = `${Math.floor(player.position.x)} / ${Math.floor(player.position.y)} / ${Math.floor(player.position.z)}`;
    this.host.querySelector('.hearts').innerHTML = Array.from({ length: 5 }, (_, i) => svg('heart', i * 2 < player.health ? 'heart-full' : 'heart-empty')).join('');
    this.host.querySelector('.stamina-track > div').style.width = `${player.stamina}%`;
    this.host.querySelector('.stamina-track').classList.toggle('exhausted', player.stamina < 15);
    this.host.querySelector('.flight-hint').hidden = !player.flying;
    const breath = this.host.querySelector('.breath-meter'); breath.hidden = !player.submerged;
    breath.querySelector('i').style.width = `${Math.max(0, 100 - this.game.breath / 12 * 100)}%`;
    breath.classList.toggle('low-air', this.game.breath > 8);
    this.host.querySelector('.underwater-overlay').classList.toggle('visible', player.submerged);
    const compass = this.host.querySelector('.compass'); const heading = ((-player.yaw * 180 / Math.PI) % 360 + 360) % 360;
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']; compass.querySelector('b').textContent = directions[Math.round(heading / 45) % 8];
    this.host.querySelector('.compass-needle').style.transform = `translateX(${Math.sin(player.yaw * 4) * 25}px)`;
  }
  updateTarget(hit, mining) {
    this.host.querySelector('.target-name').textContent = hit ? itemName(hit.id) + (hit.id === B.BENCH ? '  [F]' : '') : '';
    const ring = this.host.querySelector('.mining-ring'); ring.style.opacity = mining > 0 ? '1' : '0'; ring.querySelector('circle').style.strokeDashoffset = String(101 * (1 - mining));
  }
  updateSound() { this.host.querySelector('.sound-button').innerHTML = svg(this.game.settings.volume > 0 ? 'sound' : 'muted'); this.host.querySelector('.sound-button').setAttribute('aria-label', this.game.settings.volume > 0 ? 'Mute audio' : 'Enable audio'); }

  clickSlot(index, shift) {
    if (shift) { this.game.quickMove(index); this.slotFrom = null; }
    else if (this.slotFrom === null) { if (this.game.data.inventory[index]) this.slotFrom = index; }
    else { this.game.moveSlot(this.slotFrom, index); this.slotFrom = null; }
    this.renderInventory();
  }
  renderInventory() {
    const { data } = this.game, nearbyBench = this.game.nearBench();
    const slots = indices => indices.map(i => {
      const slot = data.inventory[i];
      return `<button class="inventory-slot ${this.slotFrom === i ? 'picked' : ''}" draggable="${!!slot}" data-action="slot" data-slot="${i}" title="${slot ? itemName(slot.id) + ' (' + slot.count + ')' : 'Empty slot'}" aria-label="${slot ? itemName(slot.id) + ', ' + slot.count : 'Empty slot'}">${i < 9 ? `<span class="slot-key">${i + 1}</span>` : ''}${slot ? iconHTML(slot.id) + `<span class="slot-count">${slot.count}</span>` : ''}</button>`;
    }).join('');
    const recipe = RECIPES.find(r => r.id === this.recipe) || RECIPES[0];
    const canCraft = this.game.canCraft(recipe);
    const creative = data.mode === 'creative';
    const supply = Object.entries(BLOCKS).filter(([id, def]) => Number(id) > 0 && !def.item && ![B.WATER, B.BEDROCK, B.TUFT].includes(Number(id)));
    this.shell(`
      <div class="panel-eyebrow">PACK LIGHT. DREAM BIG.</div><h2>Your backpack<span class="accent-period">.</span></h2>
      <div class="inventory-layout"><div class="backpack-side">
        <div class="section-label"><span>${this.creativeTab && creative ? 'BUILDING SUPPLY' : 'YOUR COLLECTION'}</span>${creative ? `<button class="small-link" data-action="creative-tab">${this.creativeTab ? 'Your backpack' : 'All blocks'} ${svg('arrow')}</button>` : '<span class="slot-instruction">Click to pick up. Click to move.</span>'}</div>
        <div class="inventory-grid">${this.creativeTab && creative ? supply.map(([id, def]) => `<button class="inventory-slot" data-action="supply" data-item="${id}" aria-label="Get ${def.name}" title="Get 64 ${def.name}">${iconHTML(Number(id))}</button>`).join('') : slots(Array.from({ length: 27 }, (_, i) => i + 9))}</div>
        <div class="section-label on-hand"><span>ON HAND</span><span class="slot-instruction">Shift-click to move quickly</span></div><div class="inventory-grid hotbar-inventory">${slots(Array.from({ length: 9 }, (_, i) => i))}</div>
        <div class="inventory-footer"><button class="inventory-return" data-action="close"><kbd>E</kbd> Back to the world</button><span>${this.slotFrom !== null ? 'Choose a destination slot' : `${data.inventory.filter(Boolean).length} / 36 slots used`}</span></div>
      </div><div class="crafting-side"><div class="section-label"><span>MAKE SOMETHING</span><span class="bench-status ${nearbyBench ? 'available' : ''}">${nearbyBench ? svg('check') + ' Table nearby' : 'Hand crafting'}</span></div>
        <div class="recipe-list">${RECIPES.map(r => `<button data-action="recipe" data-recipe="${r.id}" class="recipe-row ${r.id === recipe.id ? 'selected' : ''}">${iconHTML(r.out)}<span>${r.name}<small>${r.count > 1 ? 'Makes ' + r.count : r.bench ? 'Crafting table' : 'Handcrafted'}</small></span><span class="recipe-status">${this.game.canCraft(r) ? svg('check') : r.bench && !nearbyBench ? '&bull;' : ''}</span></button>`).join('')}</div>
        <div class="recipe-detail"><p>${recipe.description}</p><div class="ingredients">${recipe.input.map(([id, count]) => `<span class="ingredient ${this.game.itemCount(id) >= count || creative ? 'enough' : ''}" title="${itemName(id)}">${iconHTML(id)}<span>${count} <small>/ ${this.game.itemCount(id)}</small></span></span>`).join('')}</div>
          <button class="button button-green craft-button" data-action="craft" ${canCraft ? '' : 'disabled'}>${recipe.bench && !nearbyBench && !creative ? 'Place a crafting table nearby' : `Craft ${recipe.count > 1 ? recipe.count + ' ' : ''}${recipe.name.toLowerCase()}`} ${svg('plus')}</button></div>
      </div></div>`, 'inventory-panel');
  }

  renderPause() {
    this.shell(`<div class="pause-logo">${logo}</div><div class="panel-eyebrow">THE WORLD CAN WAIT</div><h2>Take a breath<span class="accent-period">.</span></h2><p class="panel-description">${escapeHTML(this.game.data.name)} &nbsp; / &nbsp; Day ${Math.floor(this.game.data.elapsed / 720) + 1}</p><div class="pause-actions"><button class="button button-green" data-action="resume">Back to the wild ${svg('arrow')}</button><button class="button button-outline" data-action="settings">${svg('gear')} Settings</button><button class="button button-outline" data-action="help">${svg('book')} Field guide</button><button class="button button-outline" data-action="save">${svg('check')} Save world</button><button class="quiet-button" data-action="save-exit">Save &amp; return to title</button></div>`, 'pause-panel');
  }
  settingValue(key, value) { return key === 'volume' ? `${Math.round(value * 100)}%` : key === 'sensitivity' ? `${value.toFixed(1)}&times;`.replace('&times;', 'x') : key === 'distance' ? `${value * 16} blocks` : `${value}`; }
  renderSettings() {
    const s = this.game.settings;
    const range = (key, label, min, max, step) => `<label class="setting-row"><span>${label}<output data-value="${key}">${this.settingValue(key, s[key])}</output></span><input type="range" data-setting="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}" aria-label="${label}"></label>`;
    this.shell(`<div class="panel-eyebrow">JUST THE WAY YOU LIKE IT</div><h2>Make yourself at home<span class="accent-period">.</span></h2><div class="settings-content">
      ${range('volume', 'World audio', 0, 1, 0.05)}${range('sensitivity', 'Mouse sensitivity', 0.3, 2, 0.1)}${range('distance', 'View distance', 3, 6, 1)}${range('fov', 'Field of view', 65, 95, 1)}
      <label class="setting-toggle"><span>Soft shadows<small>Sunlight with a little more depth</small></span><input type="checkbox" data-setting="shadows" ${s.shadows ? 'checked' : ''}><i></i></label>
      <label class="setting-toggle"><span>Show coordinates<small>For finding your way back</small></span><input type="checkbox" data-setting="showCoordinates" ${s.showCoordinates ? 'checked' : ''}><i></i></label>
      <label class="setting-select"><span>Weather</span><select data-setting="weather" aria-label="Weather"><option value="auto" ${s.weather === 'auto' ? 'selected' : ''}>Let nature decide</option><option value="clear" ${s.weather === 'clear' ? 'selected' : ''}>Clear skies</option><option value="rain" ${s.weather === 'rain' ? 'selected' : ''}>A little rain</option></select></label>
      <button class="small-link fullscreen-setting" data-action="fullscreen">${svg('fullscreen')} Toggle fullscreen</button></div><button class="button button-green full-width" data-action="close">All set ${svg('check')}</button>`, 'settings-panel');
  }

  renderWorlds() {
    this.panel = 'worlds'; const worlds = listWorlds();
    this.shell(`<div class="panel-eyebrow">PICK UP WHERE YOU WANDERED OFF</div><h2>Your little worlds<span class="accent-period">.</span></h2><div class="world-list">${worlds.length ? worlds.map(w => `<div class="world-row"><div class="world-thumbnail">${logo}</div><button class="world-details" data-action="load-world" data-id="${w.id}"><strong>${escapeHTML(w.name)}</strong><span>${w.mode === 'creative' ? 'Creative' : 'Survival'} &nbsp; &middot; &nbsp; Day ${w.day} &nbsp; &middot; &nbsp; ${new Date(w.updated).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></button><button class="world-play" data-action="load-world" data-id="${w.id}" aria-label="Play ${escapeHTML(w.name)}">${svg('arrow')}</button><button class="delete-world" data-action="delete-world" data-id="${w.id}" aria-label="Delete ${escapeHTML(w.name)}">${svg('trash')}</button></div>`).join('') : `<div class="empty-worlds">${svg('worlds')}<h3>Every world starts with a first step.</h3><p>Make a place that's entirely your own.</p></div>`}</div><button class="button button-green full-width" data-action="new-world">Create a new world ${svg('plus')}</button>`, 'worlds-panel');
  }
  renderDeleteWorld(id) {
    const world = listWorlds().find(w => w.id === id); if (!world) return;
    this.shell(`<div class="panel-eyebrow">A FRESH START?</div><h2>Let this world go?</h2><p class="panel-description">${escapeHTML(world.name)} and everything you've built will be permanently deleted.</p><div class="confirm-actions"><button class="button button-outline" data-action="worlds">Keep my world</button><button class="button button-danger" data-action="confirm-delete" data-id="id-placeholder">Delete world ${svg('trash')}</button></div>`.replace('id-placeholder', id), 'confirm-panel');
  }
  renderNewWorld() {
    this.createMode = 'survival';
    this.shell(`<div class="panel-eyebrow">A BLANK CANVAS. A FRESH ADVENTURE.</div><h2>A world of your own<span class="accent-period">.</span></h2><form id="new-world-form"><label class="field-label">Give it a name<input name="name" value="My little wilderness" maxlength="32" required autocomplete="off" placeholder="Somewhere wonderful"></label><label class="field-label">World seed<span class="seed-field"><input name="seed" placeholder="Leave blank for a little serendipity" maxlength="48" autocomplete="off"><button class="icon-button" data-action="shuffle-seed" type="button" aria-label="Random seed">${svg('shuffle')}</button></span></label><div class="field-label">How will you wander?</div><div class="mode-options"><button type="button" data-action="game-mode" data-mode="survival" class="mode-option selected" aria-pressed="true">${svg('leaf')}<strong>Survival</strong><span>Gather, craft, and find your way.</span></button><button type="button" data-action="game-mode" data-mode="creative" class="mode-option" aria-pressed="false">${svg('worlds')}<strong>Creative</strong><span>Endless blocks. Boundless ideas.</span></button></div><button class="button button-green full-width" type="submit">Let's see what's out there ${svg('arrow')}</button></form>`, 'new-world-panel');
  }
  submitWorld(form) {
    const name = form.elements.name.value.trim() || 'My little wilderness', seed = form.elements.seed.value.trim() || `wild-${Math.random().toString(36).slice(2, 9)}`;
    this.game.startWorld(createWorld(name, seed, this.createMode));
  }

  renderHelp() {
    const controls = [
      ['W A S D', 'Wander around'], ['MOUSE', 'Look around'], ['SPACE', 'Jump / swim up'], ['SHIFT', 'Sprint'],
      ['LEFT CLICK', 'Hold to break & collect'], ['RIGHT CLICK', 'Place a block / eat an apple'], ['1 - 9 / SCROLL', 'Choose your held item'], ['E', 'Backpack & crafting'], ['F', 'Use a crafting table / feed sheep'], ['J', 'Your field notes'], ['ESC', 'Pause & save'], ['V', 'Toggle flight in Creative'],
    ];
    this.shell(`<div class="panel-eyebrow">A LITTLE KNOW-HOW</div><h2>Find your footing<span class="accent-period">.</span></h2><p class="panel-description">No map. No rules. Just a few things worth knowing.</p><div class="controls-grid">${controls.map(([key, label]) => `<div class="control-row"><kbd>${key}</kbd><span>${label}</span></div>`).join('')}</div><div class="guide-note">${svg('leaf')}<p>Start with a tree. Turn logs into planks, then craft a table. Place it nearby to unlock stone tools. The rest is up to you.</p></div><button class="button button-green full-width" data-action="close">Adventure awaits ${svg('arrow')}</button>`, 'help-panel');
  }
  renderJournal() {
    const stats = this.game.data.stats;
    const entries = [
      { title: 'A good place to start', description: 'Collect 8 oak logs from the wild.', value: stats.wood, max: 8, reward: 'Reward: 4 wild apples', key: 'wood' },
      { title: 'Made by you', description: 'Craft your first crafting table.', value: stats.recipes.includes('bench') ? 1 : 0, max: 1, reward: 'Reward: 8 coal', key: 'bench' },
      { title: 'A little more possibility', description: 'Craft a stone pickaxe.', value: stats.recipes.includes('stonepick') ? 1 : 0, max: 1, reward: 'Reward: 4 raw copper', key: 'stonepick' },
      { title: 'Leave a little wonder', description: 'Place 30 blocks in your world.', value: stats.placed, max: 30, reward: 'Reward: 16 glass', key: 'build' },
      { title: 'Beyond the familiar', description: 'Discover all four biomes.', value: stats.biomes.length, max: 4, reward: 'Reward: 32 copper blocks', key: 'explore' },
    ];
    this.shell(`<div class="panel-eyebrow">NOT ALL WHO WANDER ARE LOST</div><h2>Your field notes<span class="accent-period">.</span></h2><p class="panel-description">A few small beginnings for a very big adventure.</p><div class="journal-list">${entries.map((entry, i) => `<div class="journal-entry ${entry.value >= entry.max ? 'complete' : ''}"><span class="journal-number">${entry.value >= entry.max ? svg('check') : String(i + 1).padStart(2, '0')}</span><div class="journal-entry-content"><h3>${entry.title}</h3><p>${entry.description}</p><div class="quest-progress"><div><i style="width:${Math.min(100, entry.value / entry.max * 100)}%"></i></div><span>${Math.min(entry.value, entry.max)} / ${entry.max}</span></div><small>${entry.reward}${stats.rewards.includes(entry.key) ? ' &nbsp; &middot; &nbsp; Collected' : ''}</small></div></div>`).join('')}</div><div class="journal-footer">${svg('compass')} ${Math.floor(stats.distance).toLocaleString()} blocks wandered <span>${stats.biomes.join(' &nbsp; / &nbsp; ')}</span></div>`, 'journal-panel');
  }

  showDeath() {
    this.panel = 'death'; this.game.openPanel('death'); this.host.classList.add('is-menu');
    this.shell(`<div class="pause-logo">${logo}</div><div class="panel-eyebrow">EVERY ADVENTURE HAS A DETOUR</div><h2>A softer landing next time<span class="accent-period">.</span></h2><p class="panel-description">Your world and backpack are right where you left them.</p><button class="button button-green full-width" data-action="respawn">Back on your feet ${svg('arrow')}</button>`, 'pause-panel');
    this.modalRoot.querySelector('.close-button').hidden = true;
  }
  toast(message, icon = 'leaf') {
    const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = `${svg(icon)}<span>${escapeHTML(message)}</span>`;
    const container = this.host.querySelector('.toast-container'); container.appendChild(el);
    while (container.children.length > 3) container.firstChild.remove();
    setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 300); }, 3800);
  }
  saved() { const el = this.host.querySelector('.save-indicator'); el.classList.add('visible'); clearTimeout(this.savedTimer); this.savedTimer = setTimeout(() => el.classList.remove('visible'), 2200); }
  damage() { const el = this.host.querySelector('.damage-overlay'); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  dispose() {
    this.host.removeEventListener('click', this.clickHandler); this.host.removeEventListener('input', this.inputHandler); this.host.removeEventListener('change', this.inputHandler);
    this.host.removeEventListener('submit', this.submitHandler); this.host.removeEventListener('dragstart', this.dragHandler); this.host.removeEventListener('dragover', this.overHandler); this.host.removeEventListener('drop', this.dropHandler);
    clearTimeout(this.savedTimer);
  }
}