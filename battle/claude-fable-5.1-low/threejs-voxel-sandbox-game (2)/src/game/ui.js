import { iconCanvas } from './textures.js';
import { getDef, maxStack, B, TIER_NAMES, BLOCKS } from './blocks.js';
import { RECIPES, canCraft, craft, missing } from './crafting.js';
import { listWorlds, deleteWorld } from './save.js';

const $ = (s) => document.querySelector(s);

function pixelIcon(rows, map) {
  const c = document.createElement('canvas'); c.width = c.height = 9; const ctx = c.getContext('2d');
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const col = map[r[x]]; if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); } } });
  return `url(${c.toDataURL()})`;
}
const HEART = ['.OO.OO...', 'ORROORRO.', 'ORRRRRRO.', 'ORRRRRRO.', '.ORRRRO..', '..ORRO...', '...OO....'];
const heartMap = (full) => ({ O: '#2a0a0a', R: full ? '#e8303a' : '#4a2a2a' });
const ICONS = {
  heartFull: pixelIcon(HEART, { O: '#2a0a0a', R: '#e8303a' }),
  heartHalf: pixelIcon(HEART.map(r => r.slice(0, 4).replace(/R/g, 'R') + r.slice(4).replace(/R/g, 'D')), { O: '#2a0a0a', R: '#e8303a', D: '#4a2a2a' }),
  heartEmpty: pixelIcon(HEART, heartMap(false)),
  foodFull: pixelIcon(['...OOOO..', '..ORRRRO.', '..ORRRRO.', '...ORRO..', '....OO...', '...OBO...', '..OBO....', '.OBO.....', '.OO......'], { O: '#2a1a0a', R: '#c8783a', B: '#e8d8c0' }),
  foodHalf: pixelIcon(['...OOOO..', '..ORRRRO.', '..ORRRRO.', '...ORRO..', '....OO...', '...OBO...', '..OBO....', '.OBO.....', '.OO......'], { O: '#2a1a0a', R: '#6a4a30', B: '#8a8070' }),
  foodEmpty: pixelIcon(['...OOOO..', '..O....O.', '..O....O.', '...O..O..', '....OO...', '...O.O...', '..O.O....', '.O.O.....', '.OO......'], { O: '#2a1a0a' }),
  bubble: pixelIcon(['..OOOO...', '.OWWBBO..', 'OWBBBBBO.', 'OBBBBBBO.', 'OBBBBBBO.', '.OBBBBO..', '..OOOO...'], { O: '#1a3a6a', B: '#6ab0f0', W: '#d0ecff' }),
};

export class UI {
  constructor(game) {
    this.g = game;
    this.cursor = null; // stack held by mouse in inventory
    this.invOpen = false; this.station = null; this.craftCat = 'all'; this.selectedRecipe = null;
    this.msgTimer = null;
    this.bind();
  }
  bind() {
    const g = this.g;
    $('#btn-new').onclick = () => { $('#new-world').classList.remove('hidden'); $('.title-panel').classList.add('hidden'); $('#nw-name').focus(); };
    $('#nw-cancel').onclick = () => { $('#new-world').classList.add('hidden'); $('.title-panel').classList.remove('hidden'); };
    document.querySelectorAll('.seg button').forEach(b => b.onclick = () => { document.querySelectorAll('.seg button').forEach(x => x.classList.remove('on')); b.classList.add('on'); });
    $('#nw-create').onclick = () => {
      const name = $('#nw-name').value.trim() || 'My World';
      const seedStr = $('#nw-seed').value.trim();
      const mode = document.querySelector('.seg button.on').dataset.mode;
      $('#new-world').classList.add('hidden'); $('.title-panel').classList.remove('hidden');
      g.newWorld(name, seedStr, mode);
    };
    $('#btn-resume').onclick = () => g.resume();
    $('#btn-save').onclick = () => { g.save(); this.message('World saved'); };
    $('#btn-quit').onclick = () => g.quitToMenu();
    $('#btn-respawn').onclick = () => g.respawn();
    // settings
    const s = g.settings;
    const bindRange = (id, key, fmt, onChange) => {
      const el = $('#' + id), val = $('#' + id + '-val'); el.value = s[key]; val.textContent = fmt(s[key]);
      el.oninput = () => { s[key] = parseFloat(el.value); val.textContent = fmt(s[key]); onChange && onChange(s[key]); g.saveSettings(); };
    };
    bindRange('rd', 'renderDistance', v => v + ' chunks', v => g.setRenderDistance(v));
    bindRange('sens', 'sensitivity', v => v.toFixed(1) + '×');
    bindRange('vol', 'volume', v => Math.round(v * 100) + '%', v => g.audio.setVolume(v));
    bindRange('fov', 'fov', v => v + '°');
    // craft tabs
    document.querySelectorAll('.craft-tabs button').forEach(b => b.onclick = () => { document.querySelectorAll('.craft-tabs button').forEach(x => x.classList.remove('on')); b.classList.add('on'); this.craftCat = b.dataset.cat; this.renderRecipes(); });
    document.addEventListener('mousemove', (e) => { const c = $('#cursor-item'); c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; const tt = $('#tooltip'); tt.style.left = e.clientX + 'px'; tt.style.top = e.clientY + 'px'; });
    $('#inventory').addEventListener('contextmenu', e => e.preventDefault());
  }

