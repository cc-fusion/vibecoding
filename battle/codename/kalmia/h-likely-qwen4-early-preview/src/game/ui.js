// DOM UI: title / pause / settings / inventory / crafting / HUD / toasts.
import {
  createIcons, Play, Plus, Settings, X, RotateCcw, Save, Trophy, Sun, Moon,
  CloudRain, Snowflake, Skull, Hammer, Flame, Heart, Drumstick, Droplet,
  Pickaxe, Axe, Gem, Lightbulb, Swords, Beef, ArrowDown, Building2, Anvil,
  LayoutGrid, MoonStar, BookOpen, Dices, ChevronLeft, Keyboard, Volume2,
  Sparkles, LogOut, MousePointer2, Mountain,
} from 'lucide';
import { iconURL } from './textures.js';
import { nameOf, defOf, isBlock, B, I } from './blocks.js';
import { RECIPES, SMELT_RECIPES, FUELS, canCraft, SMELT_TIME } from './crafting.js';
import { ACHIEVEMENTS } from './save.js';

const ICONS = {
  Play, Plus, Settings, X, RotateCcw, Save, Trophy, Sun, Moon, CloudRain, Snowflake,
  Skull, Hammer, Flame, Heart, Drumstick, Droplet, Pickaxe, Axe, Gem, Lightbulb,
  Swords, Beef, ArrowDown, Building2, Anvil, LayoutGrid, MoonStar, BookOpen, Dices,
  ChevronLeft, Keyboard, Volume2, Sparkles, LogOut, MousePointer2, Mountain,
};

const CONTROLS = [
  ['W A S D', 'Move'], ['Mouse', 'Look around'], ['Space', 'Jump / swim up'],
  ['Shift', 'Sprint (fly down)'], ['Left click', 'Break / attack'],
  ['Right click', 'Place / eat / use'], ['Middle click', 'Pick block'],
  ['1–9 / Scroll', 'Select hotbar'], ['E', 'Inventory & crafting'],
  ['Q', 'Drop held item'], ['F3', 'Debug info'], ['Esc', 'Pause'],
  ['Double Space', 'Toggle flight (creative)'],
];

export class UI {
  constructor(root, callbacks) {
    this.root = root;
    this.cb = callbacks;
    this.game = null;
    this.cursor = null; // stack held by mouse in inventory
    this.invTab = 'craft';
    this.currentScreen = null;
    this.lastHp = -1; this.lastHunger = -1; this.lastBreath = -1;
    this.build();
  }

  icons() {
    createIcons({ icons: ICONS, attrs: { 'stroke-width': 2.2 } });
  }

