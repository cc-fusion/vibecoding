import { BLOCK, REGISTRY, RECIPES } from './constants.js';

export class UIController {
  constructor(game) {
    this.game = game;
    this.selectedInventorySlot = null;
    this.recipeFilter = 'all';
    this.rightTab = 'craft'; // 'craft' | 'catalog'
    this.toastTimer = 0;
    this.hudVisible = true;
    this.controlsExpanded = true;

    this._cacheElements();
    this._bindEvents();
  }

  _cacheElements() {
    this.elTelemetry = document.getElementById('hud-telemetry');
    this.elFps = document.getElementById('stat-fps');
    this.elXyz = document.getElementById('stat-xyz');
    this.elBiome = document.getElementById('stat-biome');
    this.elTime = document.getElementById('stat-time');
    this.elMode = document.getElementById('stat-mode');

    this.elTargetBadge = document.getElementById('target-badge');
    this.elTargetName = document.getElementById('target-name');
    this.elTargetMineBar = document.getElementById('target-mine-fill');

    this.elToast = document.getElementById('hotbar-toast');
    this.elVitalsRow = document.getElementById('vitals-row');
    this.elHearts = document.getElementById('hearts-bar');
    this.elHunger = document.getElementById('hunger-bar');
    this.elXpPill = document.getElementById('xp-pill');
    this.elHotbar = document.getElementById('hotbar-slots');

    this.elUnderwaterOverlay = document.getElementById('underwater-overlay');
    this.elDamageOverlay = document.getElementById('damage-overlay');

    this.elControlsCard = document.getElementById('controls-body');
    this.elControlsToggle = document.getElementById('btn-toggle-controls');

    // Modals
    this.elInventoryModal = document.getElementById('inventory-modal');
    this.elPauseModal = document.getElementById('pause-modal');

    // Inventory modal elements
    this.elBackpackGrid = document.getElementById('backpack-grid');
    this.elModalHotbarGrid = document.getElementById('modal-hotbar-grid');
    this.elRecipeList = document.getElementById('recipe-list');
    this.elCatalogGrid = document.getElementById('catalog-grid');
    this.elCraftPanel = document.getElementById('craft-panel');
    this.elCatalogPanel = document.getElementById('catalog-panel');

    // Pause / World elements
    this.elWorldSlots = document.getElementById('world-slots-list');
    this.elSeedInput = document.getElementById('new-world-seed');
    this.elRenderDistSlider = document.getElementById('slider-render-dist');
    this.elRenderDistVal = document.getElementById('val-render-dist');
    this.elVolumeSlider = document.getElementById('slider-volume');
    this.elVolumeVal = document.getElementById('val-volume');
  }