  // ---------- screens ----------
  show(id) { $('#' + id).classList.remove('hidden'); }
  hide(id) { $('#' + id).classList.add('hidden'); }
  showMenu() { this.renderWorldList(); this.show('menu'); this.hide('hud'); this.hide('pause'); this.hide('death'); this.hide('inventory'); this.hide('loading'); }
  renderWorldList() {
    const list = listWorlds(); const el = $('#world-list'); el.innerHTML = '';
    if (!list.length) { el.innerHTML = '<div class="empty">No worlds yet — create one to start playing.</div>'; return; }
    for (const w of list) {
      const d = document.createElement('div'); d.className = 'world-item';
      const mins = Math.round((w.playtime || 0) / 60);
      d.innerHTML = `<div class="info"><div class="name">${esc(w.name)}</div><div class="meta">${w.mode === 'creative' ? 'Creative' : 'Survival'} · seed ${w.seed} · ${mins} min played · ${new Date(w.played).toLocaleDateString()}</div></div>`;
      const play = document.createElement('button'); play.className = 'primary'; play.textContent = 'Play'; play.onclick = () => this.g.loadWorld(w);
      const del = document.createElement('button'); del.className = 'del'; del.textContent = 'Delete'; del.onclick = () => { if (confirm(`Delete "${w.name}"? This cannot be undone.`)) { deleteWorld(w.id); this.renderWorldList(); } };
      d.append(play, del); el.appendChild(d);
    }
  }
  setLoading(frac, tip) { this.show('loading'); $('#load-bar').style.width = Math.round(frac * 100) + '%'; if (tip) $('#load-tip').textContent = tip; }
  showGame() { this.hide('menu'); this.hide('loading'); this.hide('pause'); this.hide('death'); this.show('hud'); this.renderHotbar(); this.updateStats(); setTimeout(() => { $('#hint').style.opacity = 0; }, 14000); }
  showPause() { this.show('pause'); }
  hidePause() { this.hide('pause'); }
  showDeath(cause) {
    const causes = { fall: 'You fell from a high place.', mob: 'You were slain by a monster.', drown: 'You drowned.', lava: 'You tried to swim in lava.', starve: 'You starved to death.', cactus: 'You were pricked to death.', void: 'You fell out of the world.', arrow: 'You were shot by a skeleton.' };
    $('#death-cause').textContent = causes[cause] || 'You died.'; this.show('death');
  }
  hideDeath() { this.hide('death'); }
  message(text, ms = 2200) {
    const m = $('#msg'); m.textContent = text; m.classList.add('show');
    clearTimeout(this.msgTimer); this.msgTimer = setTimeout(() => m.classList.remove('show'), ms);
  }

