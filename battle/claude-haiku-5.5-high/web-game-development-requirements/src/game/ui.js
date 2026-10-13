// Civilization Micro — DOM interface (HUD, panels, modals, screens)
import {
  TERRAIN, RESOURCES, IMPROVEMENTS, BUILDINGS, WONDERS, UNITS, TECHS, CIVS, ERAS,
  DIFFICULTY, MAP_SIZES, MAX_TURN, LEGACY,
} from './data.js';
import {
  G, SEL, TECH, cityAt, cityYields, tileYields, itemCost, itemName, buyCost, availableItems,
  researchable, techCost, civScore, growNeed, unitsAt, canFound, startBuild, civWonders,
  civResources, isCoastal, log,
} from './engine.js';

let ROOT = null;
const $ = (s) => (ROOT ? ROOT.querySelector(s) : null);

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (v, m) => Math.max(0, Math.min(100, m > 0 ? (v / m) * 100 : 0));
const eraOf = (civ) => civ.researched.reduce((a, id) => Math.max(a, TECH[id] ? TECH[id].era : 0), 0);
const fmt = (n) => (Math.round(n * 10) / 10).toString();

export function buildShell(root) {
  ROOT = root;
  root.innerHTML = `
  <div class="cm-app">
    <section id="scr-title" class="scr active">
      <canvas id="title-bg" class="title-bg"></canvas>
      <div class="title-vignette"></div>
      <div class="title-wrap">
        <div class="title-badge">🏛️ A turn-based 4X strategy game</div>
        <h1 class="title-h">CIVILIZATION <span>MICRO</span></h1>
        <p class="title-sub">Found. Expand. Research. Conquer.</p>
        <div class="title-menu" id="title-body"></div>
        <div class="title-foot">Synthesized music &amp; sound · Saves &amp; legacy stored in this browser</div>
      </div>
    </section>

    <section id="scr-setup" class="scr">
      <div class="setup-wrap"><div id="setup-body"></div></div>
    </section>

    <section id="scr-game" class="scr">
      <header class="topbar" id="topbar"></header>
      <main class="stage" id="stage">
        <canvas id="map" class="map-canvas"></canvas>
        <div class="tut hidden" id="tut"></div>
        <div class="minimap-box" id="mmbox"><canvas id="mm"></canvas></div>
        <div class="zoom-ctl">
          <button data-act="zoom-in" title="Zoom in (+)">+</button>
          <button data-act="zoom-out" title="Zoom out (-)">−</button>
          <button data-act="center-capital" title="Center on capital (Home)">⌂</button>
          <button data-act="toggle-log" title="Event log (L)">📜</button>
        </div>
        <aside class="side" id="side"></aside>
        <div class="log hidden" id="log"></div>
        <div class="toasts" id="toasts"></div>
      </main>
      <footer class="bottombar" id="bottombar"></footer>
    </section>

    <div class="modal hidden" id="modal">
      <div class="modal-box" role="dialog" aria-modal="true">
        <div class="modal-head"><h2 id="modal-title"></h2><button class="x" data-act="close-modal" title="Close (Esc)">✕</button></div>
        <div class="modal-body" id="modal-body"></div>
      </div>
    </div>
  </div>`;
}

export function showScreen(name) {
  ['title', 'setup', 'game'].forEach((n) => {
    const el = $(`#scr-${n}`);
    if (el) el.classList.toggle('active', n === name);
  });
}

/* ---------------- HUD ---------------- */

export function renderTop() {
  const el = $('#topbar');
  const P = G.civs && G.civs[0];
  if (!el || !P) return;
  const cur = P.researching ? TECH[P.researching] : null;
  const cost = cur ? techCost(cur.id) : 0;
  const sciPT = P.perTurn.sci || 0;
  const turnsLeft = cur ? Math.max(1, Math.ceil((cost - P.bulbs) / Math.max(1, sciPT))) : 0;
  const gd = P.perTurn.gold;
  const cultLeft = Math.max(0, Math.ceil((G.cultureGoal - P.culture) / Math.max(0.1, P.perTurn.cul || 0)));
  el.innerHTML = `
    <div class="tb-civ">
      <span class="civ-ico" style="background:${P.col}">${(CIVS.find((c) => c.id === P.id) || {}).icon || ''}</span>
      <div class="civ-name"><b>${esc(P.name)}</b><small>${esc(P.leader)}</small></div>
    </div>
    <div class="tb-pill" title="Turn ${G.turn} of ${MAX_TURN}">Turn <b>${G.turn}</b><small>/${MAX_TURN}</small></div>
    <div class="tb-pill era" title="Current era">${ERAS[eraOf(P)]}</div>
    <div class="tb-res">
      <div class="res" title="Gold — buys items; upkeep drains it. Negative gold slows production.">
        <span class="ri">💰</span><b>${Math.floor(P.gold)}</b>
        <span class="delta ${gd >= 0 ? 'pos' : 'neg'}">${gd >= 0 ? '+' : ''}${fmt(gd)}</span>
      </div>
      <div class="res sci" title="Research — science accumulates into the current tech.">
        <span class="ri">🔬</span>
        <div class="res-col">
          <span class="res-l">${cur ? esc(cur.name) : '<em class="warn">Choose research!</em>'}</span>
          <div class="mini"><i style="width:${cur ? pct(P.bulbs, cost) : 0}%"></i></div>
        </div>
        <span class="res-n">${cur ? turnsLeft + 't' : ''}</span>
      </div>
      <div class="res cul" title="Culture — reach ${G.cultureGoal} for a cultural victory. Also grows borders.">
        <span class="ri">🎭</span>
        <div class="res-col">
          <span class="res-l">${Math.floor(P.culture)} / ${G.cultureGoal}</span>
          <div class="mini"><i style="width:${pct(P.culture, G.cultureGoal)}%"></i></div>
        </div>
        <span class="res-n">${G.opts.cul && cultLeft && P.perTurn.cul > 0 ? '~' + cultLeft + 't' : ''}</span>
      </div>
      <div class="res" title="Score">
        <span class="ri">⭐</span><b>${civScore(0)}</b>
      </div>
    </div>
    <div class="tb-actions">
      <button data-act="open-tech" title="Research (T)">🔬<span class="lbl"> Research</span></button>
      <button data-act="open-diplo" title="Diplomacy (D)">🤝<span class="lbl"> Diplomacy</span></button>
      <button data-act="open-pause" title="Menu (Esc)">☰</button>
    </div>`;
}

