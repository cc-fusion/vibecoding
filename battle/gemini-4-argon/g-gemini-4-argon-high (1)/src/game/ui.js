// Clean Vanilla DOM UI Controller for VoxelRealms
import { GAME_MODES, MAX_HEALTH, MAX_AIR } from './constants.js';
import { CREATIVE_PALETTE, getDef } from './items.js';
import { HOTBAR_SIZE, TOTAL_SLOTS } from './inventory.js';

const MODE_DESCRIPTIONS = {
  survival: 'Gather resources, craft tiered tools, manage health, and face nighttime creatures.',
  peaceful: 'Gather, craft, and explore at your own pace with gentle wildlife and rapid healing.',
  creative: 'Unlimited blocks, instant mining, and free flight (double-tap Space or press F).',
};

const SEED_PRESETS = [
  'EmeraldValley',
  'AlpinePeaks',
  'WhisperWoods',
  'SunlitCove',
  'CrystalDeep',
  'GoldenDunes',
  'StarlightBay',
];

export class GameUI {
  constructor(app, iconUrls) {
    this.app = app;
    this.iconUrls = iconUrls;

    this.selectedNewMode = GAME_MODES.SURVIVAL;
    this.activeCategory = 'all';
    this.craftableOnly = false;
    this.activeInvTab = 'backpack';
    this.showFps = false;

    this.itemToastTimer = null;
    this.statusToastTimer = null;
    this.lastToastSlot = -1;
    this.lastToastId = -1;

    this.cacheDom();
    this.bindEvents();
  }

  cacheDom() {
    const $ = (id) => document.getElementById(id);
    this.hud = $('hud');
    this.hudPhase = $('hud-phase');
    this.hudBiome = $('hud-biome');
    this.hudCoords = $('hud-coords');
    this.hudFps = $('hud-fps');
    this.resumeLockBanner = $('resume-lock-banner');
    this.itemToast = $('item-toast');
    this.survivalBars = $('survival-bars');
    this.heartsBar = $('hearts-bar');
    this.airBar = $('air-bar');
    this.hotbarEl = $('hotbar');
    this.underwaterOverlay = $('underwater-overlay');
    this.damageOverlay = $('damage-overlay');

    this.titleScreen = $('title-screen');
    this.savedSection = $('saved-worlds-section');
    this.savedList = $('saved-worlds-list');
    this.worldNameInput = $('world-name-input');
    this.worldSeedInput = $('world-seed-input');
    this.randomSeedBtn = $('random-seed-btn');
    this.modeDesc = $('mode-desc');
    this.createWorldBtn = $('create-world-btn');
    this.importWorldInput = $('import-world-input');

    this.invModal = $('inventory-modal');
    this.tabBackpack = $('tab-backpack');
    this.tabCreative = $('tab-creative');
    this.closeInvBtn = $('close-inventory-btn');
    this.backpackPanel = $('backpack-panel');
    this.creativePanel = $('creative-panel');
    this.backpackGrid = $('backpack-grid');
    this.creativeGrid = $('creative-grid');
    this.invHotbarGrid = $('inv-hotbar-grid');
    this.craftableCheckbox = $('craftable-only-checkbox');
    this.stationStatus = $('station-status');
    this.recipeCats = $('recipe-cats');
    this.recipeList = $('recipe-list');
    this.cursorStack = $('cursor-stack');
    this.cursorStackImg = $('cursor-stack-img');
    this.cursorStackCount = $('cursor-stack-count');

    this.pauseModal = $('pause-modal');
    this.pauseWorldTitle = $('pause-world-title');
    this.resumeGameBtn = $('resume-game-btn');
    this.pauseModeGroup = $('pause-mode-group');
    this.pauseTimeGroup = $('pause-time-group');
    this.pauseWeatherGroup = $('pause-weather-group');
    this.renderDistSlider = $('render-dist-slider');
    this.renderDistVal = $('render-dist-val');
    this.volumeSlider = $('volume-slider');
    this.volumeVal = $('volume-val');
    this.saveNowBtn = $('save-now-btn');
    this.quitTitleBtn = $('quit-title-btn');

    this.deathModal = $('death-modal');
    this.respawnBtn = $('respawn-btn');
    this.statusToast = $('status-toast');
  }