  // ---------- HUD ----------
  updateStats() {
    const p = this.g.player; const creative = this.g.mode === 'creative';
    $('#stats').style.visibility = creative ? 'hidden' : 'visible';
    const hearts = $('#hearts'); hearts.innerHTML = '';
    for (let i = 0; i < 10; i++) { const el = document.createElement('i'); const v = p.hp - i * 2; el.style.backgroundImage = v >= 2 ? ICONS.heartFull : v === 1 ? ICONS.heartHalf : ICONS.heartEmpty; if (p.hp <= 4) el.style.animation = `shake .4s infinite ${i * 0.05}s`; hearts.appendChild(el); }
    const food = $('#food'); food.innerHTML = '';
    for (let i = 9; i >= 0; i--) { const el = document.createElement('i'); const v = p.food - i * 2; el.style.backgroundImage = v >= 2 ? ICONS.foodFull : v === 1 ? ICONS.foodHalf : ICONS.foodEmpty; food.appendChild(el); }
    const air = $('#air'); air.innerHTML = '';
    if (p.underwater && !creative) for (let i = 0; i < Math.ceil(p.air); i++) { const el = document.createElement('i'); el.style.backgroundImage = ICONS.bubble; air.appendChild(el); }
  }
  tick() {
    const g = this.g; const p = g.player;
    $('#clock').textContent = `${g.env.clockString()} · Day ${g.day}` + (g.env.raining ? (g.env.weather === 'storm' ? ' · ⛈ Storm' : ' · 🌧 Rain') : '');
    $('#biome').textContent = `${g.world.gen.biomeName(p.pos.x, p.pos.z)} · ${Math.floor(p.pos.x)}, ${Math.floor(p.pos.y)}, ${Math.floor(p.pos.z)}` + (g.mode === 'creative' ? (p.flying ? ' · Flying' : '') : ` · Lv ${p.level}`);
    $('#dmg-overlay').style.opacity = p.damageFlash * 0.9 + (p.hp <= 4 && p.alive && g.mode !== 'creative' ? 0.25 + Math.sin(performance.now() / 200) * 0.1 : 0);
    $('#water-overlay').style.opacity = p.underwater ? 1 : 0;
    if (this.lastAir !== Math.ceil(p.air) || this.lastUnder !== p.underwater) { this.lastAir = Math.ceil(p.air); this.lastUnder = p.underwater; this.updateStats(); }
  }
  renderHotbar() {
    const inv = this.g.inventory; const hb = $('#hotbar'); hb.innerHTML = '';
    for (let i = 0; i < 9; i++) { const s = this.slotEl(inv.slots[i]); if (i === inv.selected) s.classList.add('sel'); hb.appendChild(s); }
    const held = inv.held; const def = held ? getDef(held.id) : null;
    $('#held-name').textContent = def ? def.name : '';
    if (this.invOpen) this.renderInventory();
  }
  slotEl(stack) {
    const s = document.createElement('div'); s.className = 'slot';
    if (stack) {
      s.appendChild(iconCanvas(stack.id));
      if (stack.count > 1) { const c = document.createElement('span'); c.className = 'count'; c.textContent = stack.count; s.appendChild(c); }
      const def = getDef(stack.id);
      if (def.durability && stack.dur !== undefined && stack.dur < def.durability) {
        const f = stack.dur / def.durability; const d = document.createElement('div'); d.className = 'dur';
        d.innerHTML = `<b style="width:${f * 100}%;background:hsl(${f * 120},80%,50%)"></b>`; s.appendChild(d);
      }
    }
    return s;
  }

