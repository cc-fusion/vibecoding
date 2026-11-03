import { GAME_MODES, WEATHER_TYPES } from '../constants.js';
import {
  BLOCK_IDS,
  ITEM_IDS,
  CREATIVE_PALETTE,
  getItemDef,
  isAnyLog,
} from '../data/blocks.js';
import {
  RECIPE_CATEGORIES,
  CRAFTING_RECIPES,
  INGREDIENT_TAGS,
  getSmeltingRecipe,
} from '../data/recipes.js';
import { HOTBAR_SIZE, INVENTORY_SIZE } from '../systems/Inventory.js';

const SEED_WORDS = [
  'emerald-valley',
  'amber-peaks',
  'whispering-pines',
  'crystal-cove',
  'frostfire-ridge',
  'sunlit-archipelago',
  'golden-mesa',
  'birchwood-hollow',
];

const GUIDE_STEPS = [
  {
    check: (ctx) => ctx.totalLogs >= 3 || ctx.placedTable,
    text: (ctx) => `Punch trees to gather Wood Logs (${Math.min(3, ctx.totalLogs)}/3)`,
  },
  {
    check: (ctx) => ctx.hasTable || ctx.placedTable,
    text: () => 'Press [E] to craft Planks & a Crafting Table',
  },
  {
    check: (ctx) => ctx.bestPickTier >= 1,
    text: () => 'Place your Crafting Table & right-click it to craft a Wooden Pickaxe',
  },
  {
    check: (ctx) => ctx.bestPickTier >= 2 || ctx.hasFurnace || ctx.placedFurnace,
    text: (ctx) => `Mine Stone for Cobblestone (${Math.min(8, ctx.cobbleCount)}/8) & craft Stone Tools or a Furnace`,
  },
  {
    check: (ctx) => ctx.torchCount >= 1 || ctx.placedTorch,
    text: () => 'Craft Torches (Coal or smelted Log Charcoal + Stick)',
  },
  {
    check: (ctx) => ctx.bestPickTier >= 3,
    text: () => 'Smelt Iron Ore in a Furnace & craft an Iron Pickaxe',
  },
  {
    check: (ctx) => ctx.diamondCount >= 1 || ctx.bestPickTier >= 4,
    text: () => 'Explore deep caves (below Y=17) to find Diamond Ore',
  },
];

export class UIManager {
  constructor({ atlas, storage, audio, callbacks }) {
    this.atlas = atlas;
    this.storage = storage;
    this.audio = audio;
    this.callbacks = callbacks;

    this.activeCategory = 'all';
    this.modalStation = 'crafting'; // 'crafting' | 'creative' | 'furnace' | 'chest'
    this.hasWorkbenchAccess = false;
    this.openFurnaceState = null;
    this.openChestSlots = null;
    this.heldCursorItem = null;
    this.newWorldMode = GAME_MODES.SURVIVAL;

    this.hotbarLabelTimer = 0;
    this.toastTimer = 0;
    this.showDebug = false;

    this.guideStep = 0;
    this.guideDismissed = false;
    this.milestones = {
      placedTable: false,
      placedFurnace: false,
      placedTorch: false,
    };

    this.cacheDom();
    this.bindEvents();
    this.renderCategoryPills();
    this.renderCreativePalette();
  }

