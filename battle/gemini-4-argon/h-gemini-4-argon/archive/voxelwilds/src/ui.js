import { BLOCK, getBlockDef, getAllItems } from './blocks.js';
import { RECIPES } from './recipes.js';
import { HOTBAR_SIZE, TOTAL_SLOTS } from './inventory.js';
import { GAME_MODES } from './constants.js';

const SEED_WORDS_A = ['Emerald', 'Amber', 'Crystal', 'Whisper', 'Frost', 'Sunlit', 'Misty', 'Cedar'];
const SEED_WORDS_B = ['Valley', 'Peaks', 'Shores', 'Basin', 'Canyon', 'Haven', 'Ridge', 'Wilds'];

function heartSvg(state) {
  if (state === 'full') {
    return `<svg class="heart-svg" viewBox="0 0 16 16"><path fill="#2a0d12" d="M2 3h4v1h1v1h2V4h1V3h4v1h1v5h-1v2h-2v2h-2v2H6v-2H4v-2H2V9H1V4h1z"/><path fill="#f03e3e" d="M2 4h4v1h1v1h2V5h1V4h4v4h-1v2h-2v2H9v1H7v-1H5v-2H3V8H2z"/><path fill="#ff8787" d="M3 5h2v2H3z"/></svg>`;
  }
  if (state === 'half') {
    return `<svg class="heart-svg" viewBox="0 0 16 16"><path fill="#2a0d12" d="M2 3h4v1h1v1h2V4h1V3h4v1h1v5h-1v2h-2v2h-2v2H6v-2H4v-2H2V9H1V4h1z"/><path fill="#f03e3e" d="M2 4h4v1h1v8H7v-1H5v-2H3V8H2z"/><path fill="#ff8787" d="M3 5h2v2H3z"/></svg>`;
  }
  return `<svg class="heart-svg" viewBox="0 0 16 16"><path fill="rgba(20,24,32,0.75)" stroke="rgba(255,255,255,0.35)" stroke-width="1" d="M2 4h4v1h1v1h2V5h1V4h4v4h-1v2h-2v2H9v1H7v-1H5v-2H3V8H2z"/></svg>`;
}

export class GameUI {
  constructor({ textures, sound, storage, callbacks }) {
    this.textures = textures;
    this.sound = sound;
    this.storage = storage;
    this.callbacks = callbacks;

    this.state = 'title'; // 'title' | 'playing' | 'inventory' | 'paused' | 'dead'
    this.previousStateForControls = 'title';
    this.selectedNewWorldMode = GAME_MODES.SURVIVAL;
    this.activeFilter = 'all';
    this.craftableOnly = false;
    this.catalogQuery = '';
    this.cursorStack = null;
    this.showDebug = false;
    this.wasPointerLocked = false;
    this.toastTimer = null;
    this.lastSelectedKey = '';

    this.cacheDom();
    this.bindDomEvents();
  }

  cacheDom() {
    this.elHud = document.getElementById('hud');
    this.elStatusPill = document.getElementById('hud-status-pill');
    this.elDebug = document.getElementById('debug-panel');
    this.elMiningWrap = document.getElementById('mining-bar-wrap');
    this.elMiningFill = document.getElementById('mining-bar-fill');
    this.elTargetHint = document.getElementById('target-hint');
    this.elHeldToast = document.getElementById('held-item-toast');
    this.elVitalsRow = document.getElementById('vitals-row');
    this.elHearts = document.getElementById('hearts-bar');
    this.elOxygen = document.getElementById('oxygen-bar');
    this.elHotbar = document.getElementById('hotbar');
    this.elUnderwaterTint = document.getElementById('underwater-overlay');
    this.elDamageTint = document.getElementById('damage-overlay');

    // Title screen
    this.elTitleScreen = document.getElementById('title-screen');
    this.tabNewWorld = document.getElementById('tab-new-world');
    this.tabSavedWorlds = document.getElementById('tab-saved-worlds');
    this.panelNewWorld = document.getElementById('panel-new-world');
    this.panelSavedWorlds = document.getElementById('panel-saved-worlds');
    this.inputWorldName = document.getElementById('input-world-name');
    this.inputWorldSeed = document.getElementById('input-world-seed');
    this.btnRandomSeed = document.getElementById('btn-random-seed');
    this.btnModeSurvival = document.getElementById('mode-survival-btn');
    this.btnModeCreative = document.getElementById('mode-creative-btn');
    this.elModeDesc = document.getElementById('mode-desc');
    this.elSavedList = document.getElementById('saved-worlds-list');

    // Inventory & Workshop
    this.elInventoryModal = document.getElementById('inventory-modal');
    this.elWorkshopTitle = document.getElementById('workshop-title');
    this.elBackpackGrid = document.getElementById('backpack-grid');
    this.elModalHotbarGrid = document.getElementById('modal-hotbar-grid');
    this.elStationBanner = document.getElementById('station-banner');
    this.elFilterBar = document.getElementById('workshop-mode-tabs');
    this.elTabCreativeCatalog = document.getElementById('tab-creative-catalog');
    this.chkCraftableOnly = document.getElementById('chk-craftable-only');
    this.inputCatalogSearch = document.getElementById('input-catalog-search');
    this.elRecipesList = document.getElementById('recipes-container');
    this.elCatalogGrid = document.getElementById('catalog-container');
    this.elCursorSlot = document.getElementById('cursor-slot');

    // Pause & Settings
    this.elPauseModal = document.getElementById('pause-modal');
    this.elPauseWorldTitle = document.getElementById('pause-world-title');
    this.btnSaveWorld = document.getElementById('btn-save-world');
    this.btnPauseSurvival = document.getElementById('pause-mode-survival');
    this.btnPauseCreative = document.getElementById('pause-mode-creative');
    this.btnToggleWeather = document.getElementById('btn-toggle-weather');
    this.sliderRenderDist = document.getElementById('slider-render-dist');
    this.lblRenderDist = document.getElementById('lbl-render-dist');
    this.sliderVolume = document.getElementById('slider-volume');
    this.lblVolume = document.getElementById('lbl-volume');

    // Controls & Death
    this.elControlsModal = document.getElementById('controls-modal');
    this.elDeathModal = document.getElementById('death-modal');
  }