  // ---------- inventory ----------
  openInventory(station = null) {
    if (this.invOpen) return;
    this.invOpen = true; this.station = station;
    this.show('inventory'); this.g.onUIOpen();
    this.renderInventory(); this.renderRecipes();
  }
  closeInventory() {
    if (!this.invOpen) return;
    this.invOpen = false;
    if (this.cursor) { const left = this.g.inventory.add(this.cursor.id, this.cursor.count); if (left) this.g.drops.spawn(this.g.player.pos.x, this.g.player.pos.y + 1, this.g.player.pos.z, this.cursor.id, left); this.cursor = null; }
    this.hide('inventory'); this.hide('tooltip'); $('#cursor-item').innerHTML = '';
    this.g.onUIClose();
  }
  toggleInventory() { this.invOpen ? this.closeInventory() : this.openInventory(this.nearbyStation()); }
  nearbyStation() {
    const p = this.g.player.pos, w = this.g.world; let table = false, furnace = false;
    for (let dx = -4; dx <= 4; dx++) for (let dy = -3; dy <= 3; dy++) for (let dz = -4; dz <= 4; dz++) {
      const b = w.getBlock(Math.floor(p.x + dx), Math.floor(p.y + dy), Math.floor(p.z + dz));
      if (b === B.CRAFTING_TABLE) table = true; if (b === B.FURNACE) furnace = true;
    }
    return table && furnace ? 'both' : table ? 'table' : furnace ? 'furnace' : null;
  }
  stations() {
    const s = this.station; const near = this.nearbyStation();
    const table = s === 'table' || s === 'both' || near === 'table' || near === 'both';
    const furnace = s === 'furnace' || s === 'both' || near === 'furnace' || near === 'both';
    return { table, furnace };
  }
  renderInventory() {
    const inv = this.g.inventory;
    const main = $('#inv-main'), hot = $('#inv-hotbar'); main.innerHTML = ''; hot.innerHTML = '';
    for (let i = 0; i < 36; i++) {
      const el = this.slotEl(inv.slots[i]); el.classList.add('clickable');
      el.onmousedown = (e) => { e.preventDefault(); this.slotClick(i, e.button === 2, e.shiftKey); };
      el.onmouseenter = () => this.tooltip(inv.slots[i]); el.onmouseleave = () => this.hide('tooltip');
      (i < 9 ? hot : main).appendChild(el);
    }
    const c = $('#cursor-item'); c.innerHTML = '';
    if (this.cursor) { c.appendChild(iconCanvas(this.cursor.id)); if (this.cursor.count > 1) { const n = document.createElement('span'); n.className = 'count'; n.textContent = this.cursor.count; c.appendChild(n); } }
    const st = this.stations();
    $('#craft-station').textContent = st.table && st.furnace ? 'table + furnace' : st.table ? 'crafting table' : st.furnace ? 'furnace' : 'by hand';
  }
  tooltip(stack) {
    if (!stack) { this.hide('tooltip'); return; }
    const d = getDef(stack.id); const tt = $('#tooltip');
    let sub = '';
    if (d.tool) sub = `${TIER_NAMES[d.tier]} ${d.tool} · ${stack.dur ?? d.durability}/${d.durability}`;
    else if (d.food) sub = `Restores ${d.food / 2} hunger`;
    else if (stack.id < 100 && d.light) sub = `Light source`;
    else if (stack.id < 100 && d.tool) sub = `Needs ${TIER_NAMES[d.minTier] || 'any'} ${d.tool}`;
    tt.innerHTML = `${esc(d.name)}${sub ? `<small>${esc(sub)}</small>` : ''}`; this.show('tooltip');
  }
  slotClick(i, right, shift) {
    const inv = this.g.inventory; const slots = inv.slots; const s = slots[i];
    this.g.audio.click();
    if (shift && s && !this.cursor) {
      // move between hotbar and main
      const range = i < 9 ? [9, 36] : [0, 9];
      let rest = s.count;
      for (let j = range[0]; j < range[1] && rest > 0; j++) { const t = slots[j]; if (t && t.id === s.id && t.count < maxStack(s.id) && s.dur === undefined) { const n = Math.min(maxStack(s.id) - t.count, rest); t.count += n; rest -= n; } }
      for (let j = range[0]; j < range[1] && rest > 0; j++) { if (!slots[j]) { slots[j] = { ...s, count: rest }; rest = 0; } }
      if (rest === 0) slots[i] = null; else s.count = rest;
      inv.changed(); return;
    }
    if (!this.cursor) {
      if (!s) return;
      if (right) { const half = Math.ceil(s.count / 2); this.cursor = { ...s, count: half }; s.count -= half; if (s.count <= 0) slots[i] = null; }
      else { this.cursor = s; slots[i] = null; }
    } else {
      if (!s) { if (right) { slots[i] = { ...this.cursor, count: 1 }; this.cursor.count--; if (this.cursor.count <= 0) this.cursor = null; } else { slots[i] = this.cursor; this.cursor = null; } }
      else if (s.id === this.cursor.id && s.dur === undefined) {
        const max = maxStack(s.id); const n = Math.min(right ? 1 : this.cursor.count, max - s.count);
        s.count += n; this.cursor.count -= n; if (this.cursor.count <= 0) this.cursor = null;
      } else if (!right) { slots[i] = this.cursor; this.cursor = s; }
    }
    inv.changed();
  }