export function renderBottom() {
  const el = $('#bottombar');
  if (!el) return;
  const idle = G.units.filter((u) => u.o === 0 && u.mp > 0 && !u.fort && !(u.type === 'worker' && u.job)).length;
  let left = '';
  const b = (label, key, act, cls = '', extra = '') => `<button class="${cls}" data-act="${act}" ${extra}>${label}${key ? ` <kbd>${key}</kbd>` : ''}</button>`;
  if (SEL.kind === 'unit') {
    const u = G.units.find((x) => x.id === SEL.id);
    if (u && u.o === 0) {
      left += b('💤 Fortify', 'F', 'fortify');
      left += b('⏭ Skip', 'S', 'skip');
      if (u.type === 'settler') left += b('🏙️ Found City', 'C', 'found', 'hl');
      if (u.type === 'worker') left += b('🛠 Build…', 'B', 'build', 'hl');
    }
  } else if (SEL.kind === 'city') {
    const c = G.cities.find((x) => x.id === SEL.id);
    if (c && c.o === 0) {
      left += b('🏛️ Manage City', 'Enter', 'open-city', 'hl', `data-cid="${c.id}"`);
      const bc = buyCost(c);
      if (bc !== null) left += b(`💰 Buy (${bc})`, '', 'buy', '', `data-cid="${c.id}"`);
    }
  }
  left += b(`➤ Next Unit${idle ? ` <span class="badge">${idle}</span>` : ''}`, 'Space', 'next-unit');
  left += b('⌂ Capital', 'Home', 'center-capital');
  el.innerHTML = `<div class="bb-left">${left}</div><div class="bb-right">${b('End Turn', 'Enter', 'end-turn', 'primary big')}</div>`;
}

function unitCard(u) {
  const d = UNITS[u.type];
  const tile = G.tiles[u.i];
  const T = TERRAIN[tile.t];
  let h = `<div class="card"><div class="card-head"><span class="big-ico">${d.icon}</span>
    <div><h3>${esc(d.name)}</h3><small>${u.o === 0 ? 'Your unit' : 'Unit of ' + esc(G.civs[u.o].name)}</small></div></div>`;
  h += `<div class="bar hpbar"><i style="width:${u.hp}%"></i><span>${u.hp} / 100 HP</span></div>`;
  h += `<div class="stats-row"><span>⚔️ ${d.atk}</span><span>🛡️ ${d.def}</span><span>👣 ${u.mp}/${u.mv}</span>${d.rng ? `<span>🎯 range ${d.rng}</span>` : ''}</div>`;
  h += `<p class="muted">${esc(d.desc)}</p>`;
  h += `<div class="tile-line">${T.name} · +${Math.round(T.def * 100)}% defense · ${tile.own >= 0 ? 'Territory of ' + esc(G.civs[tile.own].name) : 'Unclaimed land'}</div>`;
  if (u.fort) h += `<div class="chip ok">Fortified · +25% defense</div>`;
  if (u.type === 'worker') {
    if (u.job) {
      const turns = IMPROVEMENTS[u.job.t].turns;
      h += `<div class="section-l">Building ${esc(IMPROVEMENTS[u.job.t].name)}</div>
        <div class="bar"><i style="width:${pct(u.job.p, turns)}%"></i><span>${u.job.p}/${turns} turns ${u.job.i === u.i ? '' : '· move back to the tile'}</span></div>`;
    } else {
      h += `<div class="hint">Press <kbd>B</kbd> to choose an improvement for this tile.</div>`;
    }
  }
  if (u.type === 'settler') {
    const err = canFound(u);
    h += err ? `<div class="chip bad">${esc(err)}</div>` : `<div class="chip ok">Ready — press <kbd>C</kbd> to found a city here.</div>`;
  }
  if (u.o === 0 && SEL.moves && SEL.moves.size) h += `<div class="hint">Blue hexes: move · red hexes: attack.</div>`;
  return h + `</div>`;
}