  cacheDom() {
    this.hud = document.getElementById('hud');
    this.screenTint = document.getElementById('screen-tint');
    this.envTimeIcon = document.getElementById('env-time-icon');
    this.envTimeText = document.getElementById('env-time-text');
    this.envBiomeText = document.getElementById('env-biome-text');
    this.envCoordsText = document.getElementById('env-coords-text');

    this.starterGuide = document.getElementById('starter-guide');
    this.guideStepNum = document.getElementById('guide-step-num');
    this.guideStepText = document.getElementById('guide-step-text');
    this.guideDismissBtn = document.getElementById('guide-dismiss-btn');

    this.debugPanel = document.getElementById('debug-panel');
    this.interactPrompt = document.getElementById('interact-prompt');
    this.hintToast = document.getElementById('hint-toast');

    this.hotbarLabel = document.getElementById('hotbar-item-label');
    this.vitalsRow = document.getElementById('vitals-row');
    this.healthBar = document.getElementById('health-bar');
    this.airBar = document.getElementById('air-bar');
    this.hungerBar = document.getElementById('hunger-bar');
    this.hotbarEl = document.getElementById('hotbar');

    // Inventory / Station Modal
    this.invModal = document.getElementById('inventory-modal');
    this.tabBtnCrafting = document.getElementById('tab-btn-crafting');
    this.tabBtnCreative = document.getElementById('tab-btn-creative');
    this.stationTitle = document.getElementById('station-title');
    this.closeInvBtn = document.getElementById('close-inventory-btn');
    this.dropHeldBtn = document.getElementById('drop-held-btn');

    this.backpackGrid = document.getElementById('backpack-grid');
    this.modalHotbarGrid = document.getElementById('modal-hotbar-grid');

    this.panelCrafting = document.getElementById('panel-crafting');
    this.panelCreative = document.getElementById('panel-creative');
    this.panelFurnace = document.getElementById('panel-furnace');
    this.panelChest = document.getElementById('panel-chest');

    this.recipeCategoriesEl = document.getElementById('recipe-categories');
    this.recipeListEl = document.getElementById('recipe-list');
    this.creativeGrid = document.getElementById('creative-grid');
    this.chestGrid = document.getElementById('chest-grid');

    this.furnaceInputSlot = document.getElementById('furnace-input-slot');
    this.furnaceFuelSlot = document.getElementById('furnace-fuel-slot');
    this.furnaceOutputSlot = document.getElementById('furnace-output-slot');
    this.furnaceFlameFill = document.getElementById('furnace-flame-fill');
    this.furnaceArrowFill = document.getElementById('furnace-arrow-fill');

    this.cursorItemEl = document.getElementById('cursor-item');

    // Menu & Death Modal
    this.deathModal = document.getElementById('death-modal');
    this.respawnBtn = document.getElementById('respawn-btn');

    this.menuOverlay = document.getElementById('menu-overlay');
    this.activeWorldSummary = document.getElementById('active-world-summary');
    this.menuViewMain = document.getElementById('menu-view-main');
    this.menuViewWorlds = document.getElementById('menu-view-worlds');
    this.menuViewSettings = document.getElementById('menu-view-settings');
    this.menuViewControls = document.getElementById('menu-view-controls');

    this.btnPlayResume = document.getElementById('btn-play-resume');
    this.btnOpenWorlds = document.getElementById('btn-open-worlds');
    this.btnOpenSettings = document.getElementById('btn-open-settings');
    this.btnOpenControls = document.getElementById('btn-open-controls');
    this.btnSaveNow = document.getElementById('btn-save-now');

    this.worldListEl = document.getElementById('world-list');
    this.newWorldName = document.getElementById('new-world-name');
    this.newWorldSeed = document.getElementById('new-world-seed');
    this.btnRandomSeed = document.getElementById('btn-random-seed');
    this.modeBtnSurvival = document.getElementById('mode-btn-survival');
    this.modeBtnCreative = document.getElementById('mode-btn-creative');
    this.btnCreateWorld = document.getElementById('btn-create-world');

    // Settings inputs
    this.optRenderDist = document.getElementById('opt-render-dist');
    this.valRenderDist = document.getElementById('val-render-dist');
    this.optFov = document.getElementById('opt-fov');
    this.valFov = document.getElementById('val-fov');
    this.optVolume = document.getElementById('opt-volume');
    this.valVolume = document.getElementById('val-volume');
    this.optSens = document.getElementById('opt-sens');
    this.valSens = document.getElementById('val-sens');
    this.optInvertY = document.getElementById('opt-invert-y');
    this.creativeEnvControls = document.getElementById('creative-env-controls');
  }

  bindEvents() {
    // Menu Navigation
    this.btnPlayResume.addEventListener('click', () => this.callbacks.onPlayOrResume());
    this.btnOpenWorlds.addEventListener('click', async () => {
      await this.refreshWorldList();
      this.showMenuView('worlds');
    });
    this.btnOpenSettings.addEventListener('click', () => this.showMenuView('settings'));
    this.btnOpenControls.addEventListener('click', () => this.showMenuView('controls'));

    this.btnSaveNow.addEventListener('click', async () => {
      await this.callbacks.onManualSave();
      const orig = this.btnSaveNow.textContent;
      this.btnSaveNow.textContent = 'Saved!';
      setTimeout(() => {
        this.btnSaveNow.textContent = orig;
      }, 1200);
    });

    document.querySelectorAll('[data-back-main]').forEach((btn) => {
      btn.addEventListener('click', () => this.showMenuView('main'));
    });

    this.btnRandomSeed.addEventListener('click', () => {
      const pick = SEED_WORDS[Math.floor(Math.random() * SEED_WORDS.length)];
      const num = Math.floor(100 + Math.random() * 900);
      this.newWorldSeed.value = `${pick}-${num}`;
    });

    this.modeBtnSurvival.addEventListener('click', () => {
      this.newWorldMode = GAME_MODES.SURVIVAL;
      this.modeBtnSurvival.classList.add('active');
      this.modeBtnCreative.classList.remove('active');
    });

    this.modeBtnCreative.addEventListener('click', () => {
      this.newWorldMode = GAME_MODES.CREATIVE;
      this.modeBtnCreative.classList.add('active');
      this.modeBtnSurvival.classList.remove('active');
    });

    this.btnCreateWorld.addEventListener('click', () => {
      const name = this.newWorldName.value.trim() || `World ${Math.floor(1 + Math.random() * 99)}`;
      const seed =
        this.newWorldSeed.value.trim() ||
        `${SEED_WORDS[Math.floor(Math.random() * SEED_WORDS.length)]}-${Math.floor(100 + Math.random() * 900)}`;
      this.callbacks.onCreateWorld({ name, seed, mode: this.newWorldMode });
      this.newWorldName.value = '';
      this.newWorldSeed.value = '';
    });

    // Settings Sliders
    const emitSettings = () => {
      const next = {
        renderDistance: parseInt(this.optRenderDist.value, 10),
        fov: parseInt(this.optFov.value, 10),
        volume: parseInt(this.optVolume.value, 10) / 100,
        sensitivity: parseInt(this.optSens.value, 10) / 100,
        invertY: this.optInvertY.checked,
      };
      this.syncSettingsLabels(next);
      this.callbacks.onSettingsChanged(next);
    };

    [this.optRenderDist, this.optFov, this.optVolume, this.optSens, this.optInvertY].forEach((el) => {
      el.addEventListener('input', emitSettings);
      el.addEventListener('change', emitSettings);
    });

    // Creative Env Quick Buttons
    document.getElementById('btn-set-dawn').addEventListener('click', () => this.callbacks.onSetTime(0.26));
    document.getElementById('btn-set-noon').addEventListener('click', () => this.callbacks.onSetTime(0.50));
    document.getElementById('btn-set-night').addEventListener('click', () => this.callbacks.onSetTime(0.88));
    document.getElementById('btn-toggle-weather').addEventListener('click', () => this.callbacks.onToggleWeather());

    // Guide dismiss
    this.guideDismissBtn.addEventListener('click', () => {
      this.guideDismissed = true;
      this.starterGuide.classList.add('hidden');
    });

    // Respawn
    this.respawnBtn.addEventListener('click', () => {
      this.deathModal.classList.add('hidden');
      this.callbacks.onRespawn();
    });

    // Inventory Modal Events
    this.closeInvBtn.addEventListener('click', () => this.callbacks.onCloseModal());
    this.invModal.addEventListener('click', (e) => {
      if (e.target === this.invModal) this.callbacks.onCloseModal();
    });
    this.invModal.addEventListener('contextmenu', (e) => e.preventDefault());

    this.tabBtnCrafting.addEventListener('click', () => {
      this.modalStation = 'crafting';
      this.refreshModalView();
    });
    this.tabBtnCreative.addEventListener('click', () => {
      this.modalStation = 'creative';
      this.refreshModalView();
    });

    this.dropHeldBtn.addEventListener('click', () => {
      if (this.heldCursorItem) {
        this.callbacks.onDropStack(this.heldCursorItem.id, this.heldCursorItem.count);
        this.heldCursorItem = null;
        this.updateCursorVisual();
        this.refreshModalView();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.invModal.classList.contains('hidden')) {
        this.cursorItemEl.style.left = `${e.clientX}px`;
        this.cursorItemEl.style.top = `${e.clientY}px`;
      }
    });
  }

