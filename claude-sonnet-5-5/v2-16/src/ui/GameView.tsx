import { useEffect, useRef, useState } from 'react';
import { Game, TUT_STEPS, type GameOpts } from '../game/sim';
import { Renderer, type Camera } from '../game/render';
import { W, H, TILE, TERRAIN_NAMES, TERRAIN_COST, CARGO_INFO, CARGOS, TECHS, START_YEAR } from '../game/data';
import { audio } from '../game/audio';
import { BuildPanel, TrainsPanel, MarketPanel, RivalsPanel, ContractsPanel, ResearchPanel, LedgerPanel, TABS, type PanelCtx } from './Panels';
import { SettingsModal, HelpModal, EndScreen, uiOpts } from './Screens';
import { Modal, money, short, Bar } from './common';

interface Props { opts: GameOpts; onAgain: () => void; onSetup: () => void; onTitle: () => void }
type Menu = null | 'pause' | 'settings' | 'help';

export default function GameView({ opts, onAgain, onSetup, onTitle }: Props) {
  const [g] = useState(() => new Game(opts));
  const [rend] = useState(() => new Renderer());
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const cam = useRef<Camera>({ x: (W * TILE) / 2, y: (H * TILE) / 2, z: 0.7 });
  const size = useRef({ w: 800, h: 600, dpr: 1 });
  const sized = useRef(false);
  const ui = useRef({
    tool: 'select', hover: null as { x: number; y: number } | null, anchor: null as number | null, pending: null as number | null,
    preview: null as { path: number[]; cost: number; ok: boolean } | null, selTrain: null as number | null, selStation: null as number | null,
    speed: 1, lastSpeed: 1, menu: null as Menu, keys: new Set<string>(), hoverIdx: -1,
  });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef({ moved: false, sx: 0, sy: 0, pinch: 0, button: 0 });
  const [, setTick] = useState(0);
  const rerender = () => setTick((n) => n + 1);
  const [tab, setTabState] = useState('build');
  const [menu, setMenuState] = useState<Menu>(null);
  const [confirmQuit, setConfirmQuit] = useState<null | 'restart' | 'quit'>(null);
  const [toasts, setToasts] = useState<{ id: number; text: string; ok: boolean }[]>([]);
  const [sideOpen, setSideOpen] = useState(true);
  const toastId = useRef(1);

  const setMenu = (m: Menu) => { ui.current.menu = m; setMenuState(m); setConfirmQuit(null); };
  const toast = (text: string, ok = true) => {
    if (!text) return;
    const id = toastId.current++;
    setToasts((t) => [...t.slice(-2), { id, text, ok }]);
    if (!ok) audio.sfx('error');
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  };
  const setTab = (t: string) => {
    setTabState(t); audio.sfx('tab');
    if (t === 'market') g.flags.market = true;
    if (t === 'rivals') g.flags.rivals = true;
  };
  const setTool = (t: string) => {
    const u = ui.current;
    u.tool = t; u.anchor = null; u.preview = null; u.pending = null;
    if (t !== 'select') { u.selStation = null; }
    rerender();
  };
  const cancelAnchor = () => { const u = ui.current; u.anchor = null; u.preview = null; u.pending = null; rerender(); };
  const setSpeed = (s: number) => { const u = ui.current; if (s > 0) u.lastSpeed = s; u.speed = s; audio.sfx('click'); rerender(); };
  const clampCam = () => {
    const c = cam.current, s = size.current;
    const minZ = Math.min(s.w / (W * TILE), s.h / (H * TILE)) * 0.85;
    c.z = Math.max(minZ, Math.min(3.2, c.z));
    c.x = Math.max(0, Math.min(W * TILE, c.x)); c.y = Math.max(0, Math.min(H * TILE, c.y));
  };
  const center = (tx: number, ty: number) => { cam.current.x = (tx + 0.5) * TILE; cam.current.y = (ty + 0.5) * TILE; clampCam(); };
  const toTile = (cx: number, cy: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const c = cam.current, s = size.current;
    const wx = (cx - r.left - s.w / 2) / c.z + c.x, wy = (cy - r.top - s.h / 2) / c.z + c.y;
    return { wx, wy, x: Math.floor(wx / TILE), y: Math.floor(wy / TILE) };
  };
  const updatePreview = () => {
    const u = ui.current;
    if (u.tool !== 'track' || u.anchor === null) { u.preview = null; return; }
    const target = u.pending !== null ? u.pending : u.hover && g.inb(u.hover.x, u.hover.y) ? g.idx(u.hover.x, u.hover.y) : null;
    if (target === null || target === u.anchor) { u.preview = null; return; }
    const path = g.findPath(u.anchor, target, 0);
    if (!path) { u.preview = null; return; }
    const cost = g.pathCost(path, 0);
    u.preview = { path, cost, ok: cost <= g.pl.cash };
  };
  const buildTo = (idx: number) => {
    const u = ui.current;
    if (u.anchor === null) return;
    if (idx === u.anchor) { cancelAnchor(); return; }
    const path = g.findPath(u.anchor, idx, 0);
    if (!path) { toast('No route there: rival rails or the map edge block the way.', false); return; }
    if (g.pathCost(path, 0) === 0) { u.anchor = idx; u.pending = null; u.preview = null; rerender(); return; }
    const r = g.actBuildTrack(path);
    toast(r.msg, r.ok);
    if (r.ok) { u.anchor = idx; u.pending = null; u.preview = null; }
    rerender();
  };
  const confirmTrack = () => {
    const u = ui.current;
    const t = u.pending !== null ? u.pending : u.hover ? g.idx(u.hover.x, u.hover.y) : null;
    if (t !== null) buildTo(t);
  };
  const handleClick = (cx: number, cy: number, ptype: string) => {
    const u = ui.current;
    const t = toTile(cx, cy);
    if (!g.inb(t.x, t.y)) return;
    const idx = g.idx(t.x, t.y);
    if (u.tool === 'station') { const r = g.actBuildStation(t.x, t.y); toast(r.msg, r.ok); if (r.ok) { const s = g.st(g.stAt[idx]); if (s) u.selStation = s.id; } rerender(); return; }
    if (u.tool === 'bulldoze') { const r = g.actDemolish(t.x, t.y); if (r.msg) toast(r.msg, r.ok); rerender(); return; }
    if (u.tool === 'track') {
      if (u.anchor === null) {
        if (g.stepCost(idx, 0) < 0) { toast('Rival property blocks this tile.', false); return; }
        u.anchor = idx; u.pending = null; audio.sfx('click'); rerender(); return;
      }
      if (ptype !== 'mouse') {
        if (u.pending === idx) { buildTo(idx); return; }
        u.pending = idx; u.hover = { x: t.x, y: t.y }; updatePreview(); toast('Tap again to confirm construction.'); rerender(); return;
      }
      buildTo(idx); return;
    }
    // select
    let best: number | null = null, bd = 16 / cam.current.z + 6;
    for (const tr of g.trains) {
      if (tr.owner !== 0) continue;
      const p = g.trainXY(tr, 0);
      const d = Math.hypot(p.x - t.wx, p.y - t.wy);
      if (d < bd) { bd = d; best = tr.id; }
    }
    if (best !== null) { u.selTrain = best; setTabState('trains'); audio.sfx('click'); setSideOpen(true); rerender(); return; }
    const sid = g.stAt[idx];
    if (sid >= 0) { const s = g.st(sid); if (s && s.owner === 0) { u.selStation = sid; setTabState('build'); setSideOpen(true); audio.sfx('click'); rerender(); return; } else if (s) { toast(`${s.name} belongs to ${g.comp(s.owner).name}.`); return; } }
    u.selTrain = null; u.selStation = null; rerender();
  };

  /* ---------- sizing ---------- */
  useEffect(() => {
    const el = wrapRef.current, cv = canvasRef.current;
    if (!el || !cv) return;
    const apply = () => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size.current = { w: Math.max(100, r.width), h: Math.max(100, r.height), dpr };
      cv.width = Math.floor(size.current.w * dpr); cv.height = Math.floor(size.current.h * dpr);
      cv.style.width = `${size.current.w}px`; cv.style.height = `${size.current.h}px`;
      if (!sized.current) {
        sized.current = true;
        const fit = Math.min(size.current.w / (W * TILE), size.current.h / (H * TILE));
        cam.current.z = Math.max(0.5, fit * 1.05);
      }
      clampCam();
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener('resize', apply);
    return () => { ro.disconnect(); window.removeEventListener('resize', apply); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sideOpen]);

  /* ---------- main loop ---------- */
  useEffect(() => {
    audio.init(); audio.startMusic();
    let raf = 0, last = performance.now(), frame = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const rdt = Math.min(0.1, (now - last) / 1000); last = now;
      const u = ui.current;
      const sp = u.menu || g.over ? 0 : u.speed;
      if (sp > 0) { let dt = rdt * sp; while (dt > 0) { const s = Math.min(dt, 0.1); g.update(s); dt -= s; } }
      if (!uiOpts.shake) g.shake = 0;
      g.updateFx(rdt);
      // keyboard pan
      if (u.keys.size && !u.menu) {
        const c = cam.current; const sp2 = (620 / c.z) * rdt;
        let moved = false;
        if (u.keys.has('a') || u.keys.has('arrowleft')) { c.x -= sp2; moved = true; }
        if (u.keys.has('d') || u.keys.has('arrowright')) { c.x += sp2; moved = true; }
        if (u.keys.has('w') || u.keys.has('arrowup')) { c.y -= sp2; moved = true; }
        if (u.keys.has('s') || u.keys.has('arrowdown')) { c.y += sp2; moved = true; }
        if (u.keys.has('+') || u.keys.has('=')) { c.z *= 1 + rdt * 1.5; moved = true; }
        if (u.keys.has('-') || u.keys.has('_')) { c.z /= 1 + rdt * 1.5; moved = true; }
        if (moved) { g.flags.panned = true; clampCam(); }
      }
      const cv = canvasRef.current;
      if (cv) {
        const ctx = cv.getContext('2d');
        if (ctx) {
          const s = size.current;
          rend.draw(ctx, g, { cam: cam.current, w: s.w, h: s.h, dpr: s.dpr, tool: u.tool, hover: u.hover, anchor: u.anchor, preview: u.preview, selTrain: u.selTrain, selStation: u.selStation, time: now / 1000 });
        }
      }
      if (++frame % 4 === 0 && miniRef.current) {
        const mc = miniRef.current.getContext('2d');
        if (mc) rend.drawMini(mc, g, cam.current, size.current.w, size.current.h, miniRef.current.width, miniRef.current.height);
      }
    };
    raf = requestAnimationFrame(loop);
    const iv = window.setInterval(() => { audio.setIntensity(ui.current.menu ? 0.1 : g.intensity); if (!g.over) g.checkTutorial(); setTick((n) => n + 1); }, 250);
    const vis = () => { if (document.hidden && !ui.current.menu && !g.over) { ui.current.menu = 'pause'; setMenuState('pause'); } };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('blur', vis);
    return () => { cancelAnimationFrame(raf); clearInterval(iv); document.removeEventListener('visibilitychange', vis); window.removeEventListener('blur', vis); audio.setIntensity(0.2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName);
    const down = (e: KeyboardEvent) => {
      if (isField(e.target)) return;
      const k = e.key.toLowerCase();
      const u = ui.current;
      if (k === 'escape') {
        if (u.menu === 'settings' || u.menu === 'help') setMenu('pause');
        else if (u.menu === 'pause') setMenu(null);
        else if (u.anchor !== null) cancelAnchor();
        else if (u.tool !== 'select') setTool('select');
        else setMenu('pause');
        return;
      }
      if (k === 'p') { setMenu(u.menu ? null : 'pause'); return; }
      if (k === 'h') { setMenu(u.menu === 'help' ? null : 'help'); return; }
      if (k === 'm') { audio.init(); audio.set({ muted: !audio.settings.muted }); rerender(); return; }
      if (u.menu || g.over) return;
      if (k === ' ') { e.preventDefault(); if (u.speed > 0) { u.lastSpeed = u.speed; u.speed = 0; } else u.speed = u.lastSpeed || 1; rerender(); return; }
      if (k === '1') setSpeed(1); else if (k === '2') setSpeed(2); else if (k === '3') setSpeed(4);
      else if (k === 'v') setTool('select'); else if (k === 't') setTool('track'); else if (k === 'x') setTool('bulldoze');
      else if (k === 'b') setTool('station');
      else if (k === 'enter') confirmTrack();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', '+', '=', '-', '_'].includes(k)) { u.keys.add(k); if (k.startsWith('arrow')) e.preventDefault(); }
    };
    const up = (e: KeyboardEvent) => { ui.current.keys.delete(e.key.toLowerCase()); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- pointer ---------- */
  const onPointerDown = (e: React.PointerEvent) => {
    audio.init();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = drag.current;
    if (pointers.current.size === 1) { d.moved = false; d.sx = e.clientX; d.sy = e.clientY; d.button = e.button; }
    else if (pointers.current.size === 2) { const [a, b] = [...pointers.current.values()]; d.pinch = Math.hypot(a.x - b.x, a.y - b.y); d.moved = true; }
    if (e.pointerType !== 'mouse') { const t = toTile(e.clientX, e.clientY); ui.current.hover = { x: t.x, y: t.y }; }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const u = ui.current, d = drag.current, c = cam.current;
    const prev = pointers.current.get(e.pointerId);
    if (!prev) {
      const t = toTile(e.clientX, e.clientY);
      if (!u.hover || u.hover.x !== t.x || u.hover.y !== t.y) { u.hover = { x: t.x, y: t.y }; if (u.tool === 'track' && u.anchor !== null) { updatePreview(); rerender(); } }
      return;
    }
    if (pointers.current.size >= 2) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (d.pinch > 0) { c.z *= dist / d.pinch; clampCam(); g.flags.panned = true; }
      d.pinch = dist;
      return;
    }
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) d.moved = true;
    if (d.moved) { c.x -= dx / c.z; c.y -= dy / c.z; g.flags.panned = true; clampCam(); }
    const t = toTile(e.clientX, e.clientY);
    if (e.pointerType === 'mouse' && (!u.hover || u.hover.x !== t.x || u.hover.y !== t.y)) u.hover = { x: t.x, y: t.y };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    const had = pointers.current.has(e.pointerId);
    const n = pointers.current.size;
    pointers.current.delete(e.pointerId);
    if (!had) return;
    if (n === 1 && !d.moved) {
      if (d.button === 2) { if (ui.current.anchor !== null) cancelAnchor(); else if (ui.current.tool !== 'select') setTool('select'); }
      else if (!menu && !g.over) handleClick(e.clientX, e.clientY, e.pointerType);
    }
    if (pointers.current.size === 0) d.pinch = 0;
  };
  const onWheel = (e: React.WheelEvent) => {
    const c = cam.current;
    const r = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - r.left - size.current.w / 2, my = e.clientY - r.top - size.current.h / 2;
    const wx = mx / c.z + c.x, wy = my / c.z + c.y;
    c.z *= Math.exp(-e.deltaY * 0.0015);
    clampCam();
    c.x = wx - mx / c.z; c.y = wy - my / c.z; clampCam();
    g.flags.panned = true;
  };
  const onMini = (e: React.PointerEvent) => {
    if (e.type === 'pointermove' && e.buttons !== 1) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    cam.current.x = ((e.clientX - r.left) / r.width) * W * TILE; cam.current.y = ((e.clientY - r.top) / r.height) * H * TILE; clampCam();
    g.flags.panned = true;
  };

  /* ---------- derived UI data ---------- */
  const u = ui.current;
  const me = g.pl;
  const worth = g.worth(me);
  const hv = u.hover && g.inb(u.hover.x, u.hover.y) ? u.hover : null;
  let hoverInfo = '';
  if (hv) {
    const i = g.idx(hv.x, hv.y);
    const tt = g.terr[i];
    hoverInfo = `${TERRAIN_NAMES[tt]} · track ${money(g.tileCost(i, 0))}`;
    const tw = g.towns.find((t) => Math.abs(t.x - hv.x) <= 1 && Math.abs(t.y - hv.y) <= 1);
    const ind = g.inds.find((t) => Math.abs(t.x - hv.x) <= 1 && Math.abs(t.y - hv.y) <= 1);
    if (tw) hoverInfo += ` · ${tw.name} (pop ${Math.round(tw.pop).toLocaleString()})`;
    if (ind) hoverInfo += ` · ${ind.name} L${ind.level}`;
    const own = g.own[i];
    if (g.trk[i] && own >= 0) hoverInfo += ` · ${g.comp(own).name} rails`;
    void TERRAIN_COST;
  }
  const ctx: PanelCtx = {
    g, toast, tool: u.tool, setTool, anchor: u.anchor, previewInfo: u.preview ? { cost: u.preview.cost, ok: u.preview.ok } : null, confirmTrack, cancelAnchor,
    selStation: u.selStation, selTrain: u.selTrain,
    selectStation: (id) => { u.selStation = id; rerender(); }, selectTrain: (id) => { u.selTrain = id; rerender(); }, center,
  };
  const season = g.season;
  const sIcon = season === 'Winter' ? '❄️' : season === 'Spring' ? '🌱' : season === 'Summer' ? '☀️' : '🍂';
  const recent = g.news.filter((n) => g.t - n.t < 22).slice(0, 3);
  const banner = g.news[0] && g.t - g.news[0].t < 6 && (g.news[0].kind === 'bad' || g.news[0].kind === 'warn') ? g.news[0] : null;
  const tutStep = g.tut.on ? TUT_STEPS[Math.min(g.tut.step, TUT_STEPS.length - 1)] : null;
  const month = g.monthAcc / 5;
  const res = g.research ? TECHS.find((t) => t.id === g.research!.id) : null;
  const overdrawn = me.cash < 0;
  void CARGO_INFO; void CARGOS; void START_YEAR;

  return (
    <div className="absolute inset-0 flex flex-col md:flex-row select-none">
      <div ref={wrapRef} className="relative flex-1 min-h-0 min-w-0 overflow-hidden" style={{ cursor: u.tool === 'select' ? 'grab' : 'crosshair' }}>
        <canvas ref={canvasRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel} onContextMenu={(e) => e.preventDefault()} />

        {/* HUD */}
        <div className="absolute top-1.5 left-1.5 right-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 panel rounded-md px-2.5 py-1.5 pointer-events-auto text-sm">
          <div className="flex flex-col leading-tight min-w-[110px]">
            <span className="font-western text-[#ffe08a] text-[13px] truncate max-w-[160px]">{me.name}</span>
            <span className="text-[11px] opacity-80">{sIcon} {g.dateStr()} · to {g.endYear}</span>
            <div className="mt-0.5"><Bar v={month * 100} color="#8a6a44" /></div>
          </div>
          <div className="leading-tight" title="Cash on hand"><div className="text-[10px] opacity-60">CASH</div><div className={`font-bold text-base ${overdrawn ? 'text-[#ff7a6a] animate-pulse' : 'text-[#9fe08a]'}`}>{money(me.cash)}</div></div>
          <div className="leading-tight" title="Outstanding loans"><div className="text-[10px] opacity-60">DEBT</div><div className="font-bold">{short(me.loan)}</div></div>
          <div className="leading-tight" title="Net worth incl. share portfolio"><div className="text-[10px] opacity-60">WORTH</div><div className="font-bold text-[#ffe08a]">{short(worth)}</div></div>
          <div className="leading-tight hidden sm:block" title="Your share price"><div className="text-[10px] opacity-60">SHARE</div><div className="font-bold">${me.price.toFixed(1)}</div></div>
          <div className="leading-tight hidden sm:block" title="Reputation / notoriety"><div className="text-[10px] opacity-60">REP / HEAT</div><div className="font-bold">⭐{Math.round(g.rep)} <span className={g.notoriety > 40 ? 'text-[#ff8a6a]' : ''}>🕵{Math.round(g.notoriety)}</span></div></div>
          {res && <div className="leading-tight hidden lg:block w-24" title="Research"><div className="text-[10px] opacity-60">{res.icon} {res.name}</div><Bar v={g.research!.total - g.research!.left} max={g.research!.total} color="#9fd3ff" /></div>}
          {overdrawn && <div className="text-xs text-[#ff8a7a] font-bold">⚠ OVERDRAWN {g.negMonths}/3</div>}
          <div className="ml-auto flex items-center gap-1">
            {[0, 1, 2, 4].map((s) => <button key={s} className={`btn btn-sm !px-2 ${u.speed === s ? 'btn-on' : ''}`} title={s === 0 ? 'Pause (Space)' : `Speed ${s}x`} onClick={() => setSpeed(s)}>{s === 0 ? '⏸' : s === 1 ? '▶' : s === 2 ? '▶▶' : '▶▶▶'}</button>)}
            <button className="btn btn-sm !px-2" title="Mute (M)" onClick={() => { audio.init(); audio.set({ muted: !audio.settings.muted }); rerender(); }}>{audio.settings.muted ? '🔇' : '🔊'}</button>
            <button className="btn btn-sm !px-2" title="Menu (Esc)" onClick={() => { audio.sfx('click'); setMenu('pause'); }}>☰</button>
            <button className="btn btn-sm !px-2 md:hidden" onClick={() => setSideOpen((s) => !s)}>📋</button>
          </div>
        </div>

        {/* tool bar */}
        <div className="absolute left-1.5 top-[78px] sm:top-[64px] flex flex-col gap-1">
          {[['select', '👆', 'Select (V)'], ['track', '🛤️', 'Track (T)'], ['station', '🏠', 'Station (B)'], ['bulldoze', '💣', 'Demolish (X)']].map(([id, ic, tip]) => (
            <button key={id} title={tip} className={`btn !px-2 !py-1.5 text-lg ${u.tool === id ? 'btn-on' : ''}`} onClick={() => { audio.sfx('click'); setTool(id); }}>{ic}</button>
          ))}
          {g.ruins.some((r) => r.owner === 0) && <button className="btn btn-red !px-2 !py-1.5 anim-pulse" title="Repair damaged track" onClick={() => { const r = g.repairRuins(0); toast(r.msg, r.ok); rerender(); }}>🔧</button>}
        </div>

        {/* banner & toasts */}
        {banner && <div key={banner.t} className="absolute top-[88px] left-1/2 -translate-x-1/2 anim-pop px-4 py-2 rounded-md font-bold text-center max-w-[90%] text-sm" style={{ background: banner.kind === 'bad' ? 'rgba(130,30,20,0.92)' : 'rgba(140,100,20,0.92)', border: '1px solid #ffd7a0' }}>{banner.text}</div>}
        <div className="absolute top-[126px] left-1/2 -translate-x-1/2 grid gap-1 pointer-events-none">
          {toasts.map((t) => <div key={t.id} className="anim-fadein px-3 py-1 rounded text-xs font-bold" style={{ background: t.ok ? 'rgba(40,70,30,0.95)' : 'rgba(110,30,20,0.95)', border: `1px solid ${t.ok ? '#8dcf6a' : '#ff8a7a'}` }}>{t.text}</div>)}
        </div>

        {/* bottom-left: hover info + news */}
        <div className="absolute left-1.5 bottom-1.5 max-w-[60%] md:max-w-[56%] grid gap-1 pointer-events-none">
          {recent.map((n, i) => <div key={n.t + '-' + i} className="anim-fadein text-[11.5px] px-2 py-1 rounded" style={{ background: 'rgba(20,12,6,0.82)', borderLeft: `3px solid ${n.kind === 'bad' ? '#d8402a' : n.kind === 'good' ? '#7ac050' : n.kind === 'warn' ? '#e0a030' : '#8a7a5a'}` }}>{n.text}</div>)}
          {hoverInfo && <div className="text-[11px] px-2 py-0.5 rounded bg-black/65 w-fit">{hoverInfo}</div>}
        </div>

        {/* minimap */}
        <div className="absolute right-1.5 bottom-1.5 panel rounded p-1 hidden sm:block">
          <canvas ref={miniRef} width={168} height={108} className="block cursor-pointer" onPointerDown={onMini} onPointerMove={onMini} />
        </div>

        {/* tutorial */}
        {tutStep && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[70px] sm:bottom-2 w-[min(560px,94%)] panel rounded-lg p-3 anim-fadein border-[#e0b050] z-10" style={{ boxShadow: '0 0 24px rgba(224,176,80,0.35)' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-western text-[#ffe08a] text-sm">🎓 Tutorial {Math.min(g.tut.step + 1, TUT_STEPS.length)}/{TUT_STEPS.length}: {tutStep.hint}</span>
              <button className="btn btn-sm" onClick={() => { g.endTutorial(); rerender(); }}>Skip</button>
            </div>
            <div className="text-[13px] leading-snug">{tutStep.text}</div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex gap-1">{TUT_STEPS.map((_, i) => <div key={i} className="w-4 h-1.5 rounded" style={{ background: i < g.tut.step ? '#8dcf6a' : i === g.tut.step ? '#e0b050' : 'rgba(255,255,255,0.15)' }} />)}</div>
              {g.tut.step === TUT_STEPS.length - 1 && <button className="btn btn-gold btn-sm" onClick={() => { g.flags.finish = true; rerender(); }}>Begin the real contest!</button>}
            </div>
          </div>
        )}

        <button className="absolute right-1.5 top-[78px] sm:top-[64px] btn btn-sm hidden md:inline-flex" onClick={() => setSideOpen((s) => !s)}>{sideOpen ? '▶ Hide' : '◀ Panels'}</button>
      </div>

      {sideOpen && (
        <div className="panel flex flex-col h-[42vh] md:h-auto md:w-[392px] shrink-0 border-l-2 border-[#6a4a2c]">
          <div className="grid grid-cols-7 gap-px p-1 bg-black/30">
            {TABS.map((t) => (
              <button key={t.id} className={`relative flex flex-col items-center py-1 rounded text-[10.5px] leading-tight transition ${tab === t.id ? 'bg-[#e0b050] text-[#2a1a08] font-bold' : 'hover:bg-white/10'}`} onClick={() => setTab(t.id)}>
                <span className="text-base">{t.icon}</span>{t.label}
                {t.id === 'contracts' && g.contracts.some((c) => !c.active) && <span className="absolute top-0.5 right-2 w-2 h-2 rounded-full bg-[#ff6a4a]" />}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto scroll p-2.5">
            {tab === 'build' && <BuildPanel {...ctx} />}
            {tab === 'trains' && <TrainsPanel {...ctx} />}
            {tab === 'market' && <MarketPanel {...ctx} />}
            {tab === 'rivals' && <RivalsPanel {...ctx} />}
            {tab === 'contracts' && <ContractsPanel {...ctx} />}
            {tab === 'research' && <ResearchPanel {...ctx} />}
            {tab === 'ledger' && <LedgerPanel {...ctx} />}
          </div>
        </div>
      )}

      {/* menus */}
      {menu === 'pause' && !g.over && (
        <Modal onClose={() => setMenu(null)}>
          <h2 className="font-western text-3xl text-[#ffe08a] text-center mb-1">Paused</h2>
          <p className="text-center text-xs opacity-70 mb-4">{me.name} · {g.dateStr()} · {g.diff.name}</p>
          <div className="grid gap-2">
            <button className="btn btn-gold !py-2.5" onClick={() => { audio.sfx('click'); setMenu(null); }}>▶ Resume</button>
            <button className="btn" onClick={() => { audio.sfx('click'); setMenu('settings'); }}>⚙ Settings & Difficulty</button>
            <button className="btn" onClick={() => { audio.sfx('click'); setMenu('help'); }}>❓ How to Play & Controls</button>
            {confirmQuit === 'restart' ? <button className="btn btn-red" onClick={onAgain}>Confirm: restart this campaign</button> : <button className="btn" onClick={() => setConfirmQuit('restart')}>↻ Restart campaign</button>}
            {confirmQuit === 'quit' ? <button className="btn btn-red" onClick={onTitle}>Confirm: abandon and quit</button> : <button className="btn" onClick={() => setConfirmQuit('quit')}>🏠 Quit to title</button>}
          </div>
        </Modal>
      )}
      {menu === 'settings' && <SettingsModal g={g} onClose={() => setMenu('pause')} />}
      {menu === 'help' && <HelpModal onClose={() => setMenu(u.menu && g.t > 0 ? 'pause' : null)} />}
      {g.over && <EndScreen g={g} onAgain={onAgain} onSetup={onSetup} onTitle={onTitle} onFree={() => { g.over = null; g.freeplay = true; g.addNews('Sandbox mode: the empire rolls on with no end in sight.', 'info'); rerender(); }} />}
    </div>
  );
}