function cityCard(c) {
  const y = cityYields(c);
  const civ = G.civs[c.o];
  const p = c.prod || { k: 'u', id: 'warrior' };
  const cost = itemCost(c, p);
  let h = `<div class="card"><div class="card-head"><span class="big-ico">${c.cap ? '🏰' : '🏘️'}</span>
    <div><h3>${esc(c.name)}</h3><small>${c.o === 0 ? 'Population ' + c.size : esc(civ.name) + ' · pop ' + c.size}${c.cap ? ' · Capital' : ''}</small></div></div>`;
  h += `<div class="section-l">Growth</div><div class="bar grow"><i style="width:${pct(c.food, y.need)}%"></i><span>${c.food}/${y.need} food · ${y.surplus >= 0 ? '+' : ''}${y.surplus}/turn</span></div>`;
  h += `<div class="section-l">Production: ${esc(itemName(p))}</div><div class="bar prod"><i style="width:${pct(c.stock, cost)}%"></i><span>${c.stock}/${cost} · ${Math.max(1, Math.ceil((cost - c.stock) / Math.max(1, y.p * civ.mult.p)))} turns</span></div>`;
  h += `<div class="yields">
    <span title="Food">🍞 ${y.f}</span><span title="Production">⚒️ ${Math.round(y.p * civ.mult.p)}</span>
    <span title="Gold">💰 ${fmt(y.g)}</span><span title="Science">🔬 ${fmt(y.s * civ.mult.s)}</span><span title="Culture">🎭 ${fmt(y.cu)}</span></div>`;
  h += `<div class="hint">Content ${y.content} · Unhappy ${y.unhappy}${y.unhappy ? ' (−prod)' : ''} · size cap ${y.cap}</div>`;
  if (c.o === 0) {
    const bc = buyCost(c);
    h += `<div class="row-btns"><button class="hl" data-act="open-city" data-cid="${c.id}">🏛️ Manage</button>${bc !== null ? `<button data-act="buy" data-cid="${c.id}">💰 Buy · ${bc}</button>` : ''}</div>`;
  }
  return h + `</div>`;
}

function tileCard(i) {
  const t = G.tiles[i];
  const T = TERRAIN[t.t];
  const y = tileYields(i);
  const worked = G.cities.find((c) => c.worked.includes(i));
  const occ = unitsAt(i);
  let h = `<div class="card"><div class="card-head"><span class="big-ico">${T.deco || '🌍'}</span>
    <div><h3>${esc(T.name)}</h3><small>${t.own >= 0 ? 'Owned by ' + esc(G.civs[t.own].name) : 'Unclaimed'}</small></div></div>`;
  h += `<div class="yields"><span>🍞 ${y.f}</span><span>⚒️ ${y.p}</span><span>💰 ${fmt(y.g)}</span><span>🔬 ${y.s}</span><span>🎭 ${y.cu}</span></div>`;
  if (t.r) h += `<div class="tile-line">${RESOURCES[t.r].icon} ${RESOURCES[t.r].name}${RESOURCES[t.r].strat ? ' <em>(strategic)</em>' : ''}</div>`;
  if (t.imp) h += `<div class="tile-line">${IMPROVEMENTS[t.imp].icon} ${IMPROVEMENTS[t.imp].name}</div>`;
  if (worked) h += `<div class="tile-line">Worked by ${esc(worked.name)}</div>`;
  if (occ.length) h += `<div class="tile-line">${occ.map((u) => UNITS[u.type].icon + ' ' + UNITS[u.type].name).join(', ')}</div>`;
  if (!TERRAIN[t.t].pass) h += `<div class="hint">Impassable terrain.</div>`;
  return h + `</div>`;
}

function overviewCard() {
  const P = G.civs[0];
  const mine = G.cities.filter((c) => c.o === 0);
  const idle = G.units.filter((u) => u.o === 0 && u.mp > 0 && !u.fort && !(u.type === 'worker' && u.job));
  const research = P.researching ? '' : `<div class="chip bad">No research selected — press <kbd>T</kbd>.</div>`;
  let h = `<div class="card"><div class="card-head"><span class="big-ico">${P.icon || '🏛️'}</span><div><h3>${esc(P.name)} overview</h3><small>${esc(CIVS[0].ability)}</small></div></div>`;
  h += `${research}<div class="stats-grid">
    <div><b>${mine.length}</b><small>Cities</small></div>
    <div><b>${mine.reduce((a, c) => a + c.size, 0)}</b><small>Population</small></div>
    <div><b>${G.units.filter((u) => u.o === 0).length}</b><small>Units</small></div>
    <div><b>${P.researched.length}/${TECHS.length}</b><small>Techs</small></div>
    <div><b>${G.stats.kills}</b><small>Kills</small></div>
    <div><b>${civWonders(0).size}</b><small>Wonder types</small></div></div>`;
  if (idle.length) {
    h += `<div class="section-l">Idle units (${idle.length})</div><div class="idle-list">`;
    for (const u of idle.slice(0, 10)) h += `<button data-act="select-unit" data-uid="${u.id}">${UNITS[u.type].icon} ${UNITS[u.type].name}</button>`;
    h += `</div>`;
  }
  h += `<div class="hint">Click a hex to inspect it. Click a city to manage production. Click your units to move them.</div>`;
  h += `<div class="legend"><span><i class="lg move"></i>Move</span><span><i class="lg atk"></i>Attack</span><span><i class="lg own"></i>Borders</span></div>`;
  return h + `</div>`;
}

export function renderSide() {
  const side = $('#side');
  if (!side) return;
  let html = '';
  if (SEL.kind === 'unit') {
    const u = G.units.find((x) => x.id === SEL.id);
    if (u) html = unitCard(u);
    else { SEL.kind = null; SEL.id = null; }
  }
  if (!html && SEL.kind === 'city') {
    const c = G.cities.find((x) => x.id === SEL.id);
    if (c) html = cityCard(c);
    else { SEL.kind = null; SEL.id = null; }
  }
  if (!html && SEL.kind === 'tile' && SEL.i >= 0) html = tileCard(SEL.i);
  if (!html) html = overviewCard();
  side.innerHTML = html;
}

export function renderLog() {
  const el = $('#log');
  if (!el) return;
  const items = G.log.slice(-60).reverse();
  el.innerHTML = `<div class="log-head"><b>Chronicle</b><button data-act="toggle-log" class="x">✕</button></div>` +
    (items.length ? items.map((e) => `<div class="log-item ${esc(e.type || '')}"><span>T${e.t}</span> ${esc(e.text)}</div>`).join('') : '<div class="muted">Nothing yet.</div>');
}

