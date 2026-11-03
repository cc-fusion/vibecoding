import { BLOCK, getDef } from '../world/blocks.js';
import { HOTBAR_SIZE, TOTAL_SLOTS } from '../gameplay/inventory.js';
import { RECIPES, CREATIVE_PALETTE } from '../gameplay/recipes.js';

export class UIManager {
  constructor(game) {
    this.game = game;

    // Elements
    this.hudEl = document.getElementById('hud');
    this.skyIconEl = document.getElementById('hud-sky-icon');
    this.dayClockEl = document.getElementById('hud-day-clock');
    this.biomeEl = document.getElementById('hud-biome');
    this.coordsEl = document.getElementById('hud-coords');
    this.modeBadgeEl = document.getElementById('hud-mode-badge');
    this.debugPanelEl = document.getElementById('debug-panel');
    this.toastContainerEl = document.getElementById('toast-container');

    this.miningBarWrap = document.getElementById('mining-bar-wrap');
    this.miningBarFill = document.getElementById('mining-bar-fill');
    this.contextHintEl = document.getElementById('context-hint');

    this.activeBannerEl = document.getElementById('active-item-banner');
    this.vitalsRowEl = document.getElementById('vitals-row');
    this.heartsBarEl = document.getElementById('hearts-bar');
    this.hungerBarEl = document.getElementById('hunger-bar');
    this.oxygenBarEl = document.getElementById('oxygen-bar');
    this.hotbarEl = document.getElementById('hotbar');

    this.invModalEl = document.getElementById('inventory-modal');
    this.stationBadgeEl = document.getElementById('station-badge');
    this.backpackGridEl = document.getElementById('backpack-grid');
    this.invHotbarGridEl = document.getElementById('inv-hotbar-grid');
    this.slotTooltipEl = document.getElementById('slot-tooltip');
    this.recipeListEl = document.getElementById('recipe-list');
    this.chkCraftableEl = document.getElementById('chk-craftable-only');
    this.creativeTabBtn = document.getElementById('tab-creative-palette');
    this.craftableFilterWrap = document.getElementById('craftable-filter-wrap');
    this.btnDropHeld = document.getElementById('btn-drop-held');

    this.cursorSlotEl = document.getElementById('cursor-slot');
    this.cursorImgEl = document.getElementById('cursor-slot-img');
    this.cursorCountEl = document.getElementById('cursor-slot-count');

    this.menuOverlayEl = document.getElementById('menu-overlay');
    this.activeSessionBarEl = document.getElementById('active-session-bar');
    this.savedWorldsSectionEl = document.getElementById('saved-worlds-section');
    this.savedWorldsListEl = document.getElementById('saved-worlds-list');
    this.respawnModalEl = document.getElementById('respawn-modal');

    this.cursorItem = null;
    this.activeCategory = 'all';
    this.nearWorkbench = false;
    this.nearFurnace = false;
    this.bannerTimer = 0;
    this.lastActiveItemId = null;
    this.showDebug = false;

    // Cache strings to avoid redundant DOM writes
    this.prevVitalsKey = '';
    this.prevClockText = '';
    this.prevCoordsText = '';
    this.prevBiomeText = '';

    this.bindEvents();
  }

