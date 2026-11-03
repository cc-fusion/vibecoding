import { GAME_MODES } from '../constants.js';
import { getDef, CREATIVE_PALETTE } from '../blocks.js';
import { INGREDIENT_GROUPS } from '../gameplay/inventory.js';
import { RECIPES, RECIPE_CATEGORIES, canUseRecipeStation } from '../gameplay/crafting.js';

export class UIManager {
  constructor(game) {
    this.game = game;
    this.activeScreen = 'title'; // 'title' | 'playing' | 'inventory' | 'pause' | 'settings' | 'controls'
    this.returnScreen = 'title';

    this.selectedCreateMode = GAME_MODES.SURVIVAL;
    this.selectedRecipeCat = 'all';
    this.craftableOnly = false;
    this.activeInvTab = 'crafting'; // 'crafting' | 'creative'

    // Cursor held stack while arranging inventory
    this.cursorStack = null;

    this.heldBannerTimer = 0;
    this.lastHeldSignature = '';
    this.toastTimer = 0;

    this._cacheElements();
    this._bindEvents();
    this._renderCategoryPills();
    this._renderCreativeGrid();
  }

  _cacheElements() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      canvas: $('game-canvas'),
      underwaterOverlay: $('underwater-overlay'),
      hurtOverlay: $('hurt-overlay'),

      hud: $('hud'),
      hudClock: $('hud-clock'),
      hudBiome: $('hud-biome'),
      hudGoal: $('hud-goal'),
      goalTitle: $('goal-title'),
      goalHint: $('goal-hint'),
      hudDiagnostics: $('hud-diagnostics'),
      miningHint: $('mining-hint'),
      toastBanner: $('toast-banner'),
      heldBanner: $('held-item-banner'),
      survivalBars: $('survival-bars'),
      heartsRow: $('hearts-row'),
      hungerRow: $('hunger-row'),
      oxygenRow: $('oxygen-row'),
      hotbar: $('hotbar'),
      hudBagBtn: $('hud-bag-btn'),

      titleScreen: $('title-screen'),
      titleMainView: $('title-main-view'),
      titleCreateView: $('title-create-view'),
      btnContinueWorld: $('btn-continue-world'),
      btnOpenNewWorld: $('btn-open-new-world'),
      savedWorldsSection: $('saved-worlds-section'),
      savedWorldsList: $('saved-worlds-list'),
      btnTitleControls: $('btn-title-controls'),
      btnTitleSettings: $('btn-title-settings'),

      inputWorldName: $('input-world-name'),
      inputWorldSeed: $('input-world-seed'),
      btnRandomSeed: $('btn-random-seed'),
      createModeToggle: $('create-mode-toggle'),
      btnCancelCreate: $('btn-cancel-create'),
      btnStartWorld: $('btn-start-world'),

      inventoryModal: $('inventory-modal'),
      tabBtnCrafting: $('tab-btn-crafting'),
      tabBtnCreative: $('tab-btn-creative'),
      stationIndicator: $('station-indicator'),
      btnCloseInventory: $('btn-close-inventory'),
      paneCrafting: $('pane-crafting'),
      paneCreative: $('pane-creative'),
      craftCategories: $('craft-categories'),
      chkCraftableOnly: $('chk-craftable-only'),
      recipeList: $('recipe-list'),
      creativeGrid: $('creative-grid'),
      backpackGrid: $('backpack-grid'),
      modalHotbarGrid: $('modal-hotbar-grid'),
      cursorItemLabel: $('cursor-item-label'),
      btnDropSelected: $('btn-drop-selected'),
      creativeQuickBar: $('creative-quick-bar'),
      btnToggleWeather: $('btn-toggle-weather'),
      floatingSlot: $('floating-slot'),
      floatingSlotImg: $('floating-slot-img'),
      floatingSlotCount: $('floating-slot-count'),

      pauseModal: $('pause-modal'),
      pauseWorldTitle: $('pause-world-title'),
      btnResume: $('btn-resume'),
      btnSaveNow: $('btn-save-now'),
      btnPauseControls: $('btn-pause-controls'),
      btnPauseSettings: $('btn-pause-settings'),
      btnExitTitle: $('btn-exit-title'),