export function toast(msg, kind = '') {
  const box = $('#toasts');
  if (!box) return;
  const d = document.createElement('div');
  d.className = `toast ${kind}`;
  d.textContent = msg;
  box.appendChild(d);
  while (box.children.length > 4) box.removeChild(box.firstChild);
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 350); }, 2900);
}

export function turnBanner(text) {
  const box = $('#toasts');
  if (!box) return;
  const d = document.createElement('div');
  d.className = 'banner';
  d.textContent = text;
  box.appendChild(d);
  setTimeout(() => d.remove(), 1500);
}

export function renderTutorial(step) {
  const el = $('#tut');
  if (!el) return;
  if (!step) { el.classList.add('hidden'); el.innerHTML = ''; return; }
  el.classList.remove('hidden');
  el.innerHTML = `<div class="tut-box"><div class="tut-step">Advisor · ${step.n}/${step.total}</div>
    <div class="tut-text">${step.text}</div>
    <div class="row-btns"><button data-act="tut-skip">Skip tutorial</button>${step.canNext ? '<button class="hl" data-act="tut-next">Got it →</button>' : ''}</div></div>`;
}

/* ---------------- modals ---------------- */

export function openModal(title, html, cls = '') {
  const m = $('#modal');
  if (!m) return;
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = html;
  const box = m.querySelector('.modal-box');
  box.className = 'modal-box ' + cls;
  m.classList.remove('hidden');
  m.scrollTop = 0;
  const body = $('#modal-body');
  if (body) body.scrollTop = 0;
}
export function closeModal() {
  const m = $('#modal');
  if (m) m.classList.add('hidden');
}
export function isModalOpen() {
  const m = $('#modal');
  return !!m && !m.classList.contains('hidden');
}

function unlocksOf(id) {
  const out = [];
  for (const k of Object.keys(UNITS)) if (UNITS[k].req === id && !UNITS[k].barb) out.push(UNITS[k].name + (UNITS[k].unique ? ' ★' : ''));
  for (const k of Object.keys(BUILDINGS)) if (BUILDINGS[k].req === id) out.push(BUILDINGS[k].name);
  for (const k of Object.keys(WONDERS)) if (WONDERS[k].req === id) out.push('🏛 ' + WONDERS[k].name);
  for (const k of Object.keys(IMPROVEMENTS)) if (IMPROVEMENTS[k].req === id) out.push(IMPROVEMENTS[k].name);
  if (id === 'space') out.push('🚀 Science victory');
  return out;
}

export function modalTech() {
  const P = G.civs[0];
  const cur = P.researching ? TECH[P.researching] : null;
  let h = `<div class="tech-head"><div><b>Researching:</b> ${cur ? esc(cur.name) + ` (${Math.floor(P.bulbs)}/${techCost(cur.id)})` : '<em class="warn">nothing — pick a technology below</em>'}</div>
    <div>Science per turn: <b>${P.perTurn.sci}</b></div></div>`;
  h += `<div class="tech-eras">`;
  for (let e = 0; e < ERAS.length; e++) {
    h += `<div class="era-col"><h4>${ERAS[e]}</h4>`;
    for (const t of TECHS.filter((x) => x.era === e)) {
      const done = P.researched.includes(t.id);
      const isCur = P.researching === t.id;
      const can = !done && t.pre.every((p) => P.researched.includes(p));
      const cls = done ? 'done' : isCur ? 'cur' : can ? 'avail' : 'locked';
      const need = t.pre.filter((p) => !P.researched.includes(p)).map((p) => TECH[p].name).join(', ');
      const unl = unlocksOf(t.id);
      h += `<button class="tech ${cls}" ${can ? `data-act="research" data-id="${t.id}"` : 'disabled'}>
        <span class="tn">${esc(t.name)}</span><span class="tc">${done ? '✓' : techCost(t.id) + ' 🔬'}</span>
        ${unl.length ? `<span class="tu">${esc(unl.join(', '))}</span>` : ''}
        <em>${done ? 'Learned' : isCur ? 'Researching…' : can ? 'Research' : 'Needs ' + esc(need)}</em></button>`;
    }
    h += `</div>`;
  }
  h += `</div><div class="hint">Techs unlock units, buildings, wonders and improvements. Space Flight wins the space race.</div>`;
  openModal('Research — Technology Tree', h, 'wide');
}

