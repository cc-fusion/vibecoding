import { ITEMS, RECIPES, getBlock, getItem, xpLevel, xpForLevel, xpForNextLevel } from './blocks.js';
import { itemIcon } from './textures.js';

const $ = (id) => document.getElementById(id);
const escapeHTML = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const heartSVG = '<svg class="status-icon" viewBox="0 0 24 24" fill="#d86d64"><path d="M12 21 3.4 12.8C-2 7.3 5.5.1 12 5.8 18.5.1 26 7.3 20.6 12.8Z"/></svg>';
const hungerSVG = '<svg class="status-icon" viewBox="0 0 24 24" fill="#d6b36c"><path d="M14.8 2.8c-3.5-1-7.2 1.5-7.8 5-.4 2.2.4 3.8 1.8 5.1l-5 4.3c-1.2 1-1.3 2.8-.3 3.9s2.8 1.1 3.9-.1c1-1.1.9-2.7.1-3.7l4.7-4c1.5.8 3.4.8 5.2-.2 3.2-1.8 4.3-6 2.2-8.7l-3.1 4.1-2.4-2.4Z"/></svg>';

export class UI {
  constructor(atlas, storage) {
    this.atlas = atlas;
    this.storage = storage;
    this.actions = {};
    this.mode = 'survival';
    this.recipeFilter = 'all';
    this.slotPick = null;
    this.inventory = null;
    this.craftingContext = null;
    this.hotbarSignature = '';
    this.statusSignature = '';
    this.announcementTimer = null;
    this.screens = [...document.querySelectorAll('.screen')];
    this.buildStatusBars();
    this.buildHotbar();
    this.buildInventoryGrid();
    this.bindEvents();
  }

  setActions(actions) {
    this.actions = actions;
  }

  buildStatusBars() {
    $('health-bar').innerHTML = Array.from({ length: 10 }, () => heartSVG).join('');
    $('hunger-bar').innerHTML = Array.from({ length: 10 }, () => hungerSVG).join('');
  }

