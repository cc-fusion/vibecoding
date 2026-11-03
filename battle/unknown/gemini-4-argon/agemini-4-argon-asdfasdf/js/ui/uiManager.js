// Clean, Friendly UI Controller: World Manager, HUD, Hotbar, Inventory/Crafting/Smelting & Pause Menu

import { GAME_MODES, WEATHER_TYPES } from '../constants.js';
import { BLOCK, getBlockDef } from '../game/blocks.js';
import { HOTBAR_SIZE, INVENTORY_SIZE } from '../game/inventory.js';
import { getCreativePaletteItems, getItemDef } from '../game/items.js';
import {
  CRAFTING_RECIPES,
  INGREDIENT_LABELS,
  SMELTING_RECIPES,
  canCraftRecipe,
  craftRecipeOnce,
} from '../game/recipes.js';

const SURVIVAL_GOALS = [
  {
    id: 'gather_wood',
    title: 'Gather Wood Logs',
    hint: 'Hold Left-Click on a tree trunk',
    check: (inv) => inv.countMatching('tag:logs') >= 2 || inv.totalCrafted.size > 0,
    progressText: (inv) => `${Math.min(2, inv.countMatching('tag:logs'))}/2`,
  },
  {
    id: 'craft_planks_sticks',
    title: 'Craft Planks & Sticks',
    hint: 'Press E to open Crafting',
    check: (inv) => inv.countMatching('tag:planks') >= 3 && inv.countMatching('item:stick') >= 2,
    progressText: (inv) => `${Math.min(2, inv.countMatching('item:stick'))}/2 sticks`,
  },
  {
    id: 'wood_pickaxe',
    title: 'Craft a Wooden Pickaxe',
    hint: 'Press E -> Tools -> Wooden Pickaxe',
    check: (inv) => inv.totalCrafted.has('tool:wood_pickaxe') || inv.countMatching('tool:wood_pickaxe') >= 1,
    progressText: () => '0/1',
  },
  {
    id: 'mine_stone',
    title: 'Mine Cobblestone',
    hint: 'Equip Pickaxe (1-9) & mine grey Stone',
    check: (inv) => inv.countMatching(`block:${BLOCK.COBBLESTONE}`) >= 3 || inv.totalCrafted.has('tool:stone_pickaxe'),
    progressText: (inv) => `${Math.min(3, inv.countMatching(`block:${BLOCK.COBBLESTONE}`))}/3`,
  },
  {
    id: 'stone_pickaxe',
    title: 'Upgrade to Stone Pickaxe',
    hint: 'Press E -> Tools -> Stone Pickaxe',
    check: (inv) => inv.totalCrafted.has('tool:stone_pickaxe') || inv.countMatching('tool:stone_pickaxe') >= 1,
    progressText: () => '0/1',
  },
  {
    id: 'furnace_or_torch',
    title: 'Craft Torches or a Furnace',
    hint: 'Mine Coal or 8 Cobblestone for caves',
    check: (inv) =>
      inv.totalCrafted.has(`block:${BLOCK.TORCH}`) ||
      inv.totalCrafted.has(`block:${BLOCK.FURNACE}`),
    progressText: () => '0/1',
  },
  {
    id: 'smelt_iron',
    title: 'Smelt Iron & Forge Gear',
    hint: 'Smelt Iron Ore in Smelting tab [E]',
    check: (inv) => inv.totalCrafted.has('item:iron_ingot') || inv.countMatching('item:iron_ingot') >= 1,
    progressText: () => '0/1',
  },
];

export class UIManager {
  constructor(game) {
    this.game = game;
    this.activeModal = 'title'; // 'title' | 'none' | 'inventory' | 'pause' | 'controls'
    this.stationTab = 'crafting'; // 'crafting' | 'smelting' | 'creative'
    this.recipeFilter = 'all';
    this.showDebugCoords = true;
    this.goalIndex = 0;
    this.goalsDismissed = false;
    this.heldLabelTimer = 0;
    this.toastTimer = 0;

    this.cacheElements();
    this.bindEvents();
  }