export function modalCity(c) {
  const civ = G.civs[c.o];
  const y = cityYields(c);
  const av = availableItems(c);
  const cur = c.prod || { k: 'u', id: 'warrior' };
  const cost = itemCost(c, cur);
  const curKey = `${cur.k}:${cur.id}`;
  const item = (k, id, desc, icon, name, cst) => `<button class="item ${curKey === k + ':' + id ? 'cur' : ''}" data-act="prod" data-k="${k}" data-id="${id}" data-cid="${c.id}">
      <span class="ii">${icon}</span><span class="in">${esc(name)}</span><span class="ic">${cst}⚒</span><small>${esc(desc)}</small></button>`;
  let h = `<div class="city-head"><div class="city-title"><span class="big-ico">${c.cap ? '🏰' : '🏘️'}</span>
    <div><h3>${esc(c.name)}</h3><small>${esc(civ.name)} · size ${c.size}/${y.cap} · ${c.cap ? 'Capital' : 'City'}</small></div></div>
    <div class="city-y"><span>🍞 ${y.f} (${y.surplus >= 0 ? '+' : ''}${y.surplus})</span><span>⚒️ ${Math.round(y.p * civ.mult.p)}</span><span>💰 ${fmt(y.g)}</span><span>🔬 ${fmt(y.s * civ.mult.s)}</span><span>🎭 ${fmt(y.cu)}</span></div></div>`;
  h += `<div class="city-status">
    <div class="bar grow"><i style="width:${pct(c.food, y.need)}%"></i><span>Growth ${c.food}/${y.need}</span></div>
    <div class="bar prod"><i style="width:${pct(c.stock, cost)}%"></i><span>${esc(itemName(cur))} ${c.stock}/${cost}</span></div>
    <div class="row-btns"><button data-act="buy" data-cid="${c.id}" ${buyCost(c) === null ? 'disabled' : ''}>💰 Buy current (${buyCost(c) ?? '—'} gold)</button></div>
    <div class="hint">Content ${y.content} · Unhappy ${y.unhappy}${y.unhappy ? ' — each unhappy citizen costs 1 production. Build Temples or Colosseums.' : ''}</div></div>`;
  h += `<div class="section-l">Units</div><div class="grid-items">${av.u.map((id) => item('u', id, UNITS[id].desc, UNITS[id].icon, UNITS[id].name, itemCost(c, { k: 'u', id }))).join('')}</div>`;
  h += `<div class="section-l">Buildings</div><div class="grid-items">${av.b.length ? av.b.map((id) => item('b', id, BUILDINGS[id].desc + ' · upkeep ' + BUILDINGS[id].up, BUILDINGS[id].icon, BUILDINGS[id].name, BUILDINGS[id].cost)).join('') : '<div class="muted">All available buildings are built.</div>'}</div>`;
  h += `<div class="section-l">Wonders</div><div class="grid-items">${av.w.length ? av.w.map((id) => item('w', id, WONDERS[id].desc, WONDERS[id].icon, WONDERS[id].name, itemCost(c, { k: 'w', id }))).join('') : '<div class="muted">No wonders available right now.</div>'}</div>`;
  h += `<div class="section-l">Built here</div><div class="chips">${c.b.map((id) => `<span class="chip">${BUILDINGS[id].icon} ${BUILDINGS[id].name}</span>`).join('') || '<span class="muted">No buildings yet.</span>'}${c.w.map((id) => `<span class="chip gold">${WONDERS[id].icon} ${WONDERS[id].name}</span>`).join('')}</div>`;
  openModal(`${c.name}`, h, 'wide');
}

export function modalDiplo() {
  const P = G.civs[0];
  let h = `<div class="hint">Opinion reflects your behavior: peace, trade and a small footprint raise it; war, border incursions and out-scoring them lower it.</div><div class="dip-list">`;
  for (const o of G.civs) {
    if (o.i === 0) continue;
    const r = G.rel[0][o.i];
    const alive = o.alive;
    const deal = G.deals.find((d) => (d.a === 0 && d.b === o.i) || (d.a === o.i && d.b === 0));
    const opPct = Math.round(((o.op + 100) / 200) * 100);
    const rLabel = !alive ? 'Destroyed' : r === 'war' ? '⚔️ War' : r === 'ally' ? '🤝 Alliance' : '🕊️ Peace';
    const cls = !alive ? 'dead' : r;
    h += `<div class="dip-card ${cls}">
      <div class="dip-head"><span class="civ-ico" style="background:${o.col}">${CIVS.find((c) => c.id === o.id).icon}</span>
        <div><b>${esc(o.name)}</b><small>${esc(o.leader)} · ${G.cities.filter((c) => c.o === o.i).length} cities · score ${civScore(o.i)}</small></div>
        <span class="status ${cls}">${rLabel}</span></div>
      <div class="op"><span>Opinion of you</span><div class="mini"><i style="width:${opPct}%"></i></div><b>${Math.round(o.op)}</b></div>
      ${deal ? `<div class="chip gold">Trade deal · ${deal.t} turns left (+3 💰/turn each)</div>` : ''}
      ${alive ? `<div class="row-btns">
        ${r === 'war' ? `<button data-act="dip" data-kind="peace" data-ci="${o.i}">🕊️ Propose peace</button>` : ''}
        ${r === 'peace' ? `<button data-act="dip" data-kind="ally" data-ci="${o.i}">🤝 Propose alliance</button>` : ''}
        ${r !== 'war' && !deal ? `<button data-act="dip" data-kind="trade" data-ci="${o.i}">💱 Trade deal (15 💰)</button>` : ''}
        ${r !== 'war' ? `<button class="danger" data-act="dip" data-kind="war" data-ci="${o.i}">⚔️ Declare war</button>` : ''}
      </div>` : ''}
    </div>`;
  }
  h += `</div><div class="hint">Your gold: <b>${Math.floor(P.gold)}</b>. AI answers instantly — watch the chronicle.</div>`;
  openModal('Diplomacy', h, 'wide');
}

export function modalPause(hasSaveNow, hasGame = true) {
  const btn = (label, act, cls = '') => `<button class="menu-btn ${cls}" data-act="${act}">${label}</button>`;
  let h = `<div class="menu-col">`;
  if (hasGame) {
    h += btn('▶ Resume', 'resume', 'primary');
    h += btn('💾 Save game', 'save');
    h += btn('📂 Load saved game', 'load', hasSaveNow ? '' : 'disabled');
  }
  h += btn('⚙️ Settings', 'open-settings');
  h += btn('❓ How to play & controls', 'open-help');
  h += btn('📊 Statistics', 'open-stats');
  if (hasGame) h += btn('🏠 Quit to title', 'quit', 'danger');
  h += `</div>`;
  if (hasGame) h += `<div class="hint center">Keyboard: Enter end turn · Space next unit · Esc menu · T research · D diplomacy</div>`;
  openModal('Menu', h);
}