  applyInitialSettings(settings) {
    this.optRenderDist.value = settings.renderDistance;
    this.optFov.value = settings.fov;
    this.optVolume.value = Math.round(settings.volume * 100);
    this.optSens.value = Math.round(settings.sensitivity * 100);
    this.optInvertY.checked = Boolean(settings.invertY);
    this.syncSettingsLabels(settings);
  }

  syncSettingsLabels(s) {
    this.valRenderDist.textContent = `${s.renderDistance} chunks`;
    this.valFov.textContent = `${s.fov}°`;
    this.valVolume.textContent = `${Math.round(s.volume * 100)}%`;
    this.valSens.textContent = `${Math.round(s.sensitivity * 100)}%`;
  }

  showMenuView(viewName) {
    this.menuViewMain.classList.toggle('hidden', viewName !== 'main');
    this.menuViewWorlds.classList.toggle('hidden', viewName !== 'worlds');
    this.menuViewSettings.classList.toggle('hidden', viewName !== 'settings');
    this.menuViewControls.classList.toggle('hidden', viewName !== 'controls');
  }

  setMenuVisible(visible, activeWorldMeta = null) {
    this.menuOverlay.classList.toggle('hidden', !visible);
    this.hud.classList.toggle('hidden', visible);

    if (visible) {
      this.showMenuView('main');
      if (activeWorldMeta) {
        const modeLabel = activeWorldMeta.mode === GAME_MODES.CREATIVE ? 'Creative' : 'Survival';
        this.activeWorldSummary.textContent = `${activeWorldMeta.name} · ${modeLabel} · Seed: ${activeWorldMeta.seed}`;
        this.activeWorldSummary.classList.remove('hidden');
        this.btnPlayResume.textContent = 'Resume World';
        this.btnSaveNow.classList.remove('hidden');
        this.creativeEnvControls.classList.toggle('hidden', activeWorldMeta.mode !== GAME_MODES.CREATIVE);
      } else {
        this.activeWorldSummary.textContent = '';
        this.activeWorldSummary.classList.add('hidden');
        this.btnPlayResume.textContent = 'Play World';
        this.btnSaveNow.classList.add('hidden');
        this.creativeEnvControls.classList.add('hidden');
      }
    }
  }

