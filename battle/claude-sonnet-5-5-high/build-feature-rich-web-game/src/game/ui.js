// ===== Pocket Valley UI: menus, HUD, dialogs (plain DOM) =====
import * as D from './data.js';

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SHOP_HRS = { general: [540, 1020], saloon: [720, 1440], smith: [540, 1020], ranch: [540, 1020], tackle: [360, 1200] };
const SHOP_NAME = { general: ['🛒', 'General Store'], saloon: ['🍺', 'The Saloon'], smith: ['🔨', "Brom's Smithy"], ranch: ['🐄', "Hazel's Ranch"], tackle: ['🎣', "Salty's Tackle"] };
const NPC_SHOP = { mabel: 'general', brom: 'smith', hazel: 'ranch', otto: 'saloon', salty: 'tackle' };
const WX = { sun: ['☀️', 'Sunny'], rain: ['🌧️', 'Rainy'], storm: ['⛈️', 'Stormy'], snow: ['❄️', 'Snowy'] };

export function installUI(G) {
  const uiEl = G.uiEl, ui = G.ui = {}, timers = [];
  let cur = null, data = null, prev = null, J = { tab: 'pack', sel: 0, hold: null, trash: false }, hudT = 0, hudSig = '', hudEls = null;
  const form = { name: 'Sprout', farm: 'Willow', diff: 'standard', mods: {}, shirt: '#3b82c4', hair: '#5a3a22' };
  ui.form = form;
  uiEl.innerHTML = '<div class="hud" style="display:none"></div><div class="toasts"></div><div class="modal" style="display:none"></div><div class="touch" style="display:none"></div>';
  const hudEl = uiEl.querySelector('.hud'), toastEl = uiEl.querySelector('.toasts'), modal = uiEl.querySelector('.modal'), touchEl = uiEl.querySelector('.touch');
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const S = () => G.S;
  const money = (n) => Math.floor(n).toLocaleString() + 'g';

  // ---------- helpers ----------
  const ic = (it, q) => '<span class="ic">' + it.icon + (it.seed ? '<i class="sd">🌱</i>' : '') + (q ? '<i class="qs q' + q + '">★</i>' : '') + '</span>';
  const slotH = (i, s, act, cls) => {
    if (!s) return '<div class="slot empty ' + (cls || '') + '" data-a="' + act + '" data-i="' + i + '"></div>';
    if (s.tool) { const t = D.TOOLS[s.tool], tier = S().tools[s.tool]; return '<div class="slot tool ' + (cls || '') + '" data-a="' + act + '" data-i="' + i + '" title="' + esc(D.TIER_NAME[tier] + ' ' + t.n) + '"><span class="ic">' + t.i + '</span><i class="tier" style="background:' + D.TIER_COL[tier] + '"></i></div>'; }
    const it = D.ITEMS[s.id]; if (!it) return '<div class="slot empty"></div>';
    return '<div class="slot ' + (cls || '') + '" data-a="' + act + '" data-i="' + i + '" title="' + esc(it.name + (s.q ? ' (' + D.QNAME[s.q] + ')' : '')) + '">' + ic(it, s.q) + (s.n > 1 ? '<b class="n">' + s.n + '</b>' : '') + '</div>';
  };
  const packGrid = (act, filterFn, selSet) => {
    let h = '<div class="grid">'; const st = S();
    for (let i = 0; i < st.invSize; i++) { const s = st.inv[i]; const ok = !filterFn || filterFn(s, i); h += slotH(i, s, ok ? act : 'noop', (ok ? '' : 'dim ') + (selSet && selSet.has(i) ? 'sel ' : '') + (i < 12 ? 'hb ' : '')); }
    return h + '</div>';
  };
  const chip = (id, n, have) => { const it = D.ITEMS[id]; const nm = id.startsWith('any:') ? 'Any ' + id.slice(4) : it.name, icn = id.startsWith('any:') ? '❔' : it.icon; return '<span class="chip ' + (have >= n ? 'ok' : 'no') + '" title="' + esc(nm) + '">' + icn + ' ' + Math.min(have, 99) + '/' + n + '</span>'; };
  const ingChips = (ing) => ing.map(([id, n]) => chip(id, n, id.startsWith('any:') ? G.countCat(id.slice(4)) : G.itemCount(id))).join('');
  const face = (id, big) => { const n = D.NPCS[id]; return '<div class="face ' + (big ? 'big' : '') + '" style="--hair:' + n.hair + ';--skin:' + n.skin + ';--shirt:' + n.shirt + '"><i></i><b></b></div>'; };
  const hearts = (n, max) => { let h = ''; for (let i = 0; i < (max || 10); i++) h += '<span class="ht ' + (i < n ? 'on' : '') + '">♥</span>'; return h; };
  const closeBtn = (a) => '<button class="btn small close" data-a="' + (a || 'close') + '">✕</button>';
  const xpBar = (id) => { const xp = S().xp[id], lv = D.lvlOf(xp), a = D.XP_LEVELS[lv], b = D.XP_LEVELS[Math.min(10, lv + 1)]; return lv >= 10 ? 100 : Math.round((xp - a) / (b - a) * 100); };
  const daysLeft = () => S().deadline - S().day + 1;

  // ---------- views ----------
  const V = {};
  V.title = () => {
    const m = G.meta, has = G.hasSave();
    return '<div class="title-box"><div class="logo"><span class="l1">Pocket</span><span class="l2">Valley</span></div><div class="sub">🌾 a tiny farming life · restore the Community Center 🌾</div>' +
      '<div class="menu">' + (has ? '<button class="btn big" data-a="continue">▶ Continue</button>' : '') +
      '<button class="btn big ' + (has ? '' : 'primary') + '" data-a="newgame">✨ New Game</button><button class="btn big" data-a="legacy">🏆 Legacy &amp; Hall of Fame <em>' + m.lp + ' LP</em></button>' +
      '<button class="btn big" data-a="help">📖 How to Play</button><button class="btn big" data-a="settings">⚙️ Settings</button></div><div class="foot">WASD move · Space use tool · E interact · I journal · M mute</div></div>';
  };
  V.newgame = () => {
    const f = form, cols = ['#3b82c4', '#c4453b', '#3bc46a', '#c49a3b', '#8a3bc4', '#e8e8f0'], hairs = ['#5a3a22', '#2a2a2e', '#d9a441', '#c9462c', '#e8d9b0', '#6b3ba0'];
    const df = D.DIFFS[f.diff]; let extra = 0; if (G.meta.upg.time) extra = 10;
    return '<div class="panel wide"><h2>🌱 New Farm</h2><div class="form"><label>Your name<input id="f-name" maxlength="14" value="' + esc(f.name) + '"></label><label>Farm name<input id="f-farm" maxlength="14" value="' + esc(f.farm) + '"></label></div>' +
      '<div class="row">Shirt ' + cols.map(c => '<i class="sw ' + (f.shirt === c ? 'on' : '') + '" style="background:' + c + '" data-a="shirt" data-v="' + c + '"></i>').join('') + ' &nbsp; Hair ' + hairs.map(c => '<i class="sw ' + (f.hair === c ? 'on' : '') + '" style="background:' + c + '" data-a="hair" data-v="' + c + '"></i>').join('') + '</div>' +
      '<h3>Difficulty</h3><div class="cards">' + Object.keys(D.DIFFS).map(k => '<div class="card ' + (f.diff === k ? 'on' : '') + '" data-a="diff" data-v="' + k + '"><b>' + D.DIFFS[k].n + '</b><span>' + D.DIFFS[k].desc + '</span><em>' + (D.DIFFS[k].days + extra) + ' days · ' + D.DIFFS[k].gold + 'g start</em></div>').join('') + '</div>' +
      '<h3>Modifiers <small>(more Legacy Points)</small></h3><div class="cards">' + Object.keys(D.MODS).map(k => '<div class="card small ' + (f.mods[k] ? 'on' : '') + '" data-a="mod" data-v="' + k + '"><b>' + D.MODS[k].n + '</b><span>' + D.MODS[k].desc + '</span></div>').join('') + '</div>' +
      '<p class="hint">Deadline: Year ' + (Math.floor((df.days + extra - 1) / 40) + 1) + ', ' + D.SEASONS[Math.floor(((df.days + extra - 1) % 40) / 10)] + ' ' + ((df.days + extra - 1) % 10 + 1) + '. Complete all 8 bundles before then.</p>' +
      '<div class="btns"><button class="btn" data-a="toTitle">← Back</button><button class="btn primary big" data-a="start">Start Farming!</button></div></div>';
  };
  V.legacy = () => {
    const m = G.meta;
    return '<div class="panel wide"><h2>🏆 Legacy</h2><p class="hint">Earn Legacy Points (LP) at the end of every run, win or lose. Spend them on permanent upgrades. You have <b>' + m.lp + ' LP</b>. Runs: ' + m.runs + ' · Victories: ' + m.wins + '</p><div class="cards">' +
      D.LEGACY.map(u => { const own = m.upg[u.id]; return '<div class="card small ' + (own ? 'on' : '') + '"><b>' + u.i + ' ' + u.n + '</b><span>' + u.desc + '</span>' + (own ? '<em>Owned ✔</em>' : '<button class="btn small ' + (m.lp >= u.cost ? 'primary' : 'dis') + '" data-a="buyLeg" data-v="' + u.id + '">Buy · ' + u.cost + ' LP</button>') + '</div>'; }).join('') + '</div>' +
      '<h3>Hall of Fame</h3><div class="hall">' + (m.hall.length ? m.hall.map(h => '<div>' + (h.kind === 'win' ? '🥇' : '💀') + ' <b>' + esc(h.name) + '</b> of ' + esc(h.farm) + ' Farm · ' + D.DIFFS[h.diff].n + ' · Day ' + h.days + ' · ' + h.bd + '/8 bundles · +' + h.lp + ' LP</div>').join('') : '<i>No runs yet. Your story starts here.</i>') + '</div>' +
      '<div class="btns"><button class="btn" data-a="toTitle">← Back</button></div></div>';
  };
  const HELP = () => '<div class="help"><h3>Goal</h3><p>The old Community Center is crumbling and <b>Joja Corp</b> wants the land. Fill all <b>8 bundles</b> (crops, forage, fish, ore, ranch goods and boss trophies) before the deadline to restore it and win. Miss the deadline and the valley is lost.</p>' +
    '<h3>Controls</h3><table class="keys"><tr><td>WASD / Arrows</td><td>Move</td></tr><tr><td>Space / Left click</td><td>Use selected tool or item (aim with mouse or facing)</td></tr><tr><td>E / Right click</td><td>Talk, harvest, open, sleep, eat</td></tr><tr><td>1-0, - , = / Wheel / Q R</td><td>Select hotbar slot</td></tr><tr><td>Shift</td><td>Dash (2 energy, brief invulnerability)</td></tr><tr><td>I / Tab</td><td>Journal &amp; Pack</td></tr><tr><td>C · J · F · H</td><td>Crafting · Bundles · Friends · Help</td></tr><tr><td>Esc</td><td>Pause</td></tr><tr><td>M</td><td>Mute</td></tr><tr><td>Gamepad</td><td>Stick move · A use · X interact · Y journal · LB/RB slots · Start pause</td></tr><tr><td>Touch</td><td>On-screen joystick &amp; buttons</td></tr></table>' +
    '<h3>Systems</h3><ul><li>🌾 <b>Farming</b>: till, plant in the right season, water daily (rain helps). Sprinklers, fertilizer, scarecrows against crows.</li><li>🎣 <b>Fishing</b>: cast at water, press when "!" appears, then hold to keep the green bar on the fish.</li><li>⛏️ <b>Mine</b>: 15 floors, bosses on 5/10/15. Break rocks for ore, find the hidden ladder, fight monsters.</li><li>💬 <b>Friends</b>: talk daily, give gifts they love. Each friend gives a perk at 4 hearts.</li><li>🐔 <b>Ranch</b>: buy animals, feed them hay, pet them every day.</li><li>🍳 <b>Cooking &amp; Crafting</b>: meals give buffs; furnaces and jars create valuable goods.</li><li>🎉 <b>Festivals</b>: day 8 of each season in Town (9am to 2pm).</li><li>🌙 Sleep before 2am or you will pass out and lose gold.</li></ul></div>';
  V.help = () => '<div class="panel wide"><h2>📖 How to Play</h2>' + HELP() + '<div class="btns"><button class="btn primary" data-a="back">Got it</button></div></div>';
  V.settings = () => {
    const s = G.set, st = S(); let extra = '';
    if (st && G.mode === 'play') {
      extra = '<h3>Difficulty (live)</h3><div class="cards">' + Object.keys(D.DIFFS).map(k => '<div class="card small ' + (st.diff === k ? 'on' : '') + '" data-a="liveDiff" data-v="' + k + '"><b>' + D.DIFFS[k].n + '</b><span>' + D.DIFFS[k].desc + '</span></div>').join('') + '</div><div class="cards">' +
        Object.keys(D.MODS).map(k => '<div class="card small ' + (st.mods[k] ? 'on' : '') + '" data-a="liveMod" data-v="' + k + '"><b>' + D.MODS[k].n + '</b></div>').join('') + '</div>';
    }
    const sl = (k, n) => '<label class="sl">' + n + '<input type="range" min="0" max="100" value="' + Math.round(s[k] * 100) + '" data-k="' + k + '"><em>' + Math.round(s[k] * 100) + '%</em></label>';
    const tg = (k, n) => '<button class="btn small ' + (s[k] ? 'primary' : '') + '" data-a="tog" data-v="' + k + '">' + n + ': ' + (s[k] ? 'On' : 'Off') + '</button>';
    return '<div class="panel"><h2>⚙️ Settings</h2>' + sl('master', '🔊 Master') + sl('music', '🎵 Music') + sl('sfx', '🔔 Effects') + '<div class="btns left">' + tg('mute', '🔇 Mute') + tg('shake', 'Screen shake') + tg('particles', 'Particles') + '</div>' +
      '<div class="btns left">Day length: ' + [[1.5, 'Long'], [1, 'Normal'], [0.65, 'Short']].map(([v, n]) => '<button class="btn small ' + (s.dayLen === v ? 'primary' : '') + '" data-a="daylen" data-v="' + v + '">' + n + '</button>').join('') + '</div>' +
      '<div class="btns left">Touch controls: ' + ['auto', 'on', 'off'].map(v => '<button class="btn small ' + (s.touch === v ? 'primary' : '') + '" data-a="touchset" data-v="' + v + '">' + v + '</button>').join('') + '</div>' + extra +
      '<div class="btns"><button class="btn primary" data-a="back">Done</button></div></div>';
  };
  V.pause = () => {
    const st = S();
    return '<div class="panel narrow"><h2>⏸ Paused</h2><p class="hint">' + esc(st.name) + ' of ' + esc(st.farm) + ' Farm · ' + D.DIFFS[st.diff].n + ' · ' + G.bundlesDone() + '/8 bundles</p><div class="menu">' +
      '<button class="btn big primary" data-a="close">▶ Resume</button><button class="btn big" data-a="jr">📖 Journal</button><button class="btn big" data-a="save">💾 Save Game</button><button class="btn big" data-a="settings">⚙️ Settings</button><button class="btn big" data-a="help">❓ Help &amp; Controls</button>' +
      '<button class="btn big" data-a="retire">🏳️ Retire this run</button><button class="btn big" data-a="quit">🏠 Save &amp; Title</button></div></div>';
  };
  V.confirm = () => '<div class="panel narrow"><h2>' + data.title + '</h2><p>' + data.text + '</p><div class="btns"><button class="btn" data-a="back">Cancel</button><button class="btn primary" data-a="' + data.yes + '">Yes</button></div></div>';
  V.intro = () => {
    const st = S(), pages = [
      'Dear ' + esc(st.name) + ',\n\nYou always wanted a quiet life. Pocket Valley is waiting: a farm, a barn, a mine, and good neighbors.',
      'The Community Center here has fallen apart. <b>Joja Corp</b> plans to buy it and pave the valley over.\n\nIf the Center is not restored in time, the town is gone.',
      'Fill its bundles with crops, forage, fish, ore and treasures. Befriend the townsfolk. Grow stronger.\n\nYou have <b>' + st.deadline + ' days</b>. Good luck!\n\n— Granny Edda'];
    const p = data.page || 0;
    return '<div class="panel narrow letter"><div class="paper">' + pages[p].replace(/\n/g, '<br>') + '</div><div class="btns"><span class="hint">' + (p + 1) + '/3</span><button class="btn primary" data-a="introNext">' + (p < 2 ? 'Next ▶' : 'Start my new life') + '</button></div></div>';
  };

  // ----- journal -----
  const tabs = [['pack', '🎒 Pack'], ['craft', '🔨 Craft'], ['social', '💬 Friends'], ['skills', '⭐ Skills'], ['bundles', '🏛 Bundles'], ['cal', '📅 Calendar'], ['help', '❓ Help']];
  V.journal = () => {
    const st = S(); let body = '';
    if (J.tab === 'pack') {
      const s = st.inv[J.sel]; let det = '<p class="hint">Select an item. Items in the first 12 slots appear on your hotbar.</p>';
      if (s && s.tool) { const t = D.TOOLS[s.tool], tier = st.tools[s.tool]; det = '<h3>' + t.i + ' ' + D.TIER_NAME[tier] + ' ' + t.n + '</h3><p>' + t.desc + '</p>' + (s.tool === 'can' ? '<p>Water: <b>' + st.water + '/' + D.CAN_CAP[tier] + '</b></p>' : '') + (st.upgrades.some(u => u.tool === s.tool) ? '<p class="warn">Being upgraded by Brom…</p>' : ''); }
      else if (s) {
        const it = D.ITEMS[s.id], f = G.edible(it);
        det = '<h3>' + ic(it, s.q) + ' ' + it.name + (s.q ? ' <small>(' + D.QNAME[s.q] + ')</small>' : '') + '</h3><p>' + (it.desc || (it.seed ? 'Plant in tilled soil during ' + D.CROPS[it.seed].s.map(x => D.SEASONS[x]).join(' / ') + '.' : 'A ' + it.cat + ' item.')) + '</p><p>Value: <b>' + G.sellPrice(it, s.q) + 'g</b> · Qty ' + s.n + '</p>' +
          (f ? '<p>Eat: +' + f.e + ' ⚡ +' + f.h + ' ❤' + (f.buff ? ' · ' + D.BUFF_NAME[f.buff[0]] + ' buff' : '') + '</p>' : '') +
          '<div class="btns left">' + (f ? '<button class="btn small primary" data-a="jeat">🍴 Eat</button>' : '') + '<button class="btn small" data-a="jmove">↔ ' + (J.hold === J.sel ? 'Pick target…' : 'Move') + '</button><button class="btn small" data-a="jtrash">' + (J.trash ? '⚠ Confirm trash' : '🗑 Trash') + '</button></div>';
      }
      body = '<div class="pack"><div>' + packGrid('jslot', null, new Set([J.sel])) + '<div class="stats">💰 ' + money(st.gold) + ' · ⚡ ' + Math.round(st.energy) + '/' + st.maxEnergy + ' · ❤ ' + Math.round(st.hp) + '/' + st.maxHp + '</div></div><div class="detail">' + det + '</div></div>';
    } else if (J.tab === 'craft') {
      body = '<p class="hint">Craft anywhere. Cook at the stove in your house. Recipes unlock with skill levels.</p><div class="list">' + D.CRAFTS.map(c => {
        const ok = G.craftOk(c), can = ok && G.hasIng(c.ing);
        return '<div class="row-item ' + (ok ? '' : 'locked') + '"><span class="big-ic">' + c.i + '</span><div class="grow"><b>' + c.n + (c.out ? ' ×' + c.out : '') + '</b><small>' + c.desc + '</small><div>' + ingChips(c.ing) + '</div></div>' + (ok ? '<button class="btn small ' + (can ? 'primary' : 'dis') + '" data-a="craft" data-v="' + c.id + '">Craft</button>' : '<span class="lock">🔒 ' + c.sk[0] + ' Lv' + c.sk[1] + '</span>') + '</div>';
      }).join('') + '</div>';
    } else if (J.tab === 'social') {
      body = '<div class="list">' + Object.keys(D.NPCS).map(id => {
        const n = D.NPCS[id], f = st.friends[id], h = G.hearts(id);
        return '<div class="row-item">' + face(id) + '<div class="grow"><b>' + n.n + '</b> <small>' + n.role + ' · 🎂 ' + D.SEASONS[n.bday[0]] + ' ' + n.bday[1] + '</small><div class="hearts">' + hearts(h) + '</div><small>' + (h >= 4 ? '✨ Perk: ' + n.perk : '🔒 Perk at 4 hearts: ' + n.perk) + '</small>' + (h >= 2 ? '<small>Loves: ' + n.loves.map(x => D.ITEMS[x].icon).join(' ') + ' · Likes: ' + n.likes.slice(0, 5).map(x => D.ITEMS[x].icon).join(' ') + '</small>' : '<small>Get to know them to learn their tastes.</small>') + '</div><div class="sm">' + (f.talk === st.day ? '💬✔' : '💬') + ' ' + (f.gift === st.day ? '🎁✔' : '🎁') + '</div></div>';
      }).join('') + '</div>';
    } else if (J.tab === 'skills') {
      const s = st.stats;
      body = '<div class="list">' + D.SKILLS.map(k => { const lv = D.lvlOf(st.xp[k.id]); return '<div class="row-item"><span class="big-ic">' + k.i + '</span><div class="grow"><b>' + k.n + ' · Level ' + lv + '</b><div class="meter"><i style="width:' + xpBar(k.id) + '%"></i></div><small>' + k.perk + '</small></div></div>'; }).join('') + '</div>' +
        '<div class="stat-grid"><span>🌾 Crops ' + s.crops + '</span><span>🐟 Fish ' + s.fish + '</span><span>🍄 Forage ' + s.forage + '</span><span>⛏️ Mined ' + s.mined + '</span><span>👹 Slain ' + s.kills + '</span><span>🍳 Cooked ' + s.cooked + '</span><span>🎁 Gifts ' + s.gifts + '</span><span>💰 Earned ' + money(s.earned) + '</span></div>';
    } else if (J.tab === 'bundles') body = V.bundleBody(false);
    else if (J.tab === 'cal') {
      const se = G.seasonOf(), dom = G.domOf(); let cells = '';
      for (let d = 1; d <= 10; d++) { const bd = Object.keys(D.NPCS).filter(id => D.NPCS[id].bday[0] === se && D.NPCS[id].bday[1] === d); cells += '<div class="cal ' + (d === dom ? 'today' : '') + '"><b>' + d + '</b>' + (d === D.FESTIVAL_DAY ? '<span>' + D.FESTIVALS[se].i + '</span>' : '') + bd.map(id => '<span title="' + D.NPCS[id].n + '">🎂</span>').join('') + '</div>'; }
      const dl = daysLeft(), dd = st.deadline;
      body = '<h3>' + D.SEASON_ICON[se] + ' ' + D.SEASONS[se] + ', Year ' + G.yearOf() + '</h3><div class="cal-grid">' + cells + '</div><p>' + D.FESTIVALS[se].i + ' <b>' + D.FESTIVALS[se].n + '</b> on day ' + D.FESTIVAL_DAY + ': ' + D.FESTIVALS[se].desc + '</p>' +
        '<p>Birthdays this season: ' + (Object.keys(D.NPCS).filter(id => D.NPCS[id].bday[0] === se).map(id => D.NPCS[id].n + ' (' + D.NPCS[id].bday[1] + ')').join(', ') || 'none') + '</p>' +
        '<p>⏰ Deadline: day <b>' + dd + '</b> (Year ' + G.yearOf(dd) + ', ' + D.SEASONS[G.seasonOf(dd)] + ' ' + G.domOf(dd) + '). <b>' + Math.max(0, dl) + '</b> days left.</p><p>Tomorrow: ' + WX[st.nextWeather][0] + ' ' + WX[st.nextWeather][1] + '</p>';
    } else if (J.tab === 'help') {
      const cu = G.tutCur(); body = (cu ? '<div class="tut-note">Tutorial: ' + cu.t + '</div>' : '') + HELP();
    }
    return '<div class="panel wide journal"><div class="tabs">' + tabs.map(([k, n]) => '<button class="tab ' + (J.tab === k ? 'on' : '') + '" data-a="jtab" data-v="' + k + '">' + n + '</button>').join('') + closeBtn() + '</div><div class="jbody">' + body + '</div></div>';
  };
  V.bundleBody = (deposit) => {
    const st = S(), done = G.bundlesDone();
    return '<p class="hint">' + (deposit ? 'Click an item to place it in its bundle (you need it in your pack). ' : 'Visit the Community Center in Town to deposit items. ') + '<b>' + done + '/' + D.BUNDLES.length + '</b> complete · ' + Math.max(0, daysLeft()) + ' days left.</p><div class="bundles">' + D.BUNDLES.map(b => {
      const got = st.bundles[b.id], full = got.every(x => x);
      return '<div class="bundle ' + (full ? 'full' : '') + '"><div class="bh">' + b.i + ' <b>' + b.n + '</b>' + (full ? ' ✔' : '') + '</div><div class="bi">' + b.items.map((id, i) => { const it = D.ITEMS[id], has = G.itemCount(id) > 0; return '<div class="bs ' + (got[i] ? 'done' : has && deposit ? 'ready' : '') + '" ' + (deposit && !got[i] ? 'data-a="deposit" data-b="' + b.id + '" data-i="' + i + '"' : '') + ' title="' + esc(it.name) + '">' + ic(it) + (got[i] ? '<i class="ck">✔</i>' : '') + '</div>'; }).join('') + '</div><small>🎁 ' + (b.reward.gold ? b.reward.gold + 'g ' : '') + b.reward.txt + '</small></div>';
    }).join('') + '</div>';
  };
  V.bundles = () => '<div class="panel wide"><h2>🏛 Community Center</h2>' + V.bundleBody(true) + '<div class="btns">' + closeBtn() + '</div></div>';

  // ----- shop -----
  V.shop = () => {
    const sh = data.shop, st = S(), [e, nm] = SHOP_NAME[sh], hrs = SHOP_HRS[sh], list = G.shopItems(sh);
    return '<div class="panel wide"><h2>' + e + ' ' + nm + '</h2><p class="hint">Open ' + D.fmtTime(hrs[0]) + ' – ' + D.fmtTime(hrs[1] % 1440) + ' · 💰 <b>' + money(st.gold) + '</b>' + (st.mods.frugal ? ' · Frugal Times: +30% prices' : '') + '</p><div class="list shoplist">' + (list.length ? list.map((x, i) => {
      const can = st.gold >= x.price;
      return '<div class="row-item"><span class="big-ic">' + x.icon + '</span><div class="grow"><b>' + x.name + '</b><small>' + x.desc + '</small></div><b class="price">' + money(x.price) + '</b><button class="btn small ' + (can ? 'primary' : 'dis') + '" data-a="buy" data-i="' + i + '" data-q="1">Buy</button>' + (x.qty ? '<button class="btn small ' + (st.gold >= x.price * 5 ? '' : 'dis') + '" data-a="buy" data-i="' + i + '" data-q="5">×5</button>' : '') + '</div>';
    }).join('') : '<i>Nothing for sale right now.</i>') + '</div><div class="btns">' + closeBtn() + '</div></div>';
  };

  // ----- npc -----
  V.npc = () => {
    const id = data.id, n = D.NPCS[id], st = S(), h = G.hearts(id), d = data.d || {};
    let body;
    if (data.gift) body = '<p>Choose a gift for ' + n.n + (G.isBirthday(id) ? ' <b>(it\'s their birthday! gifts count ×6)</b>' : '') + ':</p>' + packGrid('giveGift', (s) => s && s.id) + '<div class="btns"><button class="btn" data-a="npcBack">Cancel</button></div>';
    else {
      const shop = NPC_SHOP[id], edda = id === 'edda' && st.festIdx >= 0 && G.festWindow() && !st.festDone[st.day];
      body = '<div class="speech">' + (d.text ? '"' + esc(d.text) + '"' : '…') + '</div>' + (d.gained ? '<small class="gain">+' + d.gained + ' friendship</small>' : '') + (d.pts ? '<small class="gain ' + (d.pts < 0 ? 'bad' : '') + '">' + (d.pts > 0 ? '+' : '') + d.pts + ' friendship</small>' : '') + (d.err ? '<small class="warn">' + d.err + '</small>' : '') +
        (d.msgs || []).map(m => '<div class="reward">🎁 ' + esc(m) + '</div>').join('') +
        '<div class="btns left"><button class="btn small" data-a="npcChat">💬 Chat</button><button class="btn small" data-a="npcGift">🎁 Give gift</button>' + (shop ? '<button class="btn small" data-a="npcShop" data-v="' + shop + '">🛒 Wares</button>' : '') + (id === 'edda' ? '<button class="btn small" data-a="npcCenter">🏛 Bundles</button>' : '') + (edda ? '<button class="btn small primary" data-a="npcFest">' + D.FESTIVALS[st.festIdx].i + ' Join ' + D.FESTIVALS[st.festIdx].n + '</button>' : '') + '<button class="btn small" data-a="close">Goodbye</button></div>';
    }
    return '<div class="panel dialog">' + '<div class="dhead">' + face(id, 1) + '<div><h2>' + n.n + '</h2><small>' + n.role + (G.isBirthday(id) ? ' · 🎂 Birthday!' : '') + '</small><div class="hearts">' + hearts(h) + '</div></div></div>' + body + '</div>';
  };

  // ----- misc views -----
  V.animals = () => {
    const kind = data.kind === 'coop' ? 'chicken' : 'cow', a = G.ANIMALS[kind], list = G.animalsOf(kind), hay = G.itemCount('hay');
    return '<div class="panel wide"><h2>' + a.i + ' ' + (kind === 'chicken' ? 'Coop' : 'Barn') + ' <small>' + list.length + '/' + a.cap + '</small></h2><p class="hint">🌾 Hay in pack: <b>' + hay + '</b>. Feed and pet every day. Fed, happy animals give better products.</p><div class="list">' +
      (list.length ? list.map(x => '<div class="row-item"><span class="big-ic">' + a.i + '</span><div class="grow"><b>' + esc(x.name) + '</b><div class="hearts">' + hearts(Math.floor(x.fr / 100)) + '</div><small>' + (x.fed ? '🌾 Fed' : '❗ Hungry') + ' · ' + (x.pet ? '💕 Petted' : 'Not petted') + ' · ' + (x.prod && x.pn ? 'Ready: ' + x.pn + ' ' + D.ITEMS[x.prod].icon : 'No product yet') + '</small></div><button class="btn small" data-a="pet" data-i="' + x.id + '">💕 Pet</button></div>').join('') : '<i>Empty! Buy animals at Hazel\'s Ranch in Town.</i>') +
      '</div><div class="btns"><button class="btn primary" data-a="feed">🌾 Feed all</button><button class="btn" data-a="collect">🧺 Collect</button>' + closeBtn() + '</div></div>';
  };
  V.bin = () => {
    const st = S(); let total = 0; const rows = st.bin.map((b, i) => { const it = D.ITEMS[b.id], v = G.sellPrice(it, b.q) * b.n; total += v; return '<div class="row-item compact" data-a="binTake" data-i="' + i + '" title="Click to take back">' + ic(it, b.q) + '<div class="grow">' + it.name + ' ×' + b.n + '</div><b>' + v + 'g</b></div>'; }).join('');
    return '<div class="panel wide"><h2>📦 Shipping Bin</h2><p class="hint">Click an item to ship 1 · Shift+Click to ship the stack. Payment arrives when you sleep.</p><div class="pack"><div>' + packGrid('binAdd', (s) => s && s.id) + '</div><div class="detail"><h3>In the bin</h3>' + (rows || '<i>Empty</i>') + '<p class="total">Expected: <b>' + money(total) + '</b></p></div></div><div class="btns">' + closeBtn() + '</div></div>';
  };
  V.cook = () => {
    const st = S();
    return '<div class="panel wide"><h2>🍳 Kitchen</h2><div class="list">' + D.RECIPES.map(r => {
      const known = st.recipes[r.id], can = known && G.hasIng(r.ing);
      if (!known) return '<div class="row-item locked"><span class="big-ic">❔</span><div class="grow"><b>???</b><small>' + (r.src.shop ? 'Sold at the Saloon' : 'Learn from ' + D.NPCS[r.src.npc].n + ' at ' + r.src.h + ' hearts') + '</small></div></div>';
      return '<div class="row-item"><span class="big-ic">' + r.i + '</span><div class="grow"><b>' + r.n + '</b><small>+' + r.e + '⚡ +' + r.h + '❤' + (r.buff ? ' · ' + D.BUFF_NAME[r.buff[0]] + ' +' + r.buff[1] + ' (' + Math.round(r.buff[2] / 60) + 'h)' : '') + ' · sells ' + r.p + 'g</small><div>' + ingChips(r.ing) + '</div></div><button class="btn small ' + (can ? 'primary' : 'dis') + '" data-a="cook" data-v="' + r.id + '">Cook</button></div>';
    }).join('') + '</div><div class="btns">' + closeBtn() + '</div></div>';
  };
  V.confirmSleep = () => '<div class="panel narrow"><h2>🛏 Go to sleep?</h2><p>It is ' + D.fmtTime(S().time) + '. The day will end, crops will grow, and your shipping bin will be paid.</p><div class="btns"><button class="btn" data-a="close">Not yet</button><button class="btn primary" data-a="sleepNow">Sleep 💤</button></div></div>';
  V.tv = () => {
    const st = S(), fi = st.festIdx;
    return '<div class="panel narrow"><h2>📺 Valley Channel</h2><p>Today: ' + WX[st.weather][0] + ' ' + WX[st.weather][1] + '<br>Tomorrow: <b>' + WX[st.nextWeather][0] + ' ' + WX[st.nextWeather][1] + '</b></p>' + (fi >= 0 ? '<p>' + D.FESTIVALS[fi].i + ' Festival today: ' + D.FESTIVALS[fi].n + '!</p>' : '<p>Next festival: ' + (D.FESTIVAL_DAY - G.domOf() >= 0 ? 'in ' + (D.FESTIVAL_DAY - G.domOf()) + ' days (' + D.FESTIVALS[G.seasonOf()].n + ')' : 'next season') + '.</p>') + '<p>🏛 Bundles: ' + G.bundlesDone() + '/8 · ⏰ ' + Math.max(0, daysLeft()) + ' days until Joja Corp moves in.</p><div class="btns">' + closeBtn() + '</div></div>';
  };
  V.mineSelect = () => {
    const st = S(), fl = [1]; for (let f = 5; f <= st.mine.elev; f += 5) fl.push(f);
    return '<div class="panel narrow"><h2>🛗 Mine Elevator</h2><p class="hint">Deepest floor: ' + st.mine.max + ' · Bosses at 5, 10, 15.</p><div class="menu">' + fl.map(f => '<button class="btn big" data-a="mineGo" data-v="' + f + '">Floor ' + f + (f === 1 ? ' (entrance)' : '') + '</button>').join('') + '</div><div class="btns">' + closeBtn() + '</div></div>';
  };
  V.fair = () => {
    const sel = data.sel || new Set(), pts = G.fairScore([...sel]);
    return '<div class="panel wide"><h2>🎃 Harvest Fair Display</h2><p class="hint">Choose up to 9 items. Higher value, higher quality and more variety score more. Items are returned afterwards.</p>' + packGrid('fairPick', (s) => s && s.id, sel) + '<p class="total">Selected ' + sel.size + '/9 · Score <b>' + pts + '</b> (65 = red ribbon, 100 = blue ribbon)</p><div class="btns"><button class="btn" data-a="close">Leave</button><button class="btn primary ' + (sel.size ? '' : 'dis') + '" data-a="fairGo">Submit display</button></div></div>';
  };
  V.star = () => {
    const id = G.starTarget(), n = D.NPCS[id];
    return '<div class="panel wide"><h2>⭐ Feast of the Winter Star</h2><div class="dhead">' + face(id, 1) + '<div><p>Your secret friend is <b>' + n.n + '</b>.' + (G.hearts(id) >= 2 ? ' They love ' + n.loves.map(x => D.ITEMS[x].icon).join(' ') : '') + '</p></div></div>' + packGrid('starPick', (s) => s && s.id) + '<div class="btns"><button class="btn" data-a="close">Leave</button></div></div>';
  };
  V.festResult = () => '<div class="panel narrow"><h2>' + data.title + '</h2>' + data.lines.map(l => '<p>' + esc(l) + '</p>').join('') + '<div class="btns"><button class="btn primary" data-a="close">Continue</button></div></div>';
  V.summary = () => {
    const r = data, st = S(), se = G.seasonOf();
    return '<div class="panel wide summary"><h2>🌅 Day ' + r.day + ' · ' + D.SEASONS[se] + ' ' + G.domOf() + ', Year ' + G.yearOf() + '</h2>' +
      (r.shipped.length ? '<h3>📦 Shipped yesterday: +' + money(r.earned) + '</h3><div class="shipped">' + r.shipped.map(s => '<span class="chip ok" title="' + esc(D.ITEMS[s.id].name) + '">' + D.ITEMS[s.id].icon + '×' + s.n + ' ' + s.v + 'g</span>').join('') + '</div>' : '<p class="hint">Nothing was shipped yesterday.</p>') +
      r.lines.map(l => '<p class="line">' + esc(l) + '</p>').join('') + '<p>Today: ' + WX[r.weather][0] + ' ' + WX[r.weather][1] + ' · Tomorrow: ' + WX[r.forecast][0] + ' ' + WX[r.forecast][1] + '</p><p>💰 ' + money(st.gold) + ' · 🏛 ' + G.bundlesDone() + '/8 bundles · ⏰ ' + Math.max(0, daysLeft()) + ' days left</p><div class="btns"><button class="btn primary big" data-a="close">Start the day ☀️</button></div></div>';
  };
  const statsGrid = (s) => '<div class="stat-grid big"><span>📅 Days ' + s.days + '</span><span>🏛 Bundles ' + s.bd + '/8</span><span>💰 Gold ' + money(s.gold) + '</span><span>💵 Earned ' + money(s.earned) + '</span><span>🌾 Crops ' + s.crops + '</span><span>🐟 Fish ' + s.fish + '</span><span>🍄 Forage ' + s.forage + '</span><span>⛏️ Mined ' + s.mined + '</span><span>👹 Slain ' + s.kills + '</span><span>🏆 Bosses ' + s.bossKills + '</span><span>❤️ Hearts ' + s.hearts + '</span><span>🎁 Gifts ' + s.gifts + '</span><span>🍳 Cooked ' + s.cooked + '</span><span>😴 Knocked out ' + s.deaths + '</span></div>';
  V.victory = () => '<div class="panel wide end win"><h2>🎉 The Community Center is Restored!</h2><p class="big-p">All bundles are complete. Granny Edda cries happy tears, Joja Corp packs up and leaves, and Pocket Valley blooms. You did it, ' + esc(S().name) + '!</p>' + statsGrid(data.st) + '<p class="lp">+' + data.st.lp + ' Legacy Points earned (×' + data.st.mult.toFixed(1) + ')</p><div class="btns"><button class="btn primary" data-a="keep">🌻 Keep Playing</button><button class="btn" data-a="newgame">New Run</button><button class="btn" data-a="toTitle">Title</button></div></div>';
  V.gameover = () => '<div class="panel wide end lose"><h2>🏚 ' + (data.reason === 'retire' ? 'You Retired' : 'The Valley Was Lost') + '</h2><p class="big-p">' + (data.reason === 'retire' ? 'You hang up your hat and leave the valley.' : 'The deadline passed. Joja Corp bulldozed the Community Center and paved the valley.') + ' But every farmer learns something...</p>' + statsGrid(data.st) + '<p class="lp">+' + data.st.lp + ' Legacy Points earned. Spend them for a stronger start!</p><div class="btns"><button class="btn primary" data-a="newgame">↻ Try Again</button><button class="btn" data-a="legacy">🏆 Legacy shop</button><button class="btn" data-a="toTitle">Title</button></div></div>';

  // ---------- show / hide ----------
  ui.show = (name, d) => {
    if ((name === 'settings' || name === 'help' || name === 'newgame' || name === 'legacy' || name === 'confirm') && cur && cur !== name && !['settings', 'help', 'newgame', 'legacy', 'confirm'].includes(cur)) prev = { name: cur, data };
    else if (name === 'title' || name === 'pause') prev = null;
    cur = name; data = d || {}; ui._first = true;
    if (name === 'journal') { J.tab = data.tab || J.tab; J.hold = null; J.trash = false; G.ev('pack'); }
    if (name === 'npc') { data.d = G.npcTalk(data.id); }
    if (name === 'fair') data.sel = new Set();
    G.overlay = name; G.keys.clear(); G.mouse.down = false;
    if (name !== 'title' && name !== 'newgame') G.snd.sfx('open');
    if (name === 'pause' && G.fishing) G.fishing = null;
    ui.refresh();
  };
  ui.refresh = () => {
    if (!cur) return;
    const f = V[cur]; if (!f) return;
    const clear = ['title', 'intro'].includes(cur), first = ui._first; ui._first = false;
    modal.className = 'modal ' + (clear ? 'clear' : '') + (cur === 'title' ? ' title' : '') + (first ? ' first' : '');
    let h = ''; try { h = f(); } catch (e) { console.error(e); h = '<div class="panel"><p>Error</p><button class="btn" data-a="close">Close</button></div>'; }
    modal.innerHTML = h; modal.style.display = 'flex';
    const fn = modal.querySelector('#f-name'); if (fn) { fn.oninput = () => { form.name = fn.value; }; modal.querySelector('#f-farm').oninput = (e) => { form.farm = e.target.value; }; }
  };
  ui.hideAll = () => { cur = null; data = null; prev = null; modal.style.display = 'none'; modal.innerHTML = ''; G.overlay = null; };
  ui.close = () => { const was = cur; ui.hideAll(); if (was && was !== 'title') G.snd.sfx('close'); };
  ui.back = () => {
    if (!cur) return;
    if (['settings', 'help', 'confirm', 'legacy', 'newgame'].includes(cur)) {
      if (prev) { const p = prev; prev = null; cur = null; ui.show(p.name, p.data); } else if (G.mode === 'title') ui.show('title'); else ui.close();
    } else if (cur === 'title' || cur === 'end' || cur === 'victory' || cur === 'gameover') return;
    else if (cur === 'summary') ui.close();
    else if (cur === 'npc' && data.gift) { data.gift = false; ui.refresh(); }
    else ui.close();
  };
  ui.key = (c) => {
    if (cur === 'intro' && (c === 'Enter' || c === 'Space')) act('introNext', null);
    else if (cur === 'summary' && (c === 'Enter' || c === 'Space')) ui.close();
    else if (cur === 'npc' && (c === 'KeyE') && !data.gift) ui.close();
    else if (cur === 'journal') { const i = tabs.findIndex(t => t[0] === J.tab); if (c === 'ArrowRight') { J.tab = tabs[(i + 1) % tabs.length][0]; ui.refresh(); } if (c === 'ArrowLeft') { J.tab = tabs[(i + tabs.length - 1) % tabs.length][0]; ui.refresh(); } }
  };

  // ---------- toasts ----------
  ui.toast = (msg, icon) => {
    const d = document.createElement('div'); d.className = 'toast'; d.innerHTML = '<span>' + (icon || '✨') + '</span> ' + esc(msg); toastEl.appendChild(d);
    while (toastEl.children.length > 5) toastEl.removeChild(toastEl.firstChild);
    later(() => { d.classList.add('out'); later(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 400); }, 3200);
  };

  // ---------- actions ----------
  function act(a, el) {
    const v = el && el.dataset ? el.dataset.v : undefined, i = el && el.dataset && el.dataset.i !== undefined ? parseInt(el.dataset.i, 10) : 0, st = S();
    G.snd.sfx('click');
    switch (a) {
      case 'noop': break;
      case 'continue': G.load(); break;
      case 'newgame': if (G.mode !== 'title') { G.ui.hideAll(); G.mode = 'title'; G.S = null; G.map = null; G.ui.showHud(false); G.snd.setMode('title'); } ui.show('newgame'); break;
      case 'legacy': ui.show('legacy'); break;
      case 'help': ui.show('help'); break;
      case 'settings': ui.show('settings'); break;
      case 'toTitle': if (G.mode !== 'title') G.toTitle(); else ui.show('title'); break;
      case 'back': ui.back(); break;
      case 'close': ui.close(); break;
      case 'shirt': form.shirt = v; ui.refresh(); break;
      case 'hair': form.hair = v; ui.refresh(); break;
      case 'diff': form.diff = v; ui.refresh(); break;
      case 'mod': form.mods[v] = !form.mods[v]; ui.refresh(); break;
      case 'start': { const n = modal.querySelector('#f-name'), f = modal.querySelector('#f-farm'); if (n) form.name = n.value.trim() || 'Sprout'; if (f) form.farm = f.value.trim() || 'Willow'; G.newGame({ name: form.name, farm: form.farm, diff: form.diff, mods: Object.assign({}, form.mods), shirt: form.shirt, hair: form.hair }); break; }
      case 'buyLeg': { const u = D.LEGACY.find(x => x.id === v); if (u && !G.meta.upg[v] && G.meta.lp >= u.cost) { G.meta.lp -= u.cost; G.meta.upg[v] = 1; G.saveMeta(); G.sfx('levelup'); ui.refresh(); } else G.sfx('error'); break; }
      case 'introNext': if ((data.page || 0) < 2) { data.page = (data.page || 0) + 1; ui.refresh(); } else ui.close(); break;
      case 'tog': G.set[v] = !G.set[v]; G.snd.apply(); G.saveSettings(); ui.refresh(); break;
      case 'daylen': G.set.dayLen = parseFloat(v); G.saveSettings(); ui.refresh(); break;
      case 'touchset': G.set.touch = v; G.saveSettings(); buildTouch(); ui.refresh(); break;
      case 'liveDiff': st.diff = v; st.deadline = D.DIFFS[v].days + (G.meta.upg.time ? 10 : 0); ui.refresh(); G.toast('Difficulty: ' + D.DIFFS[v].n, '🎚️'); break;
      case 'liveMod': st.mods[v] = !st.mods[v]; ui.refresh(); break;
      case 'jr': ui.show('journal', { tab: 'pack' }); break;
      case 'save': G.save(); break;
      case 'quit': G.save(true); G.toTitle(); break;
      case 'retire': ui.show('confirm', { title: '🏳️ Retire?', text: 'Ending the run now counts as a loss, but you still earn Legacy Points.', yes: 'retireYes' }); break;
      case 'retireYes': G.lose('retire'); break;
      case 'jtab': J.tab = v; J.trash = false; ui.refresh(); break;
      case 'jslot': {
        if (J.hold !== null && J.hold !== i) { const a1 = st.inv[J.hold], b1 = st.inv[i]; if (i >= 6 && J.hold >= 6 && !(a1 && a1.tool) && !(b1 && b1.tool)) { st.inv[J.hold] = b1; st.inv[i] = a1; J.sel = i; } J.hold = null; }
        else J.sel = i; J.trash = false; ui.refresh(); break;
      }
      case 'jmove': { const s = st.inv[J.sel]; if (s && !s.tool) J.hold = J.hold === J.sel ? null : J.sel; ui.refresh(); break; }
      case 'jeat': G.eat(J.sel); ui.refresh(); break;
      case 'jtrash': if (J.trash) { const s = st.inv[J.sel]; if (s && !s.tool) st.inv[J.sel] = null; J.trash = false; G.sfx('error'); } else J.trash = true; ui.refresh(); break;
      case 'craft': G.craft(D.CRAFTS.find(c => c.id === v)); ui.refresh(); break;
      case 'cook': G.cook(D.RECIPES.find(c => c.id === v)); ui.refresh(); break;
      case 'deposit': { const b = el.dataset.b; G.bundleDeposit(b, i); if (G.mode === 'play') ui.refresh(); break; }
      case 'buy': { const list = G.shopItems(data.shop), e = list[i]; if (e) G.shopBuy(e, parseInt(el.dataset.q, 10)); ui.refresh(); break; }
      case 'npcChat': data.d = G.npcTalk(data.id); ui.refresh(); break;
      case 'npcGift': data.gift = true; ui.refresh(); break;
      case 'npcBack': data.gift = false; ui.refresh(); break;
      case 'giveGift': { const r = G.npcGift(data.id, i); data.d = r; data.gift = false; ui.refresh(); break; }
      case 'npcShop': { const hrs = SHOP_HRS[v], t = st.time; if (t >= hrs[0] && t < hrs[1]) ui.show('shop', { shop: v }); else G.toast('The shop is closed right now (' + D.fmtTime(hrs[0]) + ' – ' + D.fmtTime(hrs[1] % 1440) + ').', '🔒'); break; }
      case 'npcCenter': ui.show('bundles'); break;
      case 'npcFest': G.festStart(); break;
      case 'pet': { const an = st.animals.find(x => x.id === parseInt(el.dataset.i, 10)); if (an) G.animalPet(an); ui.refresh(); break; }
      case 'feed': G.animalFeed(data.kind); ui.refresh(); break;
      case 'collect': G.animalCollect(data.kind); ui.refresh(); break;
      case 'binAdd': G.binAdd(i, !!(el && el.shiftKey)); ui.refresh(); break;
      case 'binTake': G.binTake(i); ui.refresh(); break;
      case 'sleepNow': ui.hideAll(); G.sleep(); break;
      case 'mineGo': ui.hideAll(); G.goMine(parseInt(v, 10)); break;
      case 'fairPick': { if (data.sel.has(i)) data.sel.delete(i); else if (data.sel.size < 9) data.sel.add(i); ui.refresh(); break; }
      case 'fairGo': if (data.sel.size) G.fairSubmit([...data.sel]); break;
      case 'starPick': G.starGift(i); break;
      case 'keep': G.keepPlaying(); break;
      default: break;
    }
  }
  uiEl.addEventListener('click', (e) => {
    const el = e.target.closest('[data-a]'); if (!el || el.classList.contains('dis') || el.disabled) return;
    G.snd.init();
    if (el.dataset.a === 'hslot') { if (G.overlay === null && G.S) { G.S.sel = parseInt(el.dataset.i, 10); G.sfx('click'); } return; }
    if (el.dataset.a === 'hjournal') { if (G.mode === 'play' && G.overlay === null) ui.show('journal', { tab: 'pack' }); else if (cur === 'journal') ui.close(); return; }
    if (el.dataset.a === 'hpause') { if (G.mode === 'play' && G.overlay === null) ui.show('pause'); else if (cur === 'pause') ui.close(); return; }
    if (el.dataset.a === 'hmute') { G.set.mute = !G.set.mute; G.snd.apply(); G.saveSettings(); hudSig = ''; return; }
    el.shiftKey = e.shiftKey; act(el.dataset.a, el);
  });
  uiEl.addEventListener('input', (e) => { const k = e.target.dataset && e.target.dataset.k; if (k) { G.set[k] = parseInt(e.target.value, 10) / 100; G.snd.apply(); G.saveSettings(); const em = e.target.parentNode.querySelector('em'); if (em) em.textContent = e.target.value + '%'; } });
  uiEl.addEventListener('change', (e) => { const k = e.target.dataset && e.target.dataset.k; if (k) G.sfx('click'); });

  // ---------- HUD ----------
  ui.showHud = (on) => {
    hudEl.style.display = on ? 'block' : 'none'; hudSig = '';
    if (on && !hudEl.firstChild) {
      hudEl.innerHTML = '<div class="hud-tl panel mini"><div id="h-date"></div><div id="h-time"></div><div id="h-gold"></div><div id="h-dead"></div></div><div class="hud-tut" id="h-tut"></div><div class="hud-fest" id="h-fest"></div>' +
        '<div class="hud-btns"><button class="btn small" data-a="hjournal" title="Journal (I)">📖</button><button class="btn small" data-a="hpause" title="Pause (Esc)">⏸</button><button class="btn small" id="h-mute" data-a="hmute" title="Mute (M)">🔊</button></div>' +
        '<div class="hud-bars"><div id="h-buff"></div><div class="bar hp"><i id="h-hp"></i><span id="h-hpt"></span></div><div class="bar en"><i id="h-en"></i><span id="h-ent"></span></div><div class="water" id="h-water"></div></div><div class="hotbar" id="h-bar"></div>';
      hudEls = {}; ['h-date', 'h-time', 'h-gold', 'h-dead', 'h-tut', 'h-fest', 'h-buff', 'h-hp', 'h-hpt', 'h-en', 'h-ent', 'h-water', 'h-bar', 'h-mute'].forEach(k => { hudEls[k] = hudEl.querySelector('#' + k); });
    }
    buildTouch();
  };
  ui.hud = (dt) => {
    hudT -= dt; if (hudT > 0 || !G.S || G.mode === 'title' || !hudEls) return; hudT = 0.1;
    const st = S(), E = hudEls, se = G.seasonOf();
    const set = (k, v) => { if (E[k].dataset.v !== v) { E[k].dataset.v = v; E[k].innerHTML = v; } };
    set('h-date', D.SEASON_ICON[se] + ' ' + D.SEASONS[se] + ' ' + G.domOf() + ' · Yr ' + G.yearOf() + ' ' + WX[st.weather][0]);
    set('h-time', '🕒 ' + D.fmtTime(st.time) + (st.time >= 1440 ? ' 🌙' : ''));
    set('h-gold', '💰 ' + money(st.gold));
    const dl = daysLeft(); set('h-dead', st.won ? '🌻 Free play' : '⏰ ' + Math.max(0, dl) + ' days · 🏛 ' + G.bundlesDone() + '/8');
    const cu = G.tutCur(); set('h-tut', cu ? '<b>Tutorial</b> ' + cu.t : '');
    const f = G.fest; set('h-fest', f ? (f.type === 'egg' ? '🥚 ' + f.score + ' eggs · ' : '🎣 ' + f.score + 'g · ') + Math.ceil(Math.max(0, f.t)) + 's' : (G.festWindow() ? '🎉 ' + D.FESTIVALS[st.festIdx].n + ' · Town until 2:00 PM' : ''));
    const hp = Math.round(st.hp / st.maxHp * 100), en = Math.round(st.energy / st.maxEnergy * 100);
    E['h-hp'].style.width = hp + '%'; E['h-en'].style.width = en + '%'; E['h-en'].className = en < 20 ? 'low' : ''; E['h-hp'].className = hp < 30 ? 'low' : '';
    set('h-hpt', '❤ ' + Math.round(st.hp)); set('h-ent', '⚡ ' + Math.round(st.energy));
    const b = st.buff && G.abs() < st.buff.until ? st.buff : null; set('h-buff', b ? '<span class="buffchip">✨ ' + b.name + ' +' + b.v + ' <small>' + Math.ceil((b.until - G.abs()) / 60) + 'h</small></span>' : '');
    set('h-water', '🚿 ' + st.water + '/' + D.CAN_CAP[st.tools.can]);
    E['h-mute'].textContent = G.set.mute ? '🔇' : '🔊';
    let sig = st.sel + '|' + st.invSize; for (let i = 0; i < 12; i++) { const s = st.inv[i]; sig += s ? (s.tool ? s.tool + st.tools[s.tool] : s.id + s.n + (s.q || 0)) : '-'; sig += ','; }
    sig += st.upgrades.length;
    if (sig !== hudSig) {
      hudSig = sig; let h = '';
      for (let i = 0; i < 12; i++) { const k = i < 9 ? i + 1 : i === 9 ? 0 : i === 10 ? '-' : '='; h += '<div class="hslot ' + (i === st.sel ? 'sel' : '') + '" data-a="hslot" data-i="' + i + '"><span class="hk">' + k + '</span>' + slotH(i, st.inv[i], 'hslot', 'plain').replace('class="slot ', 'class="slot inner ') + '</div>'; }
      E['h-bar'].innerHTML = h;
      const s = st.inv[st.sel]; let nm = ''; if (s) nm = s.tool ? D.TIER_NAME[st.tools[s.tool]] + ' ' + D.TOOLS[s.tool].n : D.ITEMS[s.id].name + (s.q ? ' (' + D.QNAME[s.q] + ')' : '');
      E['h-bar'].insertAdjacentHTML('afterbegin', '<div class="hname">' + esc(nm) + '</div>');
    }
  };

  // ---------- touch controls ----------
  let touchBuilt = false;
  function touchWanted() { return G.set.touch === 'on' || (G.set.touch === 'auto' && (('ontouchstart' in window) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches))); }
  function buildTouch() {
    const want = touchWanted() && G.mode !== 'title';
    touchEl.style.display = want ? 'block' : 'none'; G.touch.on = touchWanted(); G.wrap.classList.toggle('touch-on', want);
    if (touchBuilt) return; touchBuilt = true;
    touchEl.innerHTML = '<div class="joy"><div class="knob"></div></div><div class="tbtns"><button data-t="use" class="tb a">A</button><button data-t="int" class="tb b">E</button><button data-t="dash" class="tb c">⚡</button><button data-t="pack" class="tb d">🎒</button><button data-t="prev" class="tb e">◀</button><button data-t="next" class="tb f">▶</button></div>';
    const joy = touchEl.querySelector('.joy'), knob = joy.querySelector('.knob'); let pid = null;
    const mv = (e) => { const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2); const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } G.touch.x = Math.abs(dx) > 0.2 ? dx : 0; G.touch.y = Math.abs(dy) > 0.2 ? dy : 0; knob.style.transform = 'translate(' + dx * 30 + 'px,' + dy * 30 + 'px)'; };
    joy.addEventListener('pointerdown', (e) => { pid = e.pointerId; joy.setPointerCapture(pid); G.touch.on = true; G.mouse.active = false; G.snd.init(); mv(e); e.preventDefault(); });
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === pid) mv(e); });
    const end = (e) => { if (e.pointerId === pid) { pid = null; G.touch.x = 0; G.touch.y = 0; knob.style.transform = ''; } };
    joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
    touchEl.querySelectorAll('.tb').forEach(b => {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); G.touch.on = true; G.mouse.active = false; G.snd.init(); const t = b.dataset.t;
        if (G.mode !== 'play' || G.overlay !== null) return;
        if (t === 'use') { if (G.fishing) G.fishAction(); else { G.mouse.down = true; G.useTool(true); } } else if (t === 'int') G.interact(); else if (t === 'dash') G.dashMove(); else if (t === 'pack') ui.show('journal', { tab: 'pack' }); else if (t === 'prev') G.cycleSel(-1); else if (t === 'next') G.cycleSel(1);
      });
      const up = () => { if (b.dataset.t === 'use') G.mouse.down = false; }; b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    });
  }
  ui.destroy = () => { timers.forEach(clearTimeout); };
}