export function modalSettings(s) {
  const tog = (k, label) => `<button class="toggle ${s[k] ? 'on' : ''}" data-act="toggle-set" data-key="${k}"><span class="sw"></span>${label}: <b>${s[k] ? 'On' : 'Off'}</b></button>`;
  const h = `<div class="settings">
    <label class="slider">🔊 Master volume <input type="range" min="0" max="1" step="0.05" value="${s.vol}" data-set="vol"><b>${Math.round(s.vol * 100)}%</b></label>
    ${tog('music', '🎵 Music')}
    ${tog('sfx', '🔔 Sound effects')}
    ${tog('shake', '💥 Screen shake')}
    ${tog('hints', '💡 Advisor hints')}
    <button class="toggle ${s.particles === 'high' ? 'on' : ''}" data-act="particles"><span class="sw"></span>✨ Particles: <b>${s.particles === 'high' ? 'High' : 'Low'}</b></button>
    <div class="hint">Settings are saved in this browser. Use the mute toggles at any time — no reload needed.</div>
    <div class="row-btns"><button class="danger" data-act="reset-meta">🗑 Reset legacy &amp; statistics</button></div>
  </div>`;
  openModal('Settings', h);
}

export function modalHelp(tab = 'basics') {
  const tabs = [['basics', 'Basics'], ['controls', 'Controls'], ['systems', 'Systems'], ['victory', 'Victory']];
  const body = {
    basics: `<h4>Goal</h4><p>Lead your civilization from a single settler to victory — through conquest, science, or culture — before time runs out at turn ${MAX_TURN}.</p>
      <h4>A turn</h4><ol><li>Move units and found cities.</li><li>Set city production and research.</li><li>End the turn: cities grow, produce, earn culture; AIs take their turns.</li></ol>
      <h4>Cities</h4><p>Cities grow by eating food. Settlers cost 1 population. Each city works the best tiles automatically. Unhappy citizens above the content limit cost production.</p>`,
    controls: `<table class="keys"><tr><td><kbd>Click</kbd> hex</td><td>Inspect tile / select unit / select city</td></tr>
      <tr><td><kbd>Click</kbd> blue hex</td><td>Move selected unit</td></tr>
      <tr><td><kbd>Click</kbd> red hex</td><td>Attack (moves into range first if needed)</td></tr>
      <tr><td><kbd>Right-click</kbd></td><td>Clear selection</td></tr>
      <tr><td><kbd>Drag</kbd> / <kbd>WASD</kbd> / arrows</td><td>Pan the map</td></tr>
      <tr><td><kbd>Wheel</kbd> / <kbd>+</kbd> <kbd>−</kbd></td><td>Zoom</td></tr>
      <tr><td><kbd>Pinch</kbd> (touch)</td><td>Zoom · drag to pan · tap to select</td></tr>
      <tr><td><kbd>Enter</kbd></td><td>End turn</td></tr>
      <tr><td><kbd>Space</kbd></td><td>Next idle unit</td></tr>
      <tr><td><kbd>C</kbd> / <kbd>F</kbd> / <kbd>S</kbd></td><td>Found city / Fortify / Skip unit</td></tr>
      <tr><td><kbd>B</kbd></td><td>Worker: build improvement</td></tr>
      <tr><td><kbd>T</kbd> / <kbd>D</kbd> / <kbd>L</kbd></td><td>Research / Diplomacy / Chronicle</td></tr>
      <tr><td><kbd>Home</kbd></td><td>Center on capital</td></tr>
      <tr><td><kbd>Esc</kbd></td><td>Menu / close window</td></tr></table>`,
    systems: `<h4>Yields</h4><p>🍞 Food grows cities · ⚒️ Production builds · 💰 Gold buys & pays upkeep · 🔬 Science researches · 🎭 Culture expands borders and wins the culture race.</p>
      <h4>Improvements</h4><p>Workers build farms, mines, lumber camps, pastures and roads on tiles inside your borders. Yields only count while a city works the tile.</p>
      <h4>Combat</h4><p>Strength depends on terrain (hills, forests), fortification, city walls, anti-cavalry and siege bonuses. Archers and catapults shoot from range without retaliation.</p>
      <h4>Strategic resources</h4><p>Horses, Iron unlock Horsemen, Swordsmen, Musketeers and Tanks — you need the resource on a tile you own.</p>
      <h4>Diplomacy</h4><p>Propose peace, alliances or trade. Declaring war costs opinion with everyone. Negative gold slows all production.</p>
      <h4>Barbarians</h4><p>Barbarian camps spawn raiders. Destroy a camp for gold and science.</p>
      <h4>Legacy</h4><p>Wins and turns earn Legacy Points. Spend them on permanent starting bonuses. Winning unlocks new civilizations.</p>`,
    victory: `<ul><li><b>Domination</b> — conquer or eliminate every rival civilization.</li>
      <li><b>Science</b> — research Space Flight first (can be disabled in setup).</li>
      <li><b>Culture</b> — reach the culture goal first (can be disabled in setup).</li>
      <li><b>Time</b> — if turn ${MAX_TURN} arrives, the highest score wins.</li></ul>
      <p>Defeat: losing every city and settler, or an AI winning first.</p>`,
  };
  const tabHtml = tabs.map(([k, l]) => `<button class="tab ${tab === k ? 'on' : ''}" data-act="help-tab" data-tab="${k}">${l}</button>`).join('');
  openModal('How to Play', `<div class="tabs">${tabHtml}</div><div class="help">${body[tab] || body.basics}</div>`, 'wide');
}