  // ---------- crafting ----------
  renderRecipes() {
    const inv = this.g.inventory, st = this.stations(); const el = $('#recipes'); el.innerHTML = '';
    const list = RECIPES.filter(r => this.craftCat === 'all' || r.cat === this.craftCat);
    for (const r of list) {
      const s = this.slotEl({ id: r.out[0], count: r.out[1] }); s.classList.add('clickable');
      if (!canCraft(r, inv, st)) s.classList.add('no');
      if (r === this.selectedRecipe) s.classList.add('rsel');
      s.onmousedown = (e) => { e.preventDefault(); this.selectedRecipe = r; this.renderRecipes(); if (e.shiftKey) this.doCraft(r, true); };
      s.onmouseenter = () => this.tooltip({ id: r.out[0], count: r.out[1] }); s.onmouseleave = () => this.hide('tooltip');
      el.appendChild(s);
    }
    this.renderRecipeDetail();
  }
  renderRecipeDetail() {
    const r = this.selectedRecipe; const el = $('#recipe-detail'); const inv = this.g.inventory, st = this.stations();
    if (!r) { el.innerHTML = '<div class="note">Select a recipe to see its ingredients. Tools require a crafting table; smelting needs a furnace and coal as fuel.</div>'; return; }
    const out = getDef(r.out[0]);
    el.innerHTML = `<div class="rname">${esc(out.name)} ×${r.out[1]}</div>`;
    for (const m of missing(r, inv)) {
      const d = document.createElement('div'); d.className = 'ing' + (m.have < m.need ? ' missing' : '');
      d.appendChild(iconCanvas(m.id)); const t = document.createElement('span'); t.textContent = `${getDef(m.id).name} — ${m.have}/${m.need}`; d.appendChild(t); el.appendChild(d);
    }
    if (r.station) { const n = document.createElement('div'); n.className = 'note'; n.textContent = r.station === 'table' ? (st.table ? 'Crafting table in range' : 'Requires a crafting table nearby') : (st.furnace ? 'Furnace in range' : 'Requires a furnace nearby'); el.appendChild(n); }
    const row = document.createElement('div'); row.className = 'row';
    const b = document.createElement('button'); b.className = 'primary'; b.textContent = 'Craft'; b.disabled = !canCraft(r, inv, st); b.onclick = () => this.doCraft(r, false);
    const b2 = document.createElement('button'); b2.textContent = 'Craft All'; b2.disabled = b.disabled; b2.onclick = () => this.doCraft(r, true);
    row.append(b, b2); el.appendChild(row);
  }
  doCraft(r, all) {
    const inv = this.g.inventory, st = this.stations(); let n = 0;
    do { const res = craft(r, inv, st); if (!res) break; n++; if (res.leftover) { this.g.drops.spawn(this.g.player.pos.x, this.g.player.pos.y + 1, this.g.player.pos.z, r.out[0], res.leftover); break; } } while (all && n < 64);
    if (n) { this.g.audio.craft(); this.g.player.stats.crafted += n; this.g.player.addXp(0); }
    this.renderInventory(); this.renderRecipes(); this.renderHotbar();
  }
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
void BLOCKS;
