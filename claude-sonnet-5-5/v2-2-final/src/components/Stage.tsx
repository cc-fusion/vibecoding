import { useEffect, useRef, useState } from 'react';
import { Btn, Panel, Pips, Stars, Stat } from './ui';
import { audio } from '../game/audio';
import { CREW, DIFFS, GADGETS, GADGET_IDS, LOOT, VENUES, fmt } from '../game/data';
import type { Contract, GadgetId } from '../game/data';
import { createSim, stepSim, say, estimatePlan, doorPlan, skillRateOf, useGadget, bailAll, abortCrew } from '../game/sim';
import type { Order, Result, Sim, SimConfig } from '../game/sim';
import { T_FLOOR, T_STREET } from '../game/level';
import type { Level } from '../game/level';
import { computeView, draw, describeAt, toTile } from '../game/render';
import type { View } from '../game/render';
import { rehearsalCost } from '../game/meta';
import type { Campaign, Settings } from '../game/meta';

interface Props {
  camp: Campaign; ct: Contract; crewIds: string[]; recon: number; level: Level; settings: Settings;
  onExit: () => void; onFinish: (r: Result, used: Record<GadgetId, number>) => void; onCharge: (n: number) => boolean; onHelp: () => void; onSettings: () => void;
}
type Tool = 'auto' | 'sprint' | 'ambush';
const fmtT = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const ALARM_NAMES = ['QUIET', 'ALERT', 'ALARM', 'POLICE'];
const ALARM_COL = ['#5cf0a8', '#ffd35c', '#ff7a4d', '#ff4d5e'];