  build() {
    const el = document.createElement('div');
    el.id = 'vh-ui';
    el.innerHTML = `
      <div id="vh-vignette"></div>
      <div id="vh-damage"></div>
      <div id="vh-water"></div>

      <div id="vh-hud" class="vh-hidden">
        <div id="vh-crosshair"><span></span><span></span></div>
        <div id="vh-env" class="vh-chip">
          <span id="vh-clock-icon"><i data-lucide="sun"></i></span>
          <span id="vh-clock">06:00</span>
          <span class="vh-chip-sep"></span>
          <span id="vh-day">Day 1</span>
          <span class="vh-chip-sep"></span>
          <span id="vh-biome">Plains</span>
        </div>
        <div id="vh-weather" class="vh-chip vh-hidden"><i data-lucide="cloud-rain"></i><span id="vh-weather-label">Rain</span></div>
        <div id="vh-toasts"></div>
        <div id="vh-debug" class="vh-hidden"></div>
        <div id="vh-hint">
          <span><b>E</b> Inventory</span><span><b>Esc</b> Menu</span>
        </div>
        <div id="vh-bottom">
          <div id="vh-itemname"></div>
          <div id="vh-stats">
            <div id="vh-hearts"></div>
            <div id="vh-right-stats">
              <div id="vh-breath"></div>
              <div id="vh-hunger"></div>
            </div>
          </div>
          <div id="vh-hotbar"></div>
        </div>
      </div>

      <div id="vh-screen-title" class="vh-screen vh-hidden">
        <div class="vh-title-inner">
          <div id="vh-logo">VOXEL<span>HEIM</span></div>
          <div id="vh-tagline">A tiny blocky world, all yours.</div>
          <div class="vh-menu-buttons">
            <button id="vh-continue" class="vh-btn vh-btn-primary vh-hidden"><i data-lucide="play"></i>Continue</button>
            <button id="vh-new" class="vh-btn"><i data-lucide="plus"></i>New World</button>
            <button id="vh-howto" class="vh-btn"><i data-lucide="book-open"></i>How to Play</button>
            <button id="vh-title-settings" class="vh-btn"><i data-lucide="settings"></i>Settings</button>
          </div>
        </div>
        <div class="vh-footer">Runs entirely in your browser · worlds are saved locally</div>
      </div>

      <div id="vh-screen-new" class="vh-screen vh-hidden">
        <div class="vh-panel">
          <h2><i data-lucide="mountain"></i>Create a World</h2>
          <label class="vh-label">World seed</label>
          <div class="vh-seed-row">
            <input id="vh-seed" type="text" placeholder="Leave blank for random" maxlength="32" />
            <button id="vh-seed-random" class="vh-btn vh-btn-icon" title="Random seed"><i data-lucide="dices"></i></button>
          </div>
          <label class="vh-label">Game mode</label>
          <div class="vh-mode-row">
            <button class="vh-mode-card selected" data-mode="survival">
              <i data-lucide="swords"></i><b>Survival</b>
              <span>Gather, craft, eat, and survive the night.</span>
            </button>
            <button class="vh-mode-card" data-mode="creative">
              <i data-lucide="sparkles"></i><b>Creative</b>
              <span>Unlimited blocks, flight, no damage.</span>
            </button>
          </div>
          <div id="vh-overwrite-warn" class="vh-warn vh-hidden"><i data-lucide="skull"></i>This replaces your existing world.</div>
          <div class="vh-btn-row">
            <button id="vh-new-back" class="vh-btn"><i data-lucide="chevron-left"></i>Back</button>
            <button id="vh-create" class="vh-btn vh-btn-primary"><i data-lucide="play"></i>Create World</button>
          </div>
        </div>
      </div>

      <div id="vh-screen-loading" class="vh-screen vh-hidden">
        <div class="vh-loading-box">
          <div id="vh-loading-label">Shaping the land…</div>
          <div class="vh-progress"><div id="vh-progress-fill"></div></div>
        </div>
      </div>

      <div id="vh-screen-pause" class="vh-screen vh-hidden">
        <div class="vh-panel vh-panel-slim">
          <h2>Paused</h2>
          <div class="vh-menu-buttons">
            <button id="vh-resume" class="vh-btn vh-btn-primary"><i data-lucide="play"></i>Resume</button>
            <button id="vh-pause-settings" class="vh-btn"><i data-lucide="settings"></i>Settings</button>
            <button id="vh-pause-ach" class="vh-btn"><i data-lucide="trophy"></i>Achievements</button>
            <button id="vh-quit" class="vh-btn"><i data-lucide="log-out"></i>Save & Quit</button>
          </div>
        </div>
      </div>

      <div id="vh-screen-settings" class="vh-screen vh-hidden">
        <div class="vh-panel">
          <h2><i data-lucide="settings"></i>Settings</h2>
          <div class="vh-setting"><label>Render distance <output id="vh-rd-out"></output></label>
            <input id="vh-rd" type="range" min="3" max="8" step="1" /></div>
          <div class="vh-setting"><label>Field of view <output id="vh-fov-out"></output></label>
            <input id="vh-fov" type="range" min="60" max="100" step="1" /></div>
          <div class="vh-setting"><label>Mouse sensitivity <output id="vh-sens-out"></output></label>
            <input id="vh-sens" type="range" min="20" max="200" step="5" /></div>
          <div class="vh-setting"><label>Volume <output id="vh-vol-out"></output></label>
            <input id="vh-vol" type="range" min="0" max="100" step="5" /></div>
          <div class="vh-setting vh-setting-toggle"><label>Music</label>
            <button id="vh-music" class="vh-toggle" role="switch"></button></div>
          <div class="vh-setting vh-setting-toggle"><label>Shadows</label>
            <button id="vh-shadows" class="vh-toggle" role="switch"></button></div>
          <div class="vh-btn-row">
            <button id="vh-settings-back" class="vh-btn"><i data-lucide="chevron-left"></i>Back</button>
          </div>
        </div>
      </div>

      <div id="vh-screen-ach" class="vh-screen vh-hidden">
        <div class="vh-panel">
          <h2><i data-lucide="trophy"></i>Achievements</h2>
          <div id="vh-ach-list"></div>
          <div class="vh-btn-row">
            <button id="vh-ach-back" class="vh-btn"><i data-lucide="chevron-left"></i>Back</button>
          </div>
        </div>
      </div>

      <div id="vh-screen-howto" class="vh-screen vh-hidden">
        <div class="vh-panel vh-panel-wide">
          <h2><i data-lucide="keyboard"></i>How to Play</h2>
          <div class="vh-controls-grid">
            ${CONTROLS.map(([k, v]) => `<div class="vh-control"><kbd>${k}</kbd><span>${v}</span></div>`).join('')}
          </div>
          <div class="vh-tips">
            <p><i data-lucide="axe"></i>Punch trees for wood, craft planks and tools, then dig for stone, iron and diamonds.</p>
            <p><i data-lucide="flame"></i>Craft a furnace and keep it in your inventory (or place it nearby) to smelt ore and cook food.</p>
            <p><i data-lucide="moon-star"></i>Zombies come out at night. Light your home with torches and watch your hunger.</p>
          </div>
          <div class="vh-btn-row">
            <button id="vh-howto-back" class="vh-btn"><i data-lucide="chevron-left"></i>Back</button>
          </div>
        </div>
      </div>

      <div id="vh-screen-inv" class="vh-screen vh-screen-clear vh-hidden">
        <div class="vh-inv-wrap">
          <div class="vh-panel vh-inv-left">
            <h2>Inventory</h2>
            <div id="vh-inv-grid"></div>
            <div class="vh-inv-divider"></div>
            <div id="vh-inv-hotbar"></div>
            <div class="vh-inv-help">Click to move · Right-click to split · Shift-click for quick move · Q to drop</div>
          </div>
          <div class="vh-panel vh-inv-right">
            <div class="vh-tabs">
              <button class="vh-tab selected" data-tab="craft"><i data-lucide="hammer"></i>Craft</button>
              <button class="vh-tab" data-tab="smelt"><i data-lucide="flame"></i>Smelt</button>
            </div>
            <div id="vh-recipes"></div>
          </div>
          <button id="vh-inv-close" class="vh-btn vh-btn-icon vh-inv-close" title="Close (E)"><i data-lucide="x"></i></button>
        </div>
        <div id="vh-cursor-stack" class="vh-slot vh-hidden"></div>
        <div id="vh-tooltip" class="vh-hidden"></div>
      </div>

      <div id="vh-screen-death" class="vh-screen vh-screen-death vh-hidden">
        <div class="vh-panel vh-panel-slim vh-death-panel">
          <i data-lucide="skull" class="vh-death-icon"></i>
          <h2>You died!</h2>
          <div id="vh-death-cause"></div>
          <div class="vh-menu-buttons">
            <button id="vh-respawn" class="vh-btn vh-btn-primary"><i data-lucide="rotate-ccw"></i>Respawn</button>
            <button id="vh-death-quit" class="vh-btn"><i data-lucide="log-out"></i>Title Screen</button>
          </div>
        </div>
      </div>
    `;
    this.root.appendChild(el);
    this.$ = (id) => el.querySelector('#' + id);
    this.bindEvents();
    this.icons();
  }

