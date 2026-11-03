// DOM UI: menus, HUD, inventory / crafting / furnace / chest windows, tooltips, toasts.
import { DEFS, B, I, maxStack, CREATIVE_BLOCKS, CREATIVE_ITEMS } from './blocks.js';
import { getIcon } from './textures.js';
import { RECIPES, findRecipe, planFromInventory, recipeFitsGrid, describeIngredient, SMELTING, fuelTime } from './recipes.js';
import { ADVANCEMENTS } from './advancements.js';
import { saveSettings } from './storage.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

// ---- pixel icons for the HUD ----------------------------------------------------------------------
function pixelIcon(rows, pal) {
  const c = document.createElement('canvas');
  c.width = rows[0].length; c.height = rows.length;
  const ctx = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { ctx.fillStyle = pal[ch]; ctx.fillRect(x, y, 1, 1); } }));
  return c.toDataURL();
}
const HEART = ['.ooo.ooo.', 'orrrorrro', 'orhrrrrro', 'orrrrrrro', '.orrrrro.', '..orrro..', '...oro...', '....o....'];
const DRUM = ['....ooo..', '...orrro.', '..orhrrro', '..orrrrro', '..orrrro.', '...orro..', '..owo....', '.owwo....', '.ooo.....'];
const BUBBLE = ['...ooo...', '..obbbo..', '.obhbbbo.', 'obhbbbbbo', 'obbbbbbbo', 'obbbbbbbo', '.obbbbbo.', '..obbbo..', '...ooo...'];
const mapRows = (rows, from, to) => rows.map((r) => [...r].map((c) => (c === from ? to : c)).join(''));
let HUD_ICONS = null;
function hudIcons() {
  if (HUD_ICONS) return HUD_ICONS;
  const o = '#2a0a0a';
  const heartFull = pixelIcon(HEART, { o, r: '#e8312f', h: '#ff9c93' });
  const heartEmpty = pixelIcon(HEART, { o, r: '#3a2a2a', h: '#4a3636' });
  const half = HEART.map((r) => [...r].map((c, x) => (x > 4 && (c === 'r' || c === 'h') ? 'e' : c)).join(''));
  const heartHalf = pixelIcon(half, { o, r: '#e8312f', h: '#ff9c93', e: '#3a2a2a' });
  const o2 = '#2b1608';
  const drumFull = pixelIcon(DRUM, { o: o2, r: '#c9792b', h: '#f0b060', w: '#efe6d2' });
  const drumEmpty = pixelIcon(DRUM, { o: o2, r: '#3a2b1f', h: '#4a3a2c', w: '#4a4238' });
  const halfD = DRUM.map((r, y) => [...r].map((c, x) => (y < 6 && x < 5 && (c === 'r' || c === 'h') ? 'e' : c)).join(''));
  const drumHalf = pixelIcon(halfD, { o: o2, r: '#c9792b', h: '#f0b060', w: '#efe6d2', e: '#3a2b1f' });
  const bub = pixelIcon(BUBBLE, { o: '#12305a', b: '#7ec8ff', h: '#e6f6ff' });
  HUD_ICONS = { heartFull, heartHalf, heartEmpty, drumFull, drumHalf, drumEmpty, bub };
  void mapRows;
  return HUD_ICONS;
}

const CONTROLS = [
  ['h', 'Movement'],
  [['W', 'A', 'S', 'D'], 'Move'],
  [['Space'], 'Jump / swim up'],
  [['Shift'], 'Sneak (safe at edges)'],
  [['Ctrl'], 'Sprint (or double-tap W)'],
  [['Space', 'Space'], 'Toggle flight (Creative)'],
  ['h', 'Actions'],
  [['Left Click'], 'Mine blocks / attack'],
  [['Right Click'], 'Place / use / eat (hold)'],
  [['Middle Click'], 'Pick block'],
  [['Q'], 'Drop held item'],
  [['1-9', 'Wheel'], 'Select hotbar slot'],
  ['h', 'Interface'],
  [['E'], 'Inventory / crafting'],
  [['Esc'], 'Pause'],
  [['F3'], 'Debug info'],
  [['Shift', 'Click'], 'Quick-move a stack'],
  [['Right Click'], 'Split / place one (inventory)'],
];

const TIPS = [
  'Punch a tree to collect logs, then craft planks and a crafting table.',
  'Torches keep monsters from spawning – place them in dark caves.',
  'Sleep in a bed at night to skip the dark and set your spawn point.',
  'Cook raw meat in a furnace for much more nourishment.',
  'Diamonds are found deep underground, near lava.',
  'Zombies burn in sunlight. Creepers do not.',
  'Hold Shift to sneak safely along cliff edges.',
  'Planks, cobblestone and iron make progressively stronger tools.',
];