  bindDomEvents() {
    // Title tabs
    this.tabNewWorld.addEventListener('click', () => this.switchTitleTab('new'));
    this.tabSavedWorlds.addEventListener('click', () => this.switchTitleTab('saved'));

    this.btnRandomSeed.addEventListener('click', () => {
      const a = SEED_WORDS_A[Math.floor(Math.random() * SEED_WORDS_A.length)];
      const b = SEED_WORDS_B[Math.floor(Math.random() * SEED_WORDS_B.length)];
      const n = 100 + Math.floor(Math.random() * 900);
      this.inputWorldSeed.value = `${a}${b}-${n}`;
    });

    const updateModeUI = (mode) => {
      this.selectedNewWorldMode = mode;
      this.btnModeSurvival.classList.toggle('active', mode === GAME_MODES.SURVIVAL);
      this.btnModeCreative.classList.toggle('active', mode === GAME_MODES.CREATIVE);
      this.elModeDesc.textContent =
        mode === GAME_MODES.CREATIVE
          ? 'Unlimited blocks, instant mining, and double-tap Space flight for effortless building.'
          : 'Gather resources, craft tools, manage health, and survive the night.';
    };
    this.btnModeSurvival.addEventListener('click', () => updateModeUI(GAME_MODES.SURVIVAL));
    this.btnModeCreative.addEventListener('click', () => updateModeUI(GAME_MODES.CREATIVE));

    this.panelNewWorld.addEventListener('submit', (e) => {
      e.preventDefault();
      this.sound.unlock();
      const name = this.inputWorldName.value.trim() || 'Emerald Valley';
      const seed = this.inputWorldSeed.value.trim() || `${SEED_WORDS_A[0]}-${Math.floor(Math.random() * 9999)}`;
      this.callbacks.onCreateWorld({
        name,
        seed,
        gameMode: this.selectedNewWorldMode,
      });
    });

    // HUD buttons
    document.getElementById('btn-hud-inventory').addEventListener('click', () => {
      this.openInventory('hand');
    });
    document.getElementById('btn-hud-pause').addEventListener('click', () => {
      this.openPauseMenu();
    });

    // Inventory & Workshop events
    document.getElementById('btn-close-inventory').addEventListener('click', () => {
      this.resumeGameplay();
    });

    this.elFilterBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-chip');
      if (!btn) return;
      this.activeFilter = btn.dataset.filter;
      this.renderWorkshop();
    });

    this.chkCraftableOnly.addEventListener('change', () => {
      this.craftableOnly = this.chkCraftableOnly.checked;
      this.renderWorkshop();
    });

    this.inputCatalogSearch.addEventListener('input', () => {
      this.catalogQuery = this.inputCatalogSearch.value.trim().toLowerCase();
      this.renderWorkshop();
    });

    window.addEventListener('mousemove', (e) => {
      if (this.cursorStack) {
        this.elCursorSlot.style.left = `${e.clientX}px`;
        this.elCursorSlot.style.top = `${e.clientY}px`;
      }
    });

    // Pause menu events
    document.getElementById('btn-resume').addEventListener('click', () => {
      this.resumeGameplay();
    });

    this.btnSaveWorld.addEventListener('click', async () => {
      this.btnSaveWorld.textContent = 'Saving...';
      await this.callbacks.onSaveWorld?.();
      this.btnSaveWorld.textContent = 'Saved ✓';
      setTimeout(() => {
        if (this.btnSaveWorld) this.btnSaveWorld.textContent = 'Save World';
      }, 1400);
    });

    this.btnPauseSurvival.addEventListener('click', () => {
      this.callbacks.onChangeMode?.(GAME_MODES.SURVIVAL);
      this.syncPauseSettings();
    });
    this.btnPauseCreative.addEventListener('click', () => {
      this.callbacks.onChangeMode?.(GAME_MODES.CREATIVE);
      this.syncPauseSettings();
    });

    this.elPauseModal.querySelectorAll('[data-time]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = parseFloat(btn.dataset.time);
        this.callbacks.onSetTime?.(val);
      });
    });

    this.btnToggleWeather.addEventListener('click', () => {
      const next = this.callbacks.onToggleWeather?.();
      this.btnToggleWeather.textContent = `Weather: ${next === 'rain' ? 'Rain' : 'Clear'}`;
    });

    this.sliderRenderDist.addEventListener('input', () => {
      const dist = parseInt(this.sliderRenderDist.value, 10);
      this.lblRenderDist.textContent = String(dist);
      this.callbacks.onChangeRenderDistance?.(dist);
    });

    this.sliderVolume.addEventListener('input', () => {
      const pct = parseInt(this.sliderVolume.value, 10);
      this.lblVolume.textContent = `${pct}%`;
      this.sound.setVolume(pct / 100);
    });

    document.getElementById('btn-exit-title').addEventListener('click', async () => {
      await this.callbacks.onExitToTitle?.();
    });

    // Controls modal
    document.getElementById('btn-open-controls-title').addEventListener('click', () => {
      this.previousStateForControls = 'title';
      this.elTitleScreen.classList.add('hidden');
      this.elControlsModal.classList.remove('hidden');
    });
    document.getElementById('btn-open-controls-pause').addEventListener('click', () => {
      this.previousStateForControls = 'paused';
      this.elPauseModal.classList.add('hidden');
      this.elControlsModal.classList.remove('hidden');
    });
    document.getElementById('btn-close-controls').addEventListener('click', () => {
      this.elControlsModal.classList.add('hidden');
      if (this.previousStateForControls === 'paused') {
        this.elPauseModal.classList.remove('hidden');
      } else {
        this.elTitleScreen.classList.remove('hidden');
      }
    });

    // Respawn modal
    document.getElementById('btn-respawn').addEventListener('click', () => {
      this.callbacks.onRespawn?.();
      this.resumeGameplay();
    });
    document.getElementById('btn-death-title').addEventListener('click', async () => {
      await this.callbacks.onExitToTitle?.();
    });

    // Global keybindings (E, Esc, F3)
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        if (e.code === 'Escape') e.target.blur();
        return;
      }

      if (e.code === 'F3') {
        e.preventDefault();
        this.showDebug = !this.showDebug;
        this.elDebug.classList.toggle('hidden', !this.showDebug || this.state !== 'playing');
        return;
      }

      if (e.code === 'KeyE') {
        if (this.state === 'playing') {
          e.preventDefault();
          this.openInventory('hand');
        } else if (this.state === 'inventory') {
          e.preventDefault();
          this.resumeGameplay();
        }
        return;
      }

      if (e.code === 'Escape') {
        if (!this.elControlsModal.classList.contains('hidden')) {
          document.getElementById('btn-close-controls').click();
          return;
        }
        if (this.state === 'inventory') {
          this.resumeGameplay();
        } else if (this.state === 'playing') {
          this.openPauseMenu();
        } else if (this.state === 'paused') {
          this.resumeGameplay();
        }
      }
    });

    // Pointer lock tracking: pause gracefully only if user exited an active pointer lock during gameplay
    document.addEventListener('pointerlockchange', () => {
      const canvas = document.getElementById('game-canvas');
      const lockedNow = document.pointerLockElement === canvas;
      if (lockedNow) {
        this.wasPointerLocked = true;
      } else if (this.wasPointerLocked && this.state === 'playing') {
        this.wasPointerLocked = false;
        this.openPauseMenu();
      } else {
        this.wasPointerLocked = false;
      }
    });
  }

  async refreshSavedWorlds() {
    const worlds = await this.storage.listWorlds();
    this.tabSavedWorlds.textContent = worlds.length > 0 ? `Saved Worlds (${worlds.length})` : 'Saved Worlds';

    this.elSavedList.innerHTML = '';
    if (worlds.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-worlds-msg';
      empty.textContent = 'No saved worlds yet. Create a new world to start exploring!';
      this.elSavedList.appendChild(empty);
      return;
    }

    for (const w of worlds) {
      const row = document.createElement('div');
      row.className = 'saved-world-item';

      const meta = document.createElement('div');
      meta.className = 'saved-world-meta';

      const title = document.createElement('div');
      title.className = 'saved-world-name';
      title.textContent = w.name || 'Untitled World';

      const sub = document.createElement('div');
      sub.className = 'saved-world-sub';
      const modeName = w.gameMode === GAME_MODES.CREATIVE ? 'Creative' : 'Survival';
      const dayLabel = `Day ${w.dayCount || 1}`;
      sub.textContent = `${modeName} • ${dayLabel} • Seed: ${w.seed}`;

      meta.append(title, sub);

      const btns = document.createElement('div');
      btns.className = 'saved-world-btns';

      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'primary-btn';
      playBtn.style.padding = '7px 14px';
      playBtn.style.fontSize = '13px';
      playBtn.textContent = 'Play';
      playBtn.addEventListener('click', () => {
        this.sound.unlock();
        this.callbacks.onLoadSavedWorld?.(w.id);
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'secondary-btn';
      delBtn.style.padding = '7px 10px';
      delBtn.style.fontSize = '12.5px';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async () => {
        await this.storage.deleteWorld(w.id);
        await this.refreshSavedWorlds();
      });

      btns.append(playBtn, delBtn);
      row.append(meta, btns);
      this.elSavedList.appendChild(row);
    }
  }

  switchTitleTab(tab) {
    const isNew = tab === 'new';
    this.tabNewWorld.classList.toggle('active', isNew);
    this.tabSavedWorlds.classList.toggle('active', !isNew);
    this.panelNewWorld.classList.toggle('hidden', !isNew);
    this.panelSavedWorlds.classList.toggle('hidden', isNew);
    if (!isNew) {
      this.refreshSavedWorlds();
    }
  }

  async showTitleScreen() {
    this.returnCursorStack();
    this.state = 'title';
    this.wasPointerLocked = false;
    if (document.pointerLockElement && document.exitPointerLock) {
      try { document.exitPointerLock(); } catch {}
    }

    this.elHud.classList.add('hidden');
    this.elInventoryModal.classList.add('hidden');
    this.elPauseModal.classList.add('hidden');
    this.elControlsModal.classList.add('hidden');
    this.elDeathModal.classList.add('hidden');
    this.elUnderwaterTint.classList.add('hidden');
    this.elTitleScreen.classList.remove('hidden');

    await this.refreshSavedWorlds();
  }

  resumeGameplay() {
    this.returnCursorStack();
    this.state = 'playing';
    this.elTitleScreen.classList.add('hidden');
    this.elInventoryModal.classList.add('hidden');
    this.elPauseModal.classList.add('hidden');
    this.elControlsModal.classList.add('hidden');
    this.elDeathModal.classList.add('hidden');
    this.elHud.classList.remove('hidden');
    this.elDebug.classList.toggle('hidden', !this.showDebug);

    this.callbacks.onResume?.();

    const canvas = document.getElementById('game-canvas');
    if (canvas && canvas.requestPointerLock) {
      try {
        const p = canvas.requestPointerLock();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch {}
    }

    this.renderHotbar();
    this.renderVitals();
  }

  openInventory(stationFocus = 'hand') {
    const ctx = this.callbacks.getGameContext?.();
    if (!ctx) return;

    this.state = 'inventory';
    this.wasPointerLocked = false;
    if (document.pointerLockElement && document.exitPointerLock) {
      try { document.exitPointerLock(); } catch {}
    }
    this.callbacks.onPauseControls?.();

    if (stationFocus === 'furnace') {
      this.activeFilter = 'smelting';
    } else if (stationFocus === 'crafting') {
      this.activeFilter = 'tools';
    } else if (ctx.player.gameMode === GAME_MODES.CREATIVE) {
      this.activeFilter = 'catalog';
    } else if (this.activeFilter === 'catalog') {
      this.activeFilter = 'all';
    }

    this.elPauseModal.classList.add('hidden');
    this.elInventoryModal.classList.remove('hidden');
    this.renderWorkshop();
  }

  openPauseMenu() {
    this.returnCursorStack();
    this.state = 'paused';
    this.wasPointerLocked = false;
    if (document.pointerLockElement && document.exitPointerLock) {
      try { document.exitPointerLock(); } catch {}
    }
    this.callbacks.onPauseControls?.();

    this.syncPauseSettings();
    this.elInventoryModal.classList.add('hidden');
    this.elPauseModal.classList.remove('hidden');
  }

  showDeathScreen() {
    this.returnCursorStack();
    this.state = 'dead';
    this.wasPointerLocked = false;
    if (document.pointerLockElement && document.exitPointerLock) {
      try { document.exitPointerLock(); } catch {}
    }
    this.callbacks.onPauseControls?.();
    this.elInventoryModal.classList.add('hidden');
    this.elPauseModal.classList.add('hidden');
    this.elDeathModal.classList.remove('hidden');
  }

  syncPauseSettings() {
    const ctx = this.callbacks.getGameContext?.();
    if (!ctx) return;
    this.elPauseWorldTitle.textContent = ctx.worldMeta.name || 'World Menu';
    const isCreative = ctx.player.gameMode === GAME_MODES.CREATIVE;
    this.btnPauseSurvival.classList.toggle('active', !isCreative);
    this.btnPauseCreative.classList.toggle('active', isCreative);
    this.btnToggleWeather.textContent = `Weather: ${ctx.sky.weatherMode === 'rain' ? 'Rain' : 'Clear'}`;
    this.sliderRenderDist.value = String(ctx.world.renderDistance);
    this.lblRenderDist.textContent = String(ctx.world.renderDistance);
  }

  returnCursorStack() {
    if (!this.cursorStack) return;
    const ctx = this.callbacks.getGameContext?.();
    if (ctx) {
      ctx.inventory.addItem(this.cursorStack.id, this.cursorStack.count, this.cursorStack.durability);
    }
    this.cursorStack = null;
    this.updateCursorVisual();
  }

  updateCursorVisual() {
    if (!this.cursorStack) {
      this.elCursorSlot.classList.add('hidden');
      this.elCursorSlot.innerHTML = '';
      return;
    }
    this.elCursorSlot.classList.remove('hidden');
    const url = this.textures.getItemIconURL(this.cursorStack.id);
    this.elCursorSlot.innerHTML = `
      <img class="slot-icon" src="${url}" alt="" />
      ${this.cursorStack.count > 1 ? `<span class="slot-count">${this.cursorStack.count}</span>` : ''}
    `;
  }

  createSlotElement(slotData, slotIndex, { showKeyNum = false, isSelected = false, onClick = null, onRightClick = null } = {}) {
    const el = document.createElement('div');
    el.className = `item-slot${isSelected ? ' selected' : ''}`;

    if (showKeyNum) {
      const k = document.createElement('span');
      k.className = 'slot-key-num';
      k.textContent = String(slotIndex + 1);
      el.appendChild(k);
    }

    if (slotData) {
      const def = getBlockDef(slotData.id);
      el.title = def.name;

      const img = document.createElement('img');
      img.className = 'slot-icon';
      img.src = this.textures.getItemIconURL(slotData.id);
      img.alt = def.name;
      el.appendChild(img);

      if (slotData.count > 1) {
        const cnt = document.createElement('span');
        cnt.className = 'slot-count';
        cnt.textContent = String(slotData.count);
        el.appendChild(cnt);
      }

      if (def.maxDurability && typeof slotData.durability === 'number' && slotData.durability < def.maxDurability) {
        const ratio = Math.max(0, Math.min(1, slotData.durability / def.maxDurability));
        const bar = document.createElement('div');
        bar.className = 'slot-durability';
        const fill = document.createElement('div');
        fill.className = 'slot-durability-fill';
        fill.style.width = `${Math.round(ratio * 100)}%`;
        fill.style.background = ratio > 0.5 ? '#4be368' : ratio > 0.22 ? '#f5b642' : '#f04848';
        bar.appendChild(fill);
        el.appendChild(bar);
      }
    }

    if (onClick) el.addEventListener('click', onClick);
    if (onRightClick) {
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        onRightClick(e);
      });
    }

    return el;
  }

  renderHotbar() {
    const ctx = this.callbacks.getGameContext?.();
    if (!ctx) return;
    const { inventory, player } = ctx;

    this.elHotbar.innerHTML = '';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = inventory.slots[i];
      const slotEl = this.createSlotElement(slot, i, {
        showKeyNum: true,
        isSelected: i === inventory.selectedHotbar,
        onClick: () => {
          inventory.selectHotbar(i);
          player.rebuildHeldRig();
          this.renderHotbar();
        },
      });
      this.elHotbar.appendChild(slotEl);
    }

    const sel = inventory.getSelectedSlot();
    const selKey = `${inventory.selectedHotbar}:${sel ? sel.id : 0}`;
    if (selKey !== this.lastSelectedKey) {
      this.lastSelectedKey = selKey;
      if (sel) {
        this.showToast(getBlockDef(sel.id).name);
      } else {
        this.elHeldToast.classList.remove('visible');
      }
    }
  }

  showToast(text) {
    this.elHeldToast.textContent = text;
    this.elHeldToast.classList.add('visible');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.elHeldToast.classList.remove('visible');
    }, 1800);
  }

  renderVitals() {
    const ctx = this.callbacks.getGameContext?.();
    if (!ctx) return;
    const { player } = ctx;

    if (player.gameMode === GAME_MODES.CREATIVE) {
      this.elVitalsRow.classList.add('hidden');
      return;
    }
    this.elVitalsRow.classList.remove('hidden');

    const hp = Math.ceil(player.health);
    let heartsHtml = '';
    for (let i = 0; i < 10; i++) {
      const heartVal = hp - i * 2;
      const state = heartVal >= 2 ? 'full' : heartVal === 1 ? 'half' : 'empty';
      heartsHtml += `<span class="heart-icon">${heartSvg(state)}</span>`;
    }
    this.elHearts.innerHTML = heartsHtml;

    if (player.headUnderwater || player.oxygen < player.maxOxygen) {
      this.elOxygen.classList.remove('hidden');
      const bubbles = Math.ceil(player.oxygen);
      let oxyHtml = '';
      for (let i = 0; i < 10; i++) {
        oxyHtml += `<span class="bubble-dot${i < bubbles ? '' : ' empty'}"></span>`;
      }
      this.elOxygen.innerHTML = oxyHtml;
    } else {
      this.elOxygen.classList.add('hidden');
    }
  }

  handleInventorySlotClick(idx, event) {
    const ctx = this.callbacks.getGameContext?.();
    if (!ctx) return;
    const { inventory, player } = ctx;

    if (event.shiftKey) {
      inventory.quickTransfer(idx);
      player.notifyInventoryChange();
      this.renderWorkshop();
      this.renderHotbar();
      return;
    }

    const clicked = inventory.slots[idx];
    if (!this.cursorStack) {
      if (clicked) {
        this.cursorStack = clicked;
        inventory.slots[idx] = null;
      }
    } else {
      if (!clicked) {
        inventory.slots[idx] = this.cursorStack;
        this.cursorStack = null;
      } else {
        const def = getBlockDef(clicked.id);
        const maxStack = def.maxStack || 64;
        if (clicked.id === this.cursorStack.id && maxStack > 1 && clicked.count < maxStack) {
          const add = Math.min(this.cursorStack.count, maxStack - clicked.count);
          clicked.count += add;
          this.cursorStack.count -= add;
          if (this.cursorStack.count <= 0) this.cursorStack = null;
        } else {
          inventory.slots[idx] = this.cursorStack;
          this.cursorStack = clicked;
        }
      }
    }

    this.updateCursorVisual();
    player.notifyInventoryChange();
    this.renderWorkshop();
    this.renderHotbar();
  }

  handleInventorySlotRightClick(idx) {
    const ctx = this.callbacks.getGameContext?.();
    if (!ctx) return;
    const { inventory, player } = ctx;
    const clicked = inventory.slots[idx];

    if (!this.cursorStack && clicked) {
      const half = Math.ceil(clicked.count / 2);
      this.cursorStack = { ...clicked, count: half };
      clicked.count -= half;
      if (clicked.count <= 0) inventory.slots[idx] = null;
    } else if (this.cursorStack) {
      if (!clicked) {
        inventory.slots[idx] = { ...this.cursorStack, count: 1 };
        this.cursorStack.count -= 1;
        if (this.cursorStack.count <= 0) this.cursorStack = null;
      } else if (clicked.id === this.cursorStack.id && clicked.count < (getBlockDef(clicked.id).maxStack || 64)) {
        clicked.count += 1;
        this.cursorStack.count -= 1;
        if (this.cursorStack.count <= 0) this.cursorStack = null;
      }
    }

    this.updateCursorVisual();
    player.notifyInventoryChange();
    this.renderWorkshop();
    this.renderHotbar();
  }

  renderWorkshop() {
    const ctx = this.callbacks.getGameContext?.();
    if (!ctx) return;
    const { inventory, player, world } = ctx;
    const isCreative = player.gameMode === GAME_MODES.CREATIVE;

    this.elTabCreativeCatalog.classList.toggle('hidden', !isCreative);

    // 1. Render Backpack (9..35) and Modal Hotbar (0..8)
    this.elBackpackGrid.innerHTML = '';
    for (let i = HOTBAR_SIZE; i < TOTAL_SLOTS; i++) {
      this.elBackpackGrid.appendChild(
        this.createSlotElement(inventory.slots[i], i, {
          onClick: (e) => this.handleInventorySlotClick(i, e),
          onRightClick: () => this.handleInventorySlotRightClick(i),
        })
      );
    }

    this.elModalHotbarGrid.innerHTML = '';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      this.elModalHotbarGrid.appendChild(
        this.createSlotElement(inventory.slots[i], i, {
          showKeyNum: true,
          isSelected: i === inventory.selectedHotbar,
          onClick: (e) => this.handleInventorySlotClick(i, e),
          onRightClick: () => this.handleInventorySlotRightClick(i),
        })
      );
    }

    // Update filter chip active states
    this.elFilterBar.querySelectorAll('.filter-chip').forEach((chip) => {
      chip.classList.toggle('active', chip.dataset.filter === this.activeFilter);
    });

    // Check nearby placed stations
    const nearTable =
      isCreative ||
      world.hasNearbyBlock(player.position.x, player.position.y, player.position.z, BLOCK.CRAFTING_TABLE, 6);
    const nearFurnace =
      isCreative ||
      world.hasNearbyBlock(player.position.x, player.position.y, player.position.z, BLOCK.FURNACE, 6);

    const activeStations = [];
    if (nearTable && !isCreative) activeStations.push('Crafting Table Nearby');
    if (nearFurnace && !isCreative) activeStations.push('Stone Furnace Nearby');

    if (activeStations.length > 0) {
      this.elStationBanner.classList.remove('hidden');
      this.elStationBanner.textContent = activeStations.join(' • ');
    } else {
      this.elStationBanner.classList.add('hidden');
    }

    // 2. Render Creative Catalog if selected
    if (this.activeFilter === 'catalog' && isCreative) {
      this.elRecipesList.classList.add('hidden');
      this.elCatalogGrid.classList.remove('hidden');
      this.chkCraftableOnly.parentElement.classList.add('hidden');
      this.inputCatalogSearch.classList.remove('hidden');

      this.elCatalogGrid.innerHTML = '';
      const items = getAllItems().filter((d) =>
        this.catalogQuery ? d.name.toLowerCase().includes(this.catalogQuery) : true
      );

      for (const item of items) {
        const count = item.maxStack > 1 ? 64 : 1;
        const slotEl = this.createSlotElement({ id: item.id, count: 1 }, 0, {
          onClick: () => {
            inventory.slots[inventory.selectedHotbar] = {
              id: item.id,
              count,
              durability: item.maxDurability || null,
            };
            this.sound.playPickup();
            player.notifyInventoryChange();
            this.renderWorkshop();
            this.renderHotbar();
          },
        });
        this.elCatalogGrid.appendChild(slotEl);
      }
      return;
    }

    // 3. Render Guided Crafting & Smelting List
    this.elCatalogGrid.classList.add('hidden');
    this.elRecipesList.classList.remove('hidden');
    this.chkCraftableOnly.parentElement.classList.remove('hidden');
    this.inputCatalogSearch.classList.add('hidden');

    this.elRecipesList.innerHTML = '';

    const isRecipeReady = (r) => {
      const stationOk =
        r.station === 'hand' ||
        (r.station === 'table' && nearTable) ||
        (r.station === 'furnace' && nearFurnace);
      return stationOk && inventory.canCraft(r);
    };

    const filtered = RECIPES.filter((r) => {
      if (this.activeFilter !== 'all' && r.group !== this.activeFilter) return false;
      if (this.craftableOnly && !isRecipeReady(r)) return false;
      return true;
    }).sort((a, b) => Number(isRecipeReady(b)) - Number(isRecipeReady(a)));

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-worlds-msg';
      empty.textContent = 'No matching craftable recipes right now. Gather materials or place a Crafting Table nearby!';
      this.elRecipesList.appendChild(empty);
      return;
    }

    for (const recipe of filtered) {
      const outDef = getBlockDef(recipe.output.id);
      const stationOk =
        recipe.station === 'hand' ||
        (recipe.station === 'table' && nearTable) ||
        (recipe.station === 'furnace' && nearFurnace);
      const hasMats = inventory.canCraft(recipe);
      const canMake = stationOk && hasMats;

      const card = document.createElement('div');
      card.className = `recipe-card ${canMake ? 'craftable' : 'locked'}`;

      const outDiv = document.createElement('div');
      outDiv.className = 'recipe-out';
      const outIcon = document.createElement('img');
      outIcon.src = this.textures.getItemIconURL(recipe.output.id);
      outIcon.alt = outDef.name;

      const textWrap = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'recipe-title';
      title.textContent = `${outDef.name}${recipe.output.count > 1 ? ` ×${recipe.output.count}` : ''}`;
      textWrap.appendChild(title);

      if (!stationOk) {
        const req = document.createElement('div');
        req.className = 'recipe-req-note';
        req.textContent =
          recipe.station === 'furnace'
            ? 'Place Stone Furnace nearby'
            : 'Place Crafting Table nearby';
        textWrap.appendChild(req);
      }

      outDiv.append(outIcon, textWrap);

      const ingsDiv = document.createElement('div');
      ingsDiv.className = 'recipe-ings';
      for (const ing of recipe.ingredients) {
        const have = ing.anyOf ? inventory.countGroup(ing.anyOf) : inventory.countItem(ing.id);
        const ok = isCreative || have >= ing.count;
        const iconId = ing.iconId || ing.id;

        const pill = document.createElement('span');
        pill.className = `ing-pill ${ok ? 'ok' : 'missing'}`;
        pill.title = ing.label;
        pill.innerHTML = `<img src="${this.textures.getItemIconURL(iconId)}" alt="${ing.label}" /><span>${Math.min(have, 99)}/${ing.count}</span>`;
        ingsDiv.appendChild(pill);
      }

      card.append(outDiv, ingsDiv);

      card.addEventListener('click', (e) => {
        if (!canMake) return;
        const maxTimes = e.shiftKey ? 4 : 1;
        let craftedAny = false;
        for (let c = 0; c < maxTimes; c++) {
          const readyNow =
            (recipe.station === 'hand' ||
              (recipe.station === 'table' && nearTable) ||
              (recipe.station === 'furnace' && nearFurnace)) &&
            inventory.canCraft(recipe);
          if (!readyNow) break;
          if (inventory.craftRecipe(recipe)) craftedAny = true;
          else break;
        }
        if (craftedAny) {
          this.sound.playCraft();
          player.notifyInventoryChange();
          this.renderWorkshop();
          this.renderHotbar();
        }
      });

      this.elRecipesList.appendChild(card);
    }
  }

  updateFrameHUD({ player, world, sky, entities, fps }) {
    if (this.state === 'title') return;

    // Underwater & Hurt Vignettes
    this.elUnderwaterTint.classList.toggle('hidden', !player.headUnderwater);
    this.elDamageTint.style.opacity = player.hurtFlash > 0 ? String(Math.min(1, player.hurtFlash * 2.4)) : '0';

    if (this.state !== 'playing') return;

    // Top-left live status pill
    const biome = world.generator.getBiomeAt(player.position.x, player.position.z);
    const clock = sky.getFormattedClock();
    const extras = [];
    if (sky.weatherIntensity > 0.35) {
      extras.push(biome === 'Snowy Taiga' ? 'Snowing' : 'Raining');
    }
    if (player.flying) extras.push('Flying');
    this.elStatusPill.textContent = [biome, clock, ...extras].join(' • ');

    // Mining bar & Crosshair contextual prompt
    if (player.breakProgress > 0.02) {
      this.elMiningWrap.classList.remove('hidden');
      this.elMiningFill.style.width = `${Math.min(100, Math.round(player.breakProgress * 100))}%`;
    } else {
      this.elMiningWrap.classList.add('hidden');
    }

    let hintText = '';
    if (player.targetedHit && !player.sneaking) {
      const tDef = player.targetedHit.def;
      if (tDef.interactive === 'crafting') {
        hintText = 'Right-click to use Crafting Table';
      } else if (tDef.interactive === 'furnace') {
        hintText = 'Right-click to use Stone Furnace';
      } else if (player.gameMode === GAME_MODES.SURVIVAL && tDef.minTier > 0) {
        const { canHarvest } = player.getMiningSpeedInfo(tDef);
        if (!canHarvest) {
          const tierNames = ['', 'Wooden', 'Stone', 'Iron'];
          hintText = `${tDef.name} (Requires ${tierNames[tDef.minTier] || 'Iron'} Pickaxe)`;
        }
      }
    }

    if (hintText) {
      this.elTargetHint.textContent = hintText;
      this.elTargetHint.classList.remove('hidden');
    } else {
      this.elTargetHint.classList.add('hidden');
    }

    // Optional F3 debug stats
    if (this.showDebug) {
      const p = player.position;
      const cx = Math.floor(p.x / 16);
      const cz = Math.floor(p.z / 16);
      const targetName = player.targetedHit ? player.targetedHit.def.name : 'None';
      this.elDebug.innerHTML = [
        `FPS: ${Math.round(fps)}`,
        `XYZ: ${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)} (Chunk ${cx}, ${cz})`,
        `Mode: ${player.gameMode}${player.flying ? ' [Flying]' : ''}`,
        `Chunks Loaded: ${world.chunks.size} | Creatures: ${entities.mobs.length} | Drops: ${entities.drops.length}`,
        `Looking At: ${targetName}`,
      ].join('<br/>');
    }
  }
}