  bindEvents() {
    const $ = this.$;
    const click = (id, fn) => $(id).addEventListener('click', (e) => { this.cb.clickSound?.(); fn(e); });
    click('vh-new', () => { this.$('vh-overwrite-warn').classList.toggle('vh-hidden', !this.cb.hasSave()); this.screen('new'); });
    click('vh-continue', () => this.cb.onContinue());
    click('vh-howto', () => this.screen('howto'));
    click('vh-title-settings', () => { this.settingsReturn = 'title'; this.screen('settings'); this.syncSettings(); });
    click('vh-new-back', () => this.screen('title'));
    click('vh-howto-back', () => this.screen(this.cb.inGame?.() ? 'pause' : 'title'));
    click('vh-create', () => {
      const seed = $('vh-seed').value.trim();
      const mode = this.root.querySelector('.vh-mode-card.selected').dataset.mode;
      this.cb.onNewWorld(seed, mode);
    });
    click('vh-seed-random', () => { $('vh-seed').value = String(Math.floor(Math.random() * 999999999)); });
    this.root.querySelectorAll('.vh-mode-card').forEach((c) => {
      c.addEventListener('click', () => {
        this.root.querySelectorAll('.vh-mode-card').forEach((x) => x.classList.remove('selected'));
        c.classList.add('selected');
        this.cb.clickSound?.();
      });
    });
    click('vh-resume', () => this.cb.onResume());
    click('vh-pause-settings', () => { this.settingsReturn = 'pause'; this.screen('settings'); this.syncSettings(); });
    click('vh-pause-ach', () => { this.renderAchievements(); this.screen('ach'); });
    click('vh-ach-back', () => this.screen('pause'));
    click('vh-quit', () => this.cb.onQuit());
    click('vh-settings-back', () => this.screen(this.settingsReturn || 'title'));
    click('vh-respawn', () => this.cb.onRespawn());
    click('vh-death-quit', () => this.cb.onQuit());
    click('vh-inv-close', () => this.cb.onCloseInventory());

    // settings inputs
    const bindRange = (id, outId, key, fmt = (v) => v) => {
      $(id).addEventListener('input', () => {
        const v = Number($(id).value);
        $(outId).textContent = fmt(v);
        this.cb.onSetting(key, v);
      });
    };
    bindRange('vh-rd', 'vh-rd-out', 'renderDist', (v) => v + ' chunks');
    bindRange('vh-fov', 'vh-fov-out', 'fov', (v) => v + '°');
    bindRange('vh-sens', 'vh-sens-out', 'sens', (v) => v + '%');
    bindRange('vh-vol', 'vh-vol-out', 'volume', (v) => v + '%');
    $('vh-music').addEventListener('click', () => {
      const on = !$('vh-music').classList.contains('on');
      $('vh-music').classList.toggle('on', on);
      this.cb.onSetting('music', on);
    });
    $('vh-shadows').addEventListener('click', () => {
      const on = !$('vh-shadows').classList.contains('on');
      $('vh-shadows').classList.toggle('on', on);
      this.cb.onSetting('shadows', on);
    });

    // inventory tabs
    this.root.querySelectorAll('.vh-tab').forEach((t) => {
      t.addEventListener('click', () => {
        this.invTab = t.dataset.tab;
        this.root.querySelectorAll('.vh-tab').forEach((x) => x.classList.toggle('selected', x === t));
        this.renderRecipes();
        this.cb.clickSound?.();
      });
    });

    // cursor stack follows mouse
    this.root.addEventListener('mousemove', (e) => {
      const cs = $('vh-cursor-stack');
      cs.style.left = e.clientX + 'px';
      cs.style.top = e.clientY + 'px';
      const tt = $('vh-tooltip');
      tt.style.left = Math.min(e.clientX + 14, window.innerWidth - 190) + 'px';
      tt.style.top = Math.max(e.clientY - 40, 8) + 'px';
    });
  }