  bindEvents() {
    // Title screen events
    this.randomSeedBtn.addEventListener('click', () => {
      const base = SEED_PRESETS[(Math.random() * SEED_PRESETS.length) | 0];
      const num = 100 + ((Math.random() * 899) | 0);
      this.worldSeedInput.value = `${base}${num}`;
      this.app.sound.playClick();
    });

    document.querySelectorAll('.mode-selector .mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-selector .mode-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedNewMode = btn.dataset.mode;
        this.modeDesc.textContent = MODE_DESCRIPTIONS[this.selectedNewMode] || '';
        this.app.sound.playClick();
      });
    });

    this.createWorldBtn.addEventListener('click', () => {
      const name = this.worldNameInput.value.trim() || 'New World';
      const seed = this.worldSeedInput.value.trim() || 'Horizon2026';
      this.app.sound.playClick();
      this.app.startNewWorld({ name, seed, mode: this.selectedNewMode });
    });

    this.importWorldInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data && data.seed) {
          data.id = data.id || `world_${Date.now()}`;
          data.name = data.name || 'Imported World';
          await this.app.storage.saveWorld(data);
          await this.refreshSavedWorlds();
          this.showStatusToast(`Imported "${data.name}"`);
        }
      } catch (_) {
        this.showStatusToast('Invalid world file');
      }
      e.target.value = '';
    });

    this.resumeLockBanner.addEventListener('click', () => {
      this.app.requestLock();
    });

    // Inventory & Crafting events
    this.closeInvBtn.addEventListener('click', () => {
      this.app.closeModalsAndLock();
    });

    this.tabBackpack.addEventListener('click', () => {
      this.activeInvTab = 'backpack';
      this.renderInventoryModal();
      this.app.sound.playClick();
    });

    this.tabCreative.addEventListener('click', () => {
      this.activeInvTab = 'creative';
      this.renderInventoryModal();
      this.app.sound.playClick();
    });

    this.craftableCheckbox.addEventListener('change', () => {
      this.craftableOnly = this.craftableCheckbox.checked;
      this.renderRecipeBook();
    });

    this.recipeCats.querySelectorAll('.cat-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.recipeCats.querySelectorAll('.cat-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeCategory = btn.dataset.cat;
        this.renderRecipeBook();
        this.app.sound.playClick();
      });
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.invModal.classList.contains('hidden')) {
        this.cursorStack.style.left = `${e.clientX}px`;
        this.cursorStack.style.top = `${e.clientY}px`;
      }
    });

    // Pause menu events
    this.resumeGameBtn.addEventListener('click', () => {
      this.app.sound.playClick();
      this.app.closeModalsAndLock();
    });

    this.pauseModeGroup.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.app.setGameMode(btn.dataset.mode);
        this.syncPauseControls();
        this.app.sound.playClick();
      });
    });

    this.pauseTimeGroup.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.app.sky) {
          this.app.sky.setTimePreset(btn.dataset.time);
          this.app.sound.playClick();
          this.showStatusToast(`Time set to ${btn.textContent}`);
        }
      });
    });

    this.pauseWeatherGroup.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.app.sky) {
          this.app.sky.weatherMode = btn.dataset.weather;
          this.syncPauseControls();
          this.app.sound.playClick();
        }
      });
    });

    this.renderDistSlider.addEventListener('input', () => {
      const val = Number(this.renderDistSlider.value);
      this.renderDistVal.textContent = String(val);
      if (this.app.world) this.app.world.renderDistance = val;
    });

    this.volumeSlider.addEventListener('input', () => {
      const pct = Number(this.volumeSlider.value);
      this.volumeVal.textContent = `${pct}%`;
      this.app.sound.setVolume(pct / 100);
    });

    this.saveNowBtn.addEventListener('click', async () => {
      this.app.sound.playClick();
      await this.app.saveCurrentWorld();
      this.showStatusToast('World saved');
    });

    this.quitTitleBtn.addEventListener('click', async () => {
      this.app.sound.playClick();
      await this.app.saveAndReturnToTitle();
    });

    this.respawnBtn.addEventListener('click', () => {
      this.app.sound.playClick();
      this.deathModal.classList.add('hidden');
      if (this.app.player) this.app.player.respawn();
      this.renderStats();
      this.app.requestLock();
    });

    this.buildCreativePaletteOnce();
  }

  buildCreativePaletteOnce() {
    this.creativeGrid.innerHTML = '';
    for (const id of CREATIVE_PALETTE) {
      const def = getDef(id);
      const cell = document.createElement('div');
      cell.className = 'slot';
      cell.title = def.name;
      const url = this.iconUrls.get(id);
      if (url) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = def.name;
        cell.appendChild(img);
      }
      cell.addEventListener('click', (e) => {
        e.preventDefault();
        const inv = this.app.inventory;
        if (!inv) return;
        const count = e.shiftKey ? (def.maxStack || 64) : (def.isBlock ? 16 : 1);
        // Place directly in selected hotbar slot if empty or add to inventory
        if (!inv.slots[inv.selectedSlot]) {
          inv.slots[inv.selectedSlot] = inv.makeStack(id, count);
          inv.notify();
        } else {
          inv.addItem(id, count);
        }
        this.app.sound.playPickup();
        this.showStatusToast(`Added ${def.name}`);
      });
      this.creativeGrid.appendChild(cell);
    }
  }

  async refreshSavedWorlds() {
    const worlds = await this.app.storage.listWorlds();
    this.savedList.innerHTML = '';

    if (worlds.length === 0) {
      this.savedSection.classList.add('hidden');
      return;
    }

    this.savedSection.classList.remove('hidden');
    for (const w of worlds) {
      const row = document.createElement('div');
      row.className = 'world-item';

      const meta = document.createElement('div');
      meta.className = 'world-meta';
      const title = document.createElement('strong');
      title.textContent = w.name || 'Saved World';
      const sub = document.createElement('span');
      const modeLabel = (w.mode || 'survival').charAt(0).toUpperCase() + (w.mode || 'survival').slice(1);
      sub.textContent = `${modeLabel} · Day ${w.dayCount || 1} · Seed: ${w.seed}`;
      meta.append(title, sub);

      const actions = document.createElement('div');
      actions.className = 'world-actions';

      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'primary-btn';
      playBtn.textContent = 'Play';
      playBtn.addEventListener('click', () => {
        this.app.sound.playClick();
        this.app.loadSavedWorld(w.id);
      });

      const expBtn = document.createElement('button');
      expBtn.type = 'button';
      expBtn.className = 'secondary-btn';
      expBtn.textContent = 'Export';
      expBtn.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(w)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${(w.name || 'world').replace(/[^a-z0-9_-]/gi, '_')}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'secondary-btn danger-hover';
      delBtn.textContent = '✕';
      delBtn.title = 'Delete World';
      delBtn.addEventListener('click', async () => {
        await this.app.storage.deleteWorld(w.id);
        await this.refreshSavedWorlds();
      });

      actions.append(playBtn, expBtn, delBtn);
      row.append(meta, actions);
      this.savedList.appendChild(row);
    }
  }

  showTitleScreen() {
    this.hud.classList.add('hidden');
    this.invModal.classList.add('hidden');
    this.pauseModal.classList.add('hidden');
    this.deathModal.classList.add('hidden');
    this.underwaterOverlay.classList.add('hidden');
    this.titleScreen.classList.remove('hidden');
    this.refreshSavedWorlds();
  }

  showHUD() {
    this.titleScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.renderHotbar();
    this.renderStats();
  }

  openInventory(preferredCategory = null) {
    if (preferredCategory === 'smelting') {
      this.activeCategory = 'smelting';
    } else if (preferredCategory === 'crafting' && this.activeCategory === 'smelting') {
      this.activeCategory = 'all';
    }

    this.recipeCats.querySelectorAll('.cat-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.cat === this.activeCategory);
    });

    const isCreative = this.app.gameMode === GAME_MODES.CREATIVE;
    this.tabCreative.classList.toggle('hidden', !isCreative);
    if (!isCreative && this.activeInvTab === 'creative') {
      this.activeInvTab = 'backpack';
    }

    this.pauseModal.classList.add('hidden');
    this.invModal.classList.remove('hidden');
    this.renderInventoryModal();
  }

  openPause() {
    this.invModal.classList.add('hidden');
    this.syncPauseControls();
    this.pauseModal.classList.remove('hidden');
  }

  closeModals() {
    if (this.app.inventory) this.app.inventory.returnCursorItem();
    this.invModal.classList.add('hidden');
    this.pauseModal.classList.add('hidden');
    this.updateCursorPreview();
  }

  syncPauseControls() {
    this.pauseWorldTitle.textContent = this.app.worldName || 'Game Paused';
    this.pauseModeGroup.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === this.app.gameMode);
    });
    if (this.app.sky) {
      this.pauseWeatherGroup.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('active', b.dataset.weather === this.app.sky.weatherMode);
      });
    }
    if (this.app.world) {
      this.renderDistSlider.value = String(this.app.world.renderDistance);
      this.renderDistVal.textContent = String(this.app.world.renderDistance);
    }
  }

  createSlotElement(slotData, slotIndex, { showKey = false, interactive = false } = {}) {
    const el = document.createElement('div');
    el.className = 'slot';
    if (showKey && slotIndex === this.app.inventory.selectedSlot) {
      el.classList.add('selected');
    }

    if (showKey) {
      const k = document.createElement('span');
      k.className = 'slot-key';
      k.textContent = String(slotIndex + 1);
      el.appendChild(k);
    }

    if (slotData) {
      const def = getDef(slotData.id);
      el.title = def.name;
      const url = this.iconUrls.get(slotData.id);
      if (url) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = def.name;
        el.appendChild(img);
      }
      if (slotData.count > 1) {
        const cnt = document.createElement('span');
        cnt.className = 'slot-count';
        cnt.textContent = String(slotData.count);
        el.appendChild(cnt);
      }
      if (slotData.maxDurability && slotData.durability < slotData.maxDurability) {
        const bar = document.createElement('div');
        bar.className = 'slot-durability';
        const fill = document.createElement('span');
        const ratio = Math.max(0, slotData.durability / slotData.maxDurability);
        fill.style.width = `${Math.round(ratio * 100)}%`;
        fill.style.background = ratio > 0.5 ? '#4ade80' : ratio > 0.25 ? '#fbbf24' : '#ef4444';
        bar.appendChild(fill);
        el.appendChild(bar);
      }
    }

    if (interactive) {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const right = e.button === 2;
        this.app.inventory.handleSlotClick(slotIndex, right, e.shiftKey);
        this.app.sound.playClick();
      });
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    } else if (showKey) {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.app.inventory.selectSlot(slotIndex);
      });
    }

    return el;
  }

  renderHotbar() {
    const inv = this.app.inventory;
    if (!inv) return;

    this.hotbarEl.innerHTML = '';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      this.hotbarEl.appendChild(
        this.createSlotElement(inv.slots[i], i, { showKey: true, interactive: false })
      );
    }

    const sel = inv.getSelected();
    const selId = sel ? sel.id : 0;
    if (inv.selectedSlot !== this.lastToastSlot || selId !== this.lastToastId) {
      this.lastToastSlot = inv.selectedSlot;
      this.lastToastId = selId;
      if (sel) {
        this.showItemToast(getDef(sel.id).name);
      } else {
        this.itemToast.classList.remove('visible');
      }
    }

    if (!this.invModal.classList.contains('hidden')) {
      this.renderInventoryModal();
    }
  }

  renderInventoryModal() {
    const inv = this.app.inventory;
    if (!inv) return;

    this.tabBackpack.classList.toggle('active', this.activeInvTab === 'backpack');
    this.tabCreative.classList.toggle('active', this.activeInvTab === 'creative');
    this.backpackPanel.classList.toggle('hidden', this.activeInvTab !== 'backpack');
    this.creativePanel.classList.toggle('hidden', this.activeInvTab !== 'creative');

    // Backpack slots (9..35)
    this.backpackGrid.innerHTML = '';
    for (let i = HOTBAR_SIZE; i < TOTAL_SLOTS; i++) {
      this.backpackGrid.appendChild(
        this.createSlotElement(inv.slots[i], i, { showKey: false, interactive: true })
      );
    }

    // Hotbar mirror (0..8)
    this.invHotbarGrid.innerHTML = '';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      this.invHotbarGrid.appendChild(
        this.createSlotElement(inv.slots[i], i, { showKey: true, interactive: true })
      );
    }

    this.updateCursorPreview();
    this.renderRecipeBook();
  }

  updateCursorPreview() {
    const cur = this.app.inventory ? this.app.inventory.cursorItem : null;
    if (!cur) {
      this.cursorStack.classList.add('hidden');
      return;
    }
    this.cursorStack.classList.remove('hidden');
    this.cursorStackImg.src = this.iconUrls.get(cur.id) || '';
    this.cursorStackCount.textContent = cur.count > 1 ? String(cur.count) : '';
  }

  renderRecipeBook() {
    const inv = this.app.inventory;
    const player = this.app.player;
    if (!inv || !player) return;

    const stations = player.getNearbyStations();
    if (this.app.gameMode === GAME_MODES.CREATIVE) {
      stations.crafting = true;
      stations.smelting = true;
    }

    // Dynamic station indicator (shown only when a station is actively detected nearby)
    const activeLabels = [];
    if (stations.crafting) activeLabels.push('Crafting Table nearby');
    if (stations.smelting) activeLabels.push('Furnace nearby');
    if (activeLabels.length > 0) {
      this.stationStatus.textContent = activeLabels.join(' · ');
      this.stationStatus.classList.remove('hidden');
    } else {
      this.stationStatus.classList.add('hidden');
    }

    const recipes = inv.getAvailableRecipes(stations, this.activeCategory, this.craftableOnly);
    // Sort craftable recipes first for effortless scanning
    recipes.sort((a, b) => {
      const ca = inv.canCraft(a, stations) ? 1 : 0;
      const cb = inv.canCraft(b, stations) ? 1 : 0;
      return cb - ca;
    });

    this.recipeList.innerHTML = '';
    for (const r of recipes) {
      const can = inv.canCraft(r, stations);
      const outDef = getDef(r.output.id);

      const card = document.createElement('div');
      card.className = `recipe-card${can ? ' craftable' : ''}`;

      const main = document.createElement('div');
      main.className = 'recipe-main';

      const iconWrap = document.createElement('div');
      iconWrap.className = 'recipe-out-icon';
      const img = document.createElement('img');
      img.src = this.iconUrls.get(r.output.id) || '';
      img.alt = outDef.name;
      iconWrap.appendChild(img);
      if (r.output.count > 1) {
        const c = document.createElement('span');
        c.textContent = `×${r.output.count}`;
        iconWrap.appendChild(c);
      }

      const info = document.createElement('div');
      info.className = 'recipe-info';
      const title = document.createElement('div');
      title.className = 'recipe-title';
      title.textContent = outDef.name;
      info.appendChild(title);

      const ings = document.createElement('div');
      ings.className = 'recipe-ings';
      for (const ing of r.ingredients) {
        const have = inv.countMatching(ing);
        const label = ing.label || getDef(ing.id).name;
        const pill = document.createElement('span');
        pill.className = `ing-pill ${have >= ing.count ? 'ok' : 'missing'}`;
        pill.textContent = `${label} (${Math.min(have, 99)}/${ing.count})`;
        ings.appendChild(pill);
      }
      info.appendChild(ings);

      if (r.station === 'crafting' && !stations.crafting) {
        const req = document.createElement('div');
        req.className = 'station-req';
        req.textContent = 'Place & stand near a Crafting Table';
        info.appendChild(req);
      } else if (r.station === 'smelting' && !stations.smelting) {
        const req = document.createElement('div');
        req.className = 'station-req';
        req.textContent = 'Place & stand near a Furnace';
        info.appendChild(req);
      }

      main.append(iconWrap, info);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'craft-action-btn';
      btn.disabled = !can;
      btn.textContent = r.station === 'smelting' ? 'Smelt' : 'Craft';
      btn.addEventListener('click', () => {
        const res = inv.craft(r, stations);
        if (res) {
          if (res.leftover > 0 && this.app.entities) {
            this.app.entities.spawnDrop(player.pos.x, player.pos.y + 1.0, player.pos.z, res.id, res.leftover);
          }
          this.app.sound.playPickup();
        }
      });

      card.append(main, btn);
      this.recipeList.appendChild(card);
    }
  }

  renderStats() {
    const player = this.app.player;
    if (!player) return;

    if (this.app.gameMode === GAME_MODES.CREATIVE) {
      this.survivalBars.classList.add('hidden');
      return;
    }

    this.survivalBars.classList.remove('hidden');
    this.heartsBar.innerHTML = '';
    const totalHearts = MAX_HEALTH / 2;
    for (let i = 0; i < totalHearts; i++) {
      const span = document.createElement('span');
      span.className = 'heart-icon';
      const hpVal = player.health - i * 2;
      if (hpVal >= 2) {
        span.textContent = '♥';
        span.style.color = '#ef4444';
      } else if (hpVal === 1) {
        span.textContent = '♥';
        span.style.color = '#fb7185';
        span.style.opacity = '0.68';
      } else {
        span.textContent = '♡';
        span.style.color = 'rgba(255,255,255,0.38)';
      }
      this.heartsBar.appendChild(span);
    }

    if (player.headUnderwater || player.air < MAX_AIR) {
      this.airBar.classList.remove('hidden');
      this.airBar.innerHTML = '';
      const bubbles = Math.ceil(player.air);
      for (let i = 0; i < bubbles; i++) {
        const b = document.createElement('span');
        b.className = 'bubble-icon';
        this.airBar.appendChild(b);
      }
    } else {
      this.airBar.classList.add('hidden');
    }

    if (player.dead) {
      this.deathModal.classList.remove('hidden');
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }

  flashDamage() {
    this.damageOverlay.classList.add('flash');
    setTimeout(() => this.damageOverlay.classList.remove('flash'), 210);
  }

  showItemToast(text) {
    this.itemToast.textContent = text;
    this.itemToast.classList.add('visible');
    if (this.itemToastTimer) clearTimeout(this.itemToastTimer);
    this.itemToastTimer = setTimeout(() => {
      this.itemToast.classList.remove('visible');
    }, 1800);
  }

  showStatusToast(text) {
    this.statusToast.textContent = text;
    this.statusToast.classList.remove('hidden');
    if (this.statusToastTimer) clearTimeout(this.statusToastTimer);
    this.statusToastTimer = setTimeout(() => {
      this.statusToast.classList.add('hidden');
    }, 2200);
  }

  updateHUDLive(biomeName, dayCount, phaseLabel, pos, fps, isLocked, isModalOpen, headUnderwater) {
    const flyTag = this.app.player && this.app.player.flying ? ' · Flying' : '';
    this.hudPhase.textContent = `Day ${dayCount} · ${phaseLabel}${flyTag}`;
    this.hudBiome.textContent = biomeName;
    this.hudCoords.textContent = `${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)}`;

    if (this.showFps) {
      this.hudFps.classList.remove('hidden');
      this.hudFps.textContent = `· ${fps} FPS`;
    } else {
      this.hudFps.classList.add('hidden');
    }

    this.underwaterOverlay.classList.toggle('hidden', !headUnderwater);
    this.resumeLockBanner.classList.toggle('hidden', isLocked || isModalOpen);
  }
}
