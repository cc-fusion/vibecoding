import { PRESET_SEEDS, GAME_MODES, WEATHER_TYPES } from './constants.js';
import { BLOCK, REGISTRY, getItemDef } from './blocks.js';
import { CRAFTING_RECIPES, SMELTING_RECIPES, MILESTONES } from './recipes.js';
import { HOTBAR_SIZE, TOTAL_SLOTS } from './inventory.js';

export class GameUI {
  constructor({ textures, callbacks }) {
    this.textures = textures;
    this.callbacks = callbacks;

    this.selectedMode = GAME_MODES.SURVIVAL;
    this.activeWsTab = 'craft';
    this.activeRecipeCat = 'all';
    this.craftableOnly = false;
    this.cursorItem = null;
    this.debugVisible = false;
    this.bannerTimer = null;

    this.cacheDom();
    this.bindEvents();
    this.renderSeedPresets();
  }

  cacheDom() {
    this.el = {
      screenFx: document.getElementById('screen-fx'),
      titleScreen: document.getElementById('title-screen'),
      savedSection: document.getElementById('saved-worlds-section'),
      savedList: document.getElementById('saved-worlds-list'),
      inputName: document.getElementById('input-world-name'),
      inputSeed: document.getElementById('input-world-seed'),
      seedPresets: document.getElementById('seed-presets'),
      btnRandomSeed: document.getElementById('btn-random-seed'),
      btnCreateWorld: document.getElementById('btn-create-world'),
      btnTitleControls: document.getElementById('btn-title-controls'),

      hud: document.getElementById('hud'),
      phaseIcon: document.getElementById('hud-phase-icon'),
      dayTime: document.getElementById('hud-day-time'),
      biome: document.getElementById('hud-biome'),
      weatherTag: document.getElementById('hud-weather'),
      flightTag: document.getElementById('hud-flight'),
      debugPanel: document.getElementById('debug-panel'),
      objectiveBanner: document.getElementById('objective-banner'),
      objectiveText: document.getElementById('objective-text'),
      crosshair: document.getElementById('crosshair'),
      breakCircle: document.getElementById('break-ring-circle'),
      toastContainer: document.getElementById('toast-container'),
      heldBanner: document.getElementById('held-item-banner'),
      oxygenBar: document.getElementById('oxygen-bar'),
      vitalsRow: document.getElementById('vitals-row'),
      healthBar: document.getElementById('health-bar'),
      hungerBar: document.getElementById('hunger-bar'),
      hotbar: document.getElementById('hotbar'),

      invModal: document.getElementById('inventory-modal'),
      stationBadge: document.getElementById('station-badge'),
      btnCloseInv: document.getElementById('btn-close-inventory'),
      backpackGrid: document.getElementById('backpack-grid'),
      modalHotbarGrid: document.getElementById('modal-hotbar-grid'),
      itemInspector: document.getElementById('item-inspector'),
      tabBtnCatalog: document.getElementById('tab-btn-catalog'),
      wsViewCraft: document.getElementById('ws-view-craft'),
      wsViewSmelt: document.getElementById('ws-view-smelt'),
      wsViewCatalog: document.getElementById('ws-view-catalog'),
      chkCraftable: document.getElementById('chk-craftable-only'),
      recipeList: document.getElementById('recipe-list'),
      furnaceStatusBar: document.getElementById('furnace-status-bar'),
      smeltList: document.getElementById('smelt-list'),
      catalogGrid: document.getElementById('catalog-grid'),
      cursorStack: document.getElementById('cursor-stack'),

      pauseModal: document.getElementById('pause-modal'),
      pauseTitle: document.getElementById('pause-world-title'),
      pauseSub: document.getElementById('pause-world-sub'),
      btnResume: document.getElementById('btn-resume'),
      btnResumeTop: document.getElementById('btn-resume-top'),
      btnSaveNow: document.getElementById('btn-save-now'),
      btnOpenControls: document.getElementById('btn-open-controls'),
      btnSaveExit: document.getElementById('btn-save-exit'),
      sliderRenderDist: document.getElementById('slider-render-dist'),
      valRenderDist: document.getElementById('val-render-dist'),
      sliderFov: document.getElementById('slider-fov'),
      valFov: document.getElementById('val-fov'),
      sliderSens: document.getElementById('slider-sens'),
      valSens: document.getElementById('val-sens'),
      sliderVolume: document.getElementById('slider-volume'),
      valVolume: document.getElementById('val-volume'),
      btnCycleWeather: document.getElementById('btn-cycle-weather'),

      controlsModal: document.getElementById('controls-modal'),
      btnCloseControls: document.getElementById('btn-close-controls'),

      respawnModal: document.getElementById('respawn-modal'),
      respawnReason: document.getElementById('respawn-reason'),
      btnRespawn: document.getElementById('btn-respawn'),
    };
  }