  syncSettings() {
    const s = this.cb.getSettings();
    const $ = this.$;
    $('vh-rd').value = s.renderDist; $('vh-rd-out').textContent = s.renderDist + ' chunks';
    $('vh-fov').value = s.fov; $('vh-fov-out').textContent = s.fov + '°';
    $('vh-sens').value = s.sens; $('vh-sens-out').textContent = s.sens + '%';
    $('vh-vol').value = s.volume; $('vh-vol-out').textContent = s.volume + '%';
    $('vh-music').classList.toggle('on', s.music);
    $('vh-shadows').classList.toggle('on', s.shadows);
  }

  screen(name) {
    this.currentScreen = name;
    this.root.querySelectorAll('.vh-screen').forEach((s) => s.classList.add('vh-hidden'));
    if (name) this.$('vh-screen-' + name).classList.remove('vh-hidden');
    this.$('vh-hud').classList.toggle('vh-hidden', !(this.cb.inGame?.() && (!name || name === 'inv')));
    this.hideTooltip();
    this.icons();
  }

  setLoading(p, label) {
    if (label) this.$('vh-loading-label').textContent = label;
    this.$('vh-progress-fill').style.width = Math.round(p * 100) + '%';
  }

  setContinueVisible(v) {
    this.$('vh-continue').classList.toggle('vh-hidden', !v);
  }