export function modalBuild(u) {
  const tile = G.tiles[u.i];
  const opts = Object.keys(IMPROVEMENTS).filter((k) => IMPROVEMENTS[k].on.includes(tile.t));
  let h = `<div class="hint">Tile: ${TERRAIN[tile.t].name}${tile.r ? ' · ' + RESOURCES[tile.r].icon + ' ' + RESOURCES[tile.r].name : ''}. Stay on the tile until finished.</div><div class="grid-items">`;
  for (const k of opts) {
    const I = IMPROVEMENTS[k];
    const ok = !I.req || G.civs[0].researched.includes(I.req);
    const yl = Object.entries(I.y).map(([kk, v]) => `+${v} ${kk === 'f' ? '🍞' : kk === 'p' ? '⚒️' : '💰'}`).join(' ');
    h += `<button class="item ${ok ? '' : 'locked'}" ${ok ? `data-act="build" data-t="${k}"` : 'disabled'}>
      <span class="ii">${I.icon}</span><span class="in">${esc(I.name)}</span><span class="ic">${I.turns}t</span>
      <small>${yl}${I.req && !ok ? ' · needs ' + TECH[I.req].name : ''}</small></button>`;
  }
  if (!opts.length) h += `<div class="muted">Nothing can be built on this terrain.</div>`;
  h += `</div>`;
  openModal('Build improvement', h);
}

export function modalLegacy(meta) {
  let h = `<div class="legacy-top"><div><b>${meta.lp}</b><small>Legacy points</small></div><div><b>${meta.wins}</b><small>Victories</small></div><div><b>${meta.games}</b><small>Games played</small></div></div>
    <div class="hint">Earn Legacy Points each game: 1 per 12 turns, +5 for a victory, +2 per wonder. Spend them on permanent bonuses that apply to every new game.</div><div class="perk-list">`;
  for (const p of LEGACY) {
    const owned = !!meta.perks[p.id];
    const can = !owned && meta.lp >= p.cost;
    h += `<div class="perk ${owned ? 'owned' : ''}"><div><b>${esc(p.name)}</b><small>${esc(p.desc)}</small></div>
      <button ${owned ? 'disabled' : can ? `data-act="buy-perk" data-id="${p.id}"` : 'disabled'}>${owned ? '✓ Owned' : p.cost + ' LP'}</button></div>`;
  }
  h += `</div><div class="section-l">Unlockable civilizations</div><div class="chips">${CIVS.map((c) => `<span class="chip ${meta.wins >= c.unlock ? 'ok' : ''}">${c.icon} ${c.name}${meta.wins >= c.unlock ? '' : ' 🔒 ' + c.unlock + ' win' + (c.unlock === 1 ? '' : 's')}</span>`).join('')}</div>`;
  openModal('Legacy', h, 'wide');
}

export function modalStats(title, meta, game) {
  const lt = meta.lifetime || {};
  let h = '';
  if (game) {
    const s = G.stats;
    h += `<h4>This game</h4><div class="stats-grid big">
      <div><b>${G.turn}</b><small>Turn</small></div><div><b>${civScore(0)}</b><small>Score</small></div>
      <div><b>${s.founded}</b><small>Cities founded</small></div><div><b>${s.captured}</b><small>Cities captured</small></div>
      <div><b>${s.kills}</b><small>Kills</small></div><div><b>${s.lost}</b><small>Units lost</small></div>
      <div><b>${s.camps}</b><small>Camps cleared</small></div><div><b>${s.techs}</b><small>Techs</small></div>
      <div><b>${s.wonders}</b><small>Wonders</small></div><div><b>${s.goldEarned}</b><small>Gold earned</small></div>
      <div><b>${s.peakPop}</b><small>Peak population</small></div><div><b>${Math.floor(G.civs[0].culture)}</b><small>Culture</small></div></div>`;
  }
  h += `<h4>${game ? 'Lifetime' : 'Lifetime statistics'}</h4><div class="stats-grid big">
    <div><b>${meta.games}</b><small>Games</small></div><div><b>${meta.wins}</b><small>Victories</small></div>
    <div><b>${meta.games ? Math.round((meta.wins / meta.games) * 100) : 0}%</b><small>Win rate</small></div><div><b>${meta.best}</b><small>Best score</small></div>
    <div><b>${lt.kills || 0}</b><small>Kills</small></div><div><b>${lt.cities || 0}</b><small>Cities founded</small></div>
    <div><b>${lt.wonders || 0}</b><small>Wonders</small></div><div><b>${lt.techs || 0}</b><small>Techs</small></div></div>`;
  openModal(title, h, 'wide');
}

export function modalResult(res, meta, earned, game) {
  const P = G.civs[0];
  const headline = res.win ? '🏆 Victory!' : '☠️ Defeat';
  const ways = { domination: 'Domination', science: 'Science', culture: 'Culture', time: 'Time', defeat: 'Defeat' };
  let h = `<div class="result ${res.win ? 'win' : 'lose'}"><div class="result-ico">${res.win ? '🏛️' : '🔥'}</div>
    <h3>${headline}</h3><p>${esc(res.text)}</p><div class="chip ${res.win ? 'ok' : 'bad'}">${ways[res.type] || res.type} · turn ${G.turn}</div></div>`;
  const s = G.stats;
  h += `<div class="stats-grid big">
    <div><b>${civScore(0)}</b><small>Final score</small></div><div><b>${G.turn}</b><small>Turns</small></div>
    <div><b>${G.cities.filter((c) => c.o === 0).length}</b><small>Cities</small></div><div><b>${P.researched.length}</b><small>Techs</small></div>
    <div><b>${s.kills}</b><small>Kills</small></div><div><b>${s.captured}</b><small>Captured</small></div>
    <div><b>${s.wonders}</b><small>Wonders</small></div><div><b>${Math.floor(P.culture)}</b><small>Culture</small></div></div>
    <div class="hint center">Difficulty ${DIFFICULTY[G.diff].name} · ${MAP_SIZES[G.size].name} map · ${esc(CIVS.find((c) => c.id === P.id).name)} · Legacy +${earned} LP (total ${meta.lp})</div>`;
  let btns = '';
  if (res.win && !G.continued && game) btns += `<button class="hl big" data-act="continue">Continue playing →</button>`;
  btns += `<button class="${res.win ? '' : 'hl'} big" data-act="new-same">↻ New game (same settings)</button>`;
  btns += `<button class="big" data-act="quit">🏠 Title screen</button>`;
  h += `<div class="row-btns center">${btns}</div>`;
  openModal(res.win ? 'Victory' : 'Game over', h, 'wide result-modal');
}