export class UI {
  constructor(game) {
    this.game = game;
    this.screens = ['menu', 'worlds', 'create', 'settings', 'controls', 'pause', 'adv', 'death', 'loading', 'container'];
    this.current = 'menu';
    this.returnTo = 'menu';
    this.cursor = null;
    this.slots = [];
    this.container = null;
    this.hovered = null;
    this.itemNameTimer = 0;
    this.lastInvVersion = -1;
    this.lastBars = '';
    this.mode = 'survival';
    this.toastLimit = 4;
    this.bind();
    this.buildHotbar();
    this.buildControls();
  }

  // ---------------------------------------------------------------------------------------------
  show(name) {
    for (const s of this.screens) $('screen-' + s).classList.toggle('hidden', s !== name);
    this.current = name;
  }
  hideScreens() {
    for (const s of this.screens) $('screen-' + s).classList.add('hidden');
    this.current = null;
  }
  showHUD(on) { $('hud').classList.toggle('hidden', !on); }

  bind() {
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      this.game.audio.unlock();
      this.game.audio.play('click');
      this.act(b.dataset.act, b);
    });
    // create-world form
    $('cw-mode').addEventListener('click', (e) => {
      const b = e.target.closest('.seg-btn');
      if (!b) return;
      this.mode = b.dataset.v;
      [...$('cw-mode').children].forEach((c) => c.classList.toggle('active', c === b));
      this.updateModeDesc();
    });
    this.updateModeDesc();
    // container interactions
    const win = $('container-window');
    win.addEventListener('mousedown', (e) => this.onWinMouse(e));
    win.addEventListener('contextmenu', (e) => e.preventDefault());
    $('screen-container').addEventListener('mousedown', (e) => {
      if (e.target.id !== 'screen-container' || !this.cursor) return;
      const stack = this.cursor;
      if (e.button === 2 && stack.count > 1) { this.game.dropStack({ ...stack, count: 1 }); stack.count--; } else { this.game.dropStack(stack); this.cursor = null; }
      this.refreshAll();
    });
    $('screen-container').addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousemove', (e) => this.onMove(e));
  }

  updateModeDesc() {
    $('cw-mode-desc').textContent = this.mode === 'survival'
      ? 'Gather resources, craft tools, manage hunger and fight monsters.'
      : 'Unlimited blocks, instant mining, flight and no damage.';
  }

  act(a) {
    const g = this.game;
    switch (a) {
      case 'play': g.showWorlds(); break;
      case 'back-menu': this.show('menu'); break;
      case 'new-world': $('cw-name').value = 'New World'; $('cw-seed').value = ''; this.show('create'); break;
      case 'cancel-create': this.show('worlds'); break;
      case 'create-world': g.createWorld({ name: $('cw-name').value.trim() || 'New World', seed: $('cw-seed').value, mode: this.mode, hostile: $('cw-hostile').checked }); break;
      case 'settings': this.returnTo = this.current; this.buildSettings(); this.show('settings'); break;
      case 'close-settings': this.show(this.returnTo || 'menu'); break;
      case 'controls': this.returnTo = this.current; this.show('controls'); break;
      case 'close-controls': this.show(this.returnTo || 'menu'); break;
      case 'resume': g.resume(); break;
      case 'achievements': this.buildAdvancements(); this.show('adv'); break;
      case 'close-adv': this.show('pause'); break;
      case 'quit': g.quitToMenu(); break;
      case 'respawn': g.respawn(); break;
      default: break;
    }
  }

  // ---- worlds list ---------------------------------------------------------------------------------
  renderWorlds(list) {
    const box = $('world-list');
    box.innerHTML = '';
    if (!list.length) { box.appendChild(el('div', 'world-empty', 'No worlds yet. Create one to start your adventure.')); return; }
    for (const w of list) {
      const row = el('div', 'world');
      const th = el('div', 'thumb');
      if (w.thumb) th.style.backgroundImage = `url(${w.thumb})`;
      const info = el('div', 'info');
      const day = w.data && w.data.day ? ` · Day ${w.data.day}` : '';
      info.innerHTML = `<div class="name"></div><div class="meta">${w.mode === 'creative' ? 'Creative' : 'Survival'}${day} · ${this.ago(w.played)}</div>`;
      info.querySelector('.name').textContent = w.name;
      const acts = el('div', 'acts');
      const del = el('button', 'iconbtn', '🗑');
      del.title = 'Delete world';
      del.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (del.dataset.armed) { await this.game.deleteWorld(w.id); return; }
        del.dataset.armed = '1'; del.textContent = '?'; del.title = 'Click again to confirm';
        setTimeout(() => { delete del.dataset.armed; del.textContent = '🗑'; }, 2500);
      });
      acts.appendChild(del);
      row.append(th, info, acts);
      row.addEventListener('click', () => { this.game.audio.unlock(); this.game.audio.play('click'); this.game.playWorld(w.id); });
      box.appendChild(row);
    }
  }
  ago(t) {
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return Math.floor(s / 86400) + ' d ago';
  }

  // ---- settings -------------------------------------------------------------------------------------
  buildSettings() {
    const body = $('settings-body');
    body.innerHTML = '';
    const s = this.game.settings;
    const pct = (v) => Math.round(v * 100) + '%';
    const rows = [
      ['sep', 'Video'],
      ['range', 'renderDistance', 'Render distance', 3, 16, 1, (v) => v + ' chunks'],
      ['range', 'fov', 'Field of view', 60, 110, 1, (v) => v + '°'],
      ['toggle', 'clouds', 'Clouds'], ['toggle', 'particles', 'Particles'], ['toggle', 'bobbing', 'View bobbing'], ['toggle', 'showFps', 'Show FPS counter'],
      ['sep', 'Controls'],
      ['range', 'sensitivity', 'Mouse sensitivity', 0.2, 2.5, 0.05, (v) => v.toFixed(2) + '×'],
      ['toggle', 'invertY', 'Invert Y axis'],
      ['sep', 'Audio'],
      ['range', 'master', 'Master volume', 0, 1, 0.05, pct], ['range', 'music', 'Music', 0, 1, 0.05, pct], ['range', 'sfx', 'Effects & ambience', 0, 1, 0.05, pct],
    ];
    for (const r of rows) {
      if (r[0] === 'sep') { body.appendChild(el('div', 'set-sep', r[1])); continue; }
      const [type, key, label] = r;
      if (type === 'range') {
        const row = el('div', 'set-row');
        const inp = el('input'); inp.type = 'range'; inp.min = r[3]; inp.max = r[4]; inp.step = r[5]; inp.value = s[key];
        const out = el('output', '', r[6](s[key]));
        inp.addEventListener('input', () => { s[key] = parseFloat(inp.value); out.textContent = r[6](s[key]); this.game.applySettings(); saveSettings(s); });
        row.append(el('span', '', label), inp, out);
        body.appendChild(row);
      } else {
        const row = el('div', 'set-row toggle');
        const lab = el('label', 'check');
        lab.innerHTML = `<input type="checkbox"><span class="box"></span><span>${label}</span>`;
        const cb = lab.querySelector('input'); cb.checked = !!s[key];
        cb.addEventListener('change', () => { s[key] = cb.checked; this.game.applySettings(); saveSettings(s); });
        row.appendChild(lab);
        body.appendChild(row);
      }
    }
  }

  buildControls() {
    const g = $('controls-grid');
    for (const c of CONTROLS) {
      if (c[0] === 'h') { g.appendChild(el('div', 'ctl-h', c[1])); continue; }
      const row = el('div', 'ctl');
      row.appendChild(el('span', '', c[1]));
      const k = el('span', 'keys');
      c[0].forEach((key) => k.appendChild(el('kbd', '', key)));
      row.appendChild(k);
      g.appendChild(row);
    }
  }

  buildAdvancements() {
    const adv = this.game.advancements;
    const list = $('adv-list');
    list.innerHTML = '';
    for (const a of ADVANCEMENTS) {
      const done = adv.done.has(a.id);
      const row = el('div', 'adv' + (done ? ' done' : ''));
      row.innerHTML = `<div class="ai"><img src="${getIcon(a.icon)}"></div><div><div class="at">${a.title}</div><div class="ad">${a.desc}</div></div>`;
      list.appendChild(row);
    }
    $('adv-summary').textContent = `${adv.done.size} / ${ADVANCEMENTS.length} unlocked`;
    const st = adv.stats;
    const mins = Math.floor(st.playTime / 60);
    $('adv-stats').innerHTML = `<span>Blocks mined <b>${st.mined}</b></span><span>Blocks placed <b>${st.placed}</b></span><span>Monsters slain <b>${st.kills}</b></span><span>Deaths <b>${st.deaths}</b></span><span>Distance <b>${Math.floor(st.distance)} m</b></span><span>Play time <b>${mins} min</b></span>`;
  }

  setPauseInfo(text) { $('pause-sub').textContent = text; $('adv-count').textContent = this.game.advancements ? `${this.game.advancements.done.size}/${ADVANCEMENTS.length}` : ''; }
  setDeathInfo(text) { $('death-cause').textContent = text; }

  showLoading(title, p) {
    $('loading-title').textContent = title;
    $('loading-bar').style.width = Math.round(p * 100) + '%';
    if (!this.tipShown || this.current !== 'loading') { $('loading-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)]; this.tipShown = true; }
    if (this.current !== 'loading') this.show('loading');
  }
  hideLoading() { this.tipShown = false; }

  // ---- HUD -----------------------------------------------------------------------------------------
  buildHotbar() {
    const hb = $('hotbar');
    hb.innerHTML = '';
    this.hotEls = [];
    for (let i = 0; i < 9; i++) {
      const s = el('div', 'hslot');
      s.innerHTML = `<span class="num">${i + 1}</span><img class="icon" style="display:none"><span class="cnt"></span><div class="dur" style="display:none"><i></i></div>`;
      hb.appendChild(s);
      this.hotEls.push({ el: s, img: s.querySelector('img'), cnt: s.querySelector('.cnt'), dur: s.querySelector('.dur'), key: '' });
    }
  }

  fillSlotEl(parts, stack) {
    const key = stack ? stack.id + ':' + stack.count + ':' + (stack.dmg || 0) : '';
    if (parts.key === key) return;
    parts.key = key;
    if (!stack) { parts.img.style.display = 'none'; parts.cnt.textContent = ''; parts.dur.style.display = 'none'; return; }
    parts.img.style.display = 'block';
    parts.img.src = getIcon(stack.id);
    parts.cnt.textContent = stack.count > 1 ? stack.count : '';
    const d = DEFS[stack.id];
    if (d && d.durability && stack.dmg) {
      const f = 1 - stack.dmg / d.durability;
      parts.dur.style.display = 'block';
      const bar = parts.dur.firstChild;
      bar.style.width = f * 100 + '%';
      bar.style.background = f > 0.5 ? '#6fe05a' : f > 0.25 ? '#f0c040' : '#e5574b';
    } else parts.dur.style.display = 'none';
  }

  updateHUD() {
    const g = this.game, inv = g.inventory, p = g.player;
    if (inv.version !== this.lastInvVersion) {
      this.lastInvVersion = inv.version;
      for (let i = 0; i < 9; i++) this.fillSlotEl(this.hotEls[i], inv.slots[i]);
    }
    if (this.lastSel !== inv.selected) {
      this.hotEls.forEach((h, i) => h.el.classList.toggle('sel', i === inv.selected));
      this.lastSel = inv.selected;
      this.flashItemName();
    }
    const creative = p.creative;
    const hp = Math.ceil(p.health), hu = Math.ceil(p.hunger), air = p.headUnder ? Math.ceil(p.air / 1.5) : (p.air < 15 ? Math.ceil(p.air / 1.5) : 0);
    const key = `${creative}|${hp}|${hu}|${air}`;
    if (key !== this.lastBars) {
      this.lastBars = key;
      const ic = hudIcons();
      const row = (n, full, half, empty) => {
        let h = '';
        for (let i = 0; i < 10; i++) {
          const v = n - i * 2;
          h += `<img src="${v >= 2 ? full : v === 1 ? half : empty}">`;
        }
        return h;
      };
      $('bars').style.visibility = creative ? 'hidden' : 'visible';
      $('hearts').innerHTML = row(hp, ic.heartFull, ic.heartHalf, ic.heartEmpty);
      $('hearts').classList.toggle('shake', hp <= 4);
      $('hunger').innerHTML = row(hu, ic.drumFull, ic.drumHalf, ic.drumEmpty);
      let a = '';
      if (!creative) for (let i = 0; i < Math.min(10, air); i++) a += `<img src="${ic.bub}">`;
      $('air').innerHTML = a;
    }
  }

  flashItemName() {
    const s = this.game.inventory.held();
    const n = $('item-name');
    if (!s) { n.classList.remove('show'); n.textContent = ''; return; }
    n.textContent = DEFS[s.id].name;
    n.classList.add('show');
    clearTimeout(this.nameT);
    this.nameT = setTimeout(() => n.classList.remove('show'), 1700);
  }

  setHint(text) {
    const h = $('hint');
    if (text) { h.textContent = text; h.classList.add('show'); } else h.classList.remove('show');
  }

  toastAdvancement(a) {
    const t = el('div', 'toast');
    t.innerHTML = `<div class="t-ico"><img src="${getIcon(a.icon)}"></div><div><div class="t-head">Achievement unlocked</div><div class="t-title">${a.title}</div><div class="t-desc">${a.desc}</div></div>`;
    this.pushToast(t, 5500);
  }
  toastSimple(text) {
    const t = el('div', 'toast simple', text);
    this.pushToast(t, 2600);
  }
  pushToast(t, ms) {
    const box = $('toasts');
    box.appendChild(t);
    while (box.children.length > this.toastLimit) box.removeChild(box.firstChild);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 500); }, ms);
  }

  // ---- containers --------------------------------------------------------------------------------
  get isContainerOpen() { return !!this.container; }

  makeSlot(cfg) {
    const s = el('div', 'slot' + (cfg.cls ? ' ' + cfg.cls : ''));
    s.innerHTML = '<img class="icon" style="display:none"><span class="cnt"></span><div class="dur" style="display:none"><i></i></div>';
    const slot = { ...cfg, el: s, parts: { img: s.querySelector('img'), cnt: s.querySelector('.cnt'), dur: s.querySelector('.dur'), key: '' } };
    s._slot = slot;
    this.slots.push(slot);
    return slot;
  }

  invSlot(i) {
    const inv = this.game.inventory;
    return this.makeSlot({ kind: 'inv', index: i, get: () => inv.slots[i], set: (v) => { inv.slots[i] = v; inv.touch(); } });
  }
  arraySlot(arr, i, extra = {}) {
    return this.makeSlot({ kind: extra.kind || 'arr', arr, index: i, get: () => arr[i], set: (v) => { arr[i] = v; if (extra.onSet) extra.onSet(); }, ...extra });
  }

  buildInvGrid(parent) {
    const main = el('div', 'grid'); main.style.gridTemplateColumns = 'repeat(9, var(--slot))';
    for (let i = 9; i < 36; i++) main.appendChild(this.invSlot(i).el);
    const hot = el('div', 'grid'); hot.style.gridTemplateColumns = 'repeat(9, var(--slot))'; hot.style.marginTop = '6px';
    for (let i = 0; i < 9; i++) hot.appendChild(this.invSlot(i).el);
    parent.append(el('div', 'win-title', 'Inventory'), main, hot);
  }

  openContainer(kind, ctx = {}) {
    const g = this.game;
    this.closeContainer(true);
    this.slots = [];
    this.cursor = null;
    const win = $('container-window');
    win.innerHTML = '';
    win.style.flexDirection = '';
    const c = { kind, ...ctx };
    this.container = c;
    this.containerPos = ctx.key ? { key: ctx.key } : null;
    const main = el('div', 'main');

    if (kind === 'inventory' || kind === 'crafting') {
      const gw = kind === 'crafting' ? 3 : 2;
      c.gw = gw; c.gh = gw;
      c.cells = new Array(gw * gw).fill(null);
      c.out = null;
      const side = this.buildRecipeBook(c);
      const top = el('div', 'craft-row');
      const grid = el('div', 'grid'); grid.style.gridTemplateColumns = `repeat(${gw}, var(--slot))`;
      for (let i = 0; i < gw * gw; i++) grid.appendChild(this.arraySlot(c.cells, i, { kind: 'craft', onSet: () => this.recalc() }).el);
      const out = this.makeSlot({ kind: 'output', cls: 'out', get: () => c.out, set: () => {} });
      c.outSlot = out;
      top.append(grid, el('div', 'arrow'), out.el);
      main.append(el('div', 'win-title', kind === 'crafting' ? 'Crafting Table' : 'Crafting'), top, el('div', 'sep'));
      this.buildInvGrid(main);
      win.append(side, main);
    } else if (kind === 'furnace') {
      const be = ctx.be;
      const col = el('div', 'furnace-col');
      const inSlot = this.arraySlot(be, 'input', { kind: 'fin' });
      inSlot.get = () => be.input; inSlot.set = (v) => { be.input = v; };
      const fuel = this.makeSlot({ kind: 'fuel', get: () => be.fuel, set: (v) => { be.fuel = v; }, accept: (s) => fuelTime(s.id) > 0 });
      const out = this.makeSlot({ kind: 'fout', cls: 'out', get: () => be.output, set: (v) => { be.output = v; } });
      const flame = el('div', 'flame', '<i></i>');
      c.flame = flame.firstChild;
      const arrow = el('div', 'arrow', '<div class="fill"></div>');
      c.arrow = arrow.firstChild;
      const row = el('div', 'craft-row');
      const left = el('div', 'furnace-col'); left.append(inSlot.el, flame, fuel.el);
      row.append(left, arrow, out.el);
      main.append(el('div', 'win-title', 'Furnace'), row, el('div', 'sep'));
      this.buildInvGrid(main);
      win.append(main);
      c.slotsBound = { inSlot, fuel, out };
    } else if (kind === 'chest') {
      const be = ctx.be;
      const grid = el('div', 'grid'); grid.style.gridTemplateColumns = 'repeat(9, var(--slot))';
      for (let i = 0; i < 27; i++) grid.appendChild(this.arraySlot(be.slots, i, { kind: 'chest' }).el);
      main.append(el('div', 'win-title', 'Chest'), grid, el('div', 'sep'));
      this.buildInvGrid(main);
      win.append(main);
    } else if (kind === 'creative') {
      this.buildCreative(main, c);
      win.append(main);
    }
    this.show('container');
    this.refreshAll();
    this.recalc();
  }

  closeContainer(silent = false) {
    const c = this.container;
    if (!c) return;
    const g = this.game;
    // return items
    const give = (s) => { if (!s) return; const left = g.addToInventory(s.id, s.count, s.dmg || 0); if (left > 0) g.dropStack({ ...s, count: left }); };
    if (c.cells) for (let i = 0; i < c.cells.length; i++) { give(c.cells[i]); c.cells[i] = null; }
    give(this.cursor); this.cursor = null;
    this.container = null;
    this.containerPos = null;
    this.slots = [];
    $('cursor-item').classList.add('hidden');
    $('tooltip').classList.add('hidden');
    if (!silent) { this.hideScreens(); g.onContainerClosed(); }
  }

  // ---- recipe book ------------------------------------------------------------------------------------
  buildRecipeBook(c) {
    const side = el('div', 'side recipes');
    side.append(el('div', 'win-title', 'Recipes'));
    const grid = el('div', 'grid');
    side.appendChild(grid);
    c.recipeGrid = grid;
    c.recipeEls = [];
    const list = RECIPES.filter((r) => recipeFitsGrid(r, c.gw, c.gh));
    // stable order: tools / blocks as defined
    for (const r of list) {
      const d = el('div', 'rslot');
      d.innerHTML = `<img class="icon" src="${getIcon(r.result[0])}">${r.result[1] > 1 ? `<span class="cnt">${r.result[1]}</span>` : ''}`;
      d._recipe = r;
      grid.appendChild(d);
      c.recipeEls.push(d);
    }
    c.recipeVersion = -1;
    return side;
  }

  updateRecipeBook() {
    const c = this.container;
    if (!c || !c.recipeEls) return;
    const inv = this.game.inventory;
    if (c.recipeVersion === inv.version) return;
    c.recipeVersion = inv.version;
    const withState = c.recipeEls.map((d) => ({ d, can: !!planFromInventory(d._recipe, inv) }));
    withState.forEach(({ d, can }) => d.classList.toggle('can', can));
    withState.sort((a, b) => (b.can ? 1 : 0) - (a.can ? 1 : 0));
    // keep craftable first without re-creating nodes
    const first = c.recipeGrid.firstChild;
    if (!first || first !== withState[0].d) withState.forEach(({ d }) => c.recipeGrid.appendChild(d));
  }

  autofill(recipe) {
    const c = this.container, g = this.game;
    if (!c || !c.cells) return;
    // return current grid contents
    for (let i = 0; i < c.cells.length; i++) {
      const s = c.cells[i];
      if (s) { const left = g.addToInventory(s.id, s.count, s.dmg || 0); if (left > 0) g.dropStack({ ...s, count: left }); c.cells[i] = null; }
    }
    const picks = planFromInventory(recipe, g.inventory);
    if (!picks) {
      const need = recipe.pattern.filter(Boolean).map((s) => describeIngredient(s).name);
      this.toastSimple('Missing: ' + [...new Set(need)].join(', '));
      this.recalc(); this.refreshAll();
      return;
    }
    if (recipe.shapeless) {
      picks.forEach((id, i) => { g.inventory.remove(id, 1); c.cells[i] = { id, count: 1 }; });
    } else {
      for (let y = 0; y < recipe.h; y++) for (let x = 0; x < recipe.w; x++) {
        const id = picks[y * recipe.w + x];
        if (id === null) continue;
        g.inventory.remove(id, 1);
        c.cells[y * c.gw + x] = { id, count: 1 };
      }
    }
    g.audio.play('craft', { vol: 0.5 });
    this.recalc(); this.refreshAll();
  }

  recalc() {
    const c = this.container;
    if (!c || !c.cells) return;
    const r = findRecipe(c.cells, c.gw, c.gh);
    c.recipe = r;
    c.out = r ? { id: r.result[0], count: r.result[1] } : null;
    if (c.outSlot) this.renderSlot(c.outSlot);
  }

  consumeIngredients() {
    const c = this.container;
    for (let i = 0; i < c.cells.length; i++) {
      const s = c.cells[i];
      if (s) { s.count--; if (s.count <= 0) c.cells[i] = null; }
    }
  }

  // ---- creative palette -----------------------------------------------------------------------------
  buildCreative(main, c) {
    c.tab = 'blocks'; c.query = '';
    const bar = el('div', 'tabs');
    const tb = el('button', 'tab active', 'Blocks'), ti = el('button', 'tab', 'Items');
    const search = el('input', 'search'); search.placeholder = 'Search…'; search.type = 'text';
    bar.append(tb, ti, search);
    const pal = el('div', 'palette');
    const grid = el('div', 'grid'); grid.style.gridTemplateColumns = 'repeat(9, var(--slot))';
    pal.appendChild(grid);
    const fill = () => {
      this.slots = this.slots.filter((s) => s.kind !== 'palette');
      grid.innerHTML = '';
      const ids = (c.query ? [...CREATIVE_BLOCKS, ...CREATIVE_ITEMS] : c.tab === 'blocks' ? CREATIVE_BLOCKS : CREATIVE_ITEMS)
        .filter((id) => !c.query || DEFS[id].name.toLowerCase().includes(c.query));
      for (const id of ids) grid.appendChild(this.makeSlot({ kind: 'palette', get: () => ({ id, count: 1 }), set: () => {} }).el);
      this.refreshAll();
    };
    tb.onclick = () => { c.tab = 'blocks'; tb.classList.add('active'); ti.classList.remove('active'); fill(); };
    ti.onclick = () => { c.tab = 'items'; ti.classList.add('active'); tb.classList.remove('active'); fill(); };
    search.addEventListener('input', () => { c.query = search.value.trim().toLowerCase(); fill(); });
    search.addEventListener('keydown', (e) => e.stopPropagation());
    main.append(el('div', 'win-title', 'Creative Items'), bar, pal);
    const hot = el('div', 'grid'); hot.style.gridTemplateColumns = 'repeat(9, var(--slot))'; hot.style.marginTop = '4px';
    for (let i = 0; i < 9; i++) hot.appendChild(this.invSlot(i).el);
    const trash = el('div', 'trash', '🗑'); trash.title = 'Drop here to delete';
    trash._trash = true;
    const row = el('div', 'craft-row'); row.append(hot, trash);
    main.append(el('div', 'win-title', 'Hotbar'), row);
    fill();
  }

  // ---- slot interaction -----------------------------------------------------------------------------
  onWinMouse(e) {
    const rs = e.target.closest('.rslot');
    if (rs) { this.autofill(rs._recipe); return; }
    const tr = e.target.closest('.trash');
    if (tr) { this.cursor = null; this.game.audio.play('pop', {}); this.refreshAll(); return; }
    const se = e.target.closest('.slot');
    if (!se || !se._slot) return;
    e.preventDefault();
    this.click(se._slot, e.button, e.shiftKey);
    this.game.audio.play('click', { vol: 0.5 });
    this.refreshAll();
    this.onMove(e);
  }

  stackable(id) { return maxStack(id) > 1; }

  click(slot, btn, shift) {
    const g = this.game;
    const s = slot.get();
    const cur = this.cursor;
    if (slot.kind === 'palette') {
      const id = s.id, max = maxStack(id);
      if (cur) { this.cursor = null; return; }
      if (shift) { g.addToInventory(id, max); return; }
      this.cursor = { id, count: btn === 2 ? 1 : max };
      return;
    }
    if (slot.kind === 'output' || slot.kind === 'fout') { this.takeOutput(slot, shift); return; }
    if (shift && s) { this.quickMove(slot); return; }
    if (btn === 2) {
      if (!cur) { if (s) { const half = Math.ceil(s.count / 2); this.cursor = { ...s, count: half }; s.count -= half; slot.set(s.count > 0 ? s : null); } }
      else if (slot.accept && !slot.accept(cur)) return;
      else if (!s) { slot.set({ ...cur, count: 1 }); cur.count--; if (cur.count <= 0) this.cursor = null; }
      else if (s.id === cur.id && this.stackable(s.id) && s.count < maxStack(s.id)) { s.count++; cur.count--; if (cur.count <= 0) this.cursor = null; slot.set(s); }
      else { slot.set(cur); this.cursor = s; }
      return;
    }
    if (!cur) { if (s) { this.cursor = s; slot.set(null); } return; }
    if (slot.accept && !slot.accept(cur)) return;
    if (!s) { slot.set(cur); this.cursor = null; }
    else if (s.id === cur.id && this.stackable(s.id)) {
      const n = Math.min(maxStack(s.id) - s.count, cur.count);
      s.count += n; cur.count -= n;
      if (cur.count <= 0) this.cursor = null;
      slot.set(s);
    } else { slot.set(cur); this.cursor = s; }
  }

  takeOutput(slot, shift) {
    const c = this.container, g = this.game;
    if (slot.kind === 'fout') {
      const s = slot.get();
      if (!s) return;
      if (shift) { const left = g.addToInventory(s.id, s.count, s.dmg || 0); slot.set(left > 0 ? { ...s, count: left } : null); g.onSmeltTaken && g.onSmeltTaken(s.id); return; }
      if (!this.cursor) { this.cursor = s; slot.set(null); g.onSmeltTaken && g.onSmeltTaken(s.id); }
      else if (this.cursor.id === s.id && this.cursor.count + s.count <= maxStack(s.id)) { this.cursor.count += s.count; slot.set(null); g.onSmeltTaken && g.onSmeltTaken(s.id); }
      return;
    }
    if (!c.out) return;
    const craftOne = (toInv) => {
      const out = c.out; if (!out) return false;
      if (toInv) { if (!g.inventory.canAdd(out.id, out.count)) return false; g.addToInventory(out.id, out.count); }
      else if (!this.cursor) this.cursor = { ...out };
      else if (this.cursor.id === out.id && this.cursor.count + out.count <= maxStack(out.id)) this.cursor.count += out.count;
      else return false;
      this.consumeIngredients();
      g.onCraft(out.id, out.count);
      this.recalc();
      return true;
    };
    if (shift) { let n = 0; while (n++ < 64 && craftOne(true)); } else craftOne(false);
    g.audio.play('craft', { vol: 0.6 });
  }

  // move stack to the "other side"
  quickMove(slot) {
    const c = this.container, g = this.game, inv = g.inventory;
    let s = slot.get();
    if (!s) return;
    const place = (arr, from, to, stack) => {
      const max = maxStack(stack.id);
      if (max > 1) for (let i = from; i < to && stack.count > 0; i++) {
        const t = arr[i];
        if (t && t.id === stack.id && t.count < max) { const n = Math.min(max - t.count, stack.count); t.count += n; stack.count -= n; }
      }
      for (let i = from; i < to && stack.count > 0; i++) if (!arr[i]) { arr[i] = { ...stack, count: Math.min(max, stack.count) }; stack.count -= arr[i].count; }
      return stack.count;
    };
    let left = s.count;
    const stack = { ...s };
    if (slot.kind === 'inv') {
      if (c.kind === 'chest') left = place(c.be.slots, 0, 27, stack);
      else if (c.kind === 'furnace') {
        const be = c.be;
        if (fuelTime(s.id) > 0 && (!be.fuel || be.fuel.id === s.id)) {
          if (!be.fuel) { be.fuel = { ...stack }; left = 0; } else { const n = Math.min(maxStack(s.id) - be.fuel.count, stack.count); be.fuel.count += n; left = stack.count - n; }
        } else if (!be.input || be.input.id === s.id) {
          if (!be.input) { be.input = { ...stack }; left = 0; } else { const n = Math.min(maxStack(s.id) - be.input.count, stack.count); be.input.count += n; left = stack.count - n; }
        } else left = this.quickInv(slot.index, stack, place);
      } else if (c.kind === 'creative') left = this.quickInv(slot.index, stack, place);
      else left = this.quickInv(slot.index, stack, place);
    } else {
      // from container into inventory
      stack.count = s.count;
      const l = g.addToInventory(stack.id, stack.count, stack.dmg || 0);
      left = l;
    }
    if (left <= 0) slot.set(null); else slot.set({ ...s, count: left });
    if (c.kind === 'furnace') this.refreshAll();
  }
  quickInv(index, stack, place) {
    const inv = this.game.inventory;
    if (index < 9) return place(inv.slots, 9, 36, stack);
    return place(inv.slots, 0, 9, stack);
  }

  swapHotbar(slot, n) {
    if (!slot || slot.kind === 'palette' || slot.kind === 'output' || slot.kind === 'fout') return;
    const inv = this.game.inventory;
    const a = slot.get(), b = inv.slots[n];
    if (slot.accept && b && !slot.accept(b)) return;
    slot.set(b || null);
    inv.slots[n] = a || null;
    inv.touch();
    this.refreshAll();
  }

  // ---- rendering --------------------------------------------------------------------------------------
  renderSlot(slot) {
    const stack = slot.get();
    const dim = slot.kind === 'output' && !stack;
    this.fillSlotEl(slot.parts, stack);
    slot.el.classList.toggle('dim', dim);
  }
  refreshAll() {
    for (const s of this.slots) this.renderSlot(s);
    const cur = $('cursor-item');
    if (this.cursor) {
      cur.classList.remove('hidden');
      cur.innerHTML = `<img class="icon" src="${getIcon(this.cursor.id)}"><span class="cnt">${this.cursor.count > 1 ? this.cursor.count : ''}</span>`;
    } else cur.classList.add('hidden');
    this.updateRecipeBook();
  }

  updateContainer() {
    const c = this.container;
    if (!c) return;
    if (c.kind === 'furnace') {
      const be = c.be;
      for (const s of this.slots) this.renderSlot(s);
      c.flame.style.height = be.burnMax > 0 ? Math.max(0, Math.min(100, (be.burn / be.burnMax) * 100)) + '%' : '0%';
      c.arrow.style.width = Math.min(100, (be.cook / 8) * 100) * 0.22 + 'px';
    }
    if (c.recipeEls) this.updateRecipeBook();
  }

  onMove(e) {
    const cur = $('cursor-item');
    if (this.cursor) { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }
    if (!this.container) return;
    const t = e.target.closest ? e.target.closest('.slot, .rslot') : null;
    const tip = $('tooltip');
    this.hovered = t && t._slot ? t._slot : null;
    let html = '';
    if (t && t._recipe) {
      const r = t._recipe, d = DEFS[r.result[0]];
      const need = {};
      for (const spec of r.pattern) { if (!spec) continue; const n = describeIngredient(spec).name; need[n] = (need[n] || 0) + 1; }
      html = `<div class="tn">${d.name}${r.result[1] > 1 ? ' ×' + r.result[1] : ''}</div><div class="td">${Object.entries(need).map(([n, k]) => `${k}× ${n}`).join('<br>')}</div>`;
    } else if (t && t._slot && !this.cursor) {
      const s = t._slot.get();
      if (s) html = this.itemTip(s);
    }
    if (html) {
      tip.innerHTML = html; tip.classList.remove('hidden');
      const x = Math.min(window.innerWidth - tip.offsetWidth - 8, e.clientX + 16);
      const y = Math.min(window.innerHeight - tip.offsetHeight - 8, e.clientY + 16);
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    } else tip.classList.add('hidden');
  }

  itemTip(s) {
    const d = DEFS[s.id];
    let extra = '';
    if (d.durability) extra += `Durability ${d.durability - (s.dmg || 0)} / ${d.durability}<br>`;
    if (d.damage) extra += `Attack damage ${d.damage}<br>`;
    if (d.tool && d.tool !== 'sword') extra += `Mining speed ×${d.speed}<br>`;
    if (d.food) extra += `Restores ${d.food[0]} hunger<br>`;
    if (d.fuel) extra += `Fuel: ${d.fuel}s<br>`;
    if (SMELTING.has(s.id)) extra += `Smelts into ${DEFS[SMELTING.get(s.id)[0]].name}<br>`;
    return `<div class="tn">${d.name}</div>${extra ? `<div class="td">${extra}</div>` : ''}`;
  }
}

export { B, I };