  // ---------- HUD ----------
  buildHotbar(inv) {
    const hb = this.$('vh-hotbar');
    hb.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      slot.className = 'vh-slot vh-hotbar-slot';
      slot.innerHTML = `<span class="vh-slot-num">${i + 1}</span><img draggable="false"/><span class="vh-count"></span><div class="vh-dur"><div></div></div>`;
      slot.addEventListener('click', () => { if (this.cb.inGame?.()) this.cb.onSelectSlot(i); });
      hb.appendChild(slot);
    }
    this.updateHotbar(inv);
  }

  updateHotbar(inv) {
    const slots = this.$('vh-hotbar').children;
    for (let i = 0; i < 9; i++) {
      const el = slots[i];
      const s = inv.slots[i];
      const img = el.querySelector('img');
      const cnt = el.querySelector('.vh-count');
      const dur = el.querySelector('.vh-dur');
      el.classList.toggle('selected', i === inv.selected);
      if (s) {
        img.src = iconURL(s.id);
        img.style.display = 'block';
        cnt.textContent = s.n > 1 ? s.n : '';
        const def = defOf(s.id);
        if (def?.durability && s.dur !== undefined && s.dur < def.durability) {
          dur.style.display = 'block';
          const f = s.dur / def.durability;
          dur.firstElementChild.style.width = f * 100 + '%';
          dur.firstElementChild.style.background = f > 0.5 ? '#6fce44' : f > 0.25 ? '#e8c33a' : '#e05038';
        } else dur.style.display = 'none';
      } else {
        img.style.display = 'none';
        cnt.textContent = '';
        dur.style.display = 'none';
      }
    }
  }

  showItemName(name) {
    const el = this.$('vh-itemname');
    el.textContent = name || '';
    el.classList.remove('vh-fade');
    void el.offsetWidth;
    if (name) el.classList.add('vh-fade');
  }

  updateStats(player) {
    if (player.creative) {
      this.$('vh-stats').style.display = 'none';
      return;
    }
    this.$('vh-stats').style.display = '';
    const hp = Math.ceil(player.hp);
    if (hp !== this.lastHp) {
      this.lastHp = hp;
      let html = '';
      for (let i = 0; i < 10; i++) {
        const fill = Math.max(0, Math.min(2, hp - i * 2)) / 2;
        html += `<div class="vh-heart"><i data-lucide="heart" class="vh-heart-bg"></i><div class="vh-heart-fill" style="width:${fill * 100}%"><i data-lucide="heart"></i></div></div>`;
      }
      this.$('vh-hearts').innerHTML = html;
      this.icons();
    }
    const hg = Math.ceil(player.hunger);
    if (hg !== this.lastHunger) {
      this.lastHunger = hg;
      let html = '';
      for (let i = 0; i < 10; i++) {
        const fill = Math.max(0, Math.min(2, hg - i * 2)) / 2;
        html += `<div class="vh-food"><i data-lucide="drumstick" class="vh-food-bg"></i><div class="vh-food-fill" style="width:${fill * 100}%"><i data-lucide="drumstick"></i></div></div>`;
      }
      this.$('vh-hunger').innerHTML = html;
      this.icons();
    }
    const br = Math.ceil(player.breath);
    if (br !== this.lastBreath) {
      this.lastBreath = br;
      this.$('vh-breath').innerHTML = br >= 10 ? '' :
        Array.from({ length: br }, () => '<i data-lucide="droplet"></i>').join('');
      this.icons();
    }
    this.$('vh-hearts').classList.toggle('vh-low', hp <= 6);
  }

  setEnv({ clock, day, biome, night, weather }) {
    this.$('vh-clock').textContent = clock;
    this.$('vh-day').textContent = 'Day ' + day;
    this.$('vh-biome').textContent = biome;
    const icon = this.$('vh-clock-icon');
    const want = night ? 'moon' : 'sun';
    if (icon.dataset.icon !== want) {
      icon.dataset.icon = want;
      icon.innerHTML = `<i data-lucide="${want}"></i>`;
      this.icons();
    }
    const w = this.$('vh-weather');
    if (weather) {
      w.classList.remove('vh-hidden');
      this.$('vh-weather-label').textContent = weather === 'snow' ? 'Snowfall' : 'Rain';
      if (w.dataset.icon !== weather) {
        w.dataset.icon = weather;
        w.querySelector('svg, i')?.remove();
        w.insertAdjacentHTML('afterbegin', `<i data-lucide="${weather === 'snow' ? 'snowflake' : 'cloud-rain'}"></i>`);
        this.icons();
      }
    } else w.classList.add('vh-hidden');
  }

  flashDamage() {
    const el = this.$('vh-damage');
    el.classList.remove('vh-flash');
    void el.offsetWidth;
    el.classList.add('vh-flash');
  }

  setUnderwater(on) { this.$('vh-water').classList.toggle('on', on); }
  setSprinting(on) { this.$('vh-vignette').classList.toggle('vh-sprint', on); }

  setDebug(text) {
    const el = this.$('vh-debug');
    if (text === null) { el.classList.add('vh-hidden'); return; }
    el.classList.remove('vh-hidden');
    el.textContent = text;
  }

  hintFade() {
    setTimeout(() => this.$('vh-hint').classList.add('vh-gone'), 9000);
  }

  // ---------- toasts ----------
  toast(title, desc, icon = 'sparkles', kind = '') {
    const t = document.createElement('div');
    t.className = 'vh-toast ' + kind;
    t.innerHTML = `<i data-lucide="${icon}"></i><div><b>${title}</b>${desc ? `<span>${desc}</span>` : ''}</div>`;
    this.$('vh-toasts').appendChild(t);
    this.icons();
    requestAnimationFrame(() => t.classList.add('vh-in'));
    setTimeout(() => {
      t.classList.remove('vh-in');
      setTimeout(() => t.remove(), 400);
    }, 4200);
  }

  achievementToast(a) {
    this.toast(a.name, a.desc, a.icon, 'vh-toast-ach');
  }

  renderAchievements() {
    const unlocked = this.cb.getAchievements();
    this.$('vh-ach-list').innerHTML = ACHIEVEMENTS.map((a) => {
      const got = unlocked.has(a.id);
      return `<div class="vh-ach ${got ? 'got' : ''}">
        <i data-lucide="${a.icon}"></i>
        <div><b>${a.name}</b><span>${a.desc}</span></div>
        ${got ? '<i data-lucide="trophy" class="vh-ach-check"></i>' : ''}
      </div>`;
    }).join('');
    this.icons();
  }

  // ---------- inventory screen ----------
  openInventory(inv, tab = 'craft') {
    this.invTab = tab;
    this.root.querySelectorAll('.vh-tab').forEach((x) => x.classList.toggle('selected', x.dataset.tab === tab));
    this.screen('inv');
    this.renderInventory(inv);
    this.renderRecipes();
  }

  slotHTML(s) {
    if (!s) return '';
    const def = defOf(s.id);
    let dur = '';
    if (def?.durability && s.dur !== undefined && s.dur < def.durability) {
      const f = s.dur / def.durability;
      dur = `<div class="vh-dur" style="display:block"><div style="width:${f * 100}%;background:${f > 0.5 ? '#6fce44' : f > 0.25 ? '#e8c33a' : '#e05038'}"></div></div>`;
    }
    return `<img src="${iconURL(s.id)}" draggable="false"/><span class="vh-count">${s.n > 1 ? s.n : ''}</span>${dur}`;
  }

  renderInventory(inv) {
    const grid = this.$('vh-inv-grid');
    const hb = this.$('vh-inv-hotbar');
    if (grid.children.length !== 27) {
      grid.innerHTML = '';
      for (let i = 9; i < 36; i++) grid.appendChild(this.makeInvSlot(inv, i));
    }
    if (hb.children.length !== 9) {
      hb.innerHTML = '';
      for (let i = 0; i < 9; i++) hb.appendChild(this.makeInvSlot(inv, i));
    }
    for (const el of [...grid.children, ...hb.children]) {
      const i = Number(el.dataset.i);
      el.innerHTML = this.slotHTML(inv.slots[i]);
      el.classList.toggle('selected', i === inv.selected);
    }
    this.renderCursor();
  }

  makeInvSlot(inv, i) {
    const el = document.createElement('div');
    el.className = 'vh-slot';
    el.dataset.i = i;
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.slotClick(inv, i, e.button, e.shiftKey);
    });
    el.addEventListener('mouseenter', () => {
      const s = inv.slots[i];
      if (s && !this.cursor) this.showTooltip(s);
    });
    el.addEventListener('mouseleave', () => this.hideTooltip());
    return el;
  }

  slotClick(inv, i, button, shift) {
    const s = inv.slots[i];
    this.hideTooltip();
    if (shift && s && !this.cursor) {
      // quick move between hotbar and main inventory
      const range = i < 9 ? [9, 36] : [0, 9];
      let n = s.n;
      const max = 64;
      for (let j = range[0]; j < range[1] && n > 0; j++) {
        const t = inv.slots[j];
        if (t && t.id === s.id && !defOf(s.id)?.durability && t.n < max) {
          const take = Math.min(max - t.n, n);
          t.n += take; n -= take;
        }
      }
      for (let j = range[0]; j < range[1] && n > 0; j++) {
        if (!inv.slots[j]) { inv.slots[j] = { ...s, n }; n = 0; }
      }
      if (n <= 0) inv.slots[i] = null; else s.n = n;
      inv.changed();
      this.renderInventory(inv);
      this.renderRecipes();
      return;
    }
    if (button === 0) {
      if (!this.cursor && s) {
        this.cursor = s;
        inv.slots[i] = null;
      } else if (this.cursor) {
        if (!s) {
          inv.slots[i] = this.cursor;
          this.cursor = null;
        } else if (s.id === this.cursor.id && !defOf(s.id)?.durability) {
          const max = 64;
          const take = Math.min(max - s.n, this.cursor.n);
          s.n += take;
          this.cursor.n -= take;
          if (this.cursor.n <= 0) this.cursor = null;
        } else {
          inv.slots[i] = this.cursor;
          this.cursor = s;
        }
      }
    } else if (button === 2) {
      if (!this.cursor && s) {
        const half = Math.ceil(s.n / 2);
        this.cursor = { ...s, n: half };
        s.n -= half;
        if (s.n <= 0) inv.slots[i] = null;
      } else if (this.cursor) {
        if (!s) {
          inv.slots[i] = { ...this.cursor, n: 1 };
          this.cursor.n--;
        } else if (s.id === this.cursor.id && s.n < 64 && !defOf(s.id)?.durability) {
          s.n++;
          this.cursor.n--;
        }
        if (this.cursor && this.cursor.n <= 0) this.cursor = null;
      }
    }
    inv.changed();
    this.renderInventory(inv);
    this.renderRecipes();
    this.cb.clickSound?.();
  }

  renderCursor() {
    const cs = this.$('vh-cursor-stack');
    if (this.cursor) {
      cs.classList.remove('vh-hidden');
      cs.innerHTML = this.slotHTML(this.cursor);
    } else {
      cs.classList.add('vh-hidden');
      cs.innerHTML = '';
    }
  }

  closeInventory(inv) {
    if (this.cursor) {
      const leftover = inv.add(this.cursor.id, this.cursor.n, this.cursor.dur);
      if (leftover > 0) this.cb.onDropStack?.({ ...this.cursor, n: leftover });
      this.cursor = null;
      this.renderCursor();
    }
    this.hideTooltip();
  }

  showTooltip(s) {
    const def = defOf(s.id);
    const tt = this.$('vh-tooltip');
    let extra = '';
    if (def?.durability) extra = `<span>Durability ${s.dur ?? def.durability} / ${def.durability}</span>`;
    else if (def?.food) extra = `<span>Restores ${def.food} hunger</span>`;
    else if (def?.tool) extra = `<span>${def.tool} · tier ${def.tier}</span>`;
    tt.innerHTML = `<b>${nameOf(s.id)}</b>${extra}`;
    tt.classList.remove('vh-hidden');
  }

  hideTooltip() { this.$('vh-tooltip').classList.add('vh-hidden'); }

  // ---------- crafting / smelting ----------
  renderRecipes() {
    const g = this.game;
    if (!g) return;
    const box = this.$('vh-recipes');
    if (this.invTab === 'craft') {
      box.innerHTML = RECIPES.map((r, i) => {
        const ok = canCraft(g.inv, r);
        const ing = r.ing.map((x) => {
          const have = g.inv.count(x.id);
          return `<span class="vh-ing ${have >= x.n ? 'ok' : 'no'}"><img src="${iconURL(x.id)}"/>${Math.min(have, 99)}/${x.n}</span>`;
        }).join('');
        return `<button class="vh-recipe ${ok ? 'ok' : ''}" data-i="${i}">
          <span class="vh-slot vh-recipe-icon">${this.slotHTML({ id: r.out.id, n: r.out.n })}</span>
          <span class="vh-recipe-name">${nameOf(r.out.id)}${r.out.n > 1 ? ' ×' + r.out.n : ''}</span>
          <span class="vh-recipe-ings">${ing}</span>
        </button>`;
      }).join('');
      box.querySelectorAll('.vh-recipe').forEach((el) => {
        el.addEventListener('click', () => this.cb.onCraft(RECIPES[Number(el.dataset.i)]));
      });
    } else {
      const available = g.furnaceAvailable();
      const st = g.smeltState;
      const fuelInfo = `<div class="vh-smelt-status">
        <span><i data-lucide="flame"></i>Fuel: ${st.fuel > 0 ? st.fuel + ' smelts' : 'coal / logs'}</span>
        ${st.current ? `<div class="vh-smelt-progress"><div style="width:${(st.progress / SMELT_TIME) * 100}%"></div></div><span>Smelting ${nameOf(st.current.output.id)}…</span>` : ''}
      </div>`;
      box.innerHTML = (available ? '' : `<div class="vh-smelt-locked"><i data-lucide="flame"></i>Craft a <b>furnace</b> and keep it in your inventory or place it nearby to smelt.</div>`) +
        fuelInfo +
        SMELT_RECIPES.map((r, i) => {
          const have = g.inv.count(r.input);
          const ok = available && have > 0 && !st.current;
          return `<button class="vh-recipe ${ok ? 'ok' : ''}" data-i="${i}">
            <span class="vh-slot vh-recipe-icon">${this.slotHTML({ id: r.output.id, n: r.output.n })}</span>
            <span class="vh-recipe-name">${nameOf(r.output.id)}</span>
            <span class="vh-recipe-ings"><span class="vh-ing ${have > 0 ? 'ok' : 'no'}"><img src="${iconURL(r.input)}"/>${have}</span></span>
          </button>`;
        }).join('');
      box.querySelectorAll('.vh-recipe').forEach((el) => {
        el.addEventListener('click', () => this.cb.onSmelt(SMELT_RECIPES[Number(el.dataset.i)]));
      });
    }
    this.icons();
  }
}