/* ---------------- title & setup ---------------- */

export function renderTitle(meta, hasSave) {
  const el = $('#title-body');
  if (!el) return;
  el.innerHTML = `
    <button class="title-btn primary" data-act="title-new">▶ New Game</button>
    ${hasSave ? '<button class="title-btn" data-act="title-continue">📂 Continue Saved Game</button>' : ''}
    <button class="title-btn" data-act="open-legacy">🏅 Legacy <small>${meta.lp} LP</small></button>
    <button class="title-btn" data-act="open-stats">📊 Statistics</button>
    <button class="title-btn" data-act="open-help">❓ How to Play</button>
    <button class="title-btn" data-act="open-settings">⚙️ Settings</button>
    <div class="title-meta">Victories ${meta.wins} · Games ${meta.games} · Best score ${meta.best}</div>`;
}

export function renderSetup(cfg, meta) {
  const el = $('#setup-body');
  if (!el) return;
  const civCards = CIVS.map((c, i) => {
    const locked = meta.wins < c.unlock;
    return `<button class="civ-card ${cfg.civ === i ? 'on' : ''} ${locked ? 'locked' : ''}" ${locked ? 'disabled' : `data-act="pick-civ" data-i="${i}"`} style="--c:${c.col}">
      <span class="civ-ico big" style="background:${c.col}">${c.icon}</span><b>${esc(c.name)}</b><small>${esc(c.leader)}</small>
      <em>${esc(c.ability)}</em>${locked ? `<span class="lock">🔒 ${c.unlock} win${c.unlock === 1 ? '' : 's'}</span>` : ''}</button>`;
  }).join('');
  const diffs = Object.keys(DIFFICULTY).map((k) => `<button class="opt ${cfg.diff === k ? 'on' : ''}" data-act="pick-diff" data-k="${k}"><b>${DIFFICULTY[k].name}</b><small>${DIFFICULTY[k].desc}</small></button>`).join('');
  const sizes = Object.keys(MAP_SIZES).map((k) => `<button class="opt ${cfg.size === k ? 'on' : ''}" data-act="pick-size" data-k="${k}"><b>${MAP_SIZES[k].name}</b><small>${MAP_SIZES[k].w}×${MAP_SIZES[k].h} tiles · ${MAP_SIZES[k].camps} barbarian camps</small></button>`).join('');
  const mods = [
    ['fog', '🌫️ Fog of war', 'Only see tiles near your units and cities'],
    ['barb', '🪓 Barbarians', 'Camps spawn raiders that threaten you'],
    ['sci', '🚀 Science victory', 'Space Flight wins the game'],
    ['cul', '🎭 Culture victory', 'First to the culture goal wins'],
    ['tutorial', '💡 Advisor tutorial', 'Step-by-step hints on turn one'],
  ].map(([k, l, d]) => `<button class="toggle mod ${cfg[k] ? 'on' : ''}" data-act="toggle-mod" data-k="${k}"><span class="sw"></span><span><b>${l}</b><small>${d}</small></span></button>`).join('');
  const perks = LEGACY.filter((p) => meta.perks[p.id]).map((p) => `<span class="chip ok">${esc(p.name)}</span>`).join('') || '<span class="muted">No legacy bonuses yet — earn Legacy Points!</span>';
  el.innerHTML = `
    <div class="setup-head"><button data-act="back-title">← Back</button><h2>Start a new civilization</h2><span></span></div>
    <div class="section-l">1 · Choose your civilization</div><div class="civ-grid">${civCards}</div>
    <div class="setup-two">
      <div><div class="section-l">2 · Difficulty</div><div class="opt-grid">${diffs}</div></div>
      <div><div class="section-l">3 · World size</div><div class="opt-grid">${sizes}</div></div>
    </div>
    <div class="section-l">4 · Modifiers</div><div class="mod-grid">${mods}</div>
    <div class="setup-two">
      <div><div class="section-l">5 · World seed</div>
        <div class="seed-row"><input id="seed" type="text" maxlength="9" placeholder="random" value="${esc(cfg.seed || '')}"><button data-act="reseed">🎲 Random</button></div></div>
      <div><div class="section-l">Legacy bonuses active</div><div class="chips">${perks}</div></div>
    </div>
    <div class="setup-foot"><button class="title-btn primary big" data-act="start-game">Found my civilization →</button></div>`;
}

export function renderMinimapHint() { /* minimap is drawn by the renderer */ }

export function setRelHint() { /* reserved */ }

// Exposed for main.js: civ-level helpers used in tutorial checks
export function cityCount() { return G.cities.filter((c) => c.o === 0).length; }

export { cityAt, startBuild, log, isCoastal, civResources, growNeed, researchable, fmt, unitsAt };
