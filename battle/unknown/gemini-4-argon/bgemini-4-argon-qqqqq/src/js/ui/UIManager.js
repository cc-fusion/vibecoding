import { GAME_MODES } from '../constants.js';
import { getAllCreativeEntries, getEntry } from '../data/items.js';
import {
  canCraftRecipeWithInventory,
  consumeIngredientsFromInventory,
  CRAFTING_RECIPES,
  getFuelBurnTime,
  getRecipeIngredients,
  getSmeltingResult,
  matchCraftingGrid,
  recipeFitsGrid,
  SMELTING_RECIPES,
} from '../data/recipes.js';

const SEED_IDEAS = [
  'EmeraldPeaks',
  'WhisperingWoods',
  'SunlitDunes',
  'GlacierValley',
  'CoralArchipelago',
  'StarlightRidge',
  'DeepCaverns-77',
  'NordicFjord',
];

export class UIManager {
  constructor(game) {
    this.game = game;
    this.atlas = game.atlas;

    // DOM elements
    this.titleScreen = document.getElementById('title-screen');
    this.savedWorldsCard = document.getElementById('saved-worlds-card');
    this.worldListEl = document.getElementById('world-list');
    this.createForm = document.getElementById('create-world-form');
    this.worldNameInput = document.getElementById('world-name-input');
    this.worldSeedInput = document.getElementById('world-seed-input');
    this.randomSeedBtn = document.getElementById('random-seed-btn');
    this.modeDescEl = document.getElementById('mode-description');

    this.hudEl = document.getElementById('hud');
    this.biomeClockPill = document.getElementById('biome-clock-pill');
    this.debugOverlay = document.getElementById('debug-overlay');
    this.interactionHint = document.getElementById('interaction-hint');
    this.toastBanner = document.getElementById('toast-banner');
    this.heldLabel = document.getElementById('held-item-label');
    this.vitalsRow = document.getElementById('vitals-row');
    this.heartsBar = document.getElementById('hearts-bar');
    this.hungerBar = document.getElementById('hunger-bar');
    this.hotbarEl = document.getElementById('hotbar');
    this.underwaterOverlay = document.getElementById('underwater-overlay');
    this.hurtOverlay = document.getElementById('hurt-overlay');

    this.invModal = document.getElementById('inventory-modal');
    this.stationTitle = document.getElementById('station-title');
    this.craftingSection = document.getElementById('crafting-section');
    this.craftingGridEl = document.getElementById('crafting-grid');
    this.craftingOutputEl = document.getElementById('crafting-output-slot');
    this.furnaceSection = document.getElementById('furnace-section');
    this.furnaceInputEl = document.getElementById('furnace-input-slot');
    this.furnaceFuelEl = document.getElementById('furnace-fuel-slot');
    this.furnaceOutputEl = document.getElementById('furnace-output-slot');
    this.furnaceFlameFill = document.getElementById('furnace-flame-fill');
    this.furnaceProgFill = document.getElementById('furnace-progress-fill');
    this.chestSection = document.getElementById('chest-section');
    this.chestGridEl = document.getElementById('chest-grid');
    this.bagGridEl = document.getElementById('bag-grid');
    this.modalHotbarEl = document.getElementById('modal-hotbar-grid');

    this.helperSidebar = document.getElementById('helper-sidebar');
    this.sidebarHeading = document.getElementById('sidebar-heading');
    this.sidebarTabs = document.getElementById('sidebar-tabs');
    this.tabRecipesBtn = document.getElementById('tab-recipes');
    this.tabCreativeBtn = document.getElementById('tab-creative');
    this.recipesPanel = document.getElementById('recipes-panel');
    this.recipeListEl = document.getElementById('recipe-list');
    this.creativePanel = document.getElementById('creative-panel');
    this.creativeSearch = document.getElementById('creative-search');
    this.creativeGridEl = document.getElementById('creative-grid');

    this.pauseModal = document.getElementById('pause-modal');
    this.controlsModal = document.getElementById('controls-modal');
    this.deathModal = document.getElementById('death-modal');

    this.cursorItemEl = document.getElementById('cursor-item');
    this.tooltipEl = document.getElementById('item-tooltip');

    // UI state
    this.selectedNewMode = GAME_MODES.SURVIVAL;
    this.activeModal = null; // null | 'inventory' | 'pause' | 'controls' | 'death'
    this.stationMode = 'inventory'; // 'inventory' | 'crafting_table' | 'furnace' | 'chest'
    this.activeSidebarTab = 'recipes';
    this.craftingSize = 2;
    this.craftingSlots = new Array(9).fill(null);
    this.activeFurnace = null;
    this.activeChestSlots = null;
    this.cursorRef = { item: null };

    this.showDebug = false;
    this._toastTimeout = null;
    this._heldLabelTimeout = null;
    this._lastSelectedHotbar = -1;
    this._lastHeldId = -1;

    this._bindEvents();
  }