  cacheElements() {
    this.el = {
      titleScreen: document.getElementById('title-screen'),
      continueBtn: document.getElementById('btn-continue-world'),
      playNewBtn: document.getElementById('btn-create-world'),
      worldNameInput: document.getElementById('input-world-name'),
      worldSeedInput: document.getElementById('input-world-seed'),
      randomSeedBtn: document.getElementById('btn-random-seed'),
      modeButtons: document.querySelectorAll('[data-start-mode]'),
      savedWorldsSection: document.getElementById('saved-worlds-section'),
      savedWorldsList: document.getElementById('saved-worlds-list'),
      openControlsBtn: document.getElementById('btn-open-controls'),

      hud: document.getElementById('hud'),
      biomeClock: document.getElementById('hud-biome-clock'),
      coordsText: document.getElementById('hud-coords'),
      modePill: document.getElementById('hud-mode-btn'),
      pauseBtn: document.getElementById('hud-pause-btn'),

      goalCard: document.getElementById('goal-card'),
      goalStep: document.getElementById('goal-step'),
      goalTitle: document.getElementById('goal-title'),
      goalHint: document.getElementById('goal-hint'),
      goalDismiss: document.getElementById('goal-dismiss'),

      crosshairWrap: document.getElementById('crosshair-wrap'),
      mineBarWrap: document.getElementById('mine-progress-wrap'),
      mineBarFill: document.getElementById('mine-progress-fill'),
      interactPrompt: document.getElementById('interact-prompt'),

      heldItemBanner: document.getElementById('held-item-name'),
      vitalsRow: document.getElementById('vitals-row'),
      healthBar: document.getElementById('health-pips'),
      hungerBar: document.getElementById('hunger-pips'),
      hotbar: document.getElementById('hotbar'),

      underwaterOverlay: document.getElementById('underwater-overlay'),
      damageOverlay: document.getElementById('damage-overlay'),
      toast: document.getElementById('toast-banner'),

      // Inventory / Crafting / Smelting / Creative Modal
      invModal: document.getElementById('inventory-modal'),
      invCloseBtn: document.getElementById('btn-close-inv'),
      stationTabs: document.querySelectorAll('[data-station-tab]'),
      filterBar: document.getElementById('recipe-filter-bar'),
      filterBtns: document.querySelectorAll('[data-recipe-filter]'),
      recipeList: document.getElementById('recipe-list'),
      backpackGrid: document.getElementById('backpack-grid'),
      modalHotbarGrid: document.getElementById('modal-hotbar-grid'),
      cursorItem: document.getElementById('cursor-drag-item'),
      slotTooltip: document.getElementById('slot-tooltip'),

      // Pause & World Settings Modal
      pauseModal: document.getElementById('pause-modal'),
      btnResume: document.getElementById('btn-resume'),
      btnSaveNow: document.getElementById('btn-save-now'),
      btnPauseControls: document.getElementById('btn-pause-controls'),
      btnMainMenu: document.getElementById('btn-main-menu'),
      btnToggleMode: document.getElementById('btn-toggle-mode'),
      btnToggleFly: document.getElementById('btn-toggle-fly'),
      timePresetBtns: document.querySelectorAll('[data-time-preset]'),
      weatherBtns: document.querySelectorAll('[data-weather-set]'),
      renderDistSlider: document.getElementById('slider-render-dist'),
      renderDistVal: document.getElementById('val-render-dist'),
      volumeSlider: document.getElementById('slider-volume'),
      volumeVal: document.getElementById('val-volume'),
      musicToggleBtn: document.getElementById('btn-toggle-music'),

      // Controls Guide Modal
      controlsModal: document.getElementById('controls-modal'),
      btnCloseControls: document.getElementById('btn-close-controls'),
    };
  }