  bindEvents() {
    // Mode toggle on Title Screen
    document.querySelectorAll('.seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.seg-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedMode = btn.dataset.mode;
      });
    });

    this.el.btnRandomSeed.addEventListener('click', () => {
      const wordsA = ['emerald', 'frost', 'amber', 'crystal', 'cedar', 'crimson', 'misty', 'sunlit'];
      const wordsB = ['valley', 'peaks', 'canyon', 'hollow', 'archipelago', 'ridge', 'haven', 'basin'];
      const a = wordsA[Math.floor(Math.random() * wordsA.length)];
      const b = wordsB[Math.floor(Math.random() * wordsB.length)];
      const num = Math.floor(100 + Math.random() * 900);
      this.el.inputSeed.value = `${a}-${b}-${num}`;
    });

    this.el.btnCreateWorld.addEventListener('click', () => {
      const name = this.el.inputName.value.trim() || 'New Frontier';
      const seed = this.el.inputSeed.value.trim() || `seed-${Date.now()}`;
      this.callbacks.onCreateWorld({ name, seed, mode: this.selectedMode });
    });

    this.el.btnTitleControls.addEventListener('click', () => {
      this.el.controlsModal.classList.remove('hidden');
    });

    this.el.btnCloseControls.addEventListener('click', () => {
      this.el.controlsModal.classList.add('hidden');
    });

    // Inventory Modal Events
    this.el.btnCloseInv.addEventListener('click', () => this.callbacks.onCloseModal());

    document.querySelectorAll('.ws-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setWorkshopTab(btn.dataset.wstab);
      });
    });

    document.querySelectorAll('.cat-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cat-pill').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeRecipeCat = btn.dataset.cat;
        this.callbacks.onRefreshWorkshop();
      });
    });

    this.el.chkCraftable.addEventListener('change', (e) => {
      this.craftableOnly = e.target.checked;
      this.callbacks.onRefreshWorkshop();
    });

    window.addEventListener('mousemove', (e) => {
      if (this.cursorItem) {
        this.el.cursorStack.style.left = `${e.clientX}px`;
        this.el.cursorStack.style.top = `${e.clientY}px`;
      }
    });

    // Pause & Settings Events
    this.el.pauseModal.addEventListener('mousedown', (e) => {
      if (e.target === this.el.pauseModal) this.callbacks.onResume();
    });
    this.el.btnResume.addEventListener('click', () => this.callbacks.onResume());
    this.el.btnResumeTop.addEventListener('click', () => this.callbacks.onResume());
    this.el.btnSaveNow.addEventListener('click', () => this.callbacks.onSaveNow());
    this.el.btnOpenControls.addEventListener('click', () => {
      this.el.controlsModal.classList.remove('hidden');
    });
    this.el.btnSaveExit.addEventListener('click', () => this.callbacks.onSaveAndExit());

    this.el.sliderRenderDist.addEventListener('input', (e) => {
      const v = Number(e.target.value);
      this.el.valRenderDist.textContent = `${v} Chunks`;
      this.callbacks.onSettingChange('renderDistance', v);
    });
    this.el.sliderFov.addEventListener('input', (e) => {
      const v = Number(e.target.value);
      this.el.valFov.textContent = `${v}°`;
      this.callbacks.onSettingChange('fov', v);
    });
    this.el.sliderSens.addEventListener('input', (e) => {
      const v = Number(e.target.value);
      this.el.valSens.textContent = `${v.toFixed(1)}×`;
      this.callbacks.onSettingChange('sensitivity', v);
    });
    this.el.sliderVolume.addEventListener('input', (e) => {
      const v = Number(e.target.value);
      this.el.valVolume.textContent = `${v}%`;
      this.callbacks.onSettingChange('volume', v / 100);
    });

    document.querySelectorAll('[data-settime]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.callbacks.onSetTime(Number(btn.dataset.settime));
      });
    });

    this.el.btnCycleWeather.addEventListener('click', () => {
      this.callbacks.onCycleWeather();
    });

    this.el.btnRespawn.addEventListener('click', () => {
      this.callbacks.onRespawn();
    });
  }

  renderSeedPresets() {
    this.el.seedPresets.innerHTML = '';
    for (const p of PRESET_SEEDS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'preset-chip';
      btn.textContent = p.label;
      btn.addEventListener('click', () => {
        this.el.inputSeed.value = p.seed;
        this.el.inputName.value = p.label;
      });
      this.el.seedPresets.appendChild(btn);
    }
  }

  renderSavedWorlds(worlds) {
    if (!worlds || worlds.length === 0) {
      this.el.savedSection.classList.add('hidden');
      return;
    }
    this.el.savedSection.classList.remove('hidden');
    this.el.savedList.innerHTML = '';

    for (const w of worlds) {
      const row = document.createElement('div');
      row.className = 'saved-world-row';

      const meta = document.createElement('div');
      meta.className = 'saved-world-meta';
      const modeStr = w.mode === GAME_MODES.CREATIVE ? 'Creative' : 'Survival';
      const biomeStr = w.biomeName || 'Wilderness';
      const dayStr = `Day ${w.dayCount || 1}`;
      meta.innerHTML = `<strong></strong><span>${modeStr} · ${dayStr} · ${biomeStr}</span>`;
      meta.querySelector('strong').textContent = w.name;

      const actions = document.createElement('div');
      actions.className = 'saved-world-actions';

      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'btn-primary';
      playBtn.textContent = 'Play';
      playBtn.addEventListener('click', () => this.callbacks.onLoadWorld(w.id));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-danger-sm';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => this.callbacks.onDeleteWorld(w.id));

      actions.append(playBtn, delBtn);
      row.append(meta, actions);
      this.el.savedList.appendChild(row);
    }
  }

  showTitleScreen(worlds) {
    this.renderSavedWorlds(worlds);
    this.el.titleScreen.classList.remove('hidden');
    this.el.hud.classList.add('hidden');
    this.el.invModal.classList.add('hidden');
    this.el.pauseModal.classList.add('hidden');
    this.el.respawnModal.classList.add('hidden');
  }

  showGameplayHUD(mode) {
    this.el.titleScreen.classList.add('hidden');
    this.el.invModal.classList.add('hidden');
    this.el.pauseModal.classList.add('hidden');
    this.el.controlsModal.classList.add('hidden');
    this.el.respawnModal.classList.add('hidden');
    this.el.hud.classList.remove('hidden');

    if (mode === GAME_MODES.CREATIVE) {
      this.el.vitalsRow.classList.add('hidden');
      this.el.oxygenBar.classList.add('hidden');
      this.el.objectiveBanner.classList.add('hidden');
    } else {
      this.el.vitalsRow.classList.remove('hidden');
    }
  }

  showToast(text) {
    const div = document.createElement('div');
    div.className = 'toast-msg';
    div.textContent = text;
    this.el.toastContainer.appendChild(div);
    setTimeout(() => {
      div.style.opacity = '0';
      div.style.transition = 'opacity 0.3s ease';
      setTimeout(() => div.remove(), 320);
    }, 3000);
  }

  showHeldItemBanner(itemName) {
    this.el.heldBanner.textContent = itemName || '';
    if (itemName) {
      this.el.heldBanner.classList.add('visible');
      clearTimeout(this.bannerTimer);
      this.bannerTimer = setTimeout(() => {
        this.el.heldBanner.classList.remove('visible');
      }, 1800);
    } else {
      this.el.heldBanner.classList.remove('visible');
    }
  }

  createSlotElement(stack, slotIndex, options = {}) {
    const div = document.createElement('div');
    div.className = 'inv-slot';
    if (options.selected) div.classList.add('selected');

    if (options.showKey) {
      const k = document.createElement('span');
      k.className = 'slot-key';
      k.textContent = String(slotIndex + 1);
      div.appendChild(k);
    }

    if (stack && stack.id !== BLOCK.AIR) {
      const img = document.createElement('img');
      img.src = this.textures.iconUrls[stack.id] || '';
      img.alt = getItemDef(stack.id).name;
      div.appendChild(img);

      if (stack.count > 1) {
        const cnt = document.createElement('span');
        cnt.className = 'slot-count';
        cnt.textContent = String(stack.count);
        div.appendChild(cnt);
      }

      if (stack.durability !== undefined && stack.maxDurability) {
        const pct = Math.max(0, Math.min(100, (stack.durability / stack.maxDurability) * 100));
        if (pct < 99.5) {
          const bar = document.createElement('div');
          bar.className = 'slot-durability';
          const fill = document.createElement('span');
          fill.style.width = `${pct}%`;
          fill.style.background = pct > 50 ? '#4ade80' : (pct > 22 ? '#fbbf24' : '#f87171');
          bar.appendChild(fill);
          div.appendChild(bar);
        }
      }
    }

    return div;
  }

  renderHotbar(inventory) {
    this.el.hotbar.innerHTML = '';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slotEl = this.createSlotElement(inventory.slots[i], i, {
        selected: i === inventory.selectedSlot,
        showKey: true,
      });
      slotEl.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.callbacks.onSelectHotbar(i);
      });
      this.el.hotbar.appendChild(slotEl);
    }
  }

  renderVitals(health, hunger, oxygen, underwater) {
    const buildPips = (container, val, cls) => {
      container.innerHTML = '';
      for (let i = 0; i < 10; i++) {
        const p = document.createElement('div');
        const fullThresh = (i + 1) * 2;
        let state = '';
        if (val >= fullThresh) state = 'full';
        else if (val >= fullThresh - 1) state = 'half';
        p.className = `pip ${cls} ${state}`;
        container.appendChild(p);
      }
    };

    buildPips(this.el.healthBar, Math.ceil(health), 'heart');
    buildPips(this.el.hungerBar, Math.ceil(hunger), 'food');

    if (underwater || oxygen < 19.8) {
      this.el.oxygenBar.classList.remove('hidden');
      this.el.oxygenBar.innerHTML = '';
      const bubbles = Math.ceil(oxygen / 2);
      for (let i = 0; i < 10; i++) {
        const b = document.createElement('div');
        b.className = `pip air ${i < bubbles ? 'full' : ''}`;
        this.el.oxygenBar.appendChild(b);
      }
    } else {
      this.el.oxygenBar.classList.add('hidden');
    }
  }

  updateHUDStatus({ dayCount, clock, phase, biomeName, weather, isSnowBiome, flying, breakProgress, hasTarget }) {
    this.el.dayTime.textContent = `Day ${dayCount} · ${clock}`;
    this.el.biome.textContent = biomeName;

    this.el.phaseIcon.className = 'phase-dot';
    if (phase === 'Night') this.el.phaseIcon.classList.add('night');
    else if (phase === 'Sunset' || phase === 'Dawn') this.el.phaseIcon.classList.add('sunset');

    if (weather !== WEATHER_TYPES.CLEAR) {
      this.el.weatherTag.classList.remove('hidden');
      this.el.weatherTag.textContent = (weather === WEATHER_TYPES.SNOW || isSnowBiome) ? 'Snowing' : 'Raining';
    } else {
      this.el.weatherTag.classList.add('hidden');
    }

    if (flying) this.el.flightTag.classList.remove('hidden');
    else this.el.flightTag.classList.add('hidden');

    this.el.crosshair.classList.toggle('active-target', Boolean(hasTarget));
    const offset = 88 * (1.0 - Math.max(0, Math.min(1, breakProgress || 0)));
    this.el.breakCircle.style.strokeDashoffset = String(offset);
  }

  updateObjective(completedSet, mode) {
    if (mode === GAME_MODES.CREATIVE) {
      this.el.objectiveBanner.classList.add('hidden');
      return;
    }
    const next = MILESTONES.find((m) => !completedSet.has(m.id));
    if (!next) {
      this.el.objectiveBanner.classList.add('hidden');
      return;
    }
    this.el.objectiveBanner.classList.remove('hidden');
    this.el.objectiveText.textContent = next.hint;
  }

  toggleDebug() {
    this.debugVisible = !this.debugVisible;
    this.el.debugPanel.classList.toggle('hidden', !this.debugVisible);
  }

  updateDebug(info) {
    if (!this.debugVisible) return;
    this.el.debugPanel.innerHTML = [
      `FPS: ${info.fps} · Chunks: ${info.loadedChunks} · Tris: ${info.triangles.toLocaleString()}`,
      `XYZ: ${info.x.toFixed(1)} / ${info.y.toFixed(1)} / ${info.z.toFixed(1)}`,
      `Light: Sky ${info.skyLight} · Block ${info.blockLight}`,
    ].join('<br/>');
  }

  // --- INVENTORY & WORKSHOP ---
  setWorkshopTab(tabName) {
    this.activeWsTab = tabName;
    document.querySelectorAll('.ws-tab').forEach((b) => {
      b.classList.toggle('active', b.dataset.wstab === tabName);
    });
    this.el.wsViewCraft.classList.toggle('hidden', tabName !== 'craft');
    this.el.wsViewSmelt.classList.toggle('hidden', tabName !== 'smelt');
    this.el.wsViewCatalog.classList.toggle('hidden', tabName !== 'catalog');
    this.callbacks.onRefreshWorkshop();
  }

  openInventoryModal({ inventory, hasTable, hasFurnace, isCreative, initialTab = 'craft' }) {
    this.el.invModal.classList.remove('hidden');
    this.el.tabBtnCatalog.classList.toggle('hidden', !isCreative);
    this.setWorkshopTab(initialTab);
    this.refreshWorkshop({ inventory, hasTable, hasFurnace, isCreative });
  }

  closeInventoryModal(inventory) {
    if (this.cursorItem && inventory) {
      inventory.addItem(this.cursorItem.id, this.cursorItem.count, this.cursorItem.durability);
      this.cursorItem = null;
      this.updateCursorVisual();
    }
    this.el.invModal.classList.add('hidden');
  }

  updateCursorVisual() {
    if (!this.cursorItem) {
      this.el.cursorStack.classList.add('hidden');
      this.el.cursorStack.innerHTML = '';
      return;
    }
    this.el.cursorStack.classList.remove('hidden');
    this.el.cursorStack.innerHTML = '';
    const img = document.createElement('img');
    img.src = this.textures.iconUrls[this.cursorItem.id] || '';
    this.el.cursorStack.appendChild(img);
    if (this.cursorItem.count > 1) {
      const s = document.createElement('span');
      s.className = 'slot-count';
      s.textContent = String(this.cursorItem.count);
      this.el.cursorStack.appendChild(s);
    }
  }

  describeItem(id) {
    const def = getItemDef(id);
    const parts = [def.name];
    if (def.damage) parts.push(`${def.damage} Attack`);
    if (def.toolType) parts.push(`${def.speed}× Mining Speed`);
    if (def.food) parts.push(`Restores +${def.food.hunger} Food (Right-Click to eat)`);
    if (def.light) parts.push(`Emits Light ${def.light}`);
    if (def.fuelValue) parts.push(`Furnace Fuel (${def.fuelValue} smelts)`);
    return parts.join(' · ');
  }

  handleSlotClick(e, slotIdx, inventory, context) {
    e.preventDefault();

    if (e.shiftKey && e.button === 0) {
      inventory.quickTransfer(slotIdx);
      this.refreshWorkshop(context);
      this.renderHotbar(inventory);
      return;
    }

    const slot = inventory.slots[slotIdx];

    if (e.button === 2) {
      // Right-click: split half or place 1
      if (!this.cursorItem && slot) {
        const take = Math.ceil(slot.count / 2);
        this.cursorItem = { ...slot, count: take };
        slot.count -= take;
        if (slot.count <= 0) inventory.slots[slotIdx] = null;
      } else if (this.cursorItem) {
        const maxStack = getItemDef(this.cursorItem.id).maxStack || 64;
        if (!slot) {
          inventory.slots[slotIdx] = { ...this.cursorItem, count: 1 };
          this.cursorItem.count -= 1;
        } else if (slot.id === this.cursorItem.id && slot.count < maxStack) {
          slot.count += 1;
          this.cursorItem.count -= 1;
        }
        if (this.cursorItem.count <= 0) this.cursorItem = null;
      }
    } else {
      // Left-click: pick up, place, merge, or swap
      if (!this.cursorItem && slot) {
        this.cursorItem = { ...slot };
        inventory.slots[slotIdx] = null;
      } else if (this.cursorItem) {
        if (!slot) {
          inventory.slots[slotIdx] = { ...this.cursorItem };
          this.cursorItem = null;
        } else if (slot.id === this.cursorItem.id && (getItemDef(slot.id).maxStack || 64) > 1) {
          const maxStack = getItemDef(slot.id).maxStack || 64;
          const space = maxStack - slot.count;
          const add = Math.min(space, this.cursorItem.count);
          slot.count += add;
          this.cursorItem.count -= add;
          if (this.cursorItem.count <= 0) this.cursorItem = null;
        } else {
          inventory.slots[slotIdx] = { ...this.cursorItem };
          this.cursorItem = { ...slot };
        }
      }
    }

    this.updateCursorVisual();
    this.refreshWorkshop(context);
    this.renderHotbar(inventory);
  }

  refreshWorkshop(context) {
    const { inventory, hasTable, hasFurnace, isCreative } = context;

    // Station badge (only displayed when near an active station!)
    if (hasTable && hasFurnace) {
      this.el.stationBadge.textContent = 'Crafting Table & Furnace Nearby';
      this.el.stationBadge.classList.remove('hidden');
    } else if (hasTable) {
      this.el.stationBadge.textContent = 'Crafting Table Nearby';
      this.el.stationBadge.classList.remove('hidden');
    } else if (hasFurnace) {
      this.el.stationBadge.textContent = 'Stone Furnace Nearby';
      this.el.stationBadge.classList.remove('hidden');
    } else {
      this.el.stationBadge.classList.add('hidden');
    }

    // Backpack slots 9..35
    this.el.backpackGrid.innerHTML = '';
    for (let i = HOTBAR_SIZE; i < TOTAL_SLOTS; i++) {
      const sEl = this.createSlotElement(inventory.slots[i], i);
      sEl.addEventListener('mousedown', (e) => this.handleSlotClick(e, i, inventory, context));
      sEl.addEventListener('contextmenu', (e) => e.preventDefault());
      sEl.addEventListener('mouseenter', () => {
        if (inventory.slots[i]) {
          this.el.itemInspector.textContent = this.describeItem(inventory.slots[i].id);
        }
      });
      this.el.backpackGrid.appendChild(sEl);
    }

    // Modal Hotbar slots 0..8
    this.el.modalHotbarGrid.innerHTML = '';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const sEl = this.createSlotElement(inventory.slots[i], i, {
        selected: i === inventory.selectedSlot,
        showKey: true,
      });
      sEl.addEventListener('mousedown', (e) => this.handleSlotClick(e, i, inventory, context));
      sEl.addEventListener('contextmenu', (e) => e.preventDefault());
      sEl.addEventListener('mouseenter', () => {
        if (inventory.slots[i]) {
          this.el.itemInspector.textContent = this.describeItem(inventory.slots[i].id);
        }
      });
      this.el.modalHotbarGrid.appendChild(sEl);
    }

    if (this.activeWsTab === 'craft') {
      this.renderCraftingList(context);
    } else if (this.activeWsTab === 'smelt') {
      this.renderSmeltingList(context);
    } else if (this.activeWsTab === 'catalog' && isCreative) {
      this.renderCreativeCatalog(context);
    }
  }

  renderCraftingList(context) {
    const { inventory, hasTable, isCreative } = context;
    this.el.recipeList.innerHTML = '';

    const filtered = CRAFTING_RECIPES.filter((r) => {
      if (this.activeRecipeCat !== 'all' && r.category !== this.activeRecipeCat) return false;
      const ok = inventory.canCraft(r, hasTable, isCreative);
      if (this.craftableOnly && !ok) return false;
      return true;
    });

    // Sort craftable recipes first so players immediately see what they can build
    filtered.sort((a, b) => {
      const ca = inventory.canCraft(a, hasTable, isCreative) ? 1 : 0;
      const cb = inventory.canCraft(b, hasTable, isCreative) ? 1 : 0;
      return cb - ca;
    });

    for (const r of filtered) {
      const canCraft = inventory.canCraft(r, hasTable, isCreative);
      const outDef = getItemDef(r.result.id);

      const card = document.createElement('div');
      card.className = `recipe-card ${canCraft ? 'craftable' : ''}`;

      const main = document.createElement('div');
      main.className = 'recipe-main';

      const icon = document.createElement('img');
      icon.className = 'recipe-icon';
      icon.src = this.textures.iconUrls[r.result.id] || '';
      icon.alt = outDef.name;

      const info = document.createElement('div');
      info.className = 'recipe-info';
      const title = document.createElement('strong');
      title.textContent = r.result.count > 1 ? `${outDef.name} ×${r.result.count}` : outDef.name;

      const ingsRow = document.createElement('div');
      ingsRow.className = 'recipe-ings';

      if (r.station === 'table' && !hasTable && !isCreative) {
        const stPill = document.createElement('span');
        stPill.className = 'ing-pill station-req';
        stPill.textContent = 'Needs Crafting Table';
        ingsRow.appendChild(stPill);
      }

      for (const ing of r.ingredients) {
        const have = ing.ids ? inventory.countGroup(ing.ids) : inventory.countItem(ing.id);
        const label = ing.label || getItemDef(ing.id).name;
        const pill = document.createElement('span');
        pill.className = `ing-pill ${have >= ing.count || isCreative ? 'ok' : ''}`;
        pill.textContent = `${Math.min(have, 999)}/${ing.count} ${label}`;
        ingsRow.appendChild(pill);
      }

      info.append(title, ingsRow);
      main.append(icon, info);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-craft-action';
      btn.disabled = !canCraft;
      btn.textContent = 'Craft';
      btn.addEventListener('click', () => {
        this.callbacks.onCraftRecipe(r);
      });

      card.addEventListener('mouseenter', () => {
        this.el.itemInspector.textContent = `${outDef.name}: ${r.desc}`;
      });

      card.append(main, btn);
      this.el.recipeList.appendChild(card);
    }
  }

  renderSmeltingList(context) {
    const { inventory, hasFurnace, isCreative } = context;
    this.el.smeltList.innerHTML = '';

    if (!hasFurnace && !isCreative) {
      this.el.furnaceStatusBar.textContent =
        'Place a Stone Furnace (8 Cobblestone at a Crafting Table) nearby to smelt ores, sand, clay, and food.';
    } else {
      const totalFuel = inventory.getTotalFuelPotential();
      this.el.furnaceStatusBar.textContent = isCreative
        ? 'Creative Mode: Instant smelting active.'
        : `Furnace Ready · Stored Heat: ${inventory.furnaceFuelCharges.toFixed(1)} · Total Fuel Available: ${totalFuel.toFixed(1)} smelts (Coal, Planks, Logs, Sticks)`;
    }

    for (const sr of SMELTING_RECIPES) {
      const canSmelt = inventory.canSmelt(sr, hasFurnace, isCreative);
      const inDef = getItemDef(sr.input);
      const outDef = getItemDef(sr.output.id);
      const haveIn = inventory.countItem(sr.input);

      const card = document.createElement('div');
      card.className = `recipe-card ${canSmelt ? 'craftable' : ''}`;

      const main = document.createElement('div');
      main.className = 'recipe-main';

      const icon = document.createElement('img');
      icon.className = 'recipe-icon';
      icon.src = this.textures.iconUrls[sr.output.id] || '';
      icon.alt = outDef.name;

      const info = document.createElement('div');
      info.className = 'recipe-info';
      const title = document.createElement('strong');
      title.textContent = outDef.name;

      const ings = document.createElement('div');
      ings.className = 'recipe-ings';
      const p1 = document.createElement('span');
      p1.className = `ing-pill ${haveIn >= 1 || isCreative ? 'ok' : ''}`;
      p1.textContent = `${haveIn}/1 ${inDef.name}`;
      ings.appendChild(p1);

      info.append(title, ings);
      main.append(icon, info);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-craft-action';
      btn.disabled = !canSmelt;
      btn.textContent = 'Smelt';
      btn.addEventListener('click', () => {
        this.callbacks.onSmeltRecipe(sr);
      });

      card.addEventListener('mouseenter', () => {
        this.el.itemInspector.textContent = sr.desc;
      });

      card.append(main, btn);
      this.el.smeltList.appendChild(card);
    }
  }

  renderCreativeCatalog(context) {
    const { inventory } = context;
    this.el.catalogGrid.innerHTML = '';

    for (const key of Object.keys(REGISTRY)) {
      const id = Number(key);
      if (id === BLOCK.AIR || id === BLOCK.WATER || id === BLOCK.LAVA || id === BLOCK.BEDROCK) continue;
      const def = REGISTRY[id];
      const slot = this.createSlotElement({ id, count: 1 }, 0);
      slot.addEventListener('click', () => {
        const giveCount = def.maxStack === 1 ? 1 : 64;
        inventory.addItem(id, giveCount);
        this.refreshWorkshop(context);
        this.renderHotbar(inventory);
        this.showToast(`Added ${def.name}`);
      });
      slot.addEventListener('mouseenter', () => {
        this.el.itemInspector.textContent = `Click to add ${def.name} to pack`;
      });
      this.el.catalogGrid.appendChild(slot);
    }
  }

  openPauseModal(worldMeta) {
    this.el.pauseTitle.textContent = worldMeta.name;
    this.el.pauseSub.textContent = `${worldMeta.mode === GAME_MODES.CREATIVE ? 'Creative' : 'Survival'} · Seed: ${worldMeta.seed}`;
    this.el.pauseModal.classList.remove('hidden');
  }

  closePauseModal() {
    this.el.pauseModal.classList.add('hidden');
    this.el.controlsModal.classList.add('hidden');
  }

  showRespawnModal(reason) {
    this.el.respawnReason.textContent = reason || 'Defeated in the wilderness.';
    this.el.respawnModal.classList.remove('hidden');
  }

  hideRespawnModal() {
    this.el.respawnModal.classList.add('hidden');
  }
}
