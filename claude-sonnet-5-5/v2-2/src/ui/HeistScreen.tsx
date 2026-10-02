import { useEffect, useMemo, useRef, useState } from 'react';
import GameCanvas from './GameCanvas';
import { Modal, SettingsModal, HelpModal, Bar, money } from './common';
import { ARCH, DIFFS, GADGETS, GadgetId, SKILLS, TPLS, TRAITS } from '../game/data';
import { buildWorld, findPath, Pt, T_WALL } from '../game/mapgen';
import { HeistSim, HeistResult, Mode, Plan, Step, stepIcon, stepLabel } from '../game/sim';
import { Contract, Meta, Settings, worldOpts } from '../game/meta';
import { audio } from '../game/audio';

interface Props {
  contract: Contract; meta: Meta; crewIds: string[]; loadout: Partial<Record<GadgetId, number>>; tutorial: boolean;
  settings: Settings; onSettings: (s: Settings) => void; onFinish: (r: HeistResult) => void; onAbort: () => void;
}
type Tool = 'move' | 'interact' | 'breach' | 'distract' | 'gadget';
const TOOLS: { id: Tool; icon: string; name: string; key: string }[] = [
  { id: 'move', icon: '➜', name: 'Move', key: '1' }, { id: 'interact', icon: '✋', name: 'Interact', key: '2' }, { id: 'breach', icon: '🔨', name: 'Breach', key: '3' },
  { id: 'distract', icon: '🎭', name: 'Distract', key: '4' }, { id: 'gadget', icon: '🧰', name: 'Gadget', key: '5' },
];
const fmtT = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export default function HeistScreen({ contract, meta, crewIds, loadout, tutorial, settings, onSettings, onFinish, onAbort }: Props) {
  const tpl = TPLS[contract.tpl];
  const [{ world, sim }] = useState(() => {
    const w = buildWorld(tpl, contract.seed, worldOpts(meta, contract));
    const crew = crewIds.map(id => meta.crew.find(c => c.id === id)!).filter(Boolean).map(c => ({ id: c.id, name: c.name, arch: c.arch, skills: c.skills, trait: c.trait, lvl: c.lvl }));
    const d = DIFFS[meta.diff];
    const s = new HeistSim(w, { crew, gadgets: loadout, susp: d.susp, police: d.police, paranoid: meta.mods.paranoid, heat: tutorial ? 0 : meta.heat, scanner: meta.upgrades.scanner || 0, mod: contract.mod, tutorial });
    return { world: w, sim: s };
  });
  const intel = tutorial ? 2 : contract.recon;
  const [phase, setPhase] = useState<'plan' | 'exec' | 'done'>('plan');
  const [plan, setPlan] = useState<Plan>({});
  const [sel, setSel] = useState(crewIds[0]);
  const [tool, setTool] = useState<Tool>('move');
  const [mode, setMode] = useState<Mode>('walk');
  const [gSel, setGSel] = useState<GadgetId | null>(null);
  const [waitSecs, setWaitSecs] = useState(3);
  const [syncTag, setSyncTag] = useState(1);
  const [drillOn, setDrillOn] = useState(false);
  const [speed, setSpeed] = useState(settings.speed || 1);
  const [paused, setPaused] = useState(false);
  const [menu, setMenu] = useState<null | 'pause' | 'settings' | 'help' | 'forfeit'>(null);
  const [armed, setArmed] = useState<GadgetId | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [res, setRes] = useState<HeistResult | null>(null);
  const [, setTick] = useState(0);
  const hover = useRef<Pt | null>(null);
  const uiT = useRef(0);
  const doneRef = useRef(false);
  const toastT = useRef<number | null>(null);

  const S = useRef({ phase, plan, sel, tool, mode, gSel, waitSecs, syncTag, drillOn, speed, paused, menu, armed });
  S.current = { phase, plan, sel, tool, mode, gSel, waitSecs, syncTag, drillOn, speed, paused, menu, armed };

  const say = (m: string) => { setToast(m); if (toastT.current) clearTimeout(toastT.current); toastT.current = window.setTimeout(() => setToast(null), 2600); };
  useEffect(() => () => { if (toastT.current) clearTimeout(toastT.current); audio.setAlarm(false); audio.setTension(0.1); }, []);

  const gadgetIds = useMemo(() => (Object.keys(loadout) as GadgetId[]).filter(g => (loadout[g] || 0) > 0), [loadout]);
  const planned = (g: GadgetId) => Object.values(plan).reduce((a, ss) => a + ss.filter(s => s.t === 'gadget' && s.g === g).length, 0);
  const drillPlanned = Object.values(plan).reduce((a, ss) => a + ss.filter(s => s.t === 'crack' && s.drill).length, 0);
  const crewRun = (id: string) => sim.crew.find(c => c.id === id)!;

  // path previews
  const paths = useMemo(() => {
    const out: Record<string, Pt[][]> = {};
    for (const cr of sim.crew) {
      let pos: Pt = { x: world.van.x + 0.5, y: world.van.y + 0.5 };
      const segs: Pt[][] = [];
      for (const s of plan[cr.id] || []) {
        if (s.t === 'wait' || s.t === 'sync') continue;
        let tx = s.x, ty = s.y;
        if (s.t === 'takedown' || (s.t === 'gadget' && s.g === 'dart')) { const g = world.guards[s.id ?? 0]; if (g) { tx = g.x; ty = g.y; } }
        if (s.t === 'exit') { tx = world.van.x; ty = world.van.y; }
        if (cr.arch === 'hacker' && s.t === 'hack' && Math.hypot(tx + 0.5 - pos.x, ty + 0.5 - pos.y) <= 6) continue;
        const p = findPath(world, pos.x, pos.y, tx, ty, true);
        if (p) { segs.push([pos, ...p]); if (p.length) pos = p[p.length - 1]; else pos = { x: tx + 0.5, y: ty + 0.5 }; }
      }
      out[cr.id] = segs;
    }
    return out;
  }, [plan, world, sim]);

  // ---------------------------------------------------------------- planning actions
  const push = (s: Step, id = S.current.sel) => {
    const cur = S.current.plan[id] || [];
    if (cur.length >= 30) { say('Step limit reached (30).'); audio.sfx('error'); return; }
    setPlan(p => ({ ...p, [id]: [...(p[id] || []), { mode: S.current.mode, ...s }] }));
    audio.sfx('place');
    const cr = crewRun(id);
    if (s.t === 'unlock') { const d = world.doors[s.id!]; if (d.lock > cr.sk.lock) say(`${cr.name} has Locks ${cr.sk.lock}: L${d.lock} lock will be slow.`); }
    if (s.t === 'crack' && s.k === 'safe') { const sf = world.safes[s.id!]; if (sf.lock > cr.sk.lock + 1) say(`${cr.name} struggles with an L${sf.lock} safe.`); }
    if (s.t === 'takedown') { const g = sim.guards[s.id!]; if (g.type === 'heavy' && cr.sk.muscle < 3) say('Heavies need Muscle 3+ (or a dart).'); if (g.type === 'warden') say('The Warden can only be staggered, and only by Muscle.'); }
    if (s.t === 'hack' && cr.arch !== 'hacker' && s.k === 'term') say('Non-hackers must stand next to the terminal.');
  };

  const onTile = (tx: number, ty: number) => {
    const st = S.current;
    if (st.menu) return;
    if (st.phase === 'exec') {
      if (st.armed) {
        const cr = crewRun(st.sel);
        if (cr && sim.alive(cr)) { if (sim.useGadget(cr, st.armed, tx + 0.5, ty + 0.5)) setArmed(null); }
        return;
      }
      let best: string | null = null, bd = 1.4;
      sim.crew.forEach(c => { if (!sim.alive(c)) return; const d = Math.hypot(c.x - tx - 0.5, c.y - ty - 0.5); if (d < bd) { bd = d; best = c.id; } });
      if (best) { setSel(best); audio.sfx('select'); }
      return;
    }
    if (st.phase !== 'plan') return;
    const cx = tx + 0.5, cy = ty + 0.5, w = world;
    const walkable = w.tiles[ty * w.w + tx] !== T_WALL;
    if (st.tool === 'move' || st.tool === 'distract') {
      if (!walkable) { say("Can't walk through walls."); audio.sfx('error'); return; }
      push({ t: st.tool === 'move' ? 'move' : 'distract', x: tx, y: ty });
      return;
    }
    if (st.tool === 'gadget') {
      if (!st.gSel) { say('Pick a gadget first.'); audio.sfx('error'); return; }
      const g = st.gSel;
      if (planned(g) >= (loadout[g] || 0)) { say(`No more ${GADGETS[g].name} in the loadout.`); audio.sfx('error'); return; }
      if (g === 'drill') { say('Use the Drill toggle; it applies to crack steps.'); return; }
      if (g === 'dart') {
        if (intel < 1) { say('You need recon to target guards.'); return; }
        const gd = sim.guards.filter(x => x.type !== 'drone').map(x => ({ x, d: Math.hypot(x.x - cx, x.y - cy) })).sort((a, b) => a.d - b.d)[0];
        if (!gd || gd.d > 1.6) { say('Click on a guard to target the dart.'); return; }
        push({ t: 'gadget', g, id: gd.x.id, x: Math.floor(gd.x.x), y: Math.floor(gd.x.y) });
        return;
      }
      push({ t: 'gadget', g, x: tx, y: ty });
      return;
    }
    // interact / breach
    type C = { d: number; s: Step | null; msg?: string };
    const cands: C[] = [];
    const dist = (x: number, y: number) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    w.doors.forEach(d => {
      const dd = dist(d.x, d.y); if (dd > 1.1) return;
      if (d.vault) { cands.push({ d: dd, s: st.tool === 'breach' ? null : { t: 'crack', k: 'door', id: d.id, x: d.x, y: d.y, drill: st.drillOn && (loadout.drill || 0) > drillPlanned }, msg: st.tool === 'breach' ? 'Vault doors cannot be breached. Use Interact to crack.' : undefined }); }
      else if (d.lock === 0) cands.push({ d: dd, s: null, msg: 'That door is unlocked.' });
      else cands.push({ d: dd, s: { t: st.tool === 'breach' ? 'breach' : 'unlock', id: d.id, x: d.x, y: d.y } });
    });
    w.terms.forEach(t => { const dd = dist(t.x, t.y); if (dd < 1.3) cands.push({ d: dd, s: { t: 'hack', k: 'term', id: t.id, x: t.x, y: t.y } }); });
    if (intel >= 1) {
      w.cams.forEach(c => { const dd = dist(c.x, c.y); if (dd < 1.3) cands.push({ d: dd, s: { t: 'hack', k: 'cam', id: c.id, x: c.x, y: c.y } }); });
      w.panels.forEach(p => { const dd = dist(p.x, p.y); if (dd < 1.3) cands.push({ d: dd, s: { t: 'hack', k: 'panel', id: p.id, x: p.x, y: p.y } }); });
      sim.guards.forEach(g => { const dd = Math.hypot(g.x - cx, g.y - cy); if (dd < 1.4) cands.push({ d: dd - 0.2, s: g.type === 'drone' ? null : { t: 'takedown', id: g.id, x: Math.floor(g.x), y: Math.floor(g.y) }, msg: g.type === 'drone' ? 'Drones need an EMP.' : undefined }); });
    }
    w.safes.forEach(sf => {
      const dd = dist(sf.x, sf.y); if (dd > 1.2) return;
      const cracked = Object.values(st.plan).some(ss => ss.some(s => s.t === 'crack' && s.k === 'safe' && s.id === sf.id));
      const loot = w.loot.find(l => l.safe === sf.id);
      if (cracked && loot) cands.push({ d: dd - 0.1, s: { t: 'grab', id: loot.id, x: loot.x, y: loot.y } });
      else cands.push({ d: dd - 0.1, s: { t: 'crack', k: 'safe', id: sf.id, x: sf.x, y: sf.y, drill: st.drillOn && (loadout.drill || 0) > drillPlanned } });
    });
    w.loot.forEach(l => {
      if (l.taken || l.hidden) return;
      const dd = dist(l.x, l.y); if (dd < 1.1) cands.push({ d: dd - 0.15, s: { t: 'grab', id: l.id, x: l.x, y: l.y } });
    });
    cands.sort((a, b) => a.d - b.d);
    const c = cands[0];
    if (!c) { say(st.tool === 'breach' ? 'Click a locked door to breach.' : 'Nothing to interact with there. Click a door, terminal, safe, loot or guard.'); audio.sfx('error'); return; }
    if (!c.s) { say(c.msg || 'Not possible.'); audio.sfx('error'); return; }
    push(c.s);
  };

  const addInstant = (kind: 'wait' | 'sync' | 'exit') => {
    const cur = S.current.plan[S.current.sel] || [];
    const last = cur[cur.length - 1];
    const pos = last ? { x: last.x, y: last.y } : world.van;
    if (kind === 'wait') push({ t: 'wait', secs: S.current.waitSecs, x: pos.x, y: pos.y });
    else if (kind === 'sync') push({ t: 'sync', tag: S.current.syncTag, x: pos.x, y: pos.y });
    else push({ t: 'exit', x: world.van.x, y: world.van.y });
  };
  const undo = () => { setPlan(p => { const c = (p[S.current.sel] || []).slice(0, -1); return { ...p, [S.current.sel]: c }; }); audio.sfx('remove'); };
  const removeAt = (i: number) => { setPlan(p => ({ ...p, [sel]: (p[sel] || []).filter((_, j) => j !== i) })); audio.sfx('remove'); };
  const moveStep = (i: number, d: number) => setPlan(p => { const a = (p[sel] || []).slice(); const j = i + d; if (j < 0 || j >= a.length) return p; [a[i], a[j]] = [a[j], a[i]]; return { ...p, [sel]: a }; });
  const noExit = crewIds.filter(id => !(plan[id] || []).some(s => s.t === 'exit') && (plan[id] || []).length > 0);

  const execute = () => {
    const cur = S.current.plan;
    if (!Object.values(cur).some(s => s.length > 0)) { say('Plan at least one step first.'); audio.sfx('error'); return; }
    sim.start(cur);
    audio.sfx('select'); audio.sfx('whoosh');
    setPhase('exec'); setPaused(false); setSpeed(settings.speed || 1);
  };

  // ---------------------------------------------------------------- frame
  const onFrame = (dt: number) => {
    const st = S.current;
    if (st.phase === 'exec') {
      const run = !st.menu && !st.paused;
      sim.advance(dt, run ? st.speed : 0);
      audio.setTension(sim.tension);
      audio.setAlarm(sim.alarm && !sim.over && run);
      if (sim.over && !doneRef.current) {
        doneRef.current = true;
        audio.setAlarm(false);
        const r = sim.result(); setRes(r); setPhase('done');
        audio.sfx(r.success ? 'win' : 'lose'); audio.setTension(0.1);
      }
    } else if (st.phase === 'done') sim.advance(dt, 0);
    else audio.setTension(0.12);
    uiT.current += dt;
    if (uiT.current > 0.12) { uiT.current = 0; setTick(t => t + 1); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = S.current;
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'Escape') { setMenu(m => (m ? null : st.phase === 'done' ? null : 'pause')); return; }
      if (st.menu || st.phase === 'done') return;
      const k = e.key.toLowerCase();
      if (st.phase === 'plan') {
        if (k >= '1' && k <= '5') { setTool(TOOLS[parseInt(k) - 1].id); audio.sfx('click'); }
        else if (k === '6') addInstant('wait'); else if (k === '7') addInstant('sync'); else if (k === '8') addInstant('exit');
        else if (k === 'tab') { e.preventDefault(); const i = crewIds.indexOf(st.sel); setSel(crewIds[(i + (e.shiftKey ? -1 : 1) + crewIds.length) % crewIds.length]); audio.sfx('select'); }
        else if (k === 'z' || k === 'backspace') undo();
        else if (k === 'enter') execute();
      } else {
        if (k === ' ') { e.preventDefault(); setPaused(p => !p); }
        else if (k === 'q') setSpeed(1); else if (k === 'w') setSpeed(2); else if (k === 'e') setSpeed(4);
        else if (k >= '1' && k <= '4') { const id = crewIds[parseInt(k) - 1]; if (id) { setSel(id); audio.sfx('select'); } }
        else if (k === 'h') sim.toggleHold(st.sel); else if (k === 'b') sim.bail(st.sel); else if (k === 'x') sim.skipStep(st.sel);
        else if (k === 'g') { const g = gadgetIds.find(x => x !== 'drill' && (sim.gadgets[x] || 0) > 0); if (g) setArmed(a => (a ? null : g)); }
      }
    };
    const onVis = () => { if (document.hidden && S.current.phase === 'exec' && !sim.over) setMenu('pause'); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVis);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getCfg = () => ({ world, sim, phase, intel, plan, selCrew: sel, paths, hover: hover.current, targeting: armed || (phase === 'plan' && tool === 'gadget' && gSel && gSel !== 'dart' && gSel !== 'drill' ? gSel : null), shakeOn: settings.shake && !settings.reduceFlash, tool });
  const steps = plan[sel] || [];
  const cr = crewRun(sel);
  const alive = sim.crew.filter(c => sim.alive(c));
  const tutTasks = [
    { t: 'Place a Move step (tool 1, click the map)', ok: Object.values(plan).some(ss => ss.some(s => s.t === 'move')) },
    { t: 'Pick a locked door with Interact (tool 2)', ok: Object.values(plan).some(ss => ss.some(s => s.t === 'unlock')) },
    { t: 'Grab a 💍 ring with Interact', ok: Object.values(plan).some(ss => ss.some(s => s.t === 'grab')) },
    { t: 'Give your crew an Exit step (button or key 8)', ok: Object.values(plan).some(ss => ss.some(s => s.t === 'exit')) },
    { t: 'Press EXECUTE and watch the guard cone', ok: phase !== 'plan' },
  ];
  const stateBadge = sim.alarm ? ['ALARM', 'bg-red-600 pulse-red'] : sim.cautionT > 0 ? ['CAUTION', 'bg-amber-600'] : ['QUIET', 'bg-emerald-700'];

  return (
    <div className="flex h-full w-full flex-col md:flex-row" data-phase={phase}>
      {/* ---------------- sidebar */}
      <aside className="order-2 flex max-h-[44vh] w-full shrink-0 flex-col gap-2 overflow-y-auto border-t border-sky-500/30 bg-[#06101f] p-2 md:order-1 md:max-h-none md:w-80 md:border-r md:border-t-0">
        <div className="panel p-2">
          <div className="flex items-center justify-between">
            <div className="font-display text-lg font-bold leading-tight text-amber-200">{tpl.icon} {tpl.name}</div>
            <button className="btn !px-2 !py-0.5" onClick={() => { audio.sfx('click'); setMenu('pause'); }} aria-label="Menu">☰</button>
          </div>
          <div className="text-xs text-slate-400">Client: {contract.client} · Fee {money(contract.fee)}{contract.mod !== 'none' ? ` · ${contract.mod.toUpperCase()}` : ''}</div>
          {phase === 'plan' && <div className="mt-1 text-xs text-slate-300">Recon L{intel}: {intel === 0 ? 'layout only. Cameras, lasers, guards unknown!' : intel === 1 ? 'guards and security visible, routes unknown.' : 'full intel including patrol routes.'}</div>}
        </div>

        {phase === 'plan' && (<>
          <div className="panel p-2">
            <div className="mb-1 font-display text-sm uppercase tracking-widest text-sky-300">Crew (Tab)</div>
            <div className="grid grid-cols-2 gap-1">
              {crewIds.map(id => { const c = crewRun(id); const n = (plan[id] || []).length; const bad = n > 0 && !(plan[id] || []).some(s => s.t === 'exit');
                return <button key={id} className={`btn !px-2 !py-1 text-left ${sel === id ? 'btn-on' : ''}`} style={{ borderColor: c.color }} onClick={() => { setSel(id); audio.sfx('select'); }}>
                  {c.icon} {c.name} <span className="text-xs opacity-70">({n}){bad ? ' ⚠' : ''}</span></button>; })}
            </div>
            {cr && <div className="mt-2 text-xs text-slate-300">
              <div style={{ color: cr.color }}>{ARCH[cr.arch].name} Lv{cr.lvl}{cr.trait ? ` · ${TRAITS[cr.trait].name}` : ''}</div>
              <div className="mt-1 flex flex-wrap gap-x-3">{SKILLS.map(s => <span key={s.id} title={s.desc}>{s.icon}{cr.sk[s.id]}</span>)}<span>🎒{cr.cap}</span></div>
              <div className="mt-1 text-amber-200/80">★ {ARCH[cr.arch].perk}: {ARCH[cr.arch].perkDesc}</div>
            </div>}
          </div>
          <div className="panel flex-1 p-2">
            <div className="mb-1 flex items-center justify-between font-display text-sm uppercase tracking-widest text-sky-300"><span>Plan: {cr?.name}</span><span className="text-xs normal-case text-slate-400">{steps.length}/30</span></div>
            {!steps.length && <div className="py-3 text-center text-xs text-slate-500">No steps yet. Choose a tool and click the blueprint.</div>}
            <ol className="space-y-1">
              {steps.map((s, i) => (
                <li key={i} className="flex items-center gap-1 rounded bg-white/5 px-1 py-0.5 text-xs">
                  <span className="w-5 text-center" style={{ color: cr.color }}>{i + 1}</span>
                  <span>{stepIcon(s)}</span>
                  <span className="flex-1 truncate">{stepLabel(s, world)}{s.drill ? ' 🔥' : ''}</span>
                  <button className="px-1 text-sky-300 hover:text-white" onClick={() => moveStep(i, -1)} aria-label="Move up">▲</button>
                  <button className="px-1 text-sky-300 hover:text-white" onClick={() => moveStep(i, 1)} aria-label="Move down">▼</button>
                  <button className="px-1 text-red-400 hover:text-red-200" onClick={() => removeAt(i)} aria-label="Delete step">✕</button>
                </li>
              ))}
            </ol>
            <div className="mt-2 flex gap-1">
              <button className="btn flex-1 !py-1" onClick={undo} disabled={!steps.length}>Undo (Z)</button>
              <button className="btn flex-1 !py-1" onClick={() => { setPlan(p => ({ ...p, [sel]: [] })); audio.sfx('remove'); }} disabled={!steps.length}>Clear</button>
            </div>
          </div>
          {noExit.length > 0 && <div className="rounded border border-amber-500/40 bg-amber-900/20 p-2 text-xs text-amber-200">⚠ {noExit.map(id => crewRun(id).name).join(', ')} {noExit.length > 1 ? 'have' : 'has'} no Exit step. They will linger until auto-bail.</div>}
          <button className="btn btn-gold !py-2 text-lg" onClick={execute}>▶ Execute Plan (Enter)</button>
          <button className="btn btn-red !py-1" onClick={() => { audio.sfx('click'); onAbort(); }}>Abort & return to hideout</button>
        </>)}

        {phase !== 'plan' && (<>
          <div className="panel p-2">
            <div className="mb-1 font-display text-sm uppercase tracking-widest text-sky-300">Crew (click / 1-4)</div>
            <div className="space-y-1">
              {sim.crew.map((c, i) => {
                const ok = sim.alive(c); const val = c.carry.reduce((a, l) => a + l.value, 0);
                const prog = c.auto ? c.auto.t / c.auto.dur : c.state === 'work' && c.workDur ? c.workT / c.workDur : 0;
                return (
                  <div key={c.id} onClick={() => { setSel(c.id); audio.sfx('select'); }} className={`cursor-pointer rounded border p-1.5 ${sel === c.id ? 'border-white/80 bg-white/10' : 'border-white/10 bg-white/5'}`} style={{ opacity: ok || c.state === 'escaped' ? 1 : 0.55 }}>
                    <div className="flex items-center justify-between text-sm">
                      <span style={{ color: c.color }}>{i + 1}. {c.icon} {c.name}</span>
                      <span className="text-xs">{c.state === 'escaped' ? '✅ escaped' : c.state === 'arrested' ? '⛓ arrested' : val ? `💰 ${money(val)}` : ''}</span>
                    </div>
                    <div className="truncate text-xs text-slate-400">{ok ? `${c.label}${c.hold ? ' (HOLD)' : ''}` : ''}</div>
                    {ok && <Bar value={prog} max={1} color={c.color} h={4} />}
                    {ok && sel === c.id && <div className="mt-1 flex gap-1">
                      <button className="btn flex-1 !px-1 !py-0.5 text-xs" onClick={() => sim.toggleHold(c.id)}>{c.hold ? 'Resume' : 'Hold'} (H)</button>
                      <button className="btn flex-1 !px-1 !py-0.5 text-xs" onClick={() => sim.skipStep(c.id)}>Skip (X)</button>
                      <button className="btn btn-red flex-1 !px-1 !py-0.5 text-xs" onClick={() => sim.bail(c.id)}>Bail (B)</button>
                    </div>}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="panel p-2">
            <div className="mb-1 font-display text-sm uppercase tracking-widest text-sky-300">Gadgets (G)</div>
            {gadgetIds.filter(g => g !== 'drill').length === 0 && <div className="text-xs text-slate-500">None in the loadout.</div>}
            <div className="grid grid-cols-2 gap-1">
              {gadgetIds.filter(g => g !== 'drill').map(g => (
                <button key={g} disabled={phase === 'done' || (sim.gadgets[g] || 0) <= 0} className={`btn !px-1 !py-1 text-xs ${armed === g ? 'btn-on' : ''}`} title={GADGETS[g].desc} onClick={() => { audio.sfx('click'); setArmed(a => (a === g ? null : g)); }}>
                  {GADGETS[g].icon} {GADGETS[g].name} ×{sim.gadgets[g] || 0}</button>))}
            </div>
            {armed && <div className="mt-1 text-xs text-amber-300">Click the map to throw {GADGETS[armed].name} (range 8) from {cr?.name}.</div>}
          </div>
          <div className="panel flex-1 overflow-y-auto p-2" style={{ minHeight: 80 }}>
            <div className="mb-1 font-display text-sm uppercase tracking-widest text-sky-300">Radio log</div>
            <div className="space-y-0.5 text-xs">
              {sim.log.slice(-14).reverse().map((l, i) => <div key={sim.log.length - i} className={l.kind === 'bad' ? 'text-red-300' : l.kind === 'good' ? 'text-emerald-300' : l.kind === 'warn' ? 'text-amber-300' : 'text-slate-300'}>[{fmtT(l.t)}] {l.msg}</div>)}
            </div>
          </div>
          <button className="btn btn-red !py-1" disabled={phase === 'done' || !alive.length} onClick={() => { sim.bailAll(); audio.sfx('alert'); }}>🚐 Bail everyone</button>
        </>)}
      </aside>

      {/* ---------------- canvas column */}
      <section className="relative order-1 flex min-h-0 flex-1 flex-col md:order-2">
        {phase === 'plan' ? (
          <div className="flex flex-wrap items-center gap-1 border-b border-sky-500/30 bg-[#06101f] p-1.5">
            {TOOLS.map(t => <button key={t.id} className={`btn !px-2 !py-1 text-sm ${tool === t.id ? 'btn-on' : ''}`} onClick={() => { setTool(t.id); audio.sfx('click'); }} title={`${t.name} (${t.key})`}>{t.icon} <span className="hidden sm:inline">{t.name}</span><span className="ml-1 text-[10px] opacity-60">{t.key}</span></button>)}
            <span className="mx-1 h-6 w-px bg-sky-500/30" />
            {(['sneak', 'walk', 'run'] as Mode[]).map(m => <button key={m} className={`btn !px-2 !py-1 text-sm ${mode === m ? 'btn-on' : ''}`} onClick={() => { setMode(m); audio.sfx('click'); }} title={m === 'sneak' ? 'Slow, quiet, hard to spot' : m === 'run' ? 'Fast, loud, easy to spot' : 'Normal'}>{m === 'sneak' ? '🐾' : m === 'run' ? '🏃' : '🚶'}<span className="hidden lg:inline"> {m}</span></button>)}
            <span className="mx-1 h-6 w-px bg-sky-500/30" />
            <button className="btn !px-2 !py-1 text-sm" onClick={() => addInstant('wait')} title="Add a wait step (key 6)">⏳ Wait</button>
            <button className="btn !px-1 !py-1 text-sm" onClick={() => setWaitSecs(s => Math.max(1, s - 1))}>−</button><span className="text-sm text-sky-200">{waitSecs}s</span><button className="btn !px-1 !py-1 text-sm" onClick={() => setWaitSecs(s => Math.min(30, s + 1))}>+</button>
            <button className="btn !px-2 !py-1 text-sm" onClick={() => addInstant('sync')} title="Add a sync point (key 7)">🔗 Sync</button>
            <button className="btn !px-1 !py-1 text-sm" onClick={() => setSyncTag(t => (t % 4) + 1)}>#{syncTag}</button>
            <button className="btn !px-2 !py-1 text-sm" onClick={() => addInstant('exit')} title="Add an exit step (key 8)">🚐 Exit</button>
            {(loadout.drill || 0) > 0 && <button className={`btn !px-2 !py-1 text-sm ${drillOn ? 'btn-on' : ''}`} onClick={() => setDrillOn(d => !d)} title="Next crack steps use the Thermal Drill (loud, 3x faster)">🔥 Drill {drillOn ? 'ON' : 'off'} ({(loadout.drill || 0) - drillPlanned})</button>}
            {tool === 'gadget' && gadgetIds.filter(g => g !== 'drill').map(g => <button key={g} className={`btn !px-2 !py-1 text-sm ${gSel === g ? 'btn-on' : ''}`} onClick={() => { setGSel(g); audio.sfx('click'); }} title={GADGETS[g].desc}>{GADGETS[g].icon} ×{(loadout[g] || 0) - planned(g)}</button>)}
            {tool === 'gadget' && !gadgetIds.length && <span className="text-xs text-slate-400">No gadgets in loadout.</span>}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 border-b border-sky-500/30 bg-[#06101f] px-2 py-1.5 text-sm">
            <span className={`rounded px-2 py-0.5 font-display font-bold tracking-widest ${stateBadge[1]}`}>{stateBadge[0]}</span>
            {sim.alarm && <span className="font-display text-lg font-bold text-red-300">🚓 {Math.max(0, Math.ceil(sim.copT))}s</span>}
            <span className="text-slate-300">⏱ {fmtT(sim.time)}</span>
            {sim.jamT > 0 && <span className="text-amber-300">📡 jam {Math.ceil(sim.jamT)}s</span>}
            {sim.camOffT > 0 && <span className="text-sky-300">📹 off {Math.ceil(sim.camOffT)}s</span>}
            {sim.laserOffT > 0 && <span className="text-sky-300">🔦 off {Math.ceil(sim.laserOffT)}s</span>}
            <span className="ml-auto flex items-center gap-1">
              <button className="btn !px-2 !py-0.5" onClick={() => setPaused(p => !p)}>{paused ? '▶' : '⏸'}</button>
              {[1, 2, 4].map(s => <button key={s} className={`btn !px-2 !py-0.5 ${speed === s ? 'btn-on' : ''}`} onClick={() => { setSpeed(s); audio.sfx('click'); }}>{s}x</button>)}
            </span>
          </div>
        )}
        <div className="relative min-h-0 flex-1">
          <GameCanvas world={world} getCfg={getCfg} onFrame={onFrame} onTile={onTile} onHover={p => { hover.current = p; }} />
          {toast && <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded border border-amber-400/60 bg-black/80 px-3 py-1.5 text-sm text-amber-200 pop-in">{toast}</div>}
          {paused && phase === 'exec' && !menu && <div className="pointer-events-none absolute inset-x-0 top-12 text-center font-display text-3xl font-bold tracking-[0.4em] text-sky-200/80">PAUSED</div>}
          {tutorial && phase !== 'done' && (
            <div className="panel absolute left-2 top-2 max-w-[280px] p-2 text-xs">
              <div className="mb-1 font-display text-sm uppercase tracking-widest text-amber-300">🎓 Training</div>
              {phase === 'plan' ? <ul className="space-y-0.5">{tutTasks.map((t, i) => <li key={i} className={t.ok ? 'text-emerald-300' : 'text-slate-300'}>{t.ok ? '☑' : '☐'} {t.t}</li>)}</ul>
                : <div className="text-slate-300">Watch the red vision cone. Space pauses; 1x/2x/4x speeds the plan. If it goes wrong, Bail (B) or throw a gadget (G). Reach the van with the loot!</div>}
              {phase === 'plan' && <div className="mt-1 text-slate-400">Tip: a guard patrols the shop. Sneak (🐾) when in view, or time your moves with Wait steps.</div>}
            </div>
          )}
          {phase === 'done' && res && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 fade-in">
              <div className="panel pop-in max-w-sm p-5 text-center">
                <div className={`font-display text-4xl font-bold tracking-widest ${res.success ? 'text-emerald-300' : 'text-red-400'}`}>{res.success ? 'CLEAN GETAWAY' : res.escaped.length === 0 && res.arrested.length > 0 ? 'BUSTED' : 'HEIST FAILED'}</div>
                <div className="mt-1 text-sm text-slate-300">{res.reason} · {fmtT(res.time)}</div>
                <div className="mt-2 text-lg text-amber-200">Loot: {money(res.lootValue)}</div>
                <button className="btn btn-gold mt-4 !px-6 !py-2 text-lg" onClick={() => { audio.sfx('click'); onFinish(res); }}>Debrief →</button>
              </div>
            </div>
          )}
        </div>
      </section>

      {menu === 'pause' && (
        <Modal title={phase === 'plan' ? 'Planning Menu' : 'Paused'} onClose={() => setMenu(null)}>
          <div className="space-y-2">
            <div className="text-sm text-slate-400">{tpl.name} · {DIFFS[meta.diff].name}</div>
            <button className="btn btn-gold w-full" onClick={() => setMenu(null)}>Resume</button>
            <button className="btn w-full" onClick={() => setMenu('settings')}>Settings</button>
            <button className="btn w-full" onClick={() => setMenu('help')}>Field Manual / Controls</button>
            {phase === 'exec' && <button className="btn w-full" onClick={() => { sim.bailAll(); setMenu(null); }}>Bail everyone</button>}
            {phase === 'exec' && <button className="btn btn-red w-full" onClick={() => setMenu('forfeit')}>Abandon heist</button>}
            {phase === 'plan' && <button className="btn btn-red w-full" onClick={() => { setMenu(null); onAbort(); }}>Abort & return to hideout</button>}
          </div>
        </Modal>
      )}
      {menu === 'forfeit' && (
        <Modal title="Abandon heist?" onClose={() => setMenu('pause')}>
          <p className="mb-3 text-sm text-slate-300">Everyone still inside is arrested and any loot in their hands is lost.</p>
          <div className="flex gap-2"><button className="btn flex-1" onClick={() => setMenu('pause')}>Keep going</button><button className="btn btn-red flex-1" onClick={() => { sim.forfeit(); setMenu(null); }}>Abandon</button></div>
        </Modal>
      )}
      {menu === 'settings' && <SettingsModal settings={settings} onChange={onSettings} onClose={() => setMenu('pause')} />}
      {menu === 'help' && <HelpModal onClose={() => setMenu('pause')} />}
    </div>
  );
}

