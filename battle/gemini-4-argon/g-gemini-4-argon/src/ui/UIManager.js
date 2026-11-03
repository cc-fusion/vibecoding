import { BLOCK, REGISTRY, getMaxStack } from '../constants/Blocks.js';
import { RECIPES } from '../constants/Recipes.js';
import { HOTBAR_SIZE, TOTAL_SLOTS } from '../game/Inventory.js';

const PRESET_SEEDS = [
  'EmeraldPeaks',
  'WhisperingPines',
  'GoldenOasis',
  'CrystalCaverns',
  'AlpineFjord',
  'SunlitArchipelago',
  'Timberhaven',
];

export class UIManager {
  constructor(game) {
    this.game = game;

    // Grab DOM references
    this.elTitle = document.getElementById('title-screen');
    this.elSavedSection = document.getElementById('saved-worlds-section');
    this.elWorldList = document.getElementById('world-list');
    this.elCreateForm = document.getElementById('create-world-form');
    this.elWorldName = document.getElementById('input-world-name');
    this.elWorldSeed = document.getElementById('input-world-seed');
    this.elFileImport = document.getElementById('file-import-world');

    this.elHud = document.getElementById('hud');
    this.elWorldPill = document.getElementById('hud-world-pill');
    this.elDebug = document.getElementById('hud-debug');
    this.elPointerPrompt = document.getElementById('pointer-prompt');
    this.elHotbarLabel = document.getElementById('hotbar-label');
    this.elHotbar = document.getElementById('hotbar');
    this.elSurvivalBars = document.getElementById('survival-bars');
    this.elHealthBar = document.getElementById('health-bar');
    this.elHungerBar = document.getElementById('hunger-bar');
    this.elOxygenBar = document.getElementById('oxygen-bar');
    this.elUnderwater = document.getElementById('underwater-overlay');
    this.elDamage = document.getElementById('damage-overlay');

    this.elInvModal = document.getElementById('inventory-modal');
    this.elStationBadge = document.getElementById('station-badge');
    this.elBackpackGrid = document.getElementById('backpack-grid');
    this.elModalHotbarGrid = document.getElementById('modal-hotbar-grid');
    this.elHeldBanner = document.getElementById('held-cursor-banner');
    this.elRecipeTabs = document.getElementById('recipe-tabs');
    this.elRecipeList = document.getElementById('recipe-list');

    this.elPauseModal = document.getElementById('pause-modal');
    this.elSaveToast = document.getElementById('save-toast');
    this.elDeathModal = document.getElementById('death-modal');

    this.selectedNewMode = 'survival';
    this.showDebug = false;
    this.pickedSlotIndex = null;
    this.heldCursorStack = null; // For split-half / place-one cursor stack
    this.activeRecipeTab = 'All';
    this.forcedStation = null; // 'crafting' | 'furnace' | null
    this.labelTimeout = null;

    this.bindEvents();
  }