      settingsModal: $('settings-modal'),
      btnCloseSettings: $('btn-close-settings'),
      btnDoneSettings: $('btn-done-settings'),
      selRenderDistance: $('sel-render-distance'),
      selGameMode: $('sel-game-mode'),
      rngSfx: $('rng-sfx'),
      rngMusic: $('rng-music'),
      rngSens: $('rng-sens'),
      chkPeaceful: $('chk-peaceful'),
      chkGoals: $('chk-goals'),
      chkDiagnostics: $('chk-diagnostics'),

      controlsModal: $('controls-modal'),
      btnCloseControls: $('btn-close-controls'),
      btnDoneControls: $('btn-done-controls'),
    };
  }

  _bindEvents() {
    const clickSound = () => this.game.sound.playClick();

    // Title actions
    this.el.btnContinueWorld.addEventListener('click', () => {
      clickSound();
      if (this.latestWorldId) {
        this.game.loadSavedWorld(this.latestWorldId);
      }
    });

    this.el.btnOpenNewWorld.addEventListener('click', () => {
      clickSound();
      this.el.titleMainView.classList.add('hidden');
      this.el.titleCreateView.classList.remove('hidden');
      this.el.inputWorldSeed.value = `Terra-${Math.floor(1000 + Math.random() * 9000)}`;
    });

    this.el.btnCancelCreate.addEventListener('click', () => {
      clickSound();
      this.el.titleCreateView.classList.add('hidden');
      this.el.titleMainView.classList.remove('hidden');
    });

    this.el.btnRandomSeed.addEventListener('click', () => {
      clickSound();
      const words = ['Emerald', 'Cedar', 'Summit', 'Amber', 'Glacier', 'Canyon', 'Haven', 'Horizon'];
      const w = words[Math.floor(Math.random() * words.length)];
      this.el.inputWorldSeed.value = `${w}-${Math.floor(100 + Math.random() * 900)}`;
    });

    document.querySelectorAll('.seed-presets .preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        clickSound();
        this.el.inputWorldSeed.value = btn.dataset.seed || '';
      });
    });

    this.el.createModeToggle.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        clickSound();
        this.selectedCreateMode = btn.dataset.mode;
        this.el.createModeToggle.querySelectorAll('.seg-btn').forEach((b) => {
          b.classList.toggle('active', b === btn);
        });
      });
    });

    this.el.btnStartWorld.addEventListener('click', () => {
      clickSound();
      const name = this.el.inputWorldName.value.trim() || 'New Frontier';
      const seed = this.el.inputWorldSeed.value.trim() || `Seed-${Date.now()}`;
      this.game.startNewWorld({
        name,
        seed,
        gameMode: this.selectedCreateMode,
      });
    });

    // Sub-modals from Title & Pause
    this.el.btnTitleSettings.addEventListener('click', () => {
      clickSound();
      this.openSettings('title');
    });
    this.el.btnPauseSettings.addEventListener('click', () => {
      clickSound();
      this.openSettings('pause');
    });
    this.el.btnCloseSettings.addEventListener('click', () => this.closeSettings());
    this.el.btnDoneSettings.addEventListener('click', () => {
      clickSound();
      this.closeSettings();
    });

    this.el.btnTitleControls.addEventListener('click', () => {
      clickSound();
      this.openControls('title');
    });
    this.el.btnPauseControls.addEventListener('click', () => {
      clickSound();
      this.openControls('pause');
    });
    this.el.btnCloseControls.addEventListener('click', () => this.closeControls());
    this.el.btnDoneControls.addEventListener('click', () => {
      clickSound();
      this.closeControls();
    });

    // Settings inputs
    const applySettings = () => {
      const s = this.game.settings;
      s.renderDistance = Number(this.el.selRenderDistance.value);
      s.soundVolume = Number(this.el.rngSfx.value) / 100;
      s.musicVolume = Number(this.el.rngMusic.value) / 100;
      s.sensitivity = Number(this.el.rngSens.value) / 100;
      s.peacefulMobs = this.el.chkPeaceful.checked;
      s.showGoals = this.el.chkGoals.checked;
      s.showDiagnostics = this.el.chkDiagnostics.checked;

      const desiredMode = this.el.selGameMode.value;
      if (this.game.isWorldActive && desiredMode !== this.game.gameMode) {
        this.game.setGameMode(desiredMode);
      }
      this.game.applySettings();
    };

    [
      this.el.selRenderDistance,
      this.el.selGameMode,
      this.el.rngSfx,
      this.el.rngMusic,
      this.el.rngSens,
      this.el.chkPeaceful,
      this.el.chkGoals,
      this.el.chkDiagnostics,
    ].forEach((input) => input.addEventListener('input', applySettings));

    // HUD Bag button
    this.el.hudBagBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clickSound();
      this.openInventory();
    });

    // Inventory tabs & controls
    this.el.tabBtnCrafting.addEventListener('click', () => {
      clickSound();
      this._setInvTab('crafting');
    });
    this.el.tabBtnCreative.addEventListener('click', () => {
      clickSound();
      this._setInvTab('creative');
    });
    this.el.btnCloseInventory.addEventListener('click', () => {
      clickSound();
      this.resumeGameplay();
    });
    this.el.chkCraftableOnly.addEventListener('change', () => {
      this.craftableOnly = this.el.chkCraftableOnly.checked;
      this.renderRecipes();
    });
    this.el.btnDropSelected.addEventListener('click', () => {
      clickSound();
      this.game.dropHeldItem();
      this.renderInventoryGrids();
    });

    this.el.creativeQuickBar.querySelectorAll('[data-time]').forEach((btn) => {
      btn.addEventListener('click', () => {
        clickSound();
        if (this.game.sky) {
          this.game.sky.setTimePreset(btn.dataset.time);
          this.showToast(`Time set to ${btn.textContent}`);
        }
      });
    });

    this.el.btnToggleWeather.addEventListener('click', () => {
      clickSound();
      if (this.game.sky) {
        this.game.sky.toggleWeather();
        this.showToast(this.game.sky.weatherState === 'clear' ? 'Skies clearing' : 'Precipitation started');
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.activeScreen === 'inventory' && this.cursorStack) {
        this.el.floatingSlot.style.left = `${e.clientX}px`;
        this.el.floatingSlot.style.top = `${e.clientY}px`;
      }
    });

    // Pause menu buttons
    this.el.btnResume.addEventListener('click', () => {
      clickSound();
      this.resumeGameplay();
    });
    this.el.btnSaveNow.addEventListener('click', async () => {
      clickSound();
      await this.game.saveCurrentWorld();
      this.showToast('World saved');
      this.resumeGameplay();
    });
    this.el.btnExitTitle.addEventListener('click', async () => {
      clickSound();
      await this.game.exitToTitle();
    });
  }

  _setInvTab(tab) {
    this.activeInvTab = tab;
    this.el.tabBtnCrafting.classList.toggle('active', tab === 'crafting');
    this.el.tabBtnCreative.classList.toggle('active', tab === 'creative');
    this.el.paneCrafting.classList.toggle('hidden', tab !== 'crafting');
    this.el.paneCreative.classList.toggle('hidden', tab !== 'creative');
  }

  _renderCategoryPills() {
    this.el.craftCategories.innerHTML = '';
    for (const cat of RECIPE_CATEGORIES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `cat-pill ${this.selectedRecipeCat === cat.id ? 'active' : ''}`;
      btn.textContent = cat.label;
      btn.addEventListener('click', () => {
        this.game.sound.playClick();
        this.selectedRecipeCat = cat.id;
        this._renderCategoryPills();
        this.renderRecipes();
      });
      this.el.craftCategories.appendChild(btn);
    }
  }

  _renderCreativeGrid() {
    this.el.creativeGrid.innerHTML = '';
    for (const id of CREATIVE_PALETTE) {
      const def = getDef(id);
      const slotEl = document.createElement('div');
      slotEl.className = 'item-slot';
      slotEl.title = def.name;
      const img = document.createElement('img');
      img.src = this.game.textures.getIconUrl(id);
      img.alt = def.name;
      slotEl.appendChild(img);

      slotEl.addEventListener('click', () => {
        this.game.sound.playPickup();
        const inv = this.game.inventory;
        const maxStack = def.maxStack || 64;
        inv.slots[inv.selectedHotbar] = {
          id,
          count: maxStack === 1 ? 1 : 64,
          ...(def.durability ? { durability: def.durability, maxDurability: def.durability } : {}),
        };
        inv.notify();
        this.showToast(`Equipped ${def.name}`);
      });

      this.el.creativeGrid.appendChild(slotEl);
    }
  }

  async showTitleScreen() {
    this.activeScreen = 'title';
    document.exitPointerLock?.();

    this.el.hud.classList.add('hidden');
    this.el.inventoryModal.classList.add('hidden');
    this.el.pauseModal.classList.add('hidden');
    this.el.settingsModal.classList.add('hidden');
    this.el.controlsModal.classList.add('hidden');
    this.el.titleCreateView.classList.add('hidden');
    this.el.titleMainView.classList.remove('hidden');
    this.el.titleScreen.classList.remove('hidden');

    await this.refreshSavedWorlds();
  }

  async refreshSavedWorlds() {
    const worlds = await this.game.saveManager.listWorlds();
    this.latestWorldId = worlds.length > 0 ? worlds[0].id : null;

    if (worlds.length > 0) {
      const latest = worlds[0];
      this.el.btnContinueWorld.textContent = `Continue "${latest.name}"`;
      this.el.btnContinueWorld.classList.remove('hidden');
      this.el.savedWorldsSection.classList.remove('hidden');

      this.el.savedWorldsList.innerHTML = '';
      for (const w of worlds) {
        const row = document.createElement('div');
        row.className = 'world-row';

        const info = document.createElement('div');
        info.className = 'world-row-info';
        const modeLabel = w.gameMode === GAME_MODES.CREATIVE ? 'Creative' : 'Survival';
        info.innerHTML = `
          <div class="world-row-name">${this._escape(w.name)}</div>
          <div class="world-row-meta">${modeLabel} · Day ${w.dayCount || 1} · Seed: ${this._escape(w.seed)}</div>
        `;
        info.addEventListener('click', () => {
          this.game.sound.playClick();
          this.game.loadSavedWorld(w.id);
        });

        const actions = document.createElement('div');
        actions.className = 'world-row-actions';

        const playBtn = document.createElement('button');
        playBtn.className = 'btn btn-secondary btn-compact';
        playBtn.textContent = 'Play';
        playBtn.addEventListener('click', () => {
          this.game.sound.playClick();
          this.game.loadSavedWorld(w.id);
        });

        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-danger btn-compact';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          this.game.sound.playClick();
          await this.game.saveManager.deleteWorld(w.id);
          await this.refreshSavedWorlds();
        });

        actions.append(playBtn, delBtn);
        row.append(info, actions);
        this.el.savedWorldsList.appendChild(row);
      }
    } else {
      this.el.btnContinueWorld.classList.add('hidden');
      this.el.savedWorldsSection.classList.add('hidden');
    }
  }

  enterGameplayUI() {
    this._returnCursorStackToInventory();
    this.activeScreen = 'playing';
    this.el.titleScreen.classList.add('hidden');
    this.el.inventoryModal.classList.add('hidden');
    this.el.pauseModal.classList.add('hidden');
    this.el.settingsModal.classList.add('hidden');
    this.el.controlsModal.classList.add('hidden');
    this.el.hud.classList.remove('hidden');
    this.renderHotbar();
  }

  resumeGameplay() {
    this.enterGameplayUI();
    this.game.requestPointerLock();
  }

  openInventory(preferredStation = null) {
    if (!this.game.isWorldActive) return;
    this.activeScreen = 'inventory';
    this.game.player.clearInputs();
    document.exitPointerLock?.();

    const isCreative = this.game.gameMode === GAME_MODES.CREATIVE;
    this.el.tabBtnCreative.classList.toggle('hidden', !isCreative);
    this.el.creativeQuickBar.classList.toggle('hidden', !isCreative);

    if (preferredStation === 'furnace') {
      this.selectedRecipeCat = 'smelting';
      this._renderCategoryPills();
      this._setInvTab('crafting');
    } else if (preferredStation === 'workbench') {
      this.selectedRecipeCat = 'all';
      this._renderCategoryPills();
      this._setInvTab('crafting');
    } else if (isCreative && this.activeInvTab === 'creative') {
      this._setInvTab('creative');
    } else {
      this._setInvTab('crafting');
    }

    this.el.pauseModal.classList.add('hidden');
    this.el.inventoryModal.classList.remove('hidden');

    this.renderInventoryGrids();
    this.renderRecipes();
  }

  openPauseMenu() {
    if (!this.game.isWorldActive) return;
    this._returnCursorStackToInventory();
    this.activeScreen = 'pause';
    this.game.player.clearInputs();
    document.exitPointerLock?.();

    this.el.pauseWorldTitle.textContent = this.game.worldMeta?.name || 'World Paused';
    this.el.inventoryModal.classList.add('hidden');
    this.el.settingsModal.classList.add('hidden');
    this.el.controlsModal.classList.add('hidden');
    this.el.pauseModal.classList.remove('hidden');
  }

  openSettings(fromScreen) {
    this.returnScreen = fromScreen;
    this.activeScreen = 'settings';

    const s = this.game.settings;
    this.el.selRenderDistance.value = String(s.renderDistance);
    this.el.selGameMode.value = this.game.gameMode || GAME_MODES.SURVIVAL;
    this.el.rngSfx.value = String(Math.round(s.soundVolume * 100));
    this.el.rngMusic.value = String(Math.round(s.musicVolume * 100));
    this.el.rngSens.value = String(Math.round(s.sensitivity * 100));
    this.el.chkPeaceful.checked = Boolean(s.peacefulMobs);
    this.el.chkGoals.checked = Boolean(s.showGoals);
    this.el.chkDiagnostics.checked = Boolean(s.showDiagnostics);

    this.el.titleScreen.classList.add('hidden');
    this.el.pauseModal.classList.add('hidden');
    this.el.settingsModal.classList.remove('hidden');
  }

  closeSettings() {
    this.el.settingsModal.classList.add('hidden');
    if (this.returnScreen === 'pause') {
      this.openPauseMenu();
    } else {
      this.showTitleScreen();
    }
  }

  openControls(fromScreen) {
    this.returnScreen = fromScreen;
    this.activeScreen = 'controls';
    this.el.titleScreen.classList.add('hidden');
    this.el.pauseModal.classList.add('hidden');
    this.el.controlsModal.classList.remove('hidden');
  }

  closeControls() {
    this.el.controlsModal.classList.add('hidden');
    if (this.returnScreen === 'pause') {
      this.openPauseMenu();
    } else {
      this.showTitleScreen();
    }
  }

  showToast(message, duration = 2.6) {
    this.el.toastBanner.textContent = message;
    this.el.toastBanner.classList.remove('hidden');
    this.toastTimer = duration;
  }

  renderHotbar() {
    const inv = this.game.inventory;
    if (!inv) return;

    this.el.hotbar.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const slot = inv.slots[i];
      const div = this._createSlotElement(slot, i === inv.selectedHotbar, i + 1);
      div.addEventListener('click', (e) => {
        e.stopPropagation();
        inv.selectHotbar(i);
      });
      this.el.hotbar.appendChild(div);
    }

    const held = inv.getHeldSlot();
    const sig = held ? `${inv.selectedHotbar}:${held.id}` : `${inv.selectedHotbar}:empty`;
    if (sig !== this.lastHeldSignature) {
      this.lastHeldSignature = sig;
      if (held) {
        this.el.heldBanner.textContent = getDef(held.id).name;
        this.el.heldBanner.classList.add('visible');
        this.heldBannerTimer = 2.2;
      } else {
        this.el.heldBanner.classList.remove('visible');
      }
    }
  }

  renderInventoryGrids() {
    const inv = this.game.inventory;
    if (!inv) return;

    this.el.backpackGrid.innerHTML = '';
    for (let i = 9; i < 36; i++) {
      const el = this._createSlotElement(inv.slots[i], false, null);
      this._bindModalSlotEvents(el, i);
      this.el.backpackGrid.appendChild(el);
    }

    this.el.modalHotbarGrid.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const el = this._createSlotElement(inv.slots[i], i === inv.selectedHotbar, i + 1);
      this._bindModalSlotEvents(el, i);
      this.el.modalHotbarGrid.appendChild(el);
    }

    this._syncFloatingCursor();
  }

  _createSlotElement(slot, isSelected = false, keyNumber = null) {
    const div = document.createElement('div');
    div.className = `item-slot ${isSelected ? 'selected' : ''}`;

    if (keyNumber !== null) {
      const k = document.createElement('span');
      k.className = 'slot-key';
      k.textContent = String(keyNumber);
      div.appendChild(k);
    }

    if (slot && slot.id) {
      const def = getDef(slot.id);
      div.title = def.name;
      const img = document.createElement('img');
      img.src = this.game.textures.getIconUrl(slot.id);
      img.alt = def.name;
      div.appendChild(img);

      if (slot.count > 1) {
        const cnt = document.createElement('span');
        cnt.className = 'slot-count';
        cnt.textContent = String(slot.count);
        div.appendChild(cnt);
      }

      if (typeof slot.durability === 'number' && slot.durability < slot.maxDurability) {
        const bar = document.createElement('div');
        bar.className = 'slot-durability';
        const fill = document.createElement('span');
        const pct = Math.max(4, Math.round((slot.durability / slot.maxDurability) * 100));
        fill.style.width = `${pct}%`;
        fill.style.background = pct > 50 ? '#5ee270' : pct > 22 ? '#f5c451' : '#ef5350';
        bar.appendChild(fill);
        div.appendChild(bar);
      }
    }

    return div;
  }

  _bindModalSlotEvents(slotEl, index) {
    slotEl.addEventListener('click', (e) => {
      e.preventDefault();
      const inv = this.game.inventory;
      this.game.sound.playClick();

      if (e.shiftKey && !this.cursorStack) {
        inv.quickTransfer(index);
        this.renderInventoryGrids();
        return;
      }

      const current = inv.slots[index];
      if (!this.cursorStack) {
        if (current) {
          this.cursorStack = current;
          inv.slots[index] = null;
          inv.notify();
        }
      } else {
        if (!current) {
          inv.slots[index] = this.cursorStack;
          this.cursorStack = null;
          inv.notify();
        } else if (current.id === this.cursorStack.id && !current.maxDurability) {
          const maxStack = getDef(current.id).maxStack || 64;
          const space = maxStack - current.count;
          if (space > 0) {
            const add = Math.min(space, this.cursorStack.count);
            current.count += add;
            this.cursorStack.count -= add;
            if (this.cursorStack.count <= 0) this.cursorStack = null;
            inv.notify();
          }
        } else {
          inv.slots[index] = this.cursorStack;
          this.cursorStack = current;
          inv.notify();
        }
      }
      this.renderInventoryGrids();
    });

    slotEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const inv = this.game.inventory;
      const current = inv.slots[index];

      if (!this.cursorStack && current && current.count > 1) {
        const take = Math.ceil(current.count / 2);
        this.cursorStack = { ...current, count: take };
        current.count -= take;
        inv.notify();
      } else if (this.cursorStack) {
        if (!current) {
          inv.slots[index] = { ...this.cursorStack, count: 1 };
          this.cursorStack.count -= 1;
          if (this.cursorStack.count <= 0) this.cursorStack = null;
          inv.notify();
        } else if (current.id === this.cursorStack.id && !current.maxDurability) {
          const maxStack = getDef(current.id).maxStack || 64;
          if (current.count < maxStack) {
            current.count += 1;
            this.cursorStack.count -= 1;
            if (this.cursorStack.count <= 0) this.cursorStack = null;
            inv.notify();
          }
        }
      }
      this.renderInventoryGrids();
    });
  }

  _syncFloatingCursor() {
    if (this.cursorStack) {
      const def = getDef(this.cursorStack.id);
      this.el.floatingSlotImg.src = this.game.textures.getIconUrl(this.cursorStack.id);
      this.el.floatingSlotCount.textContent = this.cursorStack.count > 1 ? String(this.cursorStack.count) : '';
      this.el.floatingSlot.classList.remove('hidden');
      this.el.cursorItemLabel.textContent = `Holding: ${def.name} ×${this.cursorStack.count}`;
    } else {
      this.el.floatingSlot.classList.add('hidden');
      this.el.cursorItemLabel.textContent = 'Click slot to move · Right-Click split · Shift+Click transfer';
    }
  }

  _returnCursorStackToInventory() {
    if (!this.cursorStack || !this.game.inventory) return;
    const leftover = this.game.inventory.addItem(
      this.cursorStack.id,
      this.cursorStack.count,
      this.cursorStack.durability ?? null
    );
    if (leftover > 0 && this.game.drops && this.game.player) {
      this.game.drops.spawnDrop(
        this.game.player.pos.x,
        this.game.player.pos.y + 1.1,
        this.game.player.pos.z,
        this.cursorStack.id,
        leftover
      );
    }
    this.cursorStack = null;
    this.el.floatingSlot.classList.add('hidden');
  }

  renderRecipes() {
    const inv = this.game.inventory;
    if (!inv || !this.game.world || !this.game.player) return;

    const stations = this.game.getNearbyStations();
    if (stations.workbench && stations.furnace) {
      this.el.stationIndicator.textContent = 'Workbench & Furnace Nearby';
      this.el.stationIndicator.classList.add('station-active');
    } else if (stations.furnace) {
      this.el.stationIndicator.textContent = 'Stone Furnace Nearby';
      this.el.stationIndicator.classList.add('station-active');
    } else if (stations.workbench) {
      this.el.stationIndicator.textContent = 'Crafting Table Nearby';
      this.el.stationIndicator.classList.add('station-active');
    } else {
      this.el.stationIndicator.textContent = 'Hand Crafting';
      this.el.stationIndicator.classList.remove('station-active');
    }

    this.el.recipeList.innerHTML = '';

    for (const r of RECIPES) {
      if (this.selectedRecipeCat !== 'all' && r.category !== this.selectedRecipeCat) continue;

      const stationOk = canUseRecipeStation(r, stations);
      const affordOk = inv.canAfford(r.ingredients);
      const canCraft = stationOk && affordOk;

      if (this.craftableOnly && !canCraft) continue;

      const outDef = getDef(r.output.id);
      const card = document.createElement('div');
      card.className = `recipe-card ${canCraft ? 'craftable' : 'locked'}`;

      const reqParts = r.ingredients.map((ing) => {
        const have = inv.countIngredient(ing.item);
        const label = typeof ing.item === 'string'
          ? INGREDIENT_GROUPS[ing.item].name
          : getDef(ing.item).name;
        return `${label} (${Math.min(have, ing.count)}/${ing.count})`;
      });

      let stationNote = '';
      if (!stationOk) {
        stationNote = r.station === 'workbench' ? 'Needs Crafting Table nearby' : 'Needs Stone Furnace nearby';
      }

      card.innerHTML = `
        <div class="recipe-left">
          <img class="recipe-icon" src="${this.game.textures.getIconUrl(r.output.id)}" alt="" />
          <div>
            <div class="recipe-title">${outDef.name}${r.output.count > 1 ? ` ×${r.output.count}` : ''}</div>
            <div class="recipe-reqs">${reqParts.join(' · ')}</div>
          </div>
        </div>
        <div class="recipe-station-note">${stationNote || (canCraft ? 'Craft' : '')}</div>
      `;

      card.addEventListener('click', (e) => {
        if (!canCraft) {
          if (!stationOk) {
            this.showToast(stationNote);
          }
          return;
        }
        const times = e.shiftKey ? 4 : 1;
        let craftedAny = false;
        for (let t = 0; t < times; t++) {
          if (!inv.canAfford(r.ingredients)) break;
          inv.consumeIngredients(r.ingredients);
          const leftover = inv.addItem(r.output.id, r.output.count);
          if (leftover > 0 && this.game.drops) {
            this.game.drops.spawnDrop(
              this.game.player.pos.x,
              this.game.player.pos.y + 1.1,
              this.game.player.pos.z,
              r.output.id,
              leftover
            );
          }
          craftedAny = true;
        }
        if (craftedAny) {
          this.game.sound.playCraft();
          this.game.progression.update(inv);
          this.renderInventoryGrids();
          this.renderRecipes();
        }
      });

      this.el.recipeList.appendChild(card);
    }
  }

  updateHUD(dt, fps) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.el.toastBanner.classList.add('hidden');
      }
    }

    if (this.heldBannerTimer > 0) {
      this.heldBannerTimer -= dt;
      if (this.heldBannerTimer <= 0) {
        this.el.heldBanner.classList.remove('visible');
      }
    }

    const player = this.game.player;
    const sky = this.game.sky;
    if (!player || !sky || !this.game.isWorldActive) return;

    // Underwater & hurt overlays
    this.el.underwaterOverlay.classList.toggle('hidden', !player.headUnderwater);
    this.el.hurtOverlay.style.opacity = String((player.hurtFlash * 0.75).toFixed(2));

    // Clock & Biome
    this.el.hudClock.textContent = sky.getClockString();
    const biome = this.game.world.generator.getBiomeAt(Math.floor(player.pos.x), Math.floor(player.pos.z));
    this.el.hudBiome.textContent = biome.name;

    // Mining tool hint
    if (player.miningToolWarning) {
      this.el.miningHint.textContent = player.miningToolWarning;
      this.el.miningHint.classList.remove('hidden');
    } else {
      this.el.miningHint.classList.add('hidden');
    }

    // Survival Vitals vs Creative clean HUD
    const isSurvival = this.game.gameMode === GAME_MODES.SURVIVAL;
    this.el.survivalBars.classList.toggle('hidden', !isSurvival);

    if (isSurvival) {
      this._renderStatPips(this.el.heartsRow, player.health, player.maxHealth, 'pip-heart');
      this._renderStatPips(this.el.hungerRow, player.hunger, player.maxHunger, 'pip-hunger');

      if (player.headUnderwater || player.oxygen < player.maxOxygen - 0.2) {
        this.el.oxygenRow.classList.remove('hidden');
        const bubbles = Math.ceil(player.oxygen);
        this.el.oxygenRow.innerHTML = '';
        for (let i = 0; i < bubbles; i++) {
          const b = document.createElement('span');
          b.className = 'pip pip-bubble';
          this.el.oxygenRow.appendChild(b);
        }
      } else {
        this.el.oxygenRow.classList.add('hidden');
      }
    } else {
      this.el.oxygenRow.classList.add('hidden');
    }

    // Progression Goal Card
    const milestone = this.game.progression.getCurrentMilestone();
    if (isSurvival && this.game.settings.showGoals && milestone) {
      this.el.goalTitle.textContent = milestone.title;
      this.el.goalHint.textContent = milestone.hint;
      this.el.hudGoal.classList.remove('hidden');
    } else {
      this.el.hudGoal.classList.add('hidden');
    }

    // Optional Coordinates & FPS (F3)
    if (this.game.settings.showDiagnostics) {
      const px = player.pos.x.toFixed(1);
      const py = player.pos.y.toFixed(1);
      const pz = player.pos.z.toFixed(1);
      const chunks = this.game.world.chunks.size;
      const modeStr = isSurvival ? 'Survival' : (player.isFlying ? 'Creative (Flying)' : 'Creative');
      this.el.hudDiagnostics.textContent = `XYZ: ${px} / ${py} / ${pz}\nFPS: ${Math.round(fps)} · Chunks: ${chunks}\nMode: ${modeStr}`;
      this.el.hudDiagnostics.classList.remove('hidden');
    } else {
      this.el.hudDiagnostics.classList.add('hidden');
    }
  }

  _renderStatPips(container, value, maxValue, pipClass) {
    const rounded = Math.ceil(value);
    if (container.dataset.lastVal === String(rounded)) return;
    container.dataset.lastVal = String(rounded);
    container.innerHTML = '';

    const count = maxValue / 2;
    for (let i = 0; i < count; i++) {
      const pip = document.createElement('span');
      const fullThreshold = (i + 1) * 2;
      const state = rounded >= fullThreshold ? 'full' : rounded === fullThreshold - 1 ? 'half' : '';
      pip.className = `pip ${pipClass} ${state}`;
      container.appendChild(pip);
    }
  }

  _escape(str) {
    return String(str || '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }
}