  bindEvents() {
    // Menu tabs
    document.querySelectorAll('.menu-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.game.sound.playUiClick();
        document.querySelectorAll('.menu-tab').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        document.getElementById('tab-worlds').classList.toggle('hidden', tab !== 'worlds');
        document.getElementById('tab-settings').classList.toggle('hidden', tab !== 'settings');
        document.getElementById('tab-controls').classList.toggle('hidden', tab !== 'controls');
      });
    });

    // New World mode selector
    this.selectedNewMode = 'survival';
    document.querySelectorAll('.mode-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.game.sound.playUiClick();
        document.querySelectorAll('.mode-option').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedNewMode = btn.dataset.mode;
      });
    });

    // Random Seed button
    document.getElementById('btn-random-seed').addEventListener('click', () => {
      this.game.sound.playUiClick();
      const words = ['AmberPeak', 'FrostVale', 'CedarCove', 'Sunstone', 'CrystalDeep', 'Mistyfjord', 'Wildbloom'];
      const pick = words[Math.floor(Math.random() * words.length)] + '-' + Math.floor(100 + Math.random() * 900);
      document.getElementById('inp-world-seed').value = pick;
    });

    // Create World button
    document.getElementById('btn-create-world').addEventListener('click', () => {
      this.game.sound.playUiClick();
      const name = document.getElementById('inp-world-name').value.trim() || 'Untitled World';
      const seed = document.getElementById('inp-world-seed').value.trim() || `Seed-${Math.floor(10000 + Math.random() * 90000)}`;
      this.game.startNewWorld({ name, seed, mode: this.selectedNewMode });
    });

    // Resume & Save buttons
    document.getElementById('btn-resume-game').addEventListener('click', () => {
      this.game.sound.playUiClick();
      this.game.resumeGameplay();
    });

    document.getElementById('btn-save-world').addEventListener('click', async () => {
      this.game.sound.playUiClick();
      await this.game.saveCurrentWorld(true);
      await this.refreshSavedWorldsList();
    });

    // Top HUD quick buttons
    document.getElementById('btn-open-inv').addEventListener('click', (e) => {
      e.stopPropagation();
      this.openInventory();
    });

    document.getElementById('btn-open-menu').addEventListener('click', (e) => {
      e.stopPropagation();
      this.openPauseMenu();
    });

    this.modeBadgeEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const next = this.game.player.mode === 'survival' ? 'creative' : 'survival';
      this.game.setGameMode(next);
    });

    // Close Inventory
    document.getElementById('btn-close-inv').addEventListener('click', () => {
      this.closeInventory(true);
    });

    this.invModalEl.addEventListener('click', (e) => {
      if (e.target === this.invModalEl) this.closeInventory(true);
    });

    this.btnDropHeld.addEventListener('click', () => {
      if (this.cursorItem) {
        this.game.tossItemStack(this.cursorItem);
        this.setCursorItem(null);
      }
    });

    // Crafting Category Tabs
    document.querySelectorAll('.cat-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.game.sound.playUiClick();
        document.querySelectorAll('.cat-tab').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeCategory = btn.dataset.cat;
        this.craftableFilterWrap.classList.toggle('hidden', this.activeCategory === 'palette');
        this.renderCraftingPanel();
      });
    });

    this.chkCraftableEl.addEventListener('change', () => {
      this.renderCraftingPanel();
    });

    // Track mouse for floating cursor slot
    window.addEventListener('mousemove', (e) => {
      if (this.cursorItem) {
        this.cursorSlotEl.style.left = `${e.clientX}px`;
        this.cursorSlotEl.style.top = `${e.clientY}px`;
      }
    });

    // Settings controls
    document.getElementById('set-mode-survival').addEventListener('click', () => this.game.setGameMode('survival'));
    document.getElementById('set-mode-creative').addEventListener('click', () => this.game.setGameMode('creative'));

    const rngDist = document.getElementById('rng-render-dist');
    rngDist.addEventListener('input', () => {
      const v = Number(rngDist.value);
      document.getElementById('lbl-render-dist').textContent = `${v} chunks`;
      this.game.setRenderDistance(v);
    });

    const rngVol = document.getElementById('rng-volume');
    rngVol.addEventListener('input', () => {
      const v = Number(rngVol.value);
      document.getElementById('lbl-volume').textContent = `${v}%`;
      this.game.setVolume(v / 100);
    });

    const rngSens = document.getElementById('rng-sens');
    rngSens.addEventListener('input', () => {
      const v = Number(rngSens.value);
      document.getElementById('lbl-sens').textContent = `${v}%`;
      this.game.setSensitivity(v / 100);
    });

    const rngFov = document.getElementById('rng-fov');
    rngFov.addEventListener('input', () => {
      const v = Number(rngFov.value);
      document.getElementById('lbl-fov').textContent = `${v}°`;
      this.game.setFov(v);
    });

    document.querySelectorAll('.env-time-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.game.sound.playUiClick();
        if (this.game.sky) {
          this.game.sky.setTimePreset(btn.dataset.time);
          this.showToast(`Time set to ${btn.textContent}`);
        }
      });
    });

    document.getElementById('btn-toggle-weather').addEventListener('click', () => {
      this.game.sound.playUiClick();
      if (this.game.sky) {
        const w = this.game.sky.toggleWeather();
        this.showToast(w === 'rain' ? 'Precipitation started' : 'Skies cleared');
      }
    });

    // Respawn
    document.getElementById('btn-respawn').addEventListener('click', () => {
      this.respawnModalEl.classList.add('hidden');
      this.game.respawnPlayer();
    });
  }

  async refreshSavedWorldsList() {
    const worlds = await this.game.saveManager.listWorlds();
    if (worlds.length === 0) {
      this.savedWorldsSectionEl.classList.add('hidden');
      this.savedWorldsListEl.innerHTML = '';
      return;
    }

    this.savedWorldsSectionEl.classList.remove('hidden');
    this.savedWorldsListEl.innerHTML = '';

    for (const w of worlds) {
      const row = document.createElement('div');
      row.className = 'saved-world-item';

      const dateStr = w.updatedAt ? new Date(w.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
      const modeLabel = w.mode === 'creative' ? 'Creative' : 'Survival';

      const meta = document.createElement('div');
      meta.className = 'saved-world-meta';
      const title = document.createElement('strong');
      title.textContent = w.name;
      const sub = document.createElement('span');
      sub.textContent = `${modeLabel} · Day ${w.dayNumber || 1} · Seed: ${w.seed}${dateStr ? ` · ${dateStr}` : ''}`;
      meta.append(title, sub);

      const actions = document.createElement('div');
      actions.className = 'saved-world-actions';

      const playBtn = document.createElement('button');
      playBtn.className = 'small-play-btn';
      playBtn.textContent = 'Play';
      playBtn.addEventListener('click', () => {
        this.game.sound.playUiClick();
        this.game.loadSavedWorld(w.id);
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'small-del-btn';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async () => {
        this.game.sound.playUiClick();
        await this.game.saveManager.deleteWorld(w.id);
        await this.refreshSavedWorldsList();
      });

      actions.append(playBtn, delBtn);
      row.append(meta, actions);
      this.savedWorldsListEl.appendChild(row);
    }
  }

  syncModeButtons(mode) {
    const isCreative = mode === 'creative';
    document.getElementById('set-mode-survival').classList.toggle('active', !isCreative);
    document.getElementById('set-mode-creative').classList.toggle('active', isCreative);
    this.creativeTabBtn.classList.toggle('hidden', !isCreative);
    this.vitalsRowEl.classList.toggle('hidden', isCreative);
  }

  openPauseMenu() {
    if (!this.invModalEl.classList.contains('hidden')) {
      this.closeInventory(false);
    }
    document.exitPointerLock?.();
    this.activeSessionBarEl.classList.toggle('hidden', !this.game.hasActiveWorld);
    this.menuOverlayEl.classList.remove('hidden');
    this.refreshSavedWorldsList();
  }

  hideMenusForGameplay() {
    this.menuOverlayEl.classList.add('hidden');
    this.invModalEl.classList.add('hidden');
    this.respawnModalEl.classList.add('hidden');
    this.hudEl.classList.remove('hidden');
  }

  openInventory(preferredCategory = null) {
    if (!this.game.hasActiveWorld) return;
    document.exitPointerLock?.();
    this.game.sound.playUiClick();

    // Detect nearby stations
    const p = this.game.player.pos;
    this.nearWorkbench = this.game.world.hasNearbyBlock(p.x, p.y + 0.8, p.z, 4.6, BLOCK.CRAFTING_TABLE);
    this.nearFurnace = this.game.world.hasNearbyBlock(p.x, p.y + 0.8, p.z, 4.6, BLOCK.FURNACE);

    this.stationBadgeEl.className = 'station-badge';
    if (this.nearFurnace && preferredCategory === 'smelting') {
      this.stationBadgeEl.textContent = 'Furnace Active · Smelting Ready';
      this.stationBadgeEl.classList.add('furnace');
    } else if (this.nearWorkbench && this.nearFurnace) {
      this.stationBadgeEl.textContent = 'Workbench & Furnace Nearby';
      this.stationBadgeEl.classList.add('workbench');
    } else if (this.nearWorkbench) {
      this.stationBadgeEl.textContent = 'Workbench Nearby · Advanced Recipes Ready';
      this.stationBadgeEl.classList.add('workbench');
    } else if (this.nearFurnace) {
      this.stationBadgeEl.textContent = 'Furnace Nearby · Smelting Ready';
      this.stationBadgeEl.classList.add('furnace');
    } else {
      this.stationBadgeEl.textContent = 'Hand Crafting';
    }

    if (preferredCategory) {
      this.activeCategory = preferredCategory;
      document.querySelectorAll('.cat-tab').forEach((b) => {
        b.classList.toggle('active', b.dataset.cat === preferredCategory);
      });
      this.craftableFilterWrap.classList.toggle('hidden', preferredCategory === 'palette');
    } else if (this.game.player.mode === 'creative' && this.activeCategory === 'all') {
      // Keep current tab, creative palette tab is available
    }

    this.syncModeButtons(this.game.player.mode);
    this.renderInventoryGrids();
    this.renderCraftingPanel();
    this.invModalEl.classList.remove('hidden');
  }

  closeInventory(resumePointerLock = true) {
    if (this.cursorItem) {
      const rem = this.game.inventory.addItem(this.cursorItem.id, this.cursorItem.count, this.cursorItem.durability);
      if (rem > 0) {
        this.game.tossItemStack({ ...this.cursorItem, count: rem });
      }
      this.setCursorItem(null);
    }
    this.invModalEl.classList.add('hidden');
    if (resumePointerLock && this.game.hasActiveWorld) {
      this.game.requestPointerLockSafe();
    }
  }

  isModalOpen() {
    return (
      !this.menuOverlayEl.classList.contains('hidden') ||
      !this.invModalEl.classList.contains('hidden') ||
      !this.respawnModalEl.classList.contains('hidden')
    );
  }

  setCursorItem(item) {
    this.cursorItem = item;
    if (!item) {
      this.cursorSlotEl.classList.add('hidden');
      this.btnDropHeld.classList.add('hidden');
      return;
    }
    this.cursorImgEl.src = this.game.textures.getIconUrl(item.id);
    this.cursorCountEl.textContent = item.count > 1 ? String(item.count) : '';
    this.cursorSlotEl.classList.remove('hidden');
    this.btnDropHeld.classList.remove('hidden');
  }

  createSlotElement(slotData, slotIndex, isHudHotbar = false) {
    const el = document.createElement('div');
    el.className = 'slot';
    if (isHudHotbar && slotIndex === this.game.inventory.selectedHotbar) {
      el.classList.add('active');
    }

    if (isHudHotbar) {
      const keyLbl = document.createElement('span');
      keyLbl.className = 'slot-key';
      keyLbl.textContent = String(slotIndex + 1);
      el.appendChild(keyLbl);
    }

    if (slotData) {
      const def = getDef(slotData.id);
      const img = document.createElement('img');
      img.src = this.game.textures.getIconUrl(slotData.id);
      img.alt = def.name;
      el.appendChild(img);

      if (slotData.count > 1) {
        const cnt = document.createElement('span');
        cnt.className = 'slot-count';
        cnt.textContent = String(slotData.count);
        el.appendChild(cnt);
      }

      if (slotData.durability != null && def.maxDurability > 0 && slotData.durability < def.maxDurability) {
        const bar = document.createElement('div');
        bar.className = 'slot-durability';
        const fill = document.createElement('div');
        fill.className = 'slot-durability-fill';
        const pct = Math.max(0, Math.min(100, (slotData.durability / def.maxDurability) * 100));
        fill.style.width = `${pct}%`;
        fill.style.background = pct > 50 ? '#52c46b' : pct > 22 ? '#f5b642' : '#eb5757';
        bar.appendChild(fill);
        el.appendChild(bar);
      }
    }

    if (isHudHotbar) {
      el.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.game.inventory.selectHotbar(slotIndex);
      });
    } else {
      el.addEventListener('mouseenter', () => {
        if (slotData) {
          const def = getDef(slotData.id);
          const extra = def.food
            ? `Restores +${def.food} hunger`
            : def.attackDamage > 1
            ? `Damage: ${def.attackDamage}`
            : def.light > 0
            ? `Light level ${def.light}`
            : '';
          this.slotTooltipEl.innerHTML = `<strong>${def.name}</strong><span>${extra}</span>`;
        } else {
          this.slotTooltipEl.textContent = 'Empty slot';
        }
      });

      el.addEventListener('contextmenu', (e) => e.preventDefault());
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.handleModalSlotClick(slotIndex, e.button === 2, e.shiftKey);
      });
    }

    return el;
  }

  handleModalSlotClick(idx, rightClick, shiftKey) {
    const inv = this.game.inventory;
    this.game.sound.playUiClick();

    if (shiftKey && !this.cursorItem) {
      inv.quickMove(idx);
      this.renderInventoryGrids();
      this.renderCraftingPanel();
      return;
    }

    const slot = inv.slots[idx];

    if (!this.cursorItem) {
      if (!slot) return;
      if (rightClick && slot.count > 1) {
        const half = Math.ceil(slot.count / 2);
        slot.count -= half;
        this.setCursorItem({ id: slot.id, count: half, durability: slot.durability });
      } else {
        inv.slots[idx] = null;
        this.setCursorItem(slot);
      }
      inv.notify();
    } else {
      const def = getDef(this.cursorItem.id);
      const maxStack = def.stackSize || 64;

      if (!slot) {
        if (rightClick && this.cursorItem.count > 1) {
          inv.slots[idx] = { id: this.cursorItem.id, count: 1, durability: this.cursorItem.durability };
          this.cursorItem.count -= 1;
          this.setCursorItem(this.cursorItem);
        } else {
          inv.slots[idx] = this.cursorItem;
          this.setCursorItem(null);
        }
      } else if (slot.id === this.cursorItem.id && maxStack > 1 && slot.count < maxStack) {
        const add = Math.min(maxStack - slot.count, rightClick ? 1 : this.cursorItem.count);
        slot.count += add;
        this.cursorItem.count -= add;
        this.setCursorItem(this.cursorItem.count > 0 ? this.cursorItem : null);
      } else {
        // Swap
        inv.slots[idx] = this.cursorItem;
        this.setCursorItem(slot);
      }
      inv.notify();
    }

    this.renderInventoryGrids();
    this.renderCraftingPanel();
  }

  renderHotbar() {
    this.hotbarEl.innerHTML = '';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      this.hotbarEl.appendChild(this.createSlotElement(this.game.inventory.slots[i], i, true));
    }

    const active = this.game.inventory.getActiveSlot();
    const activeId = active ? active.id : 0;
    if (activeId !== this.lastActiveItemId) {
      this.lastActiveItemId = activeId;
      if (activeId) {
        this.activeBannerEl.textContent = getDef(activeId).name;
        this.activeBannerEl.classList.add('visible');
        this.bannerTimer = 2.1;
      } else {
        this.activeBannerEl.classList.remove('visible');
      }
    }
  }

  renderInventoryGrids() {
    this.backpackGridEl.innerHTML = '';
    for (let i = HOTBAR_SIZE; i < TOTAL_SLOTS; i++) {
      this.backpackGridEl.appendChild(this.createSlotElement(this.game.inventory.slots[i], i, false));
    }

    this.invHotbarGridEl.innerHTML = '';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      this.invHotbarGridEl.appendChild(this.createSlotElement(this.game.inventory.slots[i], i, false));
    }
  }

  renderCraftingPanel() {
    this.recipeListEl.innerHTML = '';
    const inv = this.game.inventory;
    const isCreative = this.game.player.mode === 'creative';

    // Creative Block Palette View
    if (this.activeCategory === 'palette' && isCreative) {
      const grid = document.createElement('div');
      grid.className = 'palette-grid';
      for (const id of CREATIVE_PALETTE) {
        const def = getDef(id);
        const btn = document.createElement('div');
        btn.className = 'slot';
        btn.title = def.name;
        const img = document.createElement('img');
        img.src = this.game.textures.getIconUrl(id);
        img.alt = def.name;
        btn.appendChild(img);
        btn.addEventListener('click', () => {
          this.game.sound.playPickup();
          const stack = def.stackSize > 1 ? 64 : 1;
          inv.addItem(id, stack);
          this.renderInventoryGrids();
          this.showToast(`Added ${def.name}`);
        });
        grid.appendChild(btn);
      }
      this.recipeListEl.appendChild(grid);
      return;
    }

    const craftableOnly = this.chkCraftableEl.checked;

    for (const rec of RECIPES) {
      if (this.activeCategory !== 'all' && rec.category !== this.activeCategory) continue;

      const stationOk =
        isCreative ||
        rec.station === 'hand' ||
        (rec.station === 'workbench' && this.nearWorkbench) ||
        (rec.station === 'furnace' && this.nearFurnace);

      const matsOk = isCreative || inv.hasIngredients(rec.ingredients);
      const canCraft = stationOk && matsOk;

      if (craftableOnly && !canCraft) continue;

      const outDef = getDef(rec.outId);
      const card = document.createElement('div');
      card.className = `recipe-card${canCraft ? ' craftable' : ''}`;

      const iconBox = document.createElement('div');
      iconBox.className = 'recipe-icon-box';
      const img = document.createElement('img');
      img.src = this.game.textures.getIconUrl(rec.outId);
      img.alt = outDef.name;
      iconBox.appendChild(img);
      if (rec.outCount > 1) {
        const cnt = document.createElement('span');
        cnt.className = 'slot-count';
        cnt.textContent = `×${rec.outCount}`;
        iconBox.appendChild(cnt);
      }

      const info = document.createElement('div');
      info.className = 'recipe-info';

      const titleRow = document.createElement('div');
      titleRow.className = 'recipe-title-row';
      const title = document.createElement('span');
      title.className = 'recipe-title';
      title.textContent = outDef.name;
      titleRow.appendChild(title);

      if (!stationOk) {
        const tag = document.createElement('span');
        tag.className = 'recipe-req-tag';
        tag.textContent = rec.station === 'furnace' ? 'Needs Furnace nearby' : 'Needs Crafting Table nearby';
        titleRow.appendChild(tag);
      }

      const desc = document.createElement('div');
      desc.className = 'recipe-desc';
      desc.textContent = rec.desc;

      const ingsRow = document.createElement('div');
      ingsRow.className = 'recipe-ings';
      for (const ing of rec.ingredients) {
        const have = inv.countItem(ing.ids);
        const label = ing.label || getDef(ing.ids[0]).name;
        const pill = document.createElement('span');
        pill.className = `ing-pill${have >= ing.count ? ' ok' : ''}`;
        pill.textContent = `${label} (${Math.min(have, 999)}/${ing.count})`;
        ingsRow.appendChild(pill);
      }

      info.append(titleRow, desc, ingsRow);

      const craftBtn = document.createElement('button');
      craftBtn.className = 'craft-btn';
      craftBtn.textContent = rec.station === 'furnace' ? 'Smelt' : 'Craft';
      craftBtn.disabled = !canCraft;
      craftBtn.addEventListener('click', () => {
        if (!isCreative && !inv.consumeIngredients(rec.ingredients)) return;
        const rem = inv.addItem(rec.outId, rec.outCount);
        if (rem > 0) {
          this.game.tossItemStack({ id: rec.outId, count: rem, durability: null });
        }
        this.game.sound.playCraft(rec.station === 'furnace');
        this.game.onItemCrafted(rec.outId);
        this.renderInventoryGrids();
        this.renderCraftingPanel();
      });

      card.append(iconBox, info, craftBtn);
      this.recipeListEl.appendChild(card);
    }

    if (this.recipeListEl.children.length === 0) {
      const empty = document.createElement('div');
      empty.style.padding = '22px';
      empty.style.color = '#9aa7bd';
      empty.style.fontSize = '13px';
      empty.textContent = 'No matching recipes right now — gather wood or uncheck "Craftable" to browse all recipes.';
      this.recipeListEl.appendChild(empty);
    }
  }

  showToast(message) {
    const el = document.createElement('div');
    el.className = 'toast-item';
    el.textContent = message;
    this.toastContainerEl.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.3s ease';
      setTimeout(() => el.remove(), 320);
    }, 3000);
  }

  showRespawnModal() {
    document.exitPointerLock?.();
    this.respawnModalEl.classList.remove('hidden');
  }

  updateHUD(dt, fps) {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.activeBannerEl.classList.remove('visible');
      }
    }

    const player = this.game.player;
    const sky = this.game.sky;
    const world = this.game.world;

    // Sky clock & biome pill
    const isNight = sky.isNight();
    const skyEmoji = sky.weatherIntensity > 0.4 ? '🌧' : isNight ? '🌙' : '☀';
    const clockStr = `Day ${sky.dayNumber} · ${sky.getFormattedClock()}`;
    if (clockStr !== this.prevClockText) {
      this.prevClockText = clockStr;
      this.skyIconEl.textContent = skyEmoji;
      this.dayClockEl.textContent = clockStr;
    }

    const px = Math.floor(player.pos.x);
    const py = Math.floor(player.pos.y);
    const pz = Math.floor(player.pos.z);
    const coordsStr = `${px}, ${py}, ${pz}`;
    if (coordsStr !== this.prevCoordsText) {
      this.prevCoordsText = coordsStr;
      this.coordsEl.textContent = coordsStr;

      const bInfo = world.generator.getBiomeInfoAt(px, pz);
      if (bInfo.name !== this.prevBiomeText) {
        this.prevBiomeText = bInfo.name;
        this.biomeEl.textContent = bInfo.name;
      }
    }

    // Mode pill
    const modeLabel = player.mode === 'creative'
      ? (player.flying ? 'Creative · Flying' : 'Creative')
      : 'Survival';
    if (this.modeBadgeEl.textContent !== modeLabel) {
      this.modeBadgeEl.textContent = modeLabel;
      this.modeBadgeEl.classList.toggle('creative', player.mode === 'creative');
    }

    // Underwater overlay
    document.getElementById('underwater-tint').classList.toggle('hidden', !player.headUnderWater);

    // Vitals in Survival
    if (player.mode === 'survival') {
      const hInt = Math.ceil(player.health);
      const fInt = Math.ceil(player.hunger);
      const oInt = player.headUnderWater || player.oxygen < 9.9 ? Math.ceil(player.oxygen) : -1;
      const key = `${hInt}:${fInt}:${oInt}`;
      if (key !== this.prevVitalsKey) {
        this.prevVitalsKey = key;
        this.renderPips(this.heartsBarEl, hInt, 20, '❤');
        this.renderPips(this.hungerBarEl, fInt, 20, '🍖');
        if (oInt >= 0) {
          this.oxygenBarEl.classList.remove('hidden');
          this.renderPips(this.oxygenBarEl, oInt * 2, 20, '🫧');
        } else {
          this.oxygenBarEl.classList.add('hidden');
        }
      }
    }

    // Optional F3 Debug Panel
    if (this.showDebug) {
      const skyL = world.getSkyLight(px, py + 1, pz);
      const blkL = world.getBlockLight(px, py + 1, pz);
      this.debugPanelEl.innerHTML =
        `FPS: ${fps} | Chunks: ${world.chunks.size} (Q: ${world.genQueue.length}/${world.meshQueue.length})<br>` +
        `Light: sky ${skyL} · block ${blkL} | Mobs: ${this.game.mobs.mobs.length} | Drops: ${this.game.drops.drops.length}<br>` +
        `Seed: ${world.seed}`;
    }
  }

  renderPips(container, value20, max20, symbol) {
    const count = max20 / 2;
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const pip = document.createElement('span');
      const fullVal = (i + 1) * 2;
      if (value20 >= fullVal) {
        pip.className = 'vital-pip';
      } else if (value20 === fullVal - 1) {
        pip.className = 'vital-pip half';
      } else {
        pip.className = 'vital-pip empty';
      }
      pip.textContent = symbol;
      container.appendChild(pip);
    }
  }

  updateTargetFeedback(miningRatio, contextText) {
    if (miningRatio > 0.01) {
      this.miningBarWrap.classList.remove('hidden');
      this.miningBarFill.style.width = `${Math.min(100, miningRatio * 100)}%`;
    } else {
      this.miningBarWrap.classList.add('hidden');
    }

    if (contextText) {
      this.contextHintEl.textContent = contextText;
      this.contextHintEl.classList.remove('hidden');
    } else {
      this.contextHintEl.classList.add('hidden');
    }
  }
}