export function Stage(p: Props) {
  const { camp, ct, crewIds, recon, level, settings } = p;
  const V = VENUES[ct.venue];
  const [cfgBase] = useState<Omit<SimConfig, 'plans'>>(() => ({
    level, recon, diff: camp.diff, eagle: camp.mods.includes('eagle'), heat: camp.heat, garage: camp.upgrades.garage, seed: ct.seed + 99, tutorial: !!ct.tutorial, gadgets: { ...camp.gadgets },
    crew: crewIds.map((id) => camp.crew.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m).map((m) => ({ id: m.id, kind: m.kind, name: m.name, level: m.level })),
  }));
  const crewInfo = cfgBase.crew;

  const [plans, setPlans] = useState<Record<string, Order[]>>({});
  const [sel, setSel] = useState<string>(crewIds[0]);
  const [tool, setTool] = useState<Tool>('auto');
  const [phase, setPhase] = useState<'plan' | 'run'>('plan');
  const [rehearsal, setRehearsal] = useState(false);
  const [paused, setPaused] = useState(false);
  const [menu, setMenu] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [gadget, setGadget] = useState<GadgetId | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [msg, setMsg] = useState<{ t: string; bad: boolean } | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; title: string; lines: string[] } | null>(null);
  const [selectedOnce, setSelectedOnce] = useState(false);
  const [, setTick] = useState(0);

  const simRef = useRef<Sim | null>(null);
  if (!simRef.current) simRef.current = createSim({ ...cfgBase, plans: {} });
  const sim = simRef.current;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 300, h: 300, dpr: 1 });
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const endedRef = useRef(false);
  const usedRef = useRef<Record<GadgetId, number>>({ smoke: 0, emp: 0, decoy: 0, tranq: 0 });
  const msgTimer = useRef<number | null>(null);
  const tipT = useRef(0);
  const stateRef = useRef({ phase, paused: paused || menu, speed, sel, plans, gadget, shake: settings.shake });
  stateRef.current = { phase, paused: paused || menu, speed, sel, plans, gadget, shake: settings.shake };
  const selCrew = crewInfo.find((c) => c.id === sel) ?? crewInfo[0];

  const flash = (t: string, bad = true) => {
    setMsg({ t, bad }); if (bad) audio.sfx('error'); if (msgTimer.current) window.clearTimeout(msgTimer.current); msgTimer.current = window.setTimeout(() => setMsg(null), 2600);
  };

  // ---------- plan editing ----------
  const addOrder = (o: Order) => { if (phase !== 'plan') return; setPlans((pl) => ({ ...pl, [sel]: [...(pl[sel] ?? []), o] })); audio.sfx('add'); };
  const undo = () => { if (phase !== 'plan') return; setPlans((pl) => ({ ...pl, [sel]: (pl[sel] ?? []).slice(0, -1) })); audio.sfx('click'); };
  const allOrders = Object.values(plans).flat();

  const planClick = (fx: number, fy: number) => {
    const s = sim; const L = s.level; const c = selCrew; if (!c) return;
    const tx = Math.floor(fx), ty = Math.floor(fy); if (tx < 0 || ty < 0 || tx >= L.w || ty >= L.h) return;
    for (const u of s.crew) if (u.id !== sel && Math.hypot(u.x - fx, u.y - fy) < 0.6) { setSel(u.id); setSelectedOnce(true); audio.sfx('select'); return; }
    const it = s.items.find((i) => s.known.has(i.id) && i.x === tx && i.y === ty);
    if (it && tool === 'auto') {
      const rate = skillRateOf(c.kind, c.level, it.skill);
      if (rate <= 0) { const who = (Object.keys(CREW) as (keyof typeof CREW)[]).filter((k) => CREW[k].skills[it.skill] > 0.9).map((k) => CREW[k].name).join('/'); flash(`${c.name} can't do ${it.skill} work. Try: ${who}.`); return; }
      const reusable = it.type === 'camTerm' || it.type === 'laserBox';
      if (!reusable && allOrders.some((o) => o.type === 'interact' && o.id === it.id)) { flash('Someone is already assigned to that.'); return; }
      if (it.loot) {
        const w = (plans[sel] ?? []).reduce((a, o) => a + (o.type === 'interact' ? s.items.find((i) => i.id === o.id)?.loot?.weight ?? 0 : 0), 0);
        if (w + it.loot.weight > CREW[c.kind].cap) { flash(`${c.name}'s bag (carry ${CREW[c.kind].cap}) would overflow. Use Muscle for heavy loot.`); return; }
      }
      addOrder({ type: 'interact', x: tx, y: ty, id: it.id }); return;
    }
    const di = L.doorAt[ty * L.w + tx];
    if (di >= 0 && tool === 'auto') {
      const d = s.doors[di];
      if (d.kind === 'vault') { flash(`Vault door: defeat its ${d.locks} lock mechanism(s) to open it.`); return; }
      const known = s.known.has(d.id);
      if (known && d.kind === 'open') { addOrder({ type: 'move', x: tx, y: ty }); return; }
      if (known && !doorPlan(c.kind, c.level, d)) { flash(`${c.name} can't open a ${d.kind} door. ${d.kind === 'keycard' ? 'Needs the Hacker (or Face/Ghost, slowly).' : 'Needs a Ghost, Safecracker or Muscle.'}`); return; }
      addOrder({ type: 'unlock', x: tx, y: ty, id: d.id }); return;
    }
    const t = L.tiles[ty * L.w + tx];
    if (t !== T_FLOOR && t !== T_STREET) { flash('Cannot walk there.'); return; }
    addOrder({ type: tool === 'sprint' ? 'sprint' : tool === 'ambush' ? 'ambush' : 'move', x: tx, y: ty });
  };

  const runClick = (fx: number, fy: number) => {
    const s = sim;
    if (gadget) {
      const err = useGadget(s, gadget, fx, fy);
      if (err) flash(err); else if (s.gadgets[gadget] <= 0) setGadget(null);
      return;
    }
    for (const u of s.crew) if (Math.hypot(u.x - fx, u.y - fy) < 0.8) { setSel(u.id); audio.sfx('select'); return; }
  };

  const execute = (rehearse: boolean) => {
    if (!allOrders.length) { flash('Give your crew at least one order first.'); return; }
    if (rehearse && !p.onCharge(rehearsalCost(ct))) { flash('Cannot afford a rehearsal.'); return; }
    const s = createSim({ ...cfgBase, plans }); simRef.current = s; endedRef.current = false;
    say(s, rehearse ? 'Rehearsal started. (No consequences.)' : 'The plan is in motion.');
    setRehearsal(rehearse); setPhase('run'); setPaused(false); setMenu(false); setSpeed(1); setResult(null); setGadget(null); audio.sfx('start');
  };
  const backToPlan = () => {
    simRef.current = createSim({ ...cfgBase, plans: {} }); endedRef.current = false; setPhase('plan'); setResult(null); setPaused(false); setMenu(false); setGadget(null); audio.setSiren(0); setTick((t) => t + 1);
  };

  // ---------- keyboard ----------
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keyRef.current = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (result || document.querySelector('[data-modal="1"]')) return;
    if (phase === 'plan') {
      if (menu) { if (k === 'escape') setMenu(false); return; }
      const idx = parseInt(k, 10);
      if (idx >= 1 && idx <= crewInfo.length) { setSel(crewInfo[idx - 1].id); setSelectedOnce(true); audio.sfx('select'); }
      else if (k === 'tab') { e.preventDefault(); const i = crewInfo.findIndex((c) => c.id === sel); setSel(crewInfo[(i + 1) % crewInfo.length].id); setSelectedOnce(true); audio.sfx('select'); }
      else if (k === 's') setTool((t) => (t === 'sprint' ? 'auto' : 'sprint'));
      else if (k === 'a') setTool((t) => (t === 'ambush' ? 'auto' : 'ambush'));
      else if (k === 'enter') execute(false);
      else if (k === 'backspace') undo();
      else if (k === 'escape') setMenu(true);
    } else {
      if (k === 'escape') { if (gadget) setGadget(null); else setMenu((m) => !m); }
      else if (menu) return;
      else if (k === ' ') { e.preventDefault(); setPaused((x) => !x); }
      else if (k === 'b') bailAll(sim);
      else if (k === 'f') setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1));
      else if (k === 'tab') { e.preventDefault(); const i = crewInfo.findIndex((c) => c.id === sel); setSel(crewInfo[(i + 1) % crewInfo.length].id); }
      else { const gi = parseInt(k, 10); if (gi >= 1 && gi <= 4) { const id = GADGET_IDS[gi - 1]; if (sim.gadgets[id] > 0) { setGadget((g) => (g === id ? null : id)); audio.sfx('select'); } else flash('No ' + GADGETS[id].name + ' left.'); } }
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e);
    const vis = () => { if (document.hidden && stateRef.current.phase === 'run') setPaused(true); };
    window.addEventListener('keydown', h); document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('keydown', h); document.removeEventListener('visibilitychange', vis); audio.setSiren(0); };
  }, []);

  useEffect(() => { audio.startMusic(phase === 'run' ? 'heist' : 'plan'); }, [phase]);

  // ---------- main loop ----------
  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current; if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const resize = () => {
      const r = wrap.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
      sizeRef.current = { w: Math.max(100, r.width), h: Math.max(100, r.height), dpr };
      canvas.width = Math.floor(sizeRef.current.w * dpr); canvas.height = Math.floor(sizeRef.current.h * dpr); canvas.style.width = sizeRef.current.w + 'px'; canvas.style.height = sizeRef.current.h + 'px';
    };
    resize(); const ro = new ResizeObserver(resize); ro.observe(wrap);
    let raf = 0, last = performance.now(), hudT = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const st = stateRef.current; const s = simRef.current as Sim;
      if (st.phase === 'run' && !st.paused && !s.over) {
        const total = dt * st.speed; const n = Math.max(1, Math.ceil(total / 0.033));
        for (let i = 0; i < n; i++) stepSim(s, total / n);
        for (const q of s.sfxQ) audio.sfx(q); s.sfxQ.length = 0;
        if (s.over && !endedRef.current) {
          endedRef.current = true; const r = s.result as Result; setResult(r); audio.setSiren(0); audio.sfx(r.success ? 'success' : 'fail');
          const u = { smoke: 0, emp: 0, decoy: 0, tranq: 0 } as Record<GadgetId, number>; for (const g of GADGET_IDS) u[g] = Math.max(0, cfgBase.gadgets[g] - s.gadgets[g]); usedRef.current = u;
        }
      }
      const v: View = computeView(sizeRef.current.w, sizeRef.current.h, s.level, sizeRef.current.dpr);
      draw(ctx, s, v, { selected: st.sel, hover: hoverRef.current, plans: st.plans, phase: st.phase, gadget: st.gadget, shake: st.shake, now: now / 1000 });
      hudT += dt;
      if (hudT > 0.15) {
        hudT = 0; setTick((t) => t + 1);
        if (st.phase === 'run' && !s.over) { audio.setIntensity(s.alarm.level); audio.setSiren(st.paused ? 0 : s.alarm.level); }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [cfgBase.gadgets]);

  const evPos = (e: React.PointerEvent | React.MouseEvent) => {
    const r = (canvasRef.current as HTMLCanvasElement).getBoundingClientRect(); const px = e.clientX - r.left, py = e.clientY - r.top;
    const v = computeView(sizeRef.current.w, sizeRef.current.h, sim.level, sizeRef.current.dpr); return { px, py, ...toTile(v, px, py) };
  };
  const onMove = (e: React.PointerEvent) => {
    const q = evPos(e); hoverRef.current = { x: q.x, y: q.y };
    const now = performance.now(); if (now - tipT.current > 90) { tipT.current = now; const d = describeAt(sim, q.x, q.y); setTip(d ? { x: q.px, y: q.py, ...d } : null); }
  };
  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const q = evPos(e); hoverRef.current = { x: q.x, y: q.y }; audio.init();
    if (menu || result || paused && phase === 'run' && !gadget) return;
    if (phase === 'plan') planClick(q.x, q.y); else runClick(q.x, q.y);
  };

  // ---------- derived UI ----------
  const L = sim.level; const D = DIFFS[camp.diff];
  const primary = sim.items.find((i) => i.primary);
  const targetPlanned = !primary || allOrders.some((o) => o.type === 'interact' && o.id === primary.id);
  const signals = new Set(allOrders.filter((o) => o.type === 'signal').map((o) => o.flag));
  const badAwait = [...new Set(allOrders.filter((o) => o.type === 'await' && !signals.has(o.flag)).map((o) => o.flag))];
  const orderText = (o: Order): string => {
    const it = o.id ? sim.items.find((i) => i.id === o.id) : undefined; const dr = o.id ? sim.doors.find((d) => d.id === o.id) : undefined;
    switch (o.type) {
      case 'move': return `Move to ${o.x},${o.y}`; case 'sprint': return `Sprint to ${o.x},${o.y}`; case 'ambush': return `Ambush at ${o.x},${o.y}`;
      case 'unlock': return `Unlock ${dr && sim.known.has(dr.id) ? dr.kind : ''} door`; case 'interact': return it ? `${it.icon} ${it.label}` : 'Interact';
      case 'wait': return `Wait ${o.secs ?? 3}s`; case 'signal': return `Signal ${o.flag}`; case 'await': return `Await signal ${o.flag}`;
      case 'disguise': return 'Put on disguise'; case 'spoof': return 'Spoof radio check-ins'; case 'exit': return 'Exit to van';
    }
  };
  const editPlan = (fn: (a: Order[]) => Order[]) => setPlans((pl) => ({ ...pl, [sel]: fn(pl[sel] ?? []) }));
  const tutSteps = [
    { t: 'Select a crew member: click a crew card (or press 1-2).', done: selectedOnce },
    { t: 'Click an empty floor tile inside the building to add a Move order.', done: allOrders.some((o) => o.type === 'move' || o.type === 'sprint') },
    { t: 'Click an amber ● locked door. Pick a Ghost (picks) or Muscle (breaches).', done: allOrders.some((o) => o.type === 'unlock') },
    { t: 'Click the glowing ★ target to steal it.', done: !!primary && allOrders.some((o) => o.type === 'interact' && o.id === primary.id) },
    { t: 'Press "Exit to van" in Tools so they leave with the loot.', done: allOrders.some((o) => o.type === 'exit') },
    { t: 'Press EXECUTE. Stay out of the yellow cones! Space pauses, B bails.', done: phase === 'run' },
  ];
  const tutNext = tutSteps.findIndex((s) => !s.done);

  const alarmLvl = sim.alarm.level;
  const police = sim.police;
  const bagVal = sim.crew.reduce((a, c) => a + c.bag.reduce((x, l) => x + l.value, 0), 0);
  const secured = sim.secured.reduce((a, l) => a + l.value, 0);

  const toolBtn = (id: Tool, label: string, tip_: string) => <Btn sm on={tool === id} onClick={() => setTool(id)} title={tip_}>{label}</Btn>;

  return (
    <div className="h-full flex flex-col lg:flex-row bg-[#050d1c]">
      <div className="flex-1 min-h-[42vh] min-w-0 relative flex flex-col">
        <div className="flex items-center gap-2 px-2 py-1.5 flex-wrap" style={{ background: 'rgba(8,24,48,0.9)', borderBottom: '1px solid var(--line)' }}>
          <span className="text-xl">{V.icon}</span><span className="noir text-white">{V.name}</span>
          <span className="text-xs" style={{ color: '#ffd35c' }}>★ {ct.targetName}</span>
          <span className="text-[11px] tag ml-1">{phase === 'plan' ? 'BLUEPRINT' : rehearsal ? 'REHEARSAL' : 'LIVE'}</span>
          <div className="ml-auto flex gap-1.5"><Btn sm onClick={p.onHelp}>?</Btn><Btn sm onClick={p.onSettings}>⚙</Btn><Btn sm onClick={() => { setMenu(true); }}>☰ Menu</Btn></div>
        </div>
        <div ref={wrapRef} className="flex-1 relative overflow-hidden">
          <canvas ref={canvasRef} className="absolute left-0 top-0" style={{ cursor: gadget ? 'crosshair' : 'pointer' }} onPointerMove={onMove} onPointerDown={onDown} onPointerLeave={() => { hoverRef.current = null; setTip(null); }} onContextMenu={(e) => { e.preventDefault(); undo(); }} />
          {phase === 'run' && alarmLvl >= 2 && <div className="alarm-vig absolute inset-0" />}
          {tip && <div className="absolute pointer-events-none panel px-2 py-1 text-xs z-10" style={{ left: Math.min(tip.x + 14, sizeRef.current.w - 220), top: Math.max(4, Math.min(tip.y + 14, sizeRef.current.h - 70)), maxWidth: 220 }}><div className="font-bold text-white">{tip.title}</div>{tip.lines.map((l, i) => <div key={i} className="opacity-80">{l}</div>)}</div>}
          {msg && <div className="absolute left-1/2 -translate-x-1/2 top-3 panel px-4 py-2 text-sm z-20 rise" style={{ borderColor: msg.bad ? '#ff4d5e' : '#5cf0a8', color: msg.bad ? '#ffb3bb' : '#b8ffd9' }}>{msg.t}</div>}
          {phase === 'plan' && (ct.tutorial || settings.hints) && (
            <div className="absolute left-2 bottom-2 panel p-2 text-xs max-w-[300px] z-10" style={{ background: 'rgba(5,13,28,0.88)' }}>
              {ct.tutorial ? (
                <><div className="panel-h mb-1">Training Run</div>{tutSteps.map((s, i) => (<div key={i} className="flex gap-1.5 py-[1px]" style={{ opacity: i > tutNext && tutNext >= 0 ? 0.4 : 1, color: s.done ? '#5cf0a8' : i === tutNext ? '#ffd35c' : undefined }}><span>{s.done ? '☑' : '☐'}</span><span>{s.t}</span></div>))}</>
              ) : (<><div className="panel-h mb-1">Hint</div><div className="opacity-80">Select crew, then click the map: floor = move, items = work, doors = unlock. Hit EXECUTE when ready. Right-click undoes.</div></>)}
            </div>
          )}
          {phase === 'run' && !result && (
            <div className="absolute left-2 top-2 flex flex-col gap-1.5 z-10">
              <div className="panel px-3 py-1.5 flex items-center gap-3" style={{ borderColor: ALARM_COL[alarmLvl], boxShadow: alarmLvl >= 2 ? `0 0 18px ${ALARM_COL[alarmLvl]}` : undefined }}>
                <span className={`noir text-lg ${alarmLvl >= 2 ? 'blink' : ''}`} style={{ color: ALARM_COL[alarmLvl] }}>{alarmLvl >= 2 ? '🚨' : alarmLvl === 1 ? '⚠️' : '🤫'} {ALARM_NAMES[alarmLvl]}</span>
                {police.state === 'pending' && <span className="text-xs text-[#ffb347]">Police call in {Math.ceil(police.t)}s</span>}
                {police.state === 'enroute' && <span className="text-xs text-[#ff4d5e]">Police ETA {Math.ceil(police.eta)}s</span>}
                {police.state === 'arrived' && <span className="text-xs text-[#ff4d5e] blink">SWAT inside! Busted in {Math.max(0, Math.ceil(30 + D.escWindow * 2 - (sim.t - police.arrivedT)))}s</span>}
                <span className="text-xs opacity-70">⏱ {fmtT(sim.t)} / {fmtT(L.timeLimit)}</span>
              </div>
              {gadget && <div className="panel px-3 py-1 text-xs" style={{ borderColor: '#ffd35c' }}>Armed: {GADGETS[gadget].icon} {GADGETS[gadget].name}. Click the map to deploy. (Esc cancels)</div>}
              {paused && <div className="panel px-3 py-1 text-xs blink">⏸ Paused</div>}
            </div>
          )}
        </div>
      </div>

      <div className="lg:w-[350px] w-full max-h-[50vh] lg:max-h-none overflow-auto scroll p-2 space-y-2" style={{ background: 'rgba(5,13,28,0.95)', borderLeft: '1px solid var(--line)' }}>
        {phase === 'plan' ? (
          <>
            <Panel title="Crew">
              <div className="space-y-1.5">
                {crewInfo.map((c, i) => {
                  const d = CREW[c.kind]; const o = plans[c.id] ?? [];
                  return (
                    <button key={c.id} onClick={() => { setSel(c.id); setSelectedOnce(true); audio.sfx('select'); }} className={`w-full flex items-center gap-2 p-1.5 rounded text-left border ${sel === c.id ? 'bg-[#1f5aa8]/40' : 'hover:bg-white/5'}`} style={{ borderColor: sel === c.id ? d.color : 'transparent' }}>
                      <span className="w-9 h-9 rounded-full flex items-center justify-center text-xl" style={{ background: d.color + '33', border: `2px solid ${d.color}` }}>{d.icon}</span>
                      <span className="flex-1 text-xs"><b className="text-white text-sm">{i + 1}. {c.name}</b> <span className="opacity-60">Lv{c.level} {d.name}</span><br /><span className="opacity-70">{o.length} orders · ~{Math.round(estimatePlan(L, c.kind, c.level, o))}s · carry {d.cap}</span></span>
                    </button>
                  );
                })}
              </div>
            </Panel>
            <Panel title={`Tools — ${selCrew?.name}`}>
              <div className="text-[10px] uppercase opacity-60 mb-1">Click mode</div>
              <div className="flex gap-1.5 flex-wrap mb-2">{toolBtn('auto', '👆 Auto', 'Floor = move, item = work, door = unlock')}{toolBtn('sprint', '» Sprint (S)', 'Fast but noisy')}{toolBtn('ambush', '🗡 Ambush (A)', 'Hide and take down a passing guard')}</div>
              <div className="text-[10px] uppercase opacity-60 mb-1">Add order</div>
              <div className="flex gap-1.5 flex-wrap">
                <Btn sm onClick={() => addOrder({ type: 'wait', x: 0, y: 0, secs: 3 })}>⏱ Wait 3s</Btn>
                {['A', 'B', 'C'].map((f) => <Btn key={'s' + f} sm onClick={() => addOrder({ type: 'signal', x: 0, y: 0, flag: f })} title="Raise a flag other crew can wait for">📡 Sig {f}</Btn>)}
                {['A', 'B', 'C'].map((f) => <Btn key={'a' + f} sm onClick={() => addOrder({ type: 'await', x: 0, y: 0, flag: f })} title="Wait until someone signals">⏳ Await {f}</Btn>)}
                {selCrew?.kind === 'face' && <><Btn sm onClick={() => addOrder({ type: 'disguise', x: 0, y: 0 })}>🎭 Disguise</Btn><Btn sm onClick={() => addOrder({ type: 'spoof', x: 0, y: 0 })}>📻 Spoof Radio</Btn></>}
                <Btn sm variant="primary" onClick={() => addOrder({ type: 'exit', x: 0, y: 0 })}>🚐 Exit to van</Btn>
              </div>
            </Panel>
            <Panel title={`Orders — ${selCrew?.name}`} right={<div className="flex gap-1"><Btn sm onClick={undo}>↶ Undo</Btn><Btn sm variant="danger" onClick={() => editPlan(() => [])}>Clear</Btn></div>}>
              {(plans[sel] ?? []).length === 0 ? <div className="text-xs opacity-60 py-2">No orders yet. Click the map.</div> : (
                <ol className="space-y-1">
                  {(plans[sel] ?? []).map((o, i) => (
                    <li key={i} className="flex items-center gap-1 text-xs p-1 rounded bg-white/5">
                      <span className="w-5 h-5 rounded-full text-center leading-5 text-[10px] font-bold" style={{ background: selCrew ? CREW[selCrew.kind].color : '#fff', color: '#050d1c' }}>{i + 1}</span>
                      <span className="flex-1 truncate">{orderText(o)}</span>
                      {o.type === 'wait' && <><button className="px-1 opacity-80 hover:opacity-100" onClick={() => editPlan((a) => a.map((x, j) => (j === i ? { ...x, secs: Math.max(1, (x.secs ?? 3) - 1) } : x)))}>−</button><button className="px-1 opacity-80 hover:opacity-100" onClick={() => editPlan((a) => a.map((x, j) => (j === i ? { ...x, secs: Math.min(40, (x.secs ?? 3) + 1) } : x)))}>＋</button></>}
                      <button className="px-1 opacity-70 hover:opacity-100" disabled={i === 0} onClick={() => editPlan((a) => { const b = a.slice(); [b[i - 1], b[i]] = [b[i], b[i - 1]]; return b; })}>▲</button>
                      <button className="px-1 opacity-70 hover:opacity-100" disabled={i === (plans[sel] ?? []).length - 1} onClick={() => editPlan((a) => { const b = a.slice(); [b[i + 1], b[i]] = [b[i], b[i + 1]]; return b; })}>▼</button>
                      <button className="px-1 text-[#ff4d5e]" onClick={() => editPlan((a) => a.filter((_, j) => j !== i))}>✕</button>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
            <Panel title="Plan Check">
              <ul className="text-xs space-y-1">
                <li style={{ color: targetPlanned ? '#5cf0a8' : '#ff9a4d' }}>{targetPlanned ? '✔ Someone is going for the ★ target' : '⚠ Nobody is assigned to the ★ target'}</li>
                {badAwait.map((f) => <li key={f} style={{ color: '#ff9a4d' }}>⚠ "Await {f}" is never signaled (times out after 90s)</li>)}
                <li className="opacity-70">ℹ Crew head for the van automatically after their last order.</li>
                <li className="opacity-70">ℹ Intel: {recon === 0 ? 'blind. Unknown hazards will surprise you.' : recon === 1 ? 'scouted (no guard info).' : 'full casing (patrols tracked).'}</li>
              </ul>
            </Panel>
            <div className="flex gap-2 sticky bottom-0 pb-1">
              <Btn className="flex-1" onClick={() => execute(true)} title="Run on a copy: no consequences">🎬 Rehearse {rehearsalCost(ct) ? fmt(rehearsalCost(ct)) : '(free)'}</Btn>
              <Btn className="flex-[2]" variant="primary" onClick={() => execute(false)}>▶ EXECUTE (Enter)</Btn>
            </div>
          </>
        ) : (
          <>
            <Panel title="Controls">
              <div className="flex gap-1.5 flex-wrap">
                <Btn sm on={paused} onClick={() => setPaused((x) => !x)}>{paused ? '▶ Resume' : '⏸ Pause'}</Btn>
                {[1, 2, 4].map((n) => <Btn key={n} sm on={speed === n} onClick={() => setSpeed(n)}>{n}×</Btn>)}
                <Btn sm variant="danger" disabled={!!result} onClick={() => bailAll(sim)}>🏃 BAIL (B)</Btn>
              </div>
            </Panel>
            <Panel title="Crew">
              <div className="space-y-1.5">
                {sim.crew.map((c) => (
                  <div key={c.id} onClick={() => setSel(c.id)} className={`p-1.5 rounded border cursor-pointer ${sel === c.id ? 'bg-[#1f5aa8]/40' : 'bg-white/5'}`} style={{ borderColor: sel === c.id ? c.color : 'transparent', opacity: c.status === 'escaped' || c.status === 'captured' ? 0.6 : 1 }}>
                    <div className="flex items-center gap-2"><span className="text-xl">{CREW[c.kind].icon}</span><span className="flex-1 text-xs"><b className="text-white text-sm">{c.name}</b> <span className="opacity-70">{c.label}</span></span>
                      {c.status !== 'escaped' && c.status !== 'captured' && <Btn sm variant="ghost" onClick={() => abortCrew(sim, c)}>Bail</Btn>}</div>
                    <div className="flex items-center gap-3 mt-1 text-[11px]"><Pips n={c.hp} max={c.maxHp} /><span>🎒 {c.bag.length ? fmt(c.bag.reduce((a, l) => a + l.value, 0)) : '-'}</span>{c.disguise > 0 && <span style={{ color: '#ff7ad1' }}>🎭 {Math.ceil(c.disguise)}s</span>}
                      {c.status === 'escaped' && <span className="text-[#5cf0a8]">ESCAPED</span>}{c.status === 'captured' && <span className="text-[#ff4d5e]">ARRESTED</span>}</div>
                    {c.work && <div className="h-1.5 mt-1 bg-black/40 rounded overflow-hidden"><div style={{ width: `${Math.min(100, (c.work.t / c.work.total) * 100)}%`, background: '#5cf0a8', height: '100%' }} /></div>}
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Gadgets (1-4)">
              <div className="grid grid-cols-2 gap-1.5">
                {GADGET_IDS.map((g) => (<Btn key={g} sm on={gadget === g} disabled={sim.gadgets[g] <= 0 || !!result} title={GADGETS[g].desc} onClick={() => { setGadget((x) => (x === g ? null : g)); }}>{GADGETS[g].icon} {GADGETS[g].name.split(' ')[0]} ×{sim.gadgets[g]}</Btn>))}
              </div>
            </Panel>
            <Panel title="Take">
              <Stat label="In bags" value={fmt(bagVal)} color="#ffd35c" /><Stat label="Secured at van" value={fmt(secured)} color="#5cf0a8" />
              <Stat label="Target" value={sim.targetSecured ? 'SECURED ✔' : primary?.done ? 'In a bag' : 'Not yet'} color={sim.targetSecured ? '#5cf0a8' : '#ffb347'} />
              {sim.spoofUntil > sim.t && <Stat label="Radio spoof" value={`${Math.ceil(sim.spoofUntil - sim.t)}s`} color="#ff7ad1" />}
              {sim.camOff > sim.t && <Stat label="Cameras looped" value={`${Math.ceil(sim.camOff - sim.t)}s`} color="#5cf0a8" />}
            </Panel>
            <Panel title="Feed">
              <div className="text-xs space-y-0.5 max-h-52 overflow-auto scroll flex flex-col-reverse">
                {sim.log.slice(-14).reverse().map((l, i) => (<div key={i} style={{ color: l.kind === 'bad' ? '#ff8a97' : l.kind === 'good' ? '#7dffc0' : l.kind === 'warn' ? '#ffd35c' : '#b7cde8', opacity: 1 - i * 0.05 }}><span className="opacity-50">{fmtT(l.t)}</span> {l.msg}</div>))}
              </div>
            </Panel>
          </>
        )}
      </div>

      {menu && !result && (
        <div className="fixed inset-0 z-40 flex items-center justify-center" style={{ background: 'rgba(2,6,14,0.75)' }}>
          <div className="panel rise p-5 w-72 space-y-2">
            <div className="noir text-2xl text-white text-center mb-2">{phase === 'run' ? 'PAUSED' : 'MENU'}</div>
            <Btn className="w-full" variant="primary" onClick={() => setMenu(false)}>▶ Resume</Btn>
            <Btn className="w-full" onClick={p.onHelp}>? Field Manual</Btn>
            <Btn className="w-full" onClick={p.onSettings}>⚙ Settings & Volume</Btn>
            {phase === 'run' && rehearsal && <Btn className="w-full" onClick={backToPlan}>↺ Abort rehearsal to Blueprint</Btn>}
            {phase === 'run' && !rehearsal && <Btn className="w-full" variant="danger" onClick={() => { bailAll(sim); setMenu(false); }}>🏃 Bail everyone out</Btn>}
            {phase === 'plan' && <Btn className="w-full" variant="danger" onClick={p.onExit}>◀ Abandon job (back to HQ)</Btn>}
          </div>
        </div>
      )}

      {result && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-3 overflow-auto" style={{ background: 'rgba(2,6,14,0.8)' }}>
          <div className="panel rise p-5 w-full max-w-lg">
            <div className="text-center">
              <div className="stamp noir text-4xl" style={{ color: result.success ? '#5cf0a8' : '#ff4d5e' }}>{result.success ? 'JOB COMPLETE' : 'JOB FAILED'}</div>
              <div className="mt-1 text-xl"><Stars n={result.stars} /></div>
              {rehearsal && <div className="tag mt-1" style={{ color: '#6ee7ff' }}>Rehearsal: no consequences</div>}
            </div>
            <div className="grid grid-cols-2 gap-x-6 mt-4 text-sm">
              <Stat label="Target" value={result.targetSecured ? 'Secured' : 'Lost'} color={result.targetSecured ? '#5cf0a8' : '#ff4d5e'} />
              <Stat label="Loot secured" value={fmt(result.lootValue)} color="#ffd35c" />
              <Stat label="Loot lost" value={fmt(result.lootLost)} color="#ff9a4d" /><Stat label="Time" value={fmtT(result.time)} />
              <Stat label="Max alarm" value={ALARM_NAMES[result.alarmMax]} color={ALARM_COL[result.alarmMax]} /><Stat label="Times spotted" value={result.spotted} />
              <Stat label="Camera / laser trips" value={`${result.camTrips} / ${result.laserTrips}`} /><Stat label="Guards KO'd" value={result.guardsDowned} />
              <Stat label="Bodies found" value={result.bodies} /><Stat label="Gadgets used" value={result.gadgetsUsed} />
              <Stat label="Crew escaped" value={`${result.escaped.length}/${crewInfo.length}`} color="#5cf0a8" /><Stat label="Arrested" value={result.captured.length} color={result.captured.length ? '#ff4d5e' : undefined} />
            </div>
            <div className="text-[11px] opacity-70 mt-2 space-y-0.5"><div>★ Target secured · ★ Ghost run (no alarm) · ★ Clean getaway (no arrests, no police arrival)</div>{result.loot.length > 0 && <div>Haul: {result.loot.map((l) => LOOT[l.cat].icon + ' ' + l.name).join(', ')}</div>}</div>
            <div className="flex gap-2 mt-4 justify-center flex-wrap">
              {rehearsal ? (<><Btn variant="primary" onClick={backToPlan}>Back to Blueprint</Btn><Btn onClick={() => execute(true)}>Re-run ({fmt(rehearsalCost(ct))})</Btn></>) : <Btn variant="primary" onClick={() => p.onFinish(result, usedRef.current)}>Continue ▶</Btn>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