  _bindEvents() {
    // Prevent default right-click menu inside game/modals
    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Track mouse for dragged cursor item & tooltip
    window.addEventListener('mousemove', (e) => {
      if (this.cursorRef.item) {
        this.cursorItemEl.style.left = `${e.clientX}px`;
        this.cursorItemEl.style.top = `${e.clientY}px`;
      }
      if (!this.tooltipEl.classList.contains('hidden')) {
        const x = Math.min(window.innerWidth - 250, e.clientX + 14);
        const y = Math.min(window.innerHeight - 80, e.clientY + 14);
        this.tooltipEl.style.left = `${x}px`;
        this.tooltipEl.style.top = `${y}px`;
      }
    });

    // Title screen mode toggle
    document.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.game.sound.unlock();
        this.game.sound.playClick();
        document.querySelectorAll('.seg-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedNewMode = btn.dataset.mode;
        this.modeDescEl.textContent = this.selectedNewMode === GAME_MODES.CREATIVE
          ? 'Unlimited blocks and tools, instant mining, invulnerability, and free flight.'
          : 'Gather resources, craft tools, manage hunger, and survive the night.';
      });
    });

    this.randomSeedBtn.addEventListener('click', () => {
      this.game.sound.unlock();
      this.game.sound.playClick();
      const pick = SEED_IDEAS[Math.floor(Math.random() * SEED_IDEAS.length)] + '-' + Math.floor(100 + Math.random() * 900);
      this.worldSeedInput.value = pick;
    });

    this.createForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.game.sound.unlock();
      this.game.sound.playClick();
      const name = this.worldNameInput.value.trim() || 'New World';
      const seed = this.worldSeedInput.value.trim() || `Seed-${Math.floor(100000 + Math.random() * 900000)}`;
      this.game.startNewWorld({ name, seed, gameMode: this.selectedNewMode });
    });

    document.getElementById('title-controls-btn').addEventListener('click', () => {
      this.game.sound.unlock();
      this.game.sound.playClick();
      this.openControlsModal();
    });

    // HUD buttons
    document.getElementById('hud-inv-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.openStationModal('inventory');
    });
    document.getElementById('hud-pause-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.openPauseModal();
    });

    // Modal close buttons
    document.getElementById('close-inv-btn').addEventListener('click', () => {
      this.closeModalsAndLock();
    });
    document.getElementById('close-controls-btn').addEventListener('click', () => {
      this._closeControlsReturn();
    });
    document.getElementById('done-controls-btn').addEventListener('click', () => {
      this._closeControlsReturn();
    });

    // Sidebar Tabs
    this.tabRecipesBtn.addEventListener('click', () => {
      this.activeSidebarTab = 'recipes';
      this._syncSidebarTabs();
      this.renderStationModal();
    });
    this.tabCreativeBtn.addEventListener('click', () => {
      this.activeSidebarTab = 'creative';
      this._syncSidebarTabs();
      this.renderStationModal();
    });
    this.creativeSearch.addEventListener('input', () => {
      this._renderCreativePalette();
    });

    // Pause & Settings Controls
    const distSlider = document.getElementById('render-dist-slider');
    const distVal = document.getElementById('render-dist-val');
    distSlider.addEventListener('input', () => {
      const v = Number(distSlider.value);
      distVal.textContent = `${v} chunks`;
      if (this.game.world) this.game.world.renderDistance = v;
    });

    const fovSlider = document.getElementById('fov-slider');
    const fovVal = document.getElementById('fov-val');
    fovSlider.addEventListener('input', () => {
      const v = Number(fovSlider.value);
      fovVal.textContent = `${v}°`;
      this.game.player.baseFov = v;
      this.game.camera.fov = v;
      this.game.camera.updateProjectionMatrix();
    });

    const sfxSlider = document.getElementById('sfx-slider');
    const sfxVal = document.getElementById('sfx-val');
    sfxSlider.addEventListener('input', () => {
      const v = Number(sfxSlider.value);
      sfxVal.textContent = `${v}%`;
      this.game.sound.sfxVolume = v / 100;
    });

    const musicSlider = document.getElementById('music-slider');
    const musicVal = document.getElementById('music-val');
    musicSlider.addEventListener('input', () => {
      const v = Number(musicSlider.value);
      musicVal.textContent = `${v}%`;
      this.game.sound.musicVolume = v / 100;
    });

    document.querySelectorAll('[data-time]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.game.sound.playClick();
        this.game.skyWeather.setTimeOfDay(Number(btn.dataset.time));
        this.showToast(`Time set to ${btn.textContent}`);
      });
    });

    document.querySelectorAll('[data-weather]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.game.sound.playClick();
        this.game.skyWeather.weather = btn.dataset.weather;
        this.showToast(`Weather set to ${btn.textContent}`);
      });
    });

    const toggleModeBtn = document.getElementById('toggle-mode-btn');
    toggleModeBtn.addEventListener('click', () => {
      this.game.sound.playClick();
      const next = this.game.player.gameMode === GAME_MODES.SURVIVAL ? GAME_MODES.CREATIVE : GAME_MODES.SURVIVAL;
      this.game.setGameMode(next);
      toggleModeBtn.textContent = `Mode: ${next === GAME_MODES.CREATIVE ? 'Creative' : 'Survival'}`;
      this.showToast(`Switched to ${next === GAME_MODES.CREATIVE ? 'Creative' : 'Survival'} mode`);
    });

    document.getElementById('resume-btn').addEventListener('click', () => {
      this.game.sound.playClick();
      this.closeModalsAndLock();
    });
    document.getElementById('pause-controls-btn').addEventListener('click', () => {
      this.game.sound.playClick();
      this.openControlsModal('pause');
    });
    document.getElementById('save-quit-btn').addEventListener('click', async () => {
      this.game.sound.playClick();
      await this.game.returnToTitle();
    });

    document.getElementById('respawn-btn').addEventListener('click', () => {
      this.game.sound.playClick();
      this.game.respawnPlayer();
    });
  }

  async refreshSavedWorlds() {
    const worlds = await this.game.persistence.listWorlds();
    if (!worlds.length) {
      this.savedWorldsCard.classList.add('hidden');
      this.worldListEl.innerHTML = '';
      return;
    }

    this.savedWorldsCard.classList.remove('hidden');
    this.worldListEl.innerHTML = '';

    for (const w of worlds) {
      const row = document.createElement('div');
      row.className = 'world-item';

      const meta = document.createElement('div');
      meta.className = 'world-meta';
      const modeName = w.gameMode === GAME_MODES.CREATIVE ? 'Creative' : 'Survival';
      const dayNum = w.envData?.dayNumber || 1;
      meta.innerHTML = `
        <div class="world-meta-name"></div>
        <div class="world-meta-sub">${modeName} &middot; Day ${dayNum} &middot; Seed: <span class="seed-span"></span></div>
      `;
      meta.querySelector('.world-meta-name').textContent = w.name;
      meta.querySelector('.seed-span').textContent = w.seedString || w.worldData?.seed || '';

      const actions = document.createElement('div');
      actions.className = 'world-item-actions';

      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'primary-btn small-btn';
      playBtn.textContent = 'Play';
      playBtn.addEventListener('click', () => {
        this.game.sound.unlock();
        this.game.sound.playClick();
        this.game.loadExistingWorld(w.id);
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'danger-btn';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async () => {
        this.game.sound.unlock();
        this.game.sound.playClick();
        await this.game.persistence.deleteWorld(w.id);
        await this.refreshSavedWorlds();
      });

      actions.append(playBtn, delBtn);
      row.append(meta, actions);
      this.worldListEl.appendChild(row);
    }
  }

  showTitleScreen() {
    this.activeModal = null;
    this.titleScreen.classList.remove('hidden');
    this.hudEl.classList.add('hidden');
    this.invModal.classList.add('hidden');
    this.pauseModal.classList.add('hidden');
    this.controlsModal.classList.add('hidden');
    this.deathModal.classList.add('hidden');
    this.hideTooltip();
    this.refreshSavedWorlds();
  }

  enterGameplayHUD() {
    this.titleScreen.classList.add('hidden');
    this.hudEl.classList.remove('hidden');
    document.getElementById('toggle-mode-btn').textContent =
      `Mode: ${this.game.player.gameMode === GAME_MODES.CREATIVE ? 'Creative' : 'Survival'}`;
    this.renderHotbar();
    this.renderVitals();
  }

  showToast(message) {
    if (!message) return;
    this.toastBanner.textContent = message;
    this.toastBanner.classList.remove('hidden');
    if (this._toastTimeout) clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      this.toastBanner.classList.add('hidden');
    }, 2400);
  }

  flashHurt() {
    this.hurtOverlay.style.opacity = '1';
    setTimeout(() => {
      this.hurtOverlay.style.opacity = '0';
    }, 220);
  }

  renderVitals() {
    const player = this.game.player;
    if (player.gameMode === GAME_MODES.CREATIVE) {
      this.vitalsRow.classList.add('hidden');
      return;
    }
    this.vitalsRow.classList.remove('hidden');

    let heartsHtml = '';
    for (let i = 0; i < 10; i++) {
      const hpVal = player.health - i * 2;
      const cls = hpVal >= 2 ? 'heart-full' : hpVal === 1 ? 'heart-half' : 'heart-empty';
      heartsHtml += `<div class="vital-pip ${cls}"></div>`;
    }
    this.heartsBar.innerHTML = heartsHtml;

    let foodHtml = '';
    for (let i = 0; i < 10; i++) {
      const fVal = player.hunger - i * 2;
      const cls = fVal >= 2 ? 'food-full' : fVal === 1 ? 'food-half' : 'food-empty';
      foodHtml += `<div class="vital-pip ${cls}"></div>`;
    }
    this.hungerBar.innerHTML = foodHtml;
  }

  _fillSlotElement(el, item, keyHint = null) {
    el.innerHTML = '';
    if (keyHint !== null) {
      const k = document.createElement('span');
      k.className = 'slot-key';
      k.textContent = String(keyHint);
      el.appendChild(k);
    }

    if (!item || item.count <= 0) return;

    const entry = getEntry(item.id);
    if (!entry) return;

    const img = document.createElement('img');
    img.className = 'slot-icon';
    img.src = this.atlas.getIconUrl(item.id);
    img.alt = entry.name;
    el.appendChild(img);

    if (item.count > 1) {
      const c = document.createElement('span');
      c.className = 'slot-count';
      c.textContent = String(item.count);
      el.appendChild(c);
    }

    if (entry.maxDurability > 0 && item.durability !== undefined && item.durability < entry.maxDurability) {
      const wrap = document.createElement('div');
      wrap.className = 'slot-durability';
      const fill = document.createElement('div');
      fill.className = 'slot-durability-fill';
      const pct = Math.max(0, Math.min(100, (item.durability / entry.maxDurability) * 100));
      fill.style.width = `${pct}%`;
      fill.style.background = pct > 50 ? '#4ade80' : pct > 22 ? '#facc15' : '#ef4444';
      wrap.appendChild(fill);
      el.appendChild(wrap);
    }
  }

  renderHotbar() {
    const inv = this.game.inventory;
    this.hotbarEl.innerHTML = '';

    for (let i = 0; i < 9; i++) {
      const slotEl = document.createElement('div');
      slotEl.className = 'inv-slot' + (i === inv.selectedHotbar ? ' selected' : '');
      this._fillSlotElement(slotEl, inv.slots[i], i + 1);
      slotEl.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        inv.selectHotbar(i);
      });
      this.hotbarEl.appendChild(slotEl);
    }

    // Show held item name briefly when switching slots or item changes
    const held = inv.getHeldEntry();
    const curId = held ? held.id : 0;
    if (inv.selectedHotbar !== this._lastSelectedHotbar || curId !== this._lastHeldId) {
      this._lastSelectedHotbar = inv.selectedHotbar;
      this._lastHeldId = curId;
      if (held) {
        this.heldLabel.textContent = held.name;
        this.heldLabel.classList.add('visible');
        if (this._heldLabelTimeout) clearTimeout(this._heldLabelTimeout);
        this._heldLabelTimeout = setTimeout(() => {
          this.heldLabel.classList.remove('visible');
        }, 1800);
      } else {
        this.heldLabel.classList.remove('visible');
      }
    }
  }

  _syncCursorElement() {
    const item = this.cursorRef.item;
    if (!item || item.count <= 0) {
      this.cursorRef.item = null;
      this.cursorItemEl.classList.add('hidden');
      this.cursorItemEl.innerHTML = '';
      return;
    }
    this.cursorItemEl.classList.remove('hidden');
    this._fillSlotElement(this.cursorItemEl, item);
  }

  showItemTooltip(itemId, extraLine = '') {
    const entry = getEntry(itemId);
    if (!entry) {
      this.hideTooltip();
      return;
    }
    const details = [];
    if (entry.attackDamage > 1) details.push(`Attack: +${entry.attackDamage}`);
    if (entry.miningSpeed > 1) details.push(`Mining Speed: ${entry.miningSpeed}x`);
    if (entry.foodRestore > 0) details.push(`Restores ${entry.foodRestore} Hunger`);
    if (entry.fuelTime > 0) details.push(`Fuel (${entry.fuelTime}s)`);
    if (extraLine) details.push(extraLine);

    this.tooltipEl.innerHTML = `
      <div><strong>${entry.name}</strong></div>
      ${details.length ? `<div class="tooltip-sub">${details.join(' &middot; ')}</div>` : ''}
    `;
    this.tooltipEl.classList.remove('hidden');
  }

  hideTooltip() {
    this.tooltipEl.classList.add('hidden');
  }

  _syncSidebarTabs() {
    const isCreative = this.game.player.gameMode === GAME_MODES.CREATIVE;
    const showTabs = isCreative && this.stationMode !== 'furnace';
    this.sidebarTabs.classList.toggle('hidden', !showTabs);
    this.sidebarHeading.classList.toggle('hidden', showTabs);
    this.sidebarHeading.textContent = this.stationMode === 'furnace' ? 'Smelting Guide' : 'Recipes';

    if ((!isCreative || this.stationMode === 'furnace') && this.activeSidebarTab === 'creative') {
      this.activeSidebarTab = 'recipes';
    }
    this.tabRecipesBtn.classList.toggle('active', this.activeSidebarTab === 'recipes');
    this.tabCreativeBtn.classList.toggle('active', this.activeSidebarTab === 'creative');
    this.recipesPanel.classList.toggle('hidden', this.activeSidebarTab !== 'recipes');
    this.creativePanel.classList.toggle('hidden', this.activeSidebarTab !== 'creative');
  }

  openStationModal(mode = 'inventory', blockData = null) {
    this.game.unlockPointer();
    this.activeModal = 'inventory';
    this.stationMode = mode;

    this.pauseModal.classList.add('hidden');
    this.controlsModal.classList.add('hidden');
    this.invModal.classList.remove('hidden');

    this.activeFurnace = null;
    this.activeChestSlots = null;

    if (mode === 'crafting_table') {
      this.stationTitle.textContent = 'Crafting Table (3×3)';
      this.craftingSize = 3;
      this.helperSidebar.classList.remove('hidden');
    } else if (mode === 'furnace') {
      this.stationTitle.textContent = 'Furnace Smelting';
      this.activeFurnace = blockData;
      this.activeSidebarTab = 'recipes';
      this.helperSidebar.classList.remove('hidden');
    } else if (mode === 'chest') {
      this.stationTitle.textContent = 'Storage Chest';
      this.activeChestSlots = blockData;
      this.helperSidebar.classList.add('hidden');
    } else {
      this.stationTitle.textContent = this.game.player.gameMode === GAME_MODES.CREATIVE
        ? 'Creative Inventory & Crafting'
        : 'Inventory & Crafting';
      this.craftingSize = 2;
      if (this.game.player.gameMode === GAME_MODES.CREATIVE) {
        this.activeSidebarTab = 'creative';
      }
      this.helperSidebar.classList.remove('hidden');
    }

    this.craftingSection.classList.toggle('hidden', mode !== 'inventory' && mode !== 'crafting_table');
    this.furnaceSection.classList.toggle('hidden', mode !== 'furnace');
    this.chestSection.classList.toggle('hidden', mode !== 'chest');

    this._syncSidebarTabs();
    this.renderStationModal();
  }

  openPauseModal() {
    if (this.activeModal === 'death') return;
    this._returnCraftingAndCursorItems();
    this.game.unlockPointer();
    this.activeModal = 'pause';
    this.invModal.classList.add('hidden');
    this.controlsModal.classList.add('hidden');
    this.pauseModal.classList.remove('hidden');
    this.hideTooltip();
  }

  openControlsModal(returnTo = 'title') {
    this._controlsReturnTo = returnTo;
    this.activeModal = 'controls';
    this.pauseModal.classList.add('hidden');
    this.controlsModal.classList.remove('hidden');
  }

  _closeControlsReturn() {
    this.game.sound.playClick();
    this.controlsModal.classList.add('hidden');
    if (this._controlsReturnTo === 'pause') {
      this.openPauseModal();
    } else {
      this.activeModal = null;
    }
  }

  openDeathModal() {
    this._returnCraftingAndCursorItems();
    this.game.unlockPointer();
    this.activeModal = 'death';
    this.invModal.classList.add('hidden');
    this.pauseModal.classList.add('hidden');
    this.deathModal.classList.remove('hidden');
  }

  _returnCraftingAndCursorItems() {
    const inv = this.game.inventory;
    if (this.cursorRef.item) {
      const rem = inv.addItem(this.cursorRef.item.id, this.cursorRef.item.count, this.cursorRef.item.durability);
      if (rem > 0 && this.game.itemDrops) {
        this.game.itemDrops.spawnDrop(this.game.player.pos.x, this.game.player.pos.y + 1, this.game.player.pos.z, this.cursorRef.item.id, rem);
      }
      this.cursorRef.item = null;
      this._syncCursorElement();
    }

    for (let i = 0; i < this.craftingSlots.length; i++) {
      const s = this.craftingSlots[i];
      if (s && s.count > 0) {
        const rem = inv.addItem(s.id, s.count, s.durability);
        if (rem > 0 && this.game.itemDrops) {
          this.game.itemDrops.spawnDrop(this.game.player.pos.x, this.game.player.pos.y + 1, this.game.player.pos.z, s.id, rem);
        }
        this.craftingSlots[i] = null;
      }
    }
  }

  closeModalsAndLock() {
    this._returnCraftingAndCursorItems();
    this.activeModal = null;
    this.activeFurnace = null;
    this.activeChestSlots = null;
    this.invModal.classList.add('hidden');
    this.pauseModal.classList.add('hidden');
    this.controlsModal.classList.add('hidden');
    this.deathModal.classList.add('hidden');
    this.hideTooltip();
    this.renderHotbar();
    this.game.requestPointerLock();
  }

  _bindSlotEvents(el, arrayRef, index, onQuickTransfer = null) {
    const item = arrayRef[index];
    if (item && item.count > 0) {
      el.addEventListener('mouseenter', () => this.showItemTooltip(item.id));
      el.addEventListener('mouseleave', () => this.hideTooltip());
    }
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (e.shiftKey && onQuickTransfer) {
        onQuickTransfer();
      } else {
        this.game.inventory.interactSlot(arrayRef, index, this.cursorRef, e.button);
      }
      this.game.sound.playClick();
      this._syncCursorElement();
      this.renderStationModal();
      this.renderHotbar();
    });
  }

  renderStationModal() {
    if (this.activeModal !== 'inventory') return;
    const inv = this.game.inventory;

    // 1. Crafting Grid (2x2 or 3x3)
    if (this.stationMode === 'inventory' || this.stationMode === 'crafting_table') {
      const gSize = this.craftingSize;
      this.craftingGridEl.className = `slot-grid ${gSize === 3 ? 'grid-3x3' : 'grid-2x2'}`;
      this.craftingGridEl.innerHTML = '';

      const count = gSize * gSize;
      for (let i = 0; i < count; i++) {
        const slotEl = document.createElement('div');
        slotEl.className = 'inv-slot';
        this._fillSlotElement(slotEl, this.craftingSlots[i]);
        this._bindSlotEvents(slotEl, this.craftingSlots, i, () => {
          inv.quickTransfer(this.craftingSlots, i, inv.slots, 0, 36);
        });
        this.craftingGridEl.appendChild(slotEl);
      }

      // Match recipe for manual grid
      const activeGrid = this.craftingSlots.slice(0, count);
      const matched = matchCraftingGrid(activeGrid, gSize);
      const outItem = matched ? inv.createItemObject(matched.result.id, matched.result.count) : null;
      this._fillSlotElement(this.craftingOutputEl, outItem);

      this.craftingOutputEl.onmouseenter = outItem ? () => this.showItemTooltip(outItem.id, 'Click to craft') : null;
      this.craftingOutputEl.onmouseleave = () => this.hideTooltip();
      this.craftingOutputEl.onmousedown = (e) => {
        e.preventDefault();
        if (!matched || !outItem) return;
        const cur = this.cursorRef.item;
        const entry = getEntry(outItem.id);
        const maxStack = entry?.stackSize || 64;

        if (e.shiftKey) {
          // Craft directly into inventory!
          const rem = inv.addItem(outItem.id, outItem.count, outItem.durability);
          if (rem === 0) {
            this._consumeOneFromManualGrid(count);
            this.game.sound.playPickup();
          }
        } else if (!cur) {
          this.cursorRef.item = outItem;
          this._consumeOneFromManualGrid(count);
          this.game.sound.playPickup();
        } else if (cur.id === outItem.id && !entry.maxDurability && cur.count + outItem.count <= maxStack) {
          cur.count += outItem.count;
          this._consumeOneFromManualGrid(count);
          this.game.sound.playPickup();
        }
        this._syncCursorElement();
        this.renderStationModal();
        this.renderHotbar();
      };
    }

    // 2. Furnace Section
    if (this.stationMode === 'furnace' && this.activeFurnace) {
      this.renderFurnaceSlotsOnly();
    }

    // 3. Chest Section
    if (this.stationMode === 'chest' && this.activeChestSlots) {
      this.chestGridEl.innerHTML = '';
      for (let i = 0; i < 27; i++) {
        const slotEl = document.createElement('div');
        slotEl.className = 'inv-slot';
        this._fillSlotElement(slotEl, this.activeChestSlots[i]);
        this._bindSlotEvents(slotEl, this.activeChestSlots, i, () => {
          inv.quickTransfer(this.activeChestSlots, i, inv.slots, 0, 36);
        });
        this.chestGridEl.appendChild(slotEl);
      }
    }

    // 4. Player Backpack (slots 9..35)
    this.bagGridEl.innerHTML = '';
    for (let i = 9; i < 36; i++) {
      const slotEl = document.createElement('div');
      slotEl.className = 'inv-slot';
      this._fillSlotElement(slotEl, inv.slots[i]);
      this._bindSlotEvents(slotEl, inv.slots, i, () => {
        if (this.stationMode === 'chest' && this.activeChestSlots) {
          inv.quickTransfer(inv.slots, i, this.activeChestSlots, 0, 27);
        } else {
          inv.quickTransfer(inv.slots, i, inv.slots, 0, 9);
        }
      });
      this.bagGridEl.appendChild(slotEl);
    }

    // 5. Player Hotbar inside Modal (slots 0..8)
    this.modalHotbarEl.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const slotEl = document.createElement('div');
      slotEl.className = 'inv-slot' + (i === inv.selectedHotbar ? ' selected' : '');
      this._fillSlotElement(slotEl, inv.slots[i], i + 1);
      this._bindSlotEvents(slotEl, inv.slots, i, () => {
        if (this.stationMode === 'chest' && this.activeChestSlots) {
          inv.quickTransfer(inv.slots, i, this.activeChestSlots, 0, 27);
        } else {
          inv.quickTransfer(inv.slots, i, inv.slots, 9, 36);
        }
      });
      this.modalHotbarEl.appendChild(slotEl);
    }

    // 6. Helper Sidebar
    if (!this.helperSidebar.classList.contains('hidden')) {
      if (this.stationMode === 'furnace') {
        this._renderSmeltingGuide();
      } else if (this.activeSidebarTab === 'recipes') {
        this._renderRecipeBook();
      } else {
        this._renderCreativePalette();
      }
    }
  }

  renderFurnaceSlotsOnly() {
    const f = this.activeFurnace;
    if (!f) return;
    const inv = this.game.inventory;

    const proxy = [f.input, f.fuel, f.output];
    const syncBack = () => {
      f.input = proxy[0];
      f.fuel = proxy[1];
      f.output = proxy[2];
    };

    // Input slot
    this._fillSlotElement(this.furnaceInputEl, f.input);
    this.furnaceInputEl.onmouseenter = f.input ? () => {
      const res = getSmeltingResult(f.input.id);
      this.showItemTooltip(f.input.id, res ? `Smelts into ${getEntry(res.id)?.name}` : 'Cannot be smelted');
    } : null;
    this.furnaceInputEl.onmouseleave = () => this.hideTooltip();
    this.furnaceInputEl.onmousedown = (e) => {
      e.preventDefault();
      inv.interactSlot(proxy, 0, this.cursorRef, e.button);
      syncBack();
      this.game.sound.playClick();
      this._syncCursorElement();
      this.renderStationModal();
    };

    // Fuel slot
    this._fillSlotElement(this.furnaceFuelEl, f.fuel);
    this.furnaceFuelEl.onmouseenter = f.fuel ? () => {
      const bt = getFuelBurnTime(f.fuel.id);
      this.showItemTooltip(f.fuel.id, bt > 0 ? `Fuel (${bt}s)` : 'Not valid fuel');
    } : null;
    this.furnaceFuelEl.onmouseleave = () => this.hideTooltip();
    this.furnaceFuelEl.onmousedown = (e) => {
      e.preventDefault();
      inv.interactSlot(proxy, 1, this.cursorRef, e.button);
      syncBack();
      this.game.sound.playClick();
      this._syncCursorElement();
      this.renderStationModal();
    };

    // Output slot (pickup only)
    this._fillSlotElement(this.furnaceOutputEl, f.output);
    this.furnaceOutputEl.onmouseenter = f.output ? () => this.showItemTooltip(f.output.id) : null;
    this.furnaceOutputEl.onmouseleave = () => this.hideTooltip();
    this.furnaceOutputEl.onmousedown = (e) => {
      e.preventDefault();
      if (!f.output) return;
      if (e.shiftKey) {
        const rem = inv.addItem(f.output.id, f.output.count);
        f.output = rem > 0 ? { id: f.output.id, count: rem } : null;
      } else if (!this.cursorRef.item) {
        this.cursorRef.item = f.output;
        f.output = null;
      } else if (this.cursorRef.item.id === f.output.id) {
        const max = getEntry(f.output.id)?.stackSize || 64;
        const move = Math.min(max - this.cursorRef.item.count, f.output.count);
        this.cursorRef.item.count += move;
        f.output.count -= move;
        if (f.output.count <= 0) f.output = null;
      }
      this.game.sound.playPickup();
      this._syncCursorElement();
      this.renderStationModal();
      this.renderHotbar();
    };

    this.updateFurnaceGauges();
  }

  updateFurnaceGauges() {
    if (this.activeModal !== 'inventory' || this.stationMode !== 'furnace' || !this.activeFurnace) return;
    const f = this.activeFurnace;
    const flamePct = f.maxBurnTime > 0 ? Math.min(100, (f.burnTime / f.maxBurnTime) * 100) : 0;
    const cookPct = f.reqCookTime > 0 ? Math.min(100, (f.cookTime / f.reqCookTime) * 100) : 0;
    this.furnaceFlameFill.style.height = `${flamePct}%`;
    this.furnaceProgFill.style.width = `${cookPct}%`;
  }

  _consumeOneFromManualGrid(count) {
    for (let i = 0; i < count; i++) {
      const s = this.craftingSlots[i];
      if (s && s.count > 0) {
        s.count -= 1;
        if (s.count <= 0) this.craftingSlots[i] = null;
      }
    }
  }

  _renderRecipeBook() {
    const inv = this.game.inventory;
    const gSize = this.craftingSize;
    this.recipeListEl.innerHTML = '';

    // Filter recipes that fit current grid (or show 3x3 recipes dimmed with note if in 2x2!)
    const decorated = CRAFTING_RECIPES.map((r) => {
      const fits = recipeFitsGrid(r, gSize);
      const craftable = fits && canCraftRecipeWithInventory(r, inv, gSize);
      return { recipe: r, fits, craftable };
    });

    decorated.sort((a, b) => {
      if (a.craftable !== b.craftable) return a.craftable ? -1 : 1;
      if (a.fits !== b.fits) return a.fits ? -1 : 1;
      return 0;
    });

    for (const { recipe, fits, craftable } of decorated) {
      const outEntry = getEntry(recipe.result.id);
      if (!outEntry) continue;
      const ingredients = getRecipeIngredients(recipe);
      const costSummary = ingredients.map((ing) => `${ing.count}× ${ing.label}`).join(', ');

      const card = document.createElement('button');
      card.type = 'button';
      card.className = `recipe-card ${craftable ? 'craftable' : 'locked'}`;

      const icon = document.createElement('img');
      icon.className = 'slot-icon';
      icon.src = this.atlas.getIconUrl(recipe.result.id);
      icon.alt = outEntry.name;

      const info = document.createElement('div');
      info.className = 'recipe-info';
      const qtyStr = recipe.result.count > 1 ? ` ×${recipe.result.count}` : '';
      const tableNote = !fits ? ' (Requires Crafting Table)' : '';
      info.innerHTML = `
        <div class="recipe-name">${outEntry.name}${qtyStr}</div>
        <div class="recipe-cost">${costSummary}${tableNote}</div>
      `;

      card.append(icon, info);

      card.addEventListener('mouseenter', () => {
        this.showItemTooltip(
          recipe.result.id,
          craftable ? 'Click to craft' : !fits ? 'Use a Crafting Table (3×3)' : `Needs: ${costSummary}`
        );
      });
      card.addEventListener('mouseleave', () => this.hideTooltip());

      card.addEventListener('click', () => {
        if (!craftable) return;
        consumeIngredientsFromInventory(recipe, inv);
        const created = inv.createItemObject(recipe.result.id, recipe.result.count);
        const rem = inv.addItem(created.id, created.count, created.durability);
        if (rem > 0 && this.game.itemDrops) {
          this.game.itemDrops.spawnDrop(this.game.player.pos.x, this.game.player.pos.y + 1, this.game.player.pos.z, created.id, rem);
        }
        this.game.sound.playPickup();
        this.renderStationModal();
        this.renderHotbar();
      });

      this.recipeListEl.appendChild(card);
    }
  }

  _renderSmeltingGuide() {
    const inv = this.game.inventory;
    const f = this.activeFurnace;
    this.recipeListEl.innerHTML = '';

    for (const [inKey, spec] of Object.entries(SMELTING_RECIPES)) {
      const inId = Number(inKey);
      const inEntry = getEntry(inId);
      const outEntry = getEntry(spec.id);
      if (!inEntry || !outEntry) continue;

      const hasInput = inv.slots.some((s) => s && s.id === inId && s.count > 0);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `recipe-card ${hasInput ? 'craftable' : 'locked'}`;

      const icon = document.createElement('img');
      icon.className = 'slot-icon';
      icon.src = this.atlas.getIconUrl(spec.id);
      icon.alt = outEntry.name;

      const info = document.createElement('div');
      info.className = 'recipe-info';
      info.innerHTML = `
        <div class="recipe-name">${outEntry.name}</div>
        <div class="recipe-cost">Smelt: ${inEntry.name}</div>
      `;

      card.append(icon, info);
      card.addEventListener('mouseenter', () => {
        this.showItemTooltip(spec.id, hasInput ? 'Click to load into Furnace' : `Requires ${inEntry.name} + Fuel`);
      });
      card.addEventListener('mouseleave', () => this.hideTooltip());

      card.addEventListener('click', () => {
        if (!hasInput || !f) return;
        for (let i = 0; i < inv.slots.length; i++) {
          const s = inv.slots[i];
          if (s && s.id === inId && s.count > 0) {
            if (!f.input) {
              f.input = { id: inId, count: 1 };
              s.count -= 1;
              if (s.count <= 0) inv.slots[i] = null;
              this.game.sound.playClick();
              this.renderStationModal();
              this.renderHotbar();
              break;
            } else if (f.input.id === inId && f.input.count < (inEntry.stackSize || 64)) {
              f.input.count += 1;
              s.count -= 1;
              if (s.count <= 0) inv.slots[i] = null;
              this.game.sound.playClick();
              this.renderStationModal();
              this.renderHotbar();
              break;
            }
          }
        }
      });

      this.recipeListEl.appendChild(card);
    }
  }

  _renderCreativePalette() {
    const query = this.creativeSearch.value.trim().toLowerCase();
    const all = getAllCreativeEntries();
    this.creativeGridEl.innerHTML = '';

    for (const entry of all) {
      if (query && !entry.name.toLowerCase().includes(query) && !(entry.category || '').includes(query)) {
        continue;
      }
      const slotEl = document.createElement('div');
      slotEl.className = 'inv-slot';
      this._fillSlotElement(slotEl, { id: entry.id, count: 1 });

      slotEl.addEventListener('mouseenter', () => this.showItemTooltip(entry.id, 'Click to add · Shift+Click for stack'));
      slotEl.addEventListener('mouseleave', () => this.hideTooltip());
      slotEl.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const qty = e.shiftKey ? (entry.stackSize || 1) : 1;
        this.game.inventory.addItem(entry.id, qty);
        this.game.sound.playPickup();
        this.renderStationModal();
        this.renderHotbar();
      });

      this.creativeGridEl.appendChild(slotEl);
    }
  }

  updateFrameHUD(fps) {
    if (!this.game.world) return;
    const p = this.game.player;
    const wx = Math.floor(p.pos.x);
    const wy = Math.floor(p.pos.y);
    const wz = Math.floor(p.pos.z);
    const biome = this.game.world.getBiomeAt(wx, wz);

    const weatherSuffix = this.game.skyWeather.activePrecipitation === 'rain'
      ? ' · Rain'
      : this.game.skyWeather.activePrecipitation === 'snow'
        ? ' · Snow'
        : '';

    this.biomeClockPill.textContent = `${biome.name} · ${this.game.skyWeather.getFormattedClock()}${weatherSuffix}`;
    this.underwaterOverlay.classList.toggle('hidden', !p.eyesUnderwater);

    const hint = (!this.activeModal && p.interactionPrompt) ? p.interactionPrompt : '';
    if (hint) {
      this.interactionHint.textContent = hint;
      this.interactionHint.classList.remove('hidden');
    } else {
      this.interactionHint.classList.add('hidden');
    }

    if (this.activeModal === 'inventory' && this.stationMode === 'furnace' && this.activeFurnace) {
      const f = this.activeFurnace;
      const snap = `${f.input?.id}:${f.input?.count}|${f.fuel?.id}:${f.fuel?.count}|${f.output?.id}:${f.output?.count}`;
      if (snap !== this._lastFurnaceSnap) {
        this._lastFurnaceSnap = snap;
        this.renderFurnaceSlotsOnly();
      } else {
        this.updateFurnaceGauges();
      }
    }

    if (this.showDebug) {
      const { cx, cz } = this.game.world.worldToChunk(wx, wz);
      const skyL = this.game.world.getSkyLight(wx, wy + 1, wz);
      const blkL = this.game.world.getBlockLight(wx, wy + 1, wz);
      this.debugOverlay.textContent =
        `FPS: ${fps} | Chunks: ${this.game.world.chunks.size}\n` +
        `XYZ: ${p.pos.x.toFixed(1)}, ${p.pos.y.toFixed(1)}, ${p.pos.z.toFixed(1)} (Chunk ${cx}, ${cz})\n` +
        `Biome: ${biome.name} | Light: Sky ${skyL} / Block ${blkL}\n` +
        `Creatures: ${this.game.mobManager.mobs.length} | Mode: ${p.gameMode}${p.flying ? ' (Flying)' : ''}`;
    }
  }
}