  bindEvents() {
    // Mode cards on Title Screen
    document.querySelectorAll('.mode-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-card').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedNewMode = btn.dataset.mode;
        this.game.sound.playClick();
      });
    });

    document.getElementById('btn-random-seed').addEventListener('click', () => {
      const pick = PRESET_SEEDS[Math.floor(Math.random() * PRESET_SEEDS.length)] + '-' + Math.floor(100 + Math.random() * 900);
      this.elWorldSeed.value = pick;
      this.game.sound.playClick();
    });

    this.elCreateForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.game.sound.unlock();
      this.game.sound.playClick();
      const name = this.elWorldName.value.trim() || 'New World';
      const seed = this.elWorldSeed.value.trim() || `Seed-${Math.floor(100000 + Math.random() * 900000)}`;
      this.game.createNewWorld(name, seed, this.selectedNewMode);
    });

    // Import JSON triggers
    const triggerImport = () => this.elFileImport.click();
    document.getElementById('btn-Import-world')?.addEventListener('click', triggerImport);
    document.getElementById('btn-import-empty')?.addEventListener('click', triggerImport);

    this.elFileImport.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (parsed && parsed.seed) {
          parsed.id = parsed.id || `world_${Date.now()}`;
          await this.game.saveManager.saveWorld(parsed);
          await this.refreshTitleWorlds();
          this.game.loadSavedWorld(parsed.id);
        }
      } catch {
        // Ignore malformed files safely
      }
      this.elFileImport.value = '';
    });

    // Inventory close
    document.getElementById('btn-close-inventory').addEventListener('click', () => {
      this.game.closeInventory();
    });

    // Pause Menu Controls
    document.getElementById('btn-resume').addEventListener('click', () => {
      this.game.resumeFromPause();
    });

    const elRenderDist = document.getElementById('slider-render-dist');
    const valRenderDist = document.getElementById('val-render-dist');
    elRenderDist.addEventListener('input', () => {
      const v = Number(elRenderDist.value);
      valRenderDist.textContent = `${v} chunks`;
      if (this.game.world) this.game.world.renderDistance = v;
    });

    const elVol = document.getElementById('slider-volume');
    const valVol = document.getElementById('val-volume');
    elVol.addEventListener('input', () => {
      const v = Number(elVol.value);
      valVol.textContent = `${v}%`;
      this.game.sound.volume = v / 100;
    });

    const elSens = document.getElementById('slider-sens');
    const valSens = document.getElementById('val-sens');
    elSens.addEventListener('input', () => {
      const v = Number(elSens.value);
      valSens.textContent = `${v}%`;
      if (this.game.player) this.game.player.sensitivity = 0.0022 * (v / 100);
    });

    document.getElementById('btn-mode-survival').addEventListener('click', () => {
      this.game.setGameMode('survival');
      this.syncPauseModeButtons();
    });
    document.getElementById('btn-mode-creative').addEventListener('click', () => {
      this.game.setGameMode('creative');
      this.syncPauseModeButtons();
    });

    document.querySelectorAll('[data-time]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.game.sky) {
          this.game.sky.timeOfDay = Number(btn.dataset.time);
          this.game.sound.playClick();
        }
      });
    });

    document.querySelectorAll('[data-weather]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-weather]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        if (this.game.sky) {
          this.game.sky.weatherMode = btn.dataset.weather;
          this.game.sound.playClick();
        }
      });
    });

    document.getElementById('btn-save-now').addEventListener('click', async () => {
      await this.game.saveCurrentWorld();
      this.elSaveToast.classList.remove('hidden');
      setTimeout(() => this.elSaveToast.classList.add('hidden'), 1800);
      this.game.sound.playClick();
    });

    document.getElementById('btn-export-world').addEventListener('click', async () => {
      const rec = await this.game.saveCurrentWorld();
      if (rec) this.game.saveManager.exportWorldToFile(rec);
    });

    document.getElementById('btn-exit-title').addEventListener('click', async () => {
      await this.game.exitToTitle();
    });

    document.getElementById('btn-respawn').addEventListener('click', () => {
      this.elDeathModal.classList.add('hidden');
      this.game.player?.respawn();
      this.game.requestPointerLock();
    });
  }

  async refreshTitleWorlds() {
    const worlds = await this.game.saveManager.listWorlds();
    const emptyImportBtn = document.getElementById('btn-import-empty');

    if (worlds.length === 0) {
      this.elSavedSection.classList.add('hidden');
      emptyImportBtn?.classList.remove('hidden');
      return;
    }

    this.elSavedSection.classList.remove('hidden');
    emptyImportBtn?.classList.add('hidden');
    this.elWorldList.innerHTML = '';

    for (const w of worlds) {
      const row = document.createElement('div');
      row.className = 'world-item';

      const modeCap = w.mode === 'creative' ? 'Creative' : 'Survival';
      const dayNum = w.dayCount || 1;

      const meta = document.createElement('div');
      meta.className = 'world-meta';
      const titleEl = document.createElement('div');
      titleEl.className = 'world-name';
      titleEl.textContent = w.name || 'Saved World';

      const subEl = document.createElement('div');
      subEl.className = 'world-sub';
      subEl.textContent = `${modeCap} · Day ${dayNum} · Seed: ${w.seed}`;
      meta.append(titleEl, subEl);

      const actions = document.createElement('div');
      actions.className = 'world-actions';

      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'btn-primary btn-sm';
      playBtn.textContent = 'Play';
      playBtn.addEventListener('click', () => {
        this.game.sound.unlock();
        this.game.sound.playClick();
        this.game.loadSavedWorld(w.id);
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-danger btn-sm';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async () => {
        await this.game.saveManager.deleteWorld(w.id);
        await this.refreshTitleWorlds();
      });

      actions.append(playBtn, delBtn);
      row.append(meta, actions);
      this.elWorldList.appendChild(row);
    }
  }

  async showTitleScreen() {
    this.elTitle.classList.remove('hidden');
    this.elHud.classList.add('hidden');
    this.elInvModal.classList.add('hidden');
    this.elPauseModal.classList.add('hidden');
    this.elDeathModal.classList.add('hidden');
    this.elUnderwater.classList.add('hidden');
    this.elDamage.classList.add('hidden');
    await this.refreshTitleWorlds();
  }

  showGameplayHUD() {
    this.elTitle.classList.add('hidden');
    this.elHud.classList.remove('hidden');
    this.elInvModal.classList.add('hidden');
    this.elPauseModal.classList.add('hidden');
    this.elDeathModal.classList.add('hidden');
    this.renderHotbar();
    this.renderVitals();
  }

  syncPauseModeButtons() {
    const mode = this.game.player?.mode || 'survival';
    document.getElementById('btn-mode-survival').classList.toggle('active', mode === 'survival');
    document.getElementById('btn-mode-creative').classList.toggle('active', mode === 'creative');
    this.elSurvivalBars.classList.toggle('hidden', mode === 'creative');
  }

  renderSlotContent(slotEl, stack, keyNumber = null) {
    slotEl.innerHTML = '';
    if (keyNumber !== null) {
      const k = document.createElement('span');
      k.className = 'slot-key';
      k.textContent = String(keyNumber);
      slotEl.appendChild(k);
    }
    if (!stack || !stack.id) return;

    const def = REGISTRY[stack.id];
    const iconUrl = this.game.atlas.iconUrls[stack.id];
    if (iconUrl) {
      const img = document.createElement('img');
      img.src = iconUrl;
      img.alt = def?.name || '';
      slotEl.appendChild(img);
    }
    slotEl.title = def?.name || '';

    if (stack.count > 1) {
      const cnt = document.createElement('span');
      cnt.className = 'slot-count';
      cnt.textContent = String(stack.count);
      slotEl.appendChild(cnt);
    }

    if (def?.maxDurability && typeof stack.durability === 'number' && stack.durability < def.maxDurability) {
      const bar = document.createElement('div');
      bar.className = 'slot-durability';
      const fill = document.createElement('span');
      const pct = Math.max(0, Math.min(100, (stack.durability / def.maxDurability) * 100));
      fill.style.width = `${pct}%`;
      fill.style.background = pct > 50 ? '#34d399' : pct > 22 ? '#fbbf24' : '#f87171';
      bar.appendChild(fill);
      slotEl.appendChild(bar);
    }
  }

  renderHotbar(flashLabel = false) {
    const inv = this.game.inventory;
    if (!inv) return;

    this.elHotbar.innerHTML = '';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const div = document.createElement('div');
      div.className = 'item-slot' + (inv.selectedSlot === i ? ' selected' : '');
      this.renderSlotContent(div, inv.slots[i], i + 1);
      div.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        inv.selectSlot(i);
        this.renderHotbar(true);
      });
      this.elHotbar.appendChild(div);
    }

    if (flashLabel) {
      const sel = inv.getSelected();
      const name = sel ? REGISTRY[sel.id]?.name || '' : '';
      this.elHotbarLabel.textContent = name;
      this.elHotbarLabel.style.opacity = '1';
      clearTimeout(this.labelTimeout);
      this.labelTimeout = setTimeout(() => {
        this.elHotbarLabel.style.opacity = '0';
      }, 1800);
    }
  }

  renderVitals() {
    const p = this.game.player;
    if (!p) return;

    if (p.mode === 'creative') {
      this.elSurvivalBars.classList.add('hidden');
      this.elOxygenBar.classList.add('hidden');
      return;
    }

    this.elSurvivalBars.classList.remove('hidden');

    // 10 Hearts (20 HP)
    this.elHealthBar.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const span = document.createElement('span');
      const hpVal = p.health - i * 2;
      span.className = 'vital-pip' + (hpVal <= 0 ? ' dim' : hpVal === 1 ? ' half' : '');
      span.textContent = '❤';
      span.style.color = '#ef4444';
      this.elHealthBar.appendChild(span);
    }

    // 10 Hunger pips (20 Hunger)
    this.elHungerBar.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const span = document.createElement('span');
      const hVal = p.hunger - i * 2;
      span.className = 'vital-pip' + (hVal <= 0 ? ' dim' : hVal === 1 ? ' half' : '');
      span.textContent = '🍗';
      this.elHungerBar.appendChild(span);
    }

    // Oxygen bubbles when underwater or recovering
    if (p.headUnderwater || p.oxygen < p.maxOxygen - 0.2) {
      this.elOxygenBar.classList.remove('hidden');
      this.elOxygenBar.innerHTML = '';
      const bubbles = Math.ceil((p.oxygen / p.maxOxygen) * 10);
      for (let i = 0; i < 10; i++) {
        const span = document.createElement('span');
        span.className = 'vital-pip' + (i >= bubbles ? ' dim' : '');
        span.textContent = '🫧';
        this.elOxygenBar.appendChild(span);
      }
    } else {
      this.elOxygenBar.classList.add('hidden');
    }
  }

  // ================= INVENTORY & CRAFTING MODAL =================
  openInventoryModal(forcedStation = null) {
    this.forcedStation = forcedStation;
    this.pickedSlotIndex = null;
    this.heldCursorStack = null;

    if (forcedStation === 'furnace') {
      this.activeRecipeTab = 'Smelting';
    } else if (this.game.player?.mode === 'creative' && !forcedStation) {
      this.activeRecipeTab = 'Creative';
    } else if (this.activeRecipeTab === 'Creative' && this.game.player?.mode !== 'creative') {
      this.activeRecipeTab = 'All';
    }

    this.elInvModal.classList.remove('hidden');
    this.renderInventoryModal();
  }

  closeInventoryModal() {
    // Return any held split stack back into inventory cleanly
    if (this.heldCursorStack) {
      this.game.inventory.addItem(this.heldCursorStack.id, this.heldCursorStack.count, this.heldCursorStack.durability);
      this.heldCursorStack = null;
    }
    this.pickedSlotIndex = null;
    this.forcedStation = null;
    this.elInvModal.classList.add('hidden');
    this.renderHotbar();
  }

  getEffectiveStations() {
    const near = this.game.player ? this.game.player.getNearbyStations() : { table: false, furnace: false };
    return {
      table: near.table || this.forcedStation === 'crafting',
      furnace: near.furnace || this.forcedStation === 'furnace',
    };
  }

  handleInventorySlotClick(idx, event) {
    const inv = this.game.inventory;
    if (!inv) return;

    // Shift + Left Click quick transfers between Hotbar and Backpack
    if (event.shiftKey && event.button === 0) {
      inv.quickTransfer(idx);
      this.pickedSlotIndex = null;
      this.game.sound.playClick();
      this.renderInventoryModal();
      this.renderHotbar();
      return;
    }

    // Right Click: split half or place 1 item
    if (event.button === 2) {
      event.preventDefault();
      const target = inv.slots[idx];

      if (!this.heldCursorStack && this.pickedSlotIndex === null) {
        if (target && target.count > 1) {
          const half = Math.ceil(target.count / 2);
          target.count -= half;
          if (target.count <= 0) inv.slots[idx] = null;
          this.heldCursorStack = { id: target.id, count: half, durability: target.durability };
          this.game.sound.playClick();
        }
      } else if (this.heldCursorStack) {
        const maxS = getMaxStack(this.heldCursorStack.id);
        if (!target) {
          inv.slots[idx] = { id: this.heldCursorStack.id, count: 1, durability: this.heldCursorStack.durability };
          this.heldCursorStack.count--;
        } else if (target.id === this.heldCursorStack.id && target.count < maxS) {
          target.count++;
          this.heldCursorStack.count--;
        }
        if (this.heldCursorStack.count <= 0) this.heldCursorStack = null;
        this.game.sound.playClick();
      }
      this.renderInventoryModal();
      this.renderHotbar();
      return;
    }

    // Left Click: place heldCursorStack or pick/swap slot
    if (this.heldCursorStack) {
      const target = inv.slots[idx];
      const maxS = getMaxStack(this.heldCursorStack.id);
      if (!target) {
        inv.slots[idx] = this.heldCursorStack;
        this.heldCursorStack = null;
      } else if (target.id === this.heldCursorStack.id && target.count < maxS) {
        const move = Math.min(maxS - target.count, this.heldCursorStack.count);
        target.count += move;
        this.heldCursorStack.count -= move;
        if (this.heldCursorStack.count <= 0) this.heldCursorStack = null;
      } else {
        inv.slots[idx] = this.heldCursorStack;
        this.heldCursorStack = target;
      }
      this.game.sound.playClick();
      this.renderInventoryModal();
      this.renderHotbar();
      return;
    }

    if (this.pickedSlotIndex === null) {
      if (inv.slots[idx]) {
        this.pickedSlotIndex = idx;
        this.game.sound.playClick();
      }
    } else {
      inv.interactSlot(this.pickedSlotIndex, idx);
      this.pickedSlotIndex = null;
      this.game.sound.playClick();
    }

    this.renderInventoryModal();
    this.renderHotbar();
  }

  renderInventoryModal() {
    const inv = this.game.inventory;
    if (!inv) return;

    const stations = this.getEffectiveStations();

    // Update station badge dynamically
    if (stations.table && stations.furnace) {
      this.elStationBadge.textContent = 'Crafting Table & Furnace Nearby';
      this.elStationBadge.className = 'station-badge table';
    } else if (stations.furnace) {
      this.elStationBadge.textContent = 'Furnace Active';
      this.elStationBadge.className = 'station-badge furnace';
    } else if (stations.table) {
      this.elStationBadge.textContent = 'Crafting Table Active';
      this.elStationBadge.className = 'station-badge table';
    } else {
      this.elStationBadge.textContent = 'Hand Crafting';
      this.elStationBadge.className = 'station-badge';
    }

    // Render Backpack (slots 9..35)
    this.elBackpackGrid.innerHTML = '';
    for (let i = HOTBAR_SIZE; i < TOTAL_SLOTS; i++) {
      const slot = document.createElement('div');
      slot.className = 'item-slot' + (this.pickedSlotIndex === i ? ' picked' : '');
      this.renderSlotContent(slot, inv.slots[i]);
      slot.addEventListener('mousedown', (e) => this.handleInventorySlotClick(i, e));
      slot.addEventListener('contextmenu', (e) => e.preventDefault());
      this.elBackpackGrid.appendChild(slot);
    }

    // Render Hotbar inside modal (slots 0..8)
    this.elModalHotbarGrid.innerHTML = '';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = document.createElement('div');
      slot.className = 'item-slot' + (this.pickedSlotIndex === i ? ' picked' : '');
      this.renderSlotContent(slot, inv.slots[i], i + 1);
      slot.addEventListener('mousedown', (e) => this.handleInventorySlotClick(i, e));
      slot.addEventListener('contextmenu', (e) => e.preventDefault());
      this.elModalHotbarGrid.appendChild(slot);
    }

    // Held stack status banner
    if (this.heldCursorStack) {
      const def = REGISTRY[this.heldCursorStack.id];
      this.elHeldBanner.textContent = `Moving: ${this.heldCursorStack.count}× ${def?.name || 'Item'} — Click a slot to place`;
      this.elHeldBanner.classList.remove('hidden');
    } else if (this.pickedSlotIndex !== null && inv.slots[this.pickedSlotIndex]) {
      const s = inv.slots[this.pickedSlotIndex];
      const def = REGISTRY[s.id];
      this.elHeldBanner.textContent = `Selected: ${s.count}× ${def?.name || 'Item'} — Click any slot to swap or merge`;
      this.elHeldBanner.classList.remove('hidden');
    } else {
      this.elHeldBanner.classList.add('hidden');
    }

    // Render Category Tabs
    const tabs = ['All', 'Basics', 'Tools', 'Building', 'Utility', 'Smelting'];
    if (this.game.player?.mode === 'creative') {
      tabs.unshift('Creative');
    }
    this.elRecipeTabs.innerHTML = '';
    for (const tab of tabs) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab-btn' + (this.activeRecipeTab === tab ? ' active' : '');
      b.textContent = tab === 'Creative' ? 'Creative Palette' : tab;
      b.addEventListener('click', () => {
        this.activeRecipeTab = tab;
        this.game.sound.playClick();
        this.renderInventoryModal();
      });
      this.elRecipeTabs.appendChild(b);
    }

    // Creative Palette View
    if (this.activeRecipeTab === 'Creative') {
      this.elRecipeList.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'creative-grid';
      for (const def of Object.values(REGISTRY)) {
        if (def.id === BLOCK.AIR || def.id === BLOCK.WATER || def.id === BLOCK.BEDROCK) continue;
        const slot = document.createElement('div');
        slot.className = 'item-slot';
        const giveCount = getMaxStack(def.id) > 1 ? 64 : 1;
        this.renderSlotContent(slot, { id: def.id, count: 1 });
        slot.title = `Click to add ${def.name} (Shift+Click for 64)`;
        slot.addEventListener('click', (e) => {
          inv.addItem(def.id, e.shiftKey ? giveCount : (getMaxStack(def.id) > 1 ? 16 : 1));
          this.game.sound.playPickup();
          this.renderInventoryModal();
          this.renderHotbar();
        });
        grid.appendChild(slot);
      }
      this.elRecipeList.appendChild(grid);
      return;
    }

    // Filtered & Sorted Recipes (craftable ones automatically float to the top!)
    const filtered = RECIPES.filter((r) => this.activeRecipeTab === 'All' || r.category === this.activeRecipeTab);
    const annotated = filtered.map((recipe) => {
      const stationOk =
        recipe.station === 'hand' ||
        (recipe.station === 'table' && stations.table) ||
        (recipe.station === 'furnace' && stations.furnace);
      const can = inv.canCraft(recipe, stations);
      return { recipe, stationOk, can };
    });

    annotated.sort((a, b) => {
      if (a.can !== b.can) return a.can ? -1 : 1;
      if (a.stationOk !== b.stationOk) return a.stationOk ? -1 : 1;
      return 0;
    });

    this.elRecipeList.innerHTML = '';
    for (const { recipe, stationOk, can } of annotated) {
      const outDef = REGISTRY[recipe.output.id];
      const card = document.createElement('div');
      card.className = 'recipe-card' + (can ? ' craftable' : !stationOk ? ' locked' : '');

      const info = document.createElement('div');
      info.className = 'recipe-info';

      const icon = document.createElement('img');
      icon.className = 'recipe-icon';
      icon.src = this.game.atlas.iconUrls[recipe.output.id] || '';
      icon.alt = outDef?.name || '';

      const textWrap = document.createElement('div');
      textWrap.className = 'recipe-text';

      const title = document.createElement('div');
      title.className = 'recipe-title';
      title.textContent = `${recipe.output.count > 1 ? recipe.output.count + '× ' : ''}${outDef?.name || ''}`;

      const ingParts = recipe.ingredients.map((ing) => {
        if (ing.anyOf) {
          const have = inv.countItem(ing.anyOf);
          return `${ing.count}× ${ing.label} (${have})`;
        }
        const d = REGISTRY[ing.id];
        const have = inv.countItem(ing.id);
        return `${ing.count}× ${d?.name || ''} (${have})`;
      });
      const stationHint = !stationOk
        ? recipe.station === 'table'
          ? ' · Needs Crafting Table'
          : ' · Needs Furnace'
        : '';

      const ings = document.createElement('div');
      ings.className = 'recipe-ings';
      ings.textContent = ingParts.join(' + ') + stationHint;

      textWrap.append(title, ings);
      info.append(icon, textWrap);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'recipe-action-btn ' + (can ? 'ready' : 'disabled');
      btn.textContent = recipe.station === 'furnace' ? 'Smelt' : 'Craft';
      btn.disabled = !can;
      if (can) {
        btn.addEventListener('click', () => {
          if (inv.craft(recipe, stations)) {
            this.game.sound.playCraft();
            this.renderInventoryModal();
            this.renderHotbar();
          }
        });
      }

      card.append(info, btn);
      this.elRecipeList.appendChild(card);
    }
  }

  // Per-frame lightweight HUD sync
  updateHUD(fps) {
    const p = this.game.player;
    const sky = this.game.sky;
    const world = this.game.world;
    if (!p || !sky || !world) return;

    const biome = world.getBiomeAt(p.pos.x, p.pos.z);
    const modeLabel = p.mode === 'creative' ? (p.flying ? 'Creative · Flying' : 'Creative') : 'Survival';
    this.elWorldPill.textContent = `${biome} · Day ${sky.dayCount} · ${sky.getClockString()} · ${modeLabel}`;

    this.elUnderwater.classList.toggle('hidden', !p.headUnderwater);
    this.elDamage.classList.toggle('hidden', p.damageFlash <= 0);
    if (p.damageFlash > 0) {
      this.elDamage.style.opacity = String(Math.min(1, p.damageFlash * 2.8));
    }

    if (this.showDebug) {
      this.elDebug.classList.remove('hidden');
      const x = p.pos.x.toFixed(1);
      const y = p.pos.y.toFixed(1);
      const z = p.pos.z.toFixed(1);
      this.elDebug.textContent = `${Math.round(fps)} FPS · XYZ: ${x}, ${y}, ${z} · Chunks: ${world.chunks.size} · Mobs: ${this.game.entities?.mobs.length || 0}`;
    } else {
      this.elDebug.classList.add('hidden');
    }
  }
}