  async refreshWorldList(activeWorldId = null) {
    const worlds = await this.storage.listWorlds();
    this.worldListEl.innerHTML = '';

    if (worlds.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'muted-subtitle';
      empty.style.padding = '8px 2px';
      empty.textContent = 'No saved worlds yet — create one below or click Play World!';
      this.worldListEl.appendChild(empty);
      return;
    }

    for (const w of worlds) {
      const row = document.createElement('div');
      row.className = 'world-row';

      const info = document.createElement('div');
      info.className = 'world-row-info';
      const title = document.createElement('strong');
      title.textContent = w.name + (w.id === activeWorldId ? ' (Current)' : '');
      const meta = document.createElement('span');
      const modeText = w.mode === GAME_MODES.CREATIVE ? 'Creative' : 'Survival';
      meta.textContent = `${modeText} · Day ${w.dayCount || 1} · Seed: ${w.seed}`;
      info.append(title, meta);

      const actions = document.createElement('div');
      actions.className = 'world-row-actions';

      const playBtn = document.createElement('button');
      playBtn.className = 'btn btn-small btn-primary';
      playBtn.textContent = 'Play';
      playBtn.addEventListener('click', () => this.callbacks.onSelectWorld(w.id));

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-danger-icon';
      delBtn.title = 'Delete World';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async () => {
        await this.callbacks.onDeleteWorld(w.id);
        await this.refreshWorldList(this.callbacks.getActiveWorldId());
      });

      actions.append(playBtn, delBtn);
      row.append(info, actions);
      this.worldListEl.appendChild(row);
    }
  }

  showToast(message, duration = 2.4) {
    this.hintToast.textContent = message;
    this.hintToast.classList.remove('hidden');
    this.toastTimer = duration;
  }

  announceHotbarSelection(player) {
    const slot = player.inventory.getSelectedSlot();
    if (!slot) {
      this.hotbarLabel.textContent = '';
      return;
    }
    this.hotbarLabel.textContent = getItemDef(slot.id).name;
    this.hotbarLabel.style.opacity = '1';
    this.hotbarLabelTimer = 2.0;
  }

  decorateSlotElement(el, slotData, hotbarKeyNumber = null) {
    el.innerHTML = '';
    if (hotbarKeyNumber !== null) {
      const keySpan = document.createElement('span');
      keySpan.className = 'slot-key-num';
      keySpan.textContent = String(hotbarKeyNumber);
      el.appendChild(keySpan);
    }

    if (!slotData || !slotData.id) {
      el.title = '';
      return;
    }

    const def = getItemDef(slotData.id);
    el.title = def.name;

    const img = document.createElement('img');
    img.src = this.atlas.getIconUrl(slotData.id);
    img.alt = def.name;
    el.appendChild(img);

    if (slotData.count > 1) {
      const cnt = document.createElement('span');
      cnt.className = 'slot-count';
      cnt.textContent = String(slotData.count);
      el.appendChild(cnt);
    }

    if (def.maxDurability > 0 && typeof slotData.durability === 'number' && slotData.durability < def.maxDurability) {
      const bar = document.createElement('div');
      bar.className = 'slot-durability';
      const fill = document.createElement('div');
      fill.className = 'slot-durability-fill';
      const pct = Math.max(4, Math.round((slotData.durability / def.maxDurability) * 100));
      fill.style.width = `${pct}%`;
      if (pct < 25) fill.style.background = '#ee4b4b';
      else if (pct < 55) fill.style.background = '#f2be42';
      bar.appendChild(fill);
      el.appendChild(bar);
    }
  }

  renderHotbar(player) {
    const inv = player.inventory;
    if (this.hotbarEl.children.length !== HOTBAR_SIZE) {
      this.hotbarEl.innerHTML = '';
      for (let i = 0; i < HOTBAR_SIZE; i++) {
        const slotEl = document.createElement('div');
        slotEl.className = 'inv-slot';
        slotEl.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          inv.selectSlot(i);
          this.announceHotbarSelection(player);
        });
        this.hotbarEl.appendChild(slotEl);
      }
    }

    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slotEl = this.hotbarEl.children[i];
      slotEl.classList.toggle('selected', i === inv.selectedHotbar);
      this.decorateSlotElement(slotEl, inv.slots[i], i + 1);
    }
  }

  renderVitalPips(container, value, maxValue, symbol) {
    const pips = 10;
    if (container.children.length !== pips) {
      container.innerHTML = '';
      for (let i = 0; i < pips; i++) {
        const s = document.createElement('span');
        s.className = 'vital-pip';
        s.textContent = symbol;
        container.appendChild(s);
      }
    }
    const scaled = (value / maxValue) * 20;
    for (let i = 0; i < pips; i++) {
      const pipEl = container.children[i];
      const thresholdFull = (i + 1) * 2;
      const thresholdHalf = thresholdFull - 1;
      pipEl.classList.toggle('empty', scaled < thresholdHalf);
      pipEl.classList.toggle('half', scaled >= thresholdHalf && scaled < thresholdFull);
    }
  }

  renderCategoryPills() {
    this.recipeCategoriesEl.innerHTML = '';
    for (const cat of RECIPE_CATEGORIES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `cat-pill ${cat.id === this.activeCategory ? 'active' : ''}`;
      btn.textContent = cat.label;
      btn.addEventListener('click', () => {
        this.activeCategory = cat.id;
        this.renderCategoryPills();
        this.refreshModalView();
      });
      this.recipeCategoriesEl.appendChild(btn);
    }
  }

  renderCreativePalette() {
    this.creativeGrid.innerHTML = '';
    for (const itemId of CREATIVE_PALETTE) {
      const def = getItemDef(itemId);
      const slotEl = document.createElement('div');
      slotEl.className = 'inv-slot';
      this.decorateSlotElement(slotEl, { id: itemId, count: 1 });
      slotEl.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const player = this.callbacks.getPlayer();
        if (!player) return;
        const amount = e.shiftKey ? def.maxStack : (def.maxStack > 1 ? 16 : 1);
        player.inventory.addItem(itemId, amount);
        this.audio.playPickup();
        this.refreshModalView();
      });
      this.creativeGrid.appendChild(slotEl);
    }
  }

  isModalOpen() {
    return !this.invModal.classList.contains('hidden');
  }

  openModal({ station = 'crafting', workbench = false, furnaceState = null, chestSlots = null }) {
    const player = this.callbacks.getPlayer();
    if (!player) return;

    this.hasWorkbenchAccess = workbench;
    this.openFurnaceState = furnaceState;
    this.openChestSlots = chestSlots;

    if (station === 'inventory') {
      this.modalStation = player.mode === GAME_MODES.CREATIVE ? 'creative' : 'crafting';
    } else {
      this.modalStation = station;
    }

    this.invModal.classList.remove('hidden');
    this.refreshModalView();
  }

  closeModal() {
    const player = this.callbacks.getPlayer();
    if (this.heldCursorItem && player) {
      const leftover = player.inventory.addItem(
        this.heldCursorItem.id,
        this.heldCursorItem.count,
        this.heldCursorItem.durability ?? null
      );
      if (leftover > 0) {
        this.callbacks.onDropStack(this.heldCursorItem.id, leftover);
      }
      this.heldCursorItem = null;
      this.updateCursorVisual();
    }
    this.openFurnaceState = null;
    this.openChestSlots = null;
    this.invModal.classList.add('hidden');
  }

  updateCursorVisual() {
    if (!this.heldCursorItem) {
      this.cursorItemEl.classList.add('hidden');
      this.dropHeldBtn.classList.add('hidden');
      return;
    }
    this.cursorItemEl.classList.remove('hidden');
    this.dropHeldBtn.classList.remove('hidden');
    this.cursorItemEl.innerHTML = '';

    const img = document.createElement('img');
    img.src = this.atlas.getIconUrl(this.heldCursorItem.id);
    this.cursorItemEl.appendChild(img);

    if (this.heldCursorItem.count > 1) {
      const s = document.createElement('span');
      s.textContent = String(this.heldCursorItem.count);
      this.cursorItemEl.appendChild(s);
    }
  }

  handleSlotClick(getSlot, setSlot, event, onShiftQuickMove = null) {
    event.preventDefault();
    const player = this.callbacks.getPlayer();
    if (!player) return;

    if (event.shiftKey && onShiftQuickMove && !this.heldCursorItem) {
      onShiftQuickMove();
      player.inventory.notify();
      this.refreshModalView();
      return;
    }

    const current = getSlot();
    const rightClick = event.button === 2;

    if (!this.heldCursorItem) {
      if (!current) return;
      if (rightClick && current.count > 1) {
        const half = Math.ceil(current.count / 2);
        this.heldCursorItem = { ...current, count: half };
        current.count -= half;
        setSlot(current.count > 0 ? current : null);
      } else {
        this.heldCursorItem = { ...current };
        setSlot(null);
      }
    } else {
      const heldDef = getItemDef(this.heldCursorItem.id);
      const maxStack = heldDef.maxStack || 64;

      if (!current) {
        if (rightClick && this.heldCursorItem.count > 1) {
          setSlot({ ...this.heldCursorItem, count: 1 });
          this.heldCursorItem.count -= 1;
        } else {
          setSlot({ ...this.heldCursorItem });
          this.heldCursorItem = null;
        }
      } else if (current.id === this.heldCursorItem.id && maxStack > 1) {
        const space = maxStack - current.count;
        if (space > 0) {
          const transfer = rightClick ? 1 : Math.min(space, this.heldCursorItem.count);
          current.count += transfer;
          this.heldCursorItem.count -= transfer;
          if (this.heldCursorItem.count <= 0) this.heldCursorItem = null;
          setSlot(current);
        }
      } else if (!rightClick) {
        // Swap
        const temp = { ...current };
        setSlot({ ...this.heldCursorItem });
        this.heldCursorItem = temp;
      }
    }

    player.inventory.notify();
    this.updateCursorVisual();
    this.refreshModalView();
  }

  refreshModalView() {
    if (!this.isModalOpen()) return;
    const player = this.callbacks.getPlayer();
    if (!player) return;
    const inv = player.inventory;

    const isContainerStation = this.modalStation === 'furnace' || this.modalStation === 'chest';
    this.tabBtnCrafting.classList.toggle('hidden', isContainerStation);
    this.tabBtnCreative.classList.toggle(
      'hidden',
      isContainerStation || player.mode !== GAME_MODES.CREATIVE
    );
    this.tabBtnCrafting.classList.toggle('active', this.modalStation === 'crafting');
    this.tabBtnCreative.classList.toggle('active', this.modalStation === 'creative');

    if (this.modalStation === 'crafting') {
      this.stationTitle.textContent = this.hasWorkbenchAccess
        ? 'Crafting Table (All Recipes Unlocked)'
        : 'Hand Crafting (Place Crafting Table for Tools)';
    } else if (this.modalStation === 'creative') {
      this.stationTitle.textContent = 'Creative Block & Tool Palette';
    } else if (this.modalStation === 'furnace') {
      this.stationTitle.textContent = 'Smelting Furnace';
    } else if (this.modalStation === 'chest') {
      this.stationTitle.textContent = 'Storage Chest';
    }

    this.panelCrafting.classList.toggle('hidden', this.modalStation !== 'crafting');
    this.panelCreative.classList.toggle('hidden', this.modalStation !== 'creative');
    this.panelFurnace.classList.toggle('hidden', this.modalStation !== 'furnace');
    this.panelChest.classList.toggle('hidden', this.modalStation !== 'chest');

    // Render Backpack (slots 9..35)
    this.backpackGrid.innerHTML = '';
    for (let i = HOTBAR_SIZE; i < INVENTORY_SIZE; i++) {
      const slotEl = document.createElement('div');
      slotEl.className = 'inv-slot';
      this.decorateSlotElement(slotEl, inv.slots[i]);
      slotEl.addEventListener('mousedown', (e) => {
        this.handleSlotClick(
          () => inv.slots[i],
          (val) => { inv.slots[i] = val; },
          e,
          () => this.quickTransferInventorySlot(inv, i)
        );
      });
      this.backpackGrid.appendChild(slotEl);
    }

    // Render Modal Hotbar (slots 0..8)
    this.modalHotbarGrid.innerHTML = '';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slotEl = document.createElement('div');
      slotEl.className = `inv-slot ${i === inv.selectedHotbar ? 'selected' : ''}`;
      this.decorateSlotElement(slotEl, inv.slots[i], i + 1);
      slotEl.addEventListener('mousedown', (e) => {
        this.handleSlotClick(
          () => inv.slots[i],
          (val) => { inv.slots[i] = val; },
          e,
          () => this.quickTransferInventorySlot(inv, i)
        );
      });
      this.modalHotbarGrid.appendChild(slotEl);
    }

    if (this.modalStation === 'crafting') {
      this.renderRecipeList(inv);
    } else if (this.modalStation === 'furnace' && this.openFurnaceState) {
      this.renderFurnaceSlots(inv);
    } else if (this.modalStation === 'chest' && this.openChestSlots) {
      this.renderChestSlots(inv);
    }
  }

  quickTransferInventorySlot(inv, index) {
    const slot = inv.slots[index];
    if (!slot) return;

    if (this.modalStation === 'chest' && this.openChestSlots) {
      const def = getItemDef(slot.id);
      const maxStack = def.maxStack || 64;
      for (let c = 0; c < this.openChestSlots.length && slot.count > 0; c++) {
        const cs = this.openChestSlots[c];
        if (cs && cs.id === slot.id && cs.count < maxStack) {
          const move = Math.min(slot.count, maxStack - cs.count);
          cs.count += move;
          slot.count -= move;
        }
      }
      for (let c = 0; c < this.openChestSlots.length && slot.count > 0; c++) {
        if (!this.openChestSlots[c]) {
          this.openChestSlots[c] = { ...slot };
          slot.count = 0;
          break;
        }
      }
      if (slot.count <= 0) inv.slots[index] = null;
      return;
    }

    if (this.modalStation === 'furnace' && this.openFurnaceState) {
      const f = this.openFurnaceState;
      const def = getItemDef(slot.id);
      if (getSmeltingRecipe(slot.id) && !f.input) {
        f.input = { ...slot };
        inv.slots[index] = null;
        return;
      }
      if (def.fuelTime > 0 && !f.fuel) {
        f.fuel = { ...slot };
        inv.slots[index] = null;
        return;
      }
    }

    inv.quickMoveSlot(index);
  }

  renderRecipeList(inv) {
    this.recipeListEl.innerHTML = '';

    const filtered = CRAFTING_RECIPES.filter(
      (r) => this.activeCategory === 'all' || r.category === this.activeCategory
    );

    const evaluated = filtered.map((recipe) => ({
      recipe,
      evalResult: inv.evaluateRecipe(recipe, this.hasWorkbenchAccess),
    }));

    // Sort craftable recipes to the top for friendliness!
    evaluated.sort((a, b) => {
      if (a.evalResult.craftable !== b.evalResult.craftable) {
        return a.evalResult.craftable ? -1 : 1;
      }
      if (a.evalResult.missingTable !== b.evalResult.missingTable) {
        return a.evalResult.missingTable ? 1 : -1;
      }
      return 0;
    });

    for (const { recipe, evalResult } of evaluated) {
      const outDef = getItemDef(recipe.output.id);
      const card = document.createElement('div');
      card.className = `recipe-card ${evalResult.craftable ? 'craftable' : 'locked'}`;

      const outWrap = document.createElement('div');
      outWrap.className = 'recipe-output';
      const outImg = document.createElement('img');
      outImg.src = this.atlas.getIconUrl(recipe.output.id);
      outImg.alt = outDef.name;

      const titleWrap = document.createElement('div');
      titleWrap.className = 'recipe-title';
      const strong = document.createElement('strong');
      strong.textContent =
        recipe.output.count > 1 ? `${outDef.name} ×${recipe.output.count}` : outDef.name;
      const sub = document.createElement('span');
      sub.textContent = evalResult.missingTable
        ? 'Requires Crafting Table'
        : evalResult.craftable
          ? 'Click to craft (Shift for stack)'
          : 'Missing materials';

      titleWrap.append(strong, sub);
      outWrap.append(outImg, titleWrap);

      const ingsWrap = document.createElement('div');
      ingsWrap.className = 'recipe-ings';
      for (const st of evalResult.ingredientStatus) {
        const chip = document.createElement('span');
        chip.className = `ing-chip ${st.enough ? '' : 'missing'}`;
        const iconId = st.id || INGREDIENT_TAGS[st.tag].iconId;
        const label = st.id ? getItemDef(st.id).name : INGREDIENT_TAGS[st.tag].label;
        chip.title = label;

        const iImg = document.createElement('img');
        iImg.src = this.atlas.getIconUrl(iconId);
        const txt = document.createElement('span');
        txt.textContent = `${Math.min(st.have, 99)}/${st.count}`;
        chip.append(iImg, txt);
        ingsWrap.appendChild(chip);
      }

      card.append(outWrap, ingsWrap);
      card.addEventListener('click', (e) => {
        const count = inv.craft(recipe, this.hasWorkbenchAccess, e.shiftKey ? 16 : 1);
        if (count > 0) {
          this.audio.playCraft();
          this.refreshModalView();
        } else if (evalResult.missingTable) {
          this.showToast('Place & right-click a Crafting Table to craft this item');
        }
      });

      this.recipeListEl.appendChild(card);
    }
  }

  renderFurnaceSlots(inv) {
    const f = this.openFurnaceState;
    this.decorateSlotElement(this.furnaceInputSlot, f.input);
    this.decorateSlotElement(this.furnaceFuelSlot, f.fuel);
    this.decorateSlotElement(this.furnaceOutputSlot, f.output);

    this.furnaceInputSlot.onmousedown = (e) => {
      this.handleSlotClick(
        () => f.input,
        (val) => { f.input = val; },
        e,
        () => {
          if (f.input && inv.addItem(f.input.id, f.input.count) === 0) f.input = null;
        }
      );
    };

    this.furnaceFuelSlot.onmousedown = (e) => {
      this.handleSlotClick(
        () => f.fuel,
        (val) => { f.fuel = val; },
        e,
        () => {
          if (f.fuel && inv.addItem(f.fuel.id, f.fuel.count) === 0) f.fuel = null;
        }
      );
    };

    this.furnaceOutputSlot.onmousedown = (e) => {
      e.preventDefault();
      if (!f.output) return;
      if (!this.heldCursorItem) {
        if (e.shiftKey) {
          const rem = inv.addItem(f.output.id, f.output.count);
          f.output = rem > 0 ? { id: f.output.id, count: rem } : null;
        } else {
          this.heldCursorItem = { ...f.output };
          f.output = null;
        }
        this.audio.playPickup();
        this.updateCursorVisual();
        this.refreshModalView();
      }
    };

    this.updateFurnaceProgressLive();
  }

  updateFurnaceProgressLive() {
    if (this.modalStation !== 'furnace' || !this.openFurnaceState) return;
    const f = this.openFurnaceState;
    const burnPct = f.maxBurnTime > 0 ? Math.round((f.burnTime / f.maxBurnTime) * 100) : 0;
    const cookPct = f.cookTotal > 0 ? Math.round((f.cookProgress / f.cookTotal) * 100) : 0;
    this.furnaceFlameFill.style.height = `${burnPct}%`;
    this.furnaceArrowFill.style.width = `${cookPct}%`;

    // Keep slot counts synced as smelting finishes in real time!
    this.decorateSlotElement(this.furnaceInputSlot, f.input);
    this.decorateSlotElement(this.furnaceFuelSlot, f.fuel);
    this.decorateSlotElement(this.furnaceOutputSlot, f.output);
  }

  renderChestSlots(inv) {
    this.chestGrid.innerHTML = '';
    for (let i = 0; i < this.openChestSlots.length; i++) {
      const slotEl = document.createElement('div');
      slotEl.className = 'inv-slot';
      this.decorateSlotElement(slotEl, this.openChestSlots[i]);
      slotEl.addEventListener('mousedown', (e) => {
        this.handleSlotClick(
          () => this.openChestSlots[i],
          (val) => { this.openChestSlots[i] = val; },
          e,
          () => {
            const cs = this.openChestSlots[i];
            if (cs) {
              const rem = inv.addItem(cs.id, cs.count, cs.durability ?? null);
              this.openChestSlots[i] = rem > 0 ? { ...cs, count: rem } : null;
            }
          }
        );
      });
      this.chestGrid.appendChild(slotEl);
    }
  }

  recordBlockPlaced(blockId) {
    if (blockId === BLOCK_IDS.CRAFTING_TABLE) this.milestones.placedTable = true;
    if (blockId === BLOCK_IDS.FURNACE) this.milestones.placedFurnace = true;
    if (blockId === BLOCK_IDS.TORCH) this.milestones.placedTorch = true;
  }

  updateProgressionGuide(player) {
    if (player.mode !== GAME_MODES.SURVIVAL || this.guideDismissed || this.guideStep >= GUIDE_STEPS.length) {
      this.starterGuide.classList.add('hidden');
      return;
    }

    const inv = player.inventory;
    let totalLogs = 0;
    let bestPickTier = 0;
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const s = inv.slots[i];
      if (!s) continue;
      if (isAnyLog(s.id)) totalLogs += s.count;
      const def = getItemDef(s.id);
      if (def.toolType === 'pickaxe' && def.toolTier > bestPickTier) {
        bestPickTier = def.toolTier;
      }
    }

    const ctx = {
      totalLogs,
      hasTable: inv.countById(BLOCK_IDS.CRAFTING_TABLE) > 0,
      placedTable: this.milestones.placedTable,
      bestPickTier,
      cobbleCount: inv.countById(BLOCK_IDS.COBBLESTONE),
      hasFurnace: inv.countById(BLOCK_IDS.FURNACE) > 0,
      placedFurnace: this.milestones.placedFurnace,
      torchCount: inv.countById(BLOCK_IDS.TORCH),
      placedTorch: this.milestones.placedTorch,
      diamondCount: inv.countById(ITEM_IDS.DIAMOND),
    };

    while (this.guideStep < GUIDE_STEPS.length && GUIDE_STEPS[this.guideStep].check(ctx)) {
      this.guideStep++;
      if (this.guideStep >= GUIDE_STEPS.length) {
        this.audio.playCraft();
        this.showToast('All Wayfarer Goals Complete — Build & explore freely!', 3.6);
        this.starterGuide.classList.add('hidden');
        return;
      }
    }

    this.starterGuide.classList.remove('hidden');
    this.guideStepNum.textContent = `Goal ${this.guideStep + 1}/${GUIDE_STEPS.length}`;
    this.guideStepText.textContent = GUIDE_STEPS[this.guideStep].text(ctx);
  }

  updateHUD(dt, { player, sky, currentBiome, fps }) {
    // Environment Pill
    const clockInfo = sky.getFormattedClock();
    let icon = clockInfo.isNight ? '☾' : '☀';
    if (sky.weather === WEATHER_TYPES.RAIN) icon = '🌧';
    else if (sky.weather === WEATHER_TYPES.SNOW) icon = '❄';

    this.envTimeIcon.textContent = icon;
    this.envTimeText.textContent = `Day ${clockInfo.dayCount} · ${clockInfo.clock}`;
    this.envBiomeText.textContent = currentBiome ? currentBiome.name : 'Wilderness';

    const px = Math.floor(player.position.x);
    const py = Math.floor(player.position.y);
    const pz = Math.floor(player.position.z);
    this.envCoordsText.textContent = `${px}, ${py}, ${pz}`;

    // Screen Vignette (Underwater or Hurt Flash)
    if (player.hurtFlash > 0) {
      const a = Math.min(0.42, player.hurtFlash * 1.1);
      this.screenTint.style.background = `rgba(215, 32, 32, ${a.toFixed(2)})`;
    } else if (player.headUnderwater) {
      this.screenTint.style.background = 'rgba(14, 88, 168, 0.34)';
    } else {
      this.screenTint.style.background = 'transparent';
    }

    // Contextual Target Interaction Prompt
    if (player.targetHit && !player.crouching && player.targetHit.def.interactive) {
      const kind = player.targetHit.def.interactive;
      const labels = {
        crafting: 'Right-click · Use Crafting Table',
        furnace: 'Right-click · Open Furnace',
        chest: 'Right-click · Open Storage Chest',
        bed: 'Right-click · Rest in Bed',
        berry: 'Right-click · Harvest Berries',
      };
      this.interactPrompt.textContent = labels[kind] || '';
      this.interactPrompt.classList.remove('hidden');
    } else {
      this.interactPrompt.classList.add('hidden');
    }

    // Fading Toast & Hotbar Item Name
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.hintToast.classList.add('hidden');
    }
    if (this.hotbarLabelTimer > 0) {
      this.hotbarLabelTimer -= dt;
      if (this.hotbarLabelTimer <= 0) this.hotbarLabel.style.opacity = '0';
    }

    // Vitals in Survival
    const isSurvival = player.mode === GAME_MODES.SURVIVAL;
    this.vitalsRow.classList.toggle('hidden', !isSurvival);
    if (isSurvival) {
      this.renderVitalPips(this.healthBar, player.health, player.maxHealth, '❤');
      this.renderVitalPips(this.hungerBar, player.hunger, player.maxHunger, '🍖');
      const showAir = player.headUnderwater || player.air < player.maxAir - 0.1;
      this.airBar.classList.toggle('hidden', !showAir);
      if (showAir) {
        this.renderVitalPips(this.airBar, player.air, player.maxAir, '🫧');
      }
    }

    this.renderHotbar(player);
    this.updateProgressionGuide(player);

    if (this.isModalOpen() && this.modalStation === 'furnace') {
      this.updateFurnaceProgressLive();
    }

    // Optional Diagnostics (F3)
    this.debugPanel.classList.toggle('hidden', !this.showDebug);
    if (this.showDebug) {
      const modeStr = player.mode === GAME_MODES.CREATIVE
        ? (player.flying ? 'Creative (Flying)' : 'Creative')
        : 'Survival';
      this.debugPanel.textContent =
        `FPS: ${Math.round(fps)}\n` +
        `Mode: ${modeStr}\n` +
        `Loaded Chunks: ${player.world.chunks.size}\n` +
        `Entities: ${player.entities.mobs.length} mobs, ${player.entities.droppedItems.length} drops\n` +
        `Sky/Block Light: ${player.world.getSkyLight(px, py + 1, pz)} / ${player.world.getBlockLight(px, py + 1, pz)}`;
    }
  }
}