  _bindEvents() {
    // Quick top-right HUD buttons
    document.getElementById('btn-open-inventory')?.addEventListener('click', () => {
      this.toggleInventoryModal();
    });
    document.getElementById('btn-open-pause')?.addEventListener('click', () => {
      this.togglePauseModal();
    });

    // Controls helper toggle
    this.elControlsToggle?.addEventListener('click', () => {
      this.controlsExpanded = !this.controlsExpanded;
      if (this.elControlsCard) {
        this.elControlsCard.style.display = this.controlsExpanded ? 'grid' : 'none';
      }
    });

    // Close modal buttons
    document.getElementById('btn-close-inventory')?.addEventListener('click', () => {
      this.closeAllModals(true);
    });
    document.getElementById('btn-resume-game')?.addEventListener('click', () => {
      this.closeAllModals(true);
    });

    // Right panel tabs in Inventory Modal (Crafting vs Creative Catalog)
    document.querySelectorAll('[data-inv-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.rightTab = btn.getAttribute('data-inv-tab');
        document.querySelectorAll('[data-inv-tab]').forEach((b) => b.classList.toggle('active', b === btn));
        if (this.elCraftPanel && this.elCatalogPanel) {
          this.elCraftPanel.style.display = this.rightTab === 'craft' ? 'flex' : 'none';
          this.elCatalogPanel.style.display = this.rightTab === 'catalog' ? 'flex' : 'none';
        }
        this.renderInventoryModal();
      });
    });

    // Recipe category filter buttons
    document.querySelectorAll('[data-recipe-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.recipeFilter = btn.getAttribute('data-recipe-filter');
        document.querySelectorAll('[data-recipe-filter]').forEach((b) => b.classList.toggle('active', b === btn));
        this.renderRecipes();
      });
    });

    // Pause Modal quick environment buttons
    document.querySelectorAll('[data-set-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-set-mode');
        this.game.setGameMode(mode);
        this.renderPauseModal();
        this.updateHUD();
      });
    });

    document.querySelectorAll('[data-set-time]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = parseFloat(btn.getAttribute('data-set-time'));
        this.game.sky.timeOfDay = t;
        this.updateHUD();
      });
    });

    document.querySelectorAll('[data-set-weather]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const w = btn.getAttribute('data-set-weather');
        this.game.sky.setWeather(w);
        this.renderPauseModal();
      });
    });

    document.querySelectorAll('[data-teleport-biome]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const biomeId = btn.getAttribute('data-teleport-biome');
        this.game.teleportToBiome(biomeId);
        this.closeAllModals(true);
      });
    });

    // Render distance & volume sliders
    this.elRenderDistSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.game.world.renderDistance = val;
      if (this.elRenderDistVal) this.elRenderDistVal.textContent = `${val} Chunks`;
    });

    this.elVolumeSlider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.game.audio.volume = val / 100;
      this.game.audio.enabled = val > 0;
      if (this.elVolumeVal) this.elVolumeVal.textContent = `${val}%`;
    });

    // New World with Seed button
    document.getElementById('btn-generate-seed')?.addEventListener('click', () => {
      const seedVal = (this.elSeedInput?.value || '').trim() || `REALM_${Math.floor(Math.random() * 9999)}`;
      this.game.createNewWorldInActiveSlot(seedVal);
      this.closeAllModals(true);
    });

    // Preset seed chips
    document.querySelectorAll('[data-preset-seed]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const seed = btn.getAttribute('data-preset-seed');
        if (this.elSeedInput) this.elSeedInput.value = seed;
      });
    });

    // Export / Import JSON buttons
    document.getElementById('btn-export-world')?.addEventListener('click', () => {
      this.game.exportCurrentWorldJSON();
    });

    const fileInput = document.getElementById('input-import-world');
    document.getElementById('btn-import-world')?.addEventListener('click', () => {
      fileInput?.click();
    });
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        this.game.importWorldJSONFile(file);
        e.target.value = '';
      }
    });
  }

  isAnyModalOpen() {
    return (
      !this.elInventoryModal?.classList.contains('hidden') ||
      !this.elPauseModal?.classList.contains('hidden')
    );
  }

  toggleInventoryModal() {
    const isHidden = this.elInventoryModal.classList.contains('hidden');
    if (isHidden) {
      this.elPauseModal.classList.add('hidden');
      this.elInventoryModal.classList.remove('hidden');
      this.selectedInventorySlot = null;
      if (document.pointerLockElement) document.exitPointerLock?.();
      this.renderInventoryModal();
    } else {
      this.closeAllModals(true);
    }
  }

  togglePauseModal() {
    const isHidden = this.elPauseModal.classList.contains('hidden');
    if (isHidden) {
      this.elInventoryModal.classList.add('hidden');
      this.elPauseModal.classList.remove('hidden');
      if (document.pointerLockElement) document.exitPointerLock?.();
      this.renderPauseModal();
    } else {
      this.closeAllModals(true);
    }
  }

  closeAllModals(requestLock = false) {
    this.elInventoryModal?.classList.add('hidden');
    this.elPauseModal?.classList.add('hidden');
    this.selectedInventorySlot = null;
    this.renderHotbar();
    if (requestLock) {
      this.game.requestPointerLockSafe();
    }
  }

  showHotbarToast(text) {
    if (!this.elToast) return;
    this.elToast.textContent = text || '';
    this.elToast.classList.add('visible');
    this.toastTimer = 1.8;
  }

  renderHotbar() {
    if (!this.elHotbar) return;
    const inv = this.game.inventory;
    const icons = this.game.textures.iconUrls;

    this.elHotbar.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const slotData = inv.slots[i];
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `hotbar-slot ${inv.selectedHotbar === i ? 'selected' : ''}`;
      cell.title = slotData ? REGISTRY[slotData.id]?.name : `Slot ${i + 1}`;

      const keySpan = document.createElement('span');
      keySpan.className = 'slot-key';
      keySpan.textContent = String(i + 1);
      cell.appendChild(keySpan);

      if (slotData && REGISTRY[slotData.id]) {
        const def = REGISTRY[slotData.id];
        const img = document.createElement('img');
        img.src = icons[slotData.id];
        img.alt = def.name;
        img.className = 'slot-icon';
        cell.appendChild(img);

        if (slotData.count > 1) {
          const countSpan = document.createElement('span');
          countSpan.className = 'slot-count';
          countSpan.textContent = String(slotData.count);
          cell.appendChild(countSpan);
        }

        if (def.isTool && typeof slotData.durability === 'number') {
          const ratio = Math.max(0, Math.min(1, slotData.durability / def.durability));
          const durWrap = document.createElement('div');
          durWrap.className = 'durability-bar';
          const durFill = document.createElement('div');
          durFill.className = 'durability-fill';
          durFill.style.width = `${Math.round(ratio * 100)}%`;
          durFill.style.backgroundColor = ratio > 0.5 ? '#4ade80' : ratio > 0.25 ? '#facc15' : '#ef4444';
          durWrap.appendChild(durFill);
          cell.appendChild(durWrap);
        }
      }

      cell.addEventListener('click', () => {
        const heldDef = inv.selectSlot(i);
        this.game.player.rebuildHeldMesh();
        this.renderHotbar();
        if (heldDef) this.showHotbarToast(heldDef.name);
      });

      this.elHotbar.appendChild(cell);
    }
  }

  updateVitals() {
    const p = this.game.player;
    if (!this.elVitalsRow) return;

    if (p.mode === 'creative') {
      this.elVitalsRow.style.display = 'none';
      return;
    }
    this.elVitalsRow.style.display = 'flex';

    // Hearts (10 hearts = 20 health)
    if (this.elHearts) {
      let heartsHtml = '';
      const fullHearts = Math.floor(p.health / 2);
      const halfHeart = p.health % 2 >= 1;
      for (let i = 0; i < 10; i++) {
        if (i < fullHearts) {
          heartsHtml += '<span class="vital-pip heart-full">♥</span>';
        } else if (i === fullHearts && halfHeart) {
          heartsHtml += '<span class="vital-pip heart-half">♥</span>';
        } else {
          heartsHtml += '<span class="vital-pip heart-empty">♡</span>';
        }
      }
      this.elHearts.innerHTML = heartsHtml;
    }

    // Hunger / Stamina (10 pips = 20 hunger)
    if (this.elHunger) {
      let hungerHtml = '';
      const fullPips = Math.ceil(p.hunger / 2);
      for (let i = 0; i < 10; i++) {
        hungerHtml += `<span class="vital-pip ${i < fullPips ? 'hunger-full' : 'hunger-empty'}">◆</span>`;
      }
      this.elHunger.innerHTML = hungerHtml;
    }

    if (this.elXpPill) {
      this.elXpPill.textContent = `Lv ${p.level}`;
    }
  }

  updateHUD(dt = 0, fps = 60) {
    const p = this.game.player;
    const world = this.game.world;
    const sky = this.game.sky;

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0 && this.elToast) {
        this.elToast.classList.remove('visible');
      }
    }

    // Overlays
    if (this.elUnderwaterOverlay) {
      this.elUnderwaterOverlay.style.opacity = p.headInWater ? '1' : '0';
    }
    if (this.elDamageOverlay) {
      this.elDamageOverlay.style.opacity = String(Math.min(0.65, p.damageFlash * 1.8));
    }

    // Telemetry
    if (this.elFps) this.elFps.textContent = `${Math.round(fps)} FPS`;
    if (this.elXyz) {
      this.elXyz.textContent = `${Math.floor(p.position.x)}, ${Math.floor(p.position.y)}, ${Math.floor(p.position.z)}`;
    }
    if (this.elBiome) {
      const biome = world.generator.getBiomeAt(Math.floor(p.position.x), Math.floor(p.position.z));
      this.elBiome.textContent = biome.name;
    }
    if (this.elTime) {
      this.elTime.textContent = `Day ${sky.dayCount} • ${sky.getPhaseLabel()}`;
    }
    if (this.elMode) {
      const flySuffix = p.flying ? ' (Fly)' : '';
      this.elMode.textContent = `${p.mode === 'creative' ? 'Creative' : 'Survival'}${flySuffix}`;
    }

    // Target block badge
    if (p.targetHit && this.elTargetBadge) {
      const def = REGISTRY[p.targetHit.blockId];
      if (def) {
        this.elTargetBadge.classList.remove('hidden');
        let hint = def.name;
        if (p.targetHit.blockId === BLOCK.TNT) hint += ' • Right-Click to Ignite';
        else if (p.targetHit.blockId === BLOCK.CRAFTING_TABLE) hint += ' • Right-Click to Craft';
        else if (def.tool && def.tool !== 'any' && def.tool !== 'none') {
          hint += ` • ${def.tool[0].toUpperCase() + def.tool.slice(1)}`;
        }
        this.elTargetName.textContent = hint;
        if (this.elTargetMineBar) {
          this.elTargetMineBar.style.width = `${Math.min(100, Math.round(p.mineProgress * 100))}%`;
        }
      }
    } else if (this.elTargetBadge) {
      this.elTargetBadge.classList.add('hidden');
    }

    this.updateVitals();
  }

  renderInventoryModal() {
    const inv = this.game.inventory;
    const icons = this.game.textures.iconUrls;

    const createSlotCell = (index) => {
      const slotData = inv.slots[index];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `inv-slot ${this.selectedInventorySlot === index ? 'selected' : ''}`;
      if (slotData && REGISTRY[slotData.id]) {
        const def = REGISTRY[slotData.id];
        btn.title = def.name;
        const img = document.createElement('img');
        img.src = icons[slotData.id];
        img.alt = def.name;
        img.className = 'slot-icon';
        btn.appendChild(img);

        if (slotData.count > 1) {
          const count = document.createElement('span');
          count.className = 'slot-count';
          count.textContent = String(slotData.count);
          btn.appendChild(count);
        }
      }

      btn.addEventListener('click', (e) => {
        if (e.shiftKey && slotData) {
          // Quick transfer between hotbar (0..8) and backpack (9..35)
          const targetRange = index < 9 ? [9, 35] : [0, 8];
          for (let t = targetRange[0]; t <= targetRange[1]; t++) {
            if (!inv.slots[t] || (inv.slots[t].id === slotData.id && inv.slots[t].count < 64)) {
              inv.swapSlots(index, t);
              break;
            }
          }
          this.selectedInventorySlot = null;
          this.renderInventoryModal();
          this.renderHotbar();
          return;
        }

        if (this.selectedInventorySlot === null) {
          if (slotData) {
            this.selectedInventorySlot = index;
            this.renderInventoryModal();
          }
        } else {
          inv.swapSlots(this.selectedInventorySlot, index);
          this.selectedInventorySlot = null;
          this.game.player.rebuildHeldMesh();
          this.renderInventoryModal();
          this.renderHotbar();
        }
      });

      return btn;
    };

    if (this.elBackpackGrid) {
      this.elBackpackGrid.innerHTML = '';
      for (let i = 9; i < 36; i++) {
        this.elBackpackGrid.appendChild(createSlotCell(i));
      }
    }

    if (this.elModalHotbarGrid) {
      this.elModalHotbarGrid.innerHTML = '';
      for (let i = 0; i < 9; i++) {
        this.elModalHotbarGrid.appendChild(createSlotCell(i));
      }
    }

    this.renderRecipes();
    this.renderCatalog();
  }

  renderRecipes() {
    if (!this.elRecipeList) return;
    const inv = this.game.inventory;
    const icons = this.game.textures.iconUrls;

    this.elRecipeList.innerHTML = '';
    const filtered = RECIPES.filter((r) => {
      if (this.recipeFilter === 'craftable') return inv.canCraft(r);
      if (this.recipeFilter === 'all') return true;
      return r.category === this.recipeFilter;
    });

    for (const recipe of filtered) {
      const outDef = REGISTRY[recipe.result.id];
      const craftable = inv.canCraft(recipe);

      const card = document.createElement('div');
      card.className = `recipe-card ${craftable ? 'can-craft' : 'locked'}`;

      const left = document.createElement('div');
      left.className = 'recipe-left';

      const img = document.createElement('img');
      img.src = icons[recipe.result.id];
      img.alt = outDef.name;
      img.className = 'recipe-icon';
      left.appendChild(img);

      const info = document.createElement('div');
      info.className = 'recipe-info';

      const title = document.createElement('div');
      title.className = 'recipe-title';
      title.textContent = `${outDef.name} ×${recipe.result.count}`;
      info.appendChild(title);

      const reqs = document.createElement('div');
      reqs.className = 'recipe-reqs';
      for (const req of recipe.ingredients) {
        const have = inv.getCount(req.id);
        const reqDef = REGISTRY[req.id];
        const span = document.createElement('span');
        span.className = `req-pill ${have >= req.count ? 'ok' : 'missing'}`;
        span.textContent = `${reqDef.name}: ${have}/${req.count}`;
        reqs.appendChild(span);
      }
      info.appendChild(reqs);
      left.appendChild(info);
      card.appendChild(left);

      const craftBtn = document.createElement('button');
      craftBtn.type = 'button';
      craftBtn.className = 'btn-craft-action';
      craftBtn.disabled = !craftable;
      craftBtn.textContent = 'Craft';
      craftBtn.addEventListener('click', () => {
        if (inv.craft(recipe.id)) {
          this.game.audio.playCraft();
          this.game.player.rebuildHeldMesh();
          this.renderInventoryModal();
          this.renderHotbar();
        }
      });
      card.appendChild(craftBtn);

      this.elRecipeList.appendChild(card);
    }
  }

  renderCatalog() {
    if (!this.elCatalogGrid) return;
    const inv = this.game.inventory;
    const icons = this.game.textures.iconUrls;

    this.elCatalogGrid.innerHTML = '';
    for (const [idStr, def] of Object.entries(REGISTRY)) {
      const id = Number(idStr);
      if (id === BLOCK.WATER || id === BLOCK.BEDROCK) continue;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'inv-slot catalog-item';
      btn.title = `${def.name} (Click to add to inventory)`;

      const img = document.createElement('img');
      img.src = icons[id];
      img.alt = def.name;
      img.className = 'slot-icon';
      btn.appendChild(img);

      btn.addEventListener('click', () => {
        const giveCount = def.isTool ? 1 : 16;
        inv.addItem(id, giveCount);
        this.game.audio.playPickup();
        this.game.player.rebuildHeldMesh();
        this.renderInventoryModal();
        this.renderHotbar();
      });

      this.elCatalogGrid.appendChild(btn);
    }
  }

  renderPauseModal() {
    // Highlight current mode & weather
    const mode = this.game.player.mode;
    document.querySelectorAll('[data-set-mode]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-set-mode') === mode);
    });

    const weather = this.game.sky.weather;
    document.querySelectorAll('[data-set-weather]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-set-weather') === weather);
    });

    if (this.elSeedInput) {
      this.elSeedInput.value = this.game.world.seed;
    }

    if (this.elWorldSlots) {
      this.elWorldSlots.innerHTML = '';
      const slots = this.game.storage.listSlots();
      for (const { slotId, summary } of slots) {
        const isActive = this.game.storage.activeSlot === slotId;
        const row = document.createElement('div');
        row.className = `world-slot-card ${isActive ? 'active-slot' : ''}`;

        const meta = document.createElement('div');
        meta.className = 'world-slot-meta';
        const title = document.createElement('div');
        title.className = 'world-slot-title';
        title.textContent = summary
          ? `${summary.name} ${isActive ? ' (Active)' : ''}`
          : `Slot ${slotId.replace('slot_', '#')} (Empty)`;
        meta.appendChild(title);

        const sub = document.createElement('div');
        sub.className = 'world-slot-sub';
        sub.textContent = summary
          ? `Seed: ${summary.seed} • Day ${summary.dayCount} • ${summary.modifiedChunkCount} chunks edited`
          : 'Click Load/Create to start a fresh world in this slot.';
        meta.appendChild(sub);
        row.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'world-slot-actions';

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'btn-secondary btn-sm';
        saveBtn.textContent = 'Save Here';
        saveBtn.addEventListener('click', () => {
          this.game.storage.setActiveSlot(slotId);
          this.game.saveCurrentWorld();
          this.renderPauseModal();
        });
        actions.appendChild(saveBtn);

        const loadBtn = document.createElement('button');
        loadBtn.type = 'button';
        loadBtn.className = 'btn-primary btn-sm';
        loadBtn.textContent = summary ? 'Load' : 'Create';
        loadBtn.addEventListener('click', () => {
          this.game.switchWorldSlot(slotId);
          this.closeAllModals(true);
        });
        actions.appendChild(loadBtn);

        row.appendChild(actions);
        this.elWorldSlots.appendChild(row);
      }
    }
  }
}