  bindEvents() {
    this.selectedStartMode = GAME_MODES.SURVIVAL;

    this.el.randomSeedBtn.addEventListener('click', () => {
      const words = ['Emerald', 'Sunlit', 'Whisper', 'Crystal', 'Frostpine', 'Golden', ' Canyon', 'Aurora'];
      const pick = `${words[(Math.random() * 6) | 0]}-${100 + ((Math.random() * 899) | 0)}`;
      this.el.worldSeedInput.value = pick;
    });

    this.el.modeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedStartMode = btn.dataset.startMode;
        this.el.modeButtons.forEach((b) =>
          b.classList.toggle('active', b.dataset.startMode === this.selectedStartMode)
        );
      });
    });

    this.el.playNewBtn.addEventListener('click', () => {
      const name = this.el.worldNameInput.value.trim() || 'New Frontier';
      const seed = this.el.worldSeedInput.value.trim() || `Seed-${Date.now() % 100000}`;
      this.game.startNewWorld({ name, seed, mode: this.selectedStartMode });
    });

    this.el.continueBtn.addEventListener('click', () => {
      if (this.latestSavedWorld) {
        this.game.loadExistingWorld(this.latestSavedWorld.id);
      }
    });

    this.el.openControlsBtn.addEventListener('click', () => {
      this.prevModalBeforeControls = 'title';
      this.setModal('controls');
    });

    this.el.btnPauseControls.addEventListener('click', () => {
      this.prevModalBeforeControls = 'pause';
      this.setModal('controls');
    });

    this.el.btnCloseControls.addEventListener('click', () => {
      this.setModal(this.prevModalBeforeControls || 'title');
    });

    this.el.pauseBtn.addEventListener('click', () => this.openPause());
    this.el.modePill.addEventListener('click', () => {
      const next =
        this.game.player.mode === GAME_MODES.SURVIVAL ? GAME_MODES.CREATIVE : GAME_MODES.SURVIVAL;
      this.game.switchMode(next);
    });

    this.el.goalDismiss.addEventListener('click', () => {
      this.goalsDismissed = true;
      this.el.goalCard.classList.add('hidden');
    });

    this.el.invCloseBtn.addEventListener('click', () => this.resumeGameplay());

    this.el.stationTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        this.stationTab = tab.dataset.stationTab;
        this.renderInventoryModal();
      });
    });

    this.el.filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.recipeFilter = btn.dataset.recipeFilter;
        this.renderInventoryModal();
      });
    });

    // Pause controls
    this.el.btnResume.addEventListener('click', () => this.resumeGameplay());
    this.el.btnSaveNow.addEventListener('click', async () => {
      await this.game.saveCurrentWorld();
      this.showToast('World saved!');
    });
    this.el.btnMainMenu.addEventListener('click', async () => {
      await this.game.saveCurrentWorld();
      await this.game.returnToTitle();
    });

    this.el.btnToggleMode.addEventListener('click', () => {
      const next =
        this.game.player.mode === GAME_MODES.SURVIVAL ? GAME_MODES.CREATIVE : GAME_MODES.SURVIVAL;
      this.game.switchMode(next);
      this.syncPauseState();
    });

    this.el.btnToggleFly.addEventListener('click', () => {
      this.game.player.toggleFlight();
      this.syncPauseState();
    });

    this.el.timePresetBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.game.atmosphere.setTimePreset(btn.dataset.timePreset);
        this.showToast(`Time set to ${btn.textContent}`);
      });
    });

    this.el.weatherBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const w = btn.dataset.weatherSet;
        this.game.atmosphere.setWeather(w);
        this.syncPauseState();
        this.showToast(`Weather: ${btn.textContent}`);
      });
    });

    this.el.renderDistSlider.addEventListener('input', (e) => {
      const dist = Number(e.target.value);
      this.el.renderDistVal.textContent = `${dist} chunks`;
      this.game.chunkManager.setRenderDistance(dist);
    });

    this.el.volumeSlider.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      this.el.volumeVal.textContent = `${pct}%`;
      this.game.sound.setVolume(pct / 100);
    });

    this.el.musicToggleBtn.addEventListener('click', () => {
      this.game.sound.musicEnabled = !this.game.sound.musicEnabled;
      this.syncPauseState();
    });

    // Track mouse position for cursor stack dragging & tooltip
    window.addEventListener('mousemove', (e) => {
      if (this.activeModal === 'inventory') {
        this.el.cursorItem.style.left = `${e.clientX}px`;
        this.el.cursorItem.style.top = `${e.clientY}px`;
        this.el.slotTooltip.style.left = `${Math.min(window.innerWidth - 220, e.clientX + 14)}px`;
        this.el.slotTooltip.style.top = `${Math.max(12, e.clientY - 38)}px`;
      }
    });
  }

  async refreshWorldList() {
    const worlds = await this.game.storage.listWorlds();
    this.latestSavedWorld = worlds[0] || null;

    if (this.latestSavedWorld) {
      this.el.continueBtn.classList.remove('hidden');
      this.el.continueBtn.textContent = `Continue "${this.latestSavedWorld.name}"`;
      this.el.savedWorldsSection.classList.remove('hidden');
      this.el.savedWorldsList.innerHTML = '';

      for (const w of worlds.slice(0, 6)) {
        const row = document.createElement('div');
        row.className = 'world-row';

        const meta = document.createElement('div');
        meta.className = 'world-row-meta';
        const modeText = w.mode === GAME_MODES.CREATIVE ? 'Creative' : 'Survival';
        const dayText = `Day ${w.dayCount || 1}`;
        meta.innerHTML = `<strong>${this.escapeHtml(w.name)}</strong><span>${modeText} · ${dayText} · Seed: ${this.escapeHtml(w.seed)}</span>`;

        const actions = document.createElement('div');
        actions.className = 'world-row-actions';

        const loadBtn = document.createElement('button');
        loadBtn.className = 'btn btn-small btn-primary';
        loadBtn.textContent = 'Play';
        loadBtn.addEventListener('click', () => this.game.loadExistingWorld(w.id));

        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-small btn-ghost';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          await this.game.storage.deleteWorld(w.id);
          await this.refreshWorldList();
        });

        actions.append(loadBtn, delBtn);
        row.append(meta, actions);
        this.el.savedWorldsList.appendChild(row);
      }
    } else {
      this.el.continueBtn.classList.add('hidden');
      this.el.savedWorldsSection.classList.add('hidden');
    }
  }

  setModal(modalName) {
    this.activeModal = modalName;
    this.el.titleScreen.classList.toggle('hidden', modalName !== 'title');
    this.el.hud.classList.toggle('hidden', modalName === 'title');
    this.el.invModal.classList.toggle('hidden', modalName !== 'inventory');
    this.el.pauseModal.classList.toggle('hidden', modalName !== 'pause');
    this.el.controlsModal.classList.toggle('hidden', modalName !== 'controls');

    if (modalName !== 'inventory') {
      this.el.slotTooltip.classList.add('hidden');
      this.el.cursorItem.classList.add('hidden');
      if (this.game.inventory) {
        this.game.inventory.returnCursorToInventory();
      }
    }

    if (modalName !== 'none' && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  openInventory(defaultTab = null) {
    if (defaultTab) {
      this.stationTab = defaultTab;
    } else if (this.game.player.mode === GAME_MODES.CREATIVE && this.stationTab === 'crafting') {
      this.stationTab = 'creative';
    }
    this.setModal('inventory');
    this.renderInventoryModal();
  }

  openPause() {
    this.syncPauseState();
    this.setModal('pause');
  }

  resumeGameplay() {
    this.setModal('none');
    this.game.requestGamePointerLock();
  }

  syncPauseState() {
    const p = this.game.player;
    this.el.btnToggleMode.textContent =
      p.mode === GAME_MODES.CREATIVE ? 'Mode: Creative' : 'Mode: Survival';
    this.el.btnToggleFly.textContent = p.flying ? 'Flight: On' : 'Flight: Off';
    this.el.musicToggleBtn.textContent = this.game.sound.musicEnabled ? 'Music: On' : 'Music: Off';
    this.el.weatherBtns.forEach((b) =>
      b.classList.toggle('active', b.dataset.weatherSet === this.game.atmosphere.weather)
    );
  }

  renderHotbar() {
    const inv = this.game.inventory;
    this.el.hotbar.innerHTML = '';

    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slotEl = this.createSlotElement(inv.slots[i], i, false);
      if (i === inv.selectedSlot) slotEl.classList.add('selected');

      const keyNum = document.createElement('span');
      keyNum.className = 'slot-key';
      keyNum.textContent = String(i + 1);
      slotEl.appendChild(keyNum);

      slotEl.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        inv.selectSlot(i);
        this.notifyHeldItemChanged();
      });

      this.el.hotbar.appendChild(slotEl);
    }
    this.notifyHeldItemChanged();
  }

  notifyHeldItemChanged() {
    const held = this.game.inventory.getHeldDef();
    this.el.heldItemBanner.textContent = held ? held.name : 'Empty Hand';
    this.el.heldItemBanner.classList.add('visible');
    this.heldLabelTimer = 2.4;
  }

  renderVitals() {
    const p = this.game.player;
    const hideVitals = p.mode === GAME_MODES.CREATIVE;
    this.el.vitalsRow.classList.toggle('hidden', hideVitals);
    this.el.modePill.textContent =
      p.mode === GAME_MODES.CREATIVE
        ? p.flying
          ? 'Creative · Flying'
          : 'Creative'
        : p.flying
        ? 'Survival · Flying'
        : 'Survival';

    if (hideVitals) return;

    this.el.healthBar.innerHTML = '';
    this.el.hungerBar.innerHTML = '';

    for (let i = 0; i < 10; i++) {
      const hpVal = p.health - i * 2;
      const heart = document.createElement('span');
      heart.className =
        hpVal >= 2 ? 'vital-pip heart full' : hpVal === 1 ? 'vital-pip heart half' : 'vital-pip heart empty';
      this.el.healthBar.appendChild(heart);

      const foodVal = p.hunger - i * 2;
      const food = document.createElement('span');
      food.className =
        foodVal >= 2 ? 'vital-pip food full' : foodVal === 1 ? 'vital-pip food half' : 'vital-pip food empty';
      this.el.hungerBar.appendChild(food);
    }
  }

  createSlotElement(stack, slotIndex, interactiveModal = true) {
    const div = document.createElement('div');
    div.className = 'item-slot';
    div.dataset.slotIndex = String(slotIndex);

    if (stack) {
      const def = getItemDef(stack.id);
      const img = document.createElement('img');
      img.src = this.game.textures.getItemIconUrl(stack.id);
      img.alt = def?.name || stack.id;
      img.draggable = false;
      div.appendChild(img);

      if (stack.count > 1) {
        const count = document.createElement('span');
        count.className = 'slot-count';
        count.textContent = String(stack.count);
        div.appendChild(count);
      }

      if (stack.durability !== undefined && stack.maxDurability) {
        const ratio = Math.max(0, Math.min(1, stack.durability / stack.maxDurability));
        if (ratio < 1) {
          const bar = document.createElement('div');
          bar.className = 'slot-durability';
          const fill = document.createElement('div');
          fill.style.width = `${ratio * 100}%`;
          fill.style.backgroundColor = ratio > 0.5 ? '#5be068' : ratio > 0.22 ? '#f5b838' : '#f04848';
          bar.appendChild(fill);
          div.appendChild(bar);
        }
      }

      if (interactiveModal && def) {
        div.addEventListener('mouseenter', () => {
          const extras = [];
          if (def.toolType) extras.push(`Speed ×${def.speed} · Attack +${def.attack}`);
          if (def.food) extras.push(`Restores +${def.food} Hunger`);
          this.el.slotTooltip.innerHTML = `<strong>${def.name}</strong>${extras.length ? `<span>${extras.join(' · ')}</span>` : ''}`;
          this.el.slotTooltip.classList.remove('hidden');
        });
        div.addEventListener('mouseleave', () => {
          this.el.slotTooltip.classList.add('hidden');
        });
      }
    }

    if (interactiveModal) {
      div.addEventListener('contextmenu', (e) => e.preventDefault());
      div.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.game.inventory.handleSlotClick(slotIndex, e.button, e.shiftKey);
        this.renderInventoryModal();
        this.renderHotbar();
      });
    }

    return div;
  }

  renderInventoryModal() {
    if (this.activeModal !== 'inventory') return;
    const inv = this.game.inventory;

    this.el.stationTabs.forEach((t) =>
      t.classList.toggle('active', t.dataset.stationTab === this.stationTab)
    );
    this.el.filterBar.classList.toggle('hidden', this.stationTab !== 'crafting');
    this.el.filterBtns.forEach((b) =>
      b.classList.toggle('active', b.dataset.recipeFilter === this.recipeFilter)
    );

    // Backpack slots 9..35
    this.el.backpackGrid.innerHTML = '';
    for (let i = HOTBAR_SIZE; i < INVENTORY_SIZE; i++) {
      this.el.backpackGrid.appendChild(this.createSlotElement(inv.slots[i], i, true));
    }

    // Hotbar slots 0..8 inside modal
    this.el.modalHotbarGrid.innerHTML = '';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slotEl = this.createSlotElement(inv.slots[i], i, true);
      if (i === inv.selectedSlot) slotEl.classList.add('selected');
      this.el.modalHotbarGrid.appendChild(slotEl);
    }

    // Cursor stack overlay
    if (inv.cursorSlot) {
      this.el.cursorItem.classList.remove('hidden');
      this.el.cursorItem.innerHTML = `<img src="${this.game.textures.getItemIconUrl(inv.cursorSlot.id)}" alt="">${inv.cursorSlot.count > 1 ? `<span>${inv.cursorSlot.count}</span>` : ''}`;
    } else {
      this.el.cursorItem.classList.add('hidden');
    }

    // Right column: Crafting, Smelting, or Creative Catalog
    this.el.recipeList.innerHTML = '';

    if (this.stationTab === 'creative') {
      const grid = document.createElement('div');
      grid.className = 'creative-catalog-grid';
      for (const itemId of getCreativePaletteItems()) {
        const def = getItemDef(itemId);
        if (!def) continue;
        const card = document.createElement('button');
        card.className = 'creative-item-btn';
        card.title = `${def.name} (Click to add stack)`;
        card.innerHTML = `<img src="${this.game.textures.getItemIconUrl(itemId)}" alt="${def.name}"><span>${def.name}</span>`;
        card.addEventListener('click', (e) => {
          const amount = e.shiftKey ? def.stackSize : def.stackSize > 1 ? 16 : 1;
          inv.addItem(itemId, amount);
          this.game.sound.playPickup();
          this.renderInventoryModal();
          this.renderHotbar();
        });
        grid.appendChild(card);
      }
      this.el.recipeList.appendChild(grid);
      return;
    }

    const sourceRecipes =
      this.stationTab === 'smelting'
        ? SMELTING_RECIPES
        : CRAFTING_RECIPES.filter(
            (r) => this.recipeFilter === 'all' || r.category === this.recipeFilter
          );

    // Sort craftable recipes cleanly to the top so players immediately see what they can build!
    const sorted = [...sourceRecipes].sort((a, b) => {
      const ca = canCraftRecipe(inv, a) ? 1 : 0;
      const cb = canCraftRecipe(inv, b) ? 1 : 0;
      return cb - ca;
    });

    for (const recipe of sorted) {
      const outDef = getItemDef(recipe.output);
      const craftable = canCraftRecipe(inv, recipe);

      const card = document.createElement('div');
      card.className = `recipe-card ${craftable ? 'craftable' : 'locked'}`;
      card.dataset.recipeId = recipe.id;

      const iconWrap = document.createElement('div');
      iconWrap.className = 'recipe-icon';
      iconWrap.innerHTML = `<img src="${this.game.textures.getItemIconUrl(recipe.output)}" alt="">${recipe.count > 1 ? `<span>×${recipe.count}</span>` : ''}`;

      const info = document.createElement('div');
      info.className = 'recipe-info';
      const reqParts = recipe.ingredients.map((req) => {
        const have = inv.countMatching(req.id);
        const label = INGREDIENT_LABELS[req.id] || getItemDef(req.id)?.name || req.id;
        const ok = have >= req.count;
        return `<span class="req-pill ${ok ? 'ok' : 'missing'}">${Math.min(have, 99)}/${req.count} ${label}</span>`;
      });
      info.innerHTML = `<strong>${outDef?.name || recipe.output}</strong><div class="req-list">${reqParts.join('')}</div>`;

      const actionBtn = document.createElement('button');
      actionBtn.className = `btn btn-small ${craftable ? 'btn-primary' : 'btn-disabled'}`;
      actionBtn.textContent = this.stationTab === 'smelting' ? 'Smelt' : 'Craft';
      actionBtn.disabled = !craftable;
      actionBtn.addEventListener('click', (e) => {
        const times = e.shiftKey ? 8 : 1;
        let craftedAny = false;
        for (let t = 0; t < times; t++) {
          if (craftRecipeOnce(inv, recipe)) craftedAny = true;
          else break;
        }
        if (craftedAny) {
          this.game.sound.playCraft();
          this.renderInventoryModal();
          this.renderHotbar();
          this.updateGoals();
        }
      });

      card.append(iconWrap, info, actionBtn);
      this.el.recipeList.appendChild(card);
    }
  }

  updateGoals() {
    if (this.goalsDismissed || this.game.player.mode !== GAME_MODES.SURVIVAL) {
      this.el.goalCard.classList.add('hidden');
      return;
    }

    while (
      this.goalIndex < SURVIVAL_GOALS.length &&
      SURVIVAL_GOALS[this.goalIndex].check(this.game.inventory)
    ) {
      this.goalIndex++;
      if (this.goalIndex < SURVIVAL_GOALS.length) {
        this.showToast(`Milestone Complete! Next: ${SURVIVAL_GOALS[this.goalIndex].title}`);
      } else {
        this.showToast('All Survival Milestones Mastered!');
      }
    }

    if (this.goalIndex >= SURVIVAL_GOALS.length) {
      this.el.goalCard.classList.add('hidden');
      return;
    }

    const goal = SURVIVAL_GOALS[this.goalIndex];
    this.el.goalCard.classList.remove('hidden');
    this.el.goalStep.textContent = `Goal ${this.goalIndex + 1}/${SURVIVAL_GOALS.length} · ${goal.progressText(this.game.inventory)}`;
    this.el.goalTitle.textContent = goal.title;
    this.el.goalHint.textContent = goal.hint;
  }

  showToast(message) {
    this.el.toast.textContent = message;
    this.el.toast.classList.add('visible');
    this.toastTimer = 2.4;
  }

  updateHUD(dt, fps) {
    if (this.activeModal === 'title') return;

    const p = this.game.player;
    const col = this.game.worldGen.sampleColumn(Math.floor(p.position.x), Math.floor(p.position.z));
    const weatherIcon =
      this.game.atmosphere.weather === WEATHER_TYPES.RAIN
        ? ' · Rain'
        : this.game.atmosphere.weather === WEATHER_TYPES.SNOW
        ? ' · Snow'
        : '';

    this.el.biomeClock.textContent = `${col.biome} · ${this.game.atmosphere.getClockLabel()}${weatherIcon}`;

    if (this.showDebugCoords) {
      this.el.coordsText.classList.remove('hidden');
      this.el.coordsText.textContent = `XYZ ${Math.floor(p.position.x)}, ${Math.floor(p.position.y)}, ${Math.floor(p.position.z)} · ${fps} FPS`;
    } else {
      this.el.coordsText.classList.add('hidden');
    }

    // Mining bar feedback
    if (p.miningProgress > 0.02) {
      this.el.mineBarWrap.classList.remove('hidden');
      this.el.mineBarFill.style.width = `${Math.min(100, p.miningProgress * 100)}%`;
    } else {
      this.el.mineBarWrap.classList.add('hidden');
    }

    // Dynamic contextual interaction hint ONLY when looking directly at an interactive block!
    const targetId = p.targetHit?.blockId;
    const targetDef = targetId ? getBlockDef(targetId) : null;
    if (targetDef?.interactive === 'craft') {
      this.el.interactPrompt.textContent = 'Right-Click to Use Crafting Table';
      this.el.interactPrompt.classList.remove('hidden');
    } else if (targetDef?.interactive === 'smelt') {
      this.el.interactPrompt.textContent = 'Right-Click to Use Furnace';
      this.el.interactPrompt.classList.remove('hidden');
    } else if (targetDef?.interactive === 'chest') {
      this.el.interactPrompt.textContent = 'Right-Click to Open Treasure Chest';
      this.el.interactPrompt.classList.remove('hidden');
    } else {
      this.el.interactPrompt.classList.add('hidden');
    }

    // Screen state overlays
    this.el.underwaterOverlay.classList.toggle('visible', p.headUnderWater);
    this.el.damageOverlay.style.opacity = String(Math.min(0.65, p.hurtFlash * 1.6));

    if (this.heldLabelTimer > 0) {
      this.heldLabelTimer -= dt;
      if (this.heldLabelTimer <= 0) {
        this.el.heldItemBanner.classList.remove('visible');
      }
    }

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.el.toast.classList.remove('visible');
      }
    }

    this.updateGoals();
  }

  escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));
  }
}