  buildHotbar() {
    $('hotbar').innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.innerHTML = '<span class="slot-key"></span>';
      slot.querySelector('.slot-key').textContent = i + 1;
      $('hotbar').appendChild(slot);
    }
  }

  buildInventoryGrid() {
    $('inventory-grid').innerHTML = '';
    for (let i = 0; i < 36; i++) {
      const slot = document.createElement('button');
      slot.className = 'slot';
      slot.dataset.index = i;
      slot.addEventListener('click', () => {
        if (this.slotPick === null) {
          if (!this.inventory?.slots[i]) return;
          this.slotPick = i;
        } else if (this.slotPick === i) this.slotPick = null;
        else {
          const from = this.slotPick;
          this.slotPick = null;
          this.actions.moveSlot?.(from, i);
        }
        this.refreshInventory();
      });
      $('inventory-grid').appendChild(slot);
    }
  }

  bindEvents() {
    document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => {
      this.mode = button.dataset.mode;
      document.querySelectorAll('[data-mode]').forEach((other) => other.classList.toggle('selected', other === button));
      this.actions.sound?.('click');
    }));
    $('create-world-form').addEventListener('submit', (event) => {
      event.preventDefault();
      this.actions.createWorld?.({ name: $('world-name').value, seed: $('world-seed').value, mode: this.mode });
    });
    $('inventory-close').addEventListener('click', () => this.actions.closeInventory?.());
    $('sort-inventory').addEventListener('click', () => this.actions.sortInventory?.());
    $('resume-button').addEventListener('click', () => this.actions.resume?.());
    $('settings-button').addEventListener('click', () => $('settings-panel').classList.remove('hidden'));
    $('settings-close').addEventListener('click', () => $('settings-panel').classList.add('hidden'));
    $('save-menu-button').addEventListener('click', () => this.actions.saveAndMenu?.());
    $('respawn-button').addEventListener('click', () => this.actions.respawn?.());
    document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => {
      this.recipeFilter = button.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach((other) => other.classList.toggle('selected', other === button));
      this.refreshInventory();
    }));
    const settings = [
      ['render-distance', 'renderDistance', (v) => `${v} chunks`, Number],
      ['fov', 'fov', (v) => `${v}°`, Number],
      ['sensitivity', 'sensitivity', (v) => `${Number(v).toFixed(1)}×`, Number],
      ['volume', 'volume', (v) => `${Math.round(v * 100)}%`, Number],
    ];
    for (const [id, key, format, parse] of settings) {
      $(id).addEventListener('input', () => {
        const value = parse($(id).value);
        $(`${id}-value`).textContent = format(value);
        this.actions.setting?.(key, value);
      });
    }
  }

  applySettings(settings) {
    for (const [key, id] of Object.entries({ renderDistance: 'render-distance', fov: 'fov', sensitivity: 'sensitivity', volume: 'volume' })) {
      $(id).value = settings[key];
    }
    $('render-distance-value').textContent = `${settings.renderDistance} chunks`;
    $('fov-value').textContent = `${settings.fov}°`;
    $('sensitivity-value').textContent = `${Number(settings.sensitivity).toFixed(1)}×`;
    $('volume-value').textContent = `${Math.round(settings.volume * 100)}%`;
  }

  showOnly(id = null) {
    for (const screen of this.screens) screen.classList.toggle('active', screen.id === id);
  }

  showMenu() {
    this.showOnly('menu-screen');
    $('hud').classList.add('hidden');
    this.renderWorlds();
  }

  renderWorlds() {
    const worlds = this.storage.list();
    const list = $('world-list');
    if (!worlds.length) {
      list.innerHTML = '<div class="empty-worlds">Your first sanctuary is waiting.<br>Name a world and choose a seed to begin.</div>';
      return;
    }
    list.innerHTML = worlds.map((world) => {
      const date = new Date(world.lastPlayed).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      return `<article class="world-card" data-world="${escapeHTML(world.id)}">
        <div><h3>${escapeHTML(world.name)}</h3><p>Seed ${escapeHTML(world.seed)} · ${world.mode === 'peaceful' ? 'Peaceful' : 'Survival'}<br>Level ${world.level || 1} · Last played ${date}</p></div>
        <div class="world-actions"><button class="world-delete">Delete</button><button class="world-load">Enter world</button></div>
      </article>`;
    }).join('');
    list.querySelectorAll('.world-card').forEach((card) => {
      const id = card.dataset.world;
      card.querySelector('.world-load').addEventListener('click', () => this.actions.loadWorld?.(id));
      const deleteButton = card.querySelector('.world-delete');
      deleteButton.addEventListener('click', () => {
        if (deleteButton.classList.contains('confirm')) this.actions.deleteWorld?.(id);
        else {
          deleteButton.classList.add('confirm');
          deleteButton.textContent = 'Confirm';
          setTimeout(() => { deleteButton.classList.remove('confirm'); deleteButton.textContent = 'Delete'; }, 3500);
        }
      });
    });
  }

  setLoading(progress, label = 'Shaping terrain') {
    this.showOnly('loading-screen');
    $('loading-fill').style.width = `${Math.round(progress * 100)}%`;
    $('loading-label').textContent = label;
  }

  showGame() {
    this.showOnly();
    $('hud').classList.remove('hidden');
  }

  openInventory(inventory, context) {
    this.inventory = inventory;
    this.craftingContext = context;
    this.slotPick = null;
    $('inventory-screen').classList.add('active');
    this.refreshInventory();
  }

  closeInventory() {
    $('inventory-screen').classList.remove('active');
    this.slotPick = null;
  }

  openPause() {
    $('pause-screen').classList.add('active');
    $('settings-panel').classList.add('hidden');
  }

  closePause() {
    $('pause-screen').classList.remove('active');
  }

  showDeath(source) {
    const messages = {
      fall: 'The ground was less forgiving than it looked.', starvation: 'Hunger overtook your expedition.', void: 'You slipped beyond the edge of the world.', food: 'That meal was not quite ready to eat.',
    };
    $('death-cause').textContent = messages[source] || `${source || 'The wilds'} ended this journey.`;
    $('death-screen').classList.add('active');
  }

  hideDeath() {
    $('death-screen').classList.remove('active');
  }

  slotContent(element, slot, selected = false, picked = false) {
    const def = slot ? getItem(slot.id) : null;
    element.classList.toggle('selected', selected);
    element.classList.toggle('picked', picked);
    element.title = def ? def.name : 'Empty slot';
    const key = element.querySelector('.slot-key')?.outerHTML || '';
    let html = key;
    if (slot && def) {
      html += `<img src="${itemIcon(slot.id, this.atlas)}" alt="" />`;
      if (slot.count > 1) html += `<span class="slot-count">${slot.count}</span>`;
      if (def.durability && slot.durability !== undefined) {
        const ratio = slot.durability / def.durability;
        html += `<div class="durability"><span style="width:${Math.max(0, ratio * 100)}%;background:${ratio < 0.25 ? '#d87564' : '#82c875'}"></span></div>`;
      }
    }
    element.innerHTML = html;
  }

  updateHotbar(inventory) {
    const signature = JSON.stringify([inventory.selected, inventory.slots.slice(0, 9)]);
    if (signature === this.hotbarSignature) return;
    this.hotbarSignature = signature;
    [...$('hotbar').children].forEach((element, index) => this.slotContent(element, inventory.slots[index], inventory.selected === index));
  }

  refreshInventory() {
    if (!this.inventory || !this.craftingContext) return;
    [...$('inventory-grid').children].forEach((element, index) => this.slotContent(element, this.inventory.slots[index], false, this.slotPick === index));
    $('inventory-level').textContent = `Level ${this.craftingContext.level} · ${this.inventory.slots.filter(Boolean).length}/36 slots used`;
    const stations = this.craftingContext.stations;
    $('station-label').textContent = stations.furnace ? 'Furnace in reach' : stations.crafting_table ? 'Crafting table in reach' : 'Field crafting';
    const recipes = RECIPES.filter((recipe) => this.recipeFilter === 'all' || recipe.category === this.recipeFilter);
    $('recipe-list').innerHTML = recipes.map((recipe) => {
      const output = ITEMS[recipe.out];
      let requirement = '';
      if (this.craftingContext.level < (recipe.level || 1)) requirement = `Unlocks at level ${recipe.level}`;
      else if (recipe.boss && !this.craftingContext.guardianDefeated) requirement = 'Defeat the Ancient Guardian to unlock';
      else if (recipe.station && !stations[recipe.station]) requirement = `Requires a nearby ${recipe.station === 'furnace' ? 'furnace' : 'crafting table'}`;
      const ingredients = Object.entries(recipe.ingredients).map(([id, count]) => {
        const held = this.inventory.countItem(id);
        return `<span class="${held < count ? 'missing' : ''}">${getItem(id).name} ${held}/${count}</span>`;
      }).join('');
      const canCraft = !requirement && this.inventory.hasIngredients(recipe.ingredients);
      return `<article class="recipe-card ${requirement ? 'locked' : ''}">
        <div class="recipe-output"><img src="${itemIcon(recipe.out, this.atlas)}" alt="" />${recipe.count > 1 ? `<span>×${recipe.count}</span>` : ''}</div>
        <div class="recipe-info"><strong>${output.name}</strong><div class="recipe-ingredients">${ingredients}</div>${requirement ? `<span class="recipe-requirement">${requirement}</span>` : ''}</div>
        <button class="craft-button" data-recipe="${recipe.id}" ${canCraft ? '' : 'disabled'}>Craft</button>
      </article>`;
    }).join('');
    $('recipe-list').querySelectorAll('[data-recipe]').forEach((button) => button.addEventListener('click', () => this.actions.craft?.(button.dataset.recipe)));
  }

  updateHUD({ player, inventory, environment, world, xp, objective, boss }) {
    const statusSignature = `${player.health},${player.hunger},${xp}`;
    if (statusSignature !== this.statusSignature) {
      this.statusSignature = statusSignature;
      const updateIcons = (id, value) => [...$(id).children].forEach((icon, index) => {
        icon.classList.toggle('empty', value < index * 2 + 1);
        icon.classList.toggle('half', value === index * 2 + 1);
      });
      updateIcons('health-bar', Math.ceil(player.health));
      updateIcons('hunger-bar', Math.ceil(player.hunger));
      const level = xpLevel(xp);
      const current = xpForLevel(level); const next = xpForNextLevel(level);
      $('level-label').textContent = `Level ${level}`;
      $('xp-fill').style.width = `${Math.min(100, ((xp - current) / (next - current)) * 100)}%`;
    }
    this.updateHotbar(inventory);
    $('day-label').textContent = `Day ${environment.day}`;
    $('time-label').textContent = environment.timeLabel();
    $('weather-label').textContent = environment.weather === 'storm' ? 'Thunderstorm' : environment.weather === 'rain' ? 'Rain' : 'Clear';
    $('objective-title').textContent = objective.title;
    $('objective-detail').textContent = objective.detail;
    $('biome-label').textContent = world.biomeAt(Math.floor(player.position.x), Math.floor(player.position.z)).name;
    $('underwater-overlay').classList.toggle('active', player.underwater);
    if (boss) {
      $('boss-panel').classList.remove('hidden');
      $('boss-fill').style.width = `${Math.max(0, boss.health / boss.maxHealth) * 100}%`;
      $('boss-phase').textContent = `Phase ${['I', 'II', 'III'][boss.phase - 1]}`;
    } else $('boss-panel').classList.add('hidden');
  }

  updateTarget(target, progress = 0, detail = '') {
    if (!target) {
      $('target-info').classList.add('hidden');
      return;
    }
    $('target-info').classList.remove('hidden');
    $('target-name').textContent = getBlock(target.id).name;
    $('target-detail').textContent = detail;
    $('mining-meter').classList.toggle('hidden', progress <= 0);
    $('mining-fill').style.width = `${Math.min(100, progress * 100)}%`;
  }

  updateEntityTarget(entity) {
    if (!entity) {
      $('target-info').classList.add('hidden');
      return;
    }
    $('target-info').classList.remove('hidden');
    $('target-name').textContent = entity.name;
    $('target-detail').textContent = `${Math.max(0, Math.ceil(entity.health))} / ${entity.maxHealth} health`;
    $('mining-meter').classList.add('hidden');
  }

  setCombatTarget(active) {
    $('crosshair').classList.toggle('hit', active);
  }

  toast(message, type = '') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    $('toasts').appendChild(toast);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
    setTimeout(() => {
      toast.classList.add('leaving');
      setTimeout(() => toast.remove(), 350);
    }, 2600);
  }

  announce(eyebrow, title, detail = '', duration = 3600) {
    clearTimeout(this.announcementTimer);
    const element = $('announcement');
    element.querySelector('span').textContent = eyebrow;
    element.querySelector('strong').textContent = title;
    element.querySelector('p').textContent = detail;
    element.classList.remove('hidden');
    this.announcementTimer = setTimeout(() => element.classList.add('hidden'), duration);
  }

  damageFlash() {
    $('damage-overlay').classList.add('active');
    setTimeout(() => $('damage-overlay').classList.remove('active'), 90);
  }

  lightningFlash() {
    $('lightning-overlay').classList.add('active');
    setTimeout(() => $('lightning-overlay').classList.remove('active'), 80);
  }

  updateDebug(text, visible) {
    $('debug-panel').classList.toggle('hidden', !visible);
    if (visible) $('debug-panel').textContent = text;
  }
}
