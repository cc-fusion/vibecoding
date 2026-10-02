import { useEffect, useMemo, useRef, useState } from 'react';
import type { Campaign, Crew, GadgetId, HeistDef, Mode, P, Plan, Step, Thing } from '../game/types';
import { GADGET_IDS } from '../game/types';
import { GADGETS, ROLE_INFO } from '../game/data';
import { genWorld } from '../game/mapgen';
import { createSim, extraGuards, makeCfg, pickThing, stepLabel, thingDone, update } from '../game/sim';
import { render } from '../game/render';
import type { PathViz } from '../game/render';
import { buyIntel, freeCrew, loadoutSlots, reconCost, slots } from '../game/store';
import { audio } from '../game/audio';
import { Btn, GameCanvas, Meter, Panel, money } from './ui';

type Act = (fn: (c: Campaign) => string | null | void, ok?: string) => boolean;
type Tool = { k: 'path' | 'ambush' | 'distract' | 'gadget' | 'key'; g?: GadgetId };

const ICON: Record<string, string> = { door: '🔓', camera: '📷', terminal: '💻', safe: '🔐', loot: '💰' };
const LOCK_LABEL = { pick: '🗝️ Pick', hack: '⌁ Hack', breach: '✱ Breach' } as const;

function defaultCrew(free: Crew[], n: number): string[] {
  const pref = ['hacker', 'shadow', 'muscle', 'cracker', 'face'];
  return free.slice().sort((a, b) => pref.indexOf(a.role) - pref.indexOf(b.role)).slice(0, n).map(c => c.id);
}
function defaultLoadout(c: Campaign): Record<GadgetId, number> {
  const out: Record<GadgetId, number> = { smoke: 0, emp: 0, decoy: 0, dart: 0, key: 0 };
  let left = loadoutSlots(c);
  (['smoke', 'decoy', 'dart', 'emp', 'key'] as GadgetId[]).forEach(g => { const n = Math.min(left, c.gadgets[g]); out[g] = n; left -= n; });
  return out;
}

export function Planner({ camp, def, act, onBack, onExecute, toast, onHelp, onSettings }: { camp: Campaign; def: HeistDef; act: Act; onBack: () => void; onExecute: (ids: string[], plan: Plan, loadout: Record<GadgetId, number>) => void; toast: (m: string, k?: string) => void; onHelp: () => void; onSettings: () => void }) {
  const free = freeCrew(camp);
  const maxSlots = slots(camp);
  const [chosen, setChosen] = useState<string[]>(() => defaultCrew(free, maxSlots));
  const [plan, setPlan] = useState<Plan>({});
  const [active, setActive] = useState<string>(chosen[0] || '');
  const [mode, setMode] = useState<Mode>('walk');
  const [tool, setTool] = useState<Tool>({ k: 'path' });
  const [loadout, setLoadout] = useState<Record<GadgetId, number>>(() => defaultLoadout(camp));
  const hover = useRef<P | null>(null);
  const recon = camp.intel[def.id] || 0;
  const world = useMemo(() => genWorld(def, extraGuards(camp)), [def, camp.heat, camp.diff]); // eslint-disable-line react-hooks/exhaustive-deps
  const sim = useMemo(() => createSim(world, chosen.map(id => camp.crew.find(c => c.id === id)).filter(Boolean) as Crew[], {}, loadout, makeCfg(camp, def)), [world, chosen.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const activeCrew = camp.crew.find(c => c.id === active);
  const steps = plan[active] || [];
  const loadoutCount = GADGET_IDS.reduce((a, g) => a + loadout[g], 0);

  const known = (th: Thing) => (th.kind === 'door' ? th.locked : (recon >= 1 || (th.kind === 'safe' && th.vault)) && !thingDone(th));

  const addStep = (st: Step) => {
    if (!active) { toast('Select a crew member first', 'bad'); audio.play('error'); return; }
    setPlan(p => ({ ...p, [active]: [...(p[active] || []), st] }));
    audio.play('click');
  };
  const undo = () => setPlan(p => ({ ...p, [active]: (p[active] || []).slice(0, -1) }));

  const skillFor = (th: Thing): number => {
    if (!activeCrew) return 1;
    const s = activeCrew.skills;
    if (th.kind === 'door') return th.lock === 'pick' ? s.pick : th.lock === 'hack' ? s.hack : Math.max(s.force, s.crack);
    if (th.kind === 'camera' || th.kind === 'terminal') return s.hack;
    if (th.kind === 'safe') return s.crack;
    return 1;
  };

  const onPointer = (kind: 'move' | 'down' | 'leave', t: P) => {
    if (kind === 'leave') { hover.current = null; return; }
    hover.current = t;
    if (kind !== 'down') return;
    const tx = Math.floor(t.x), ty = Math.floor(t.y);
    const inb = tx >= 0 && ty >= 0 && tx < world.w && ty < world.h;
    const floor = inb && world.tiles[ty * world.w + tx] === 1;
    if (tool.k === 'key') {
      const th = pickThing(world, t.x, t.y, x => known(x) && x.kind !== 'loot');
      if (!th) { toast('Click a lock, terminal, camera or safe', 'bad'); return; }
      addStep({ k: 'use', oid: th.id, key: true }); setTool({ k: 'path' }); return;
    }
    if (tool.k === 'ambush' || tool.k === 'distract') {
      if (!floor) { toast('Pick a floor tile', 'bad'); return; }
      addStep({ k: tool.k, x: tx + 0.5, y: ty + 0.5 }); setTool({ k: 'path' }); return;
    }
    if (tool.k === 'gadget') {
      if (!inb) return;
      addStep({ k: 'gadget', g: tool.g!, x: t.x, y: t.y }); setTool({ k: 'path' }); return;
    }
    if (Math.hypot(t.x - world.van.x, t.y - world.van.y) < 1.1) { addStep({ k: 'extract' }); return; }
    const th = pickThing(world, t.x, t.y, known);
    if (th) {
      if (skillFor(th) < 1 && th.kind !== 'loot') toast(`${activeCrew?.name} lacks the skill: slow, loud, may trip an alarm`, 'info');
      addStep({ k: 'use', oid: th.id }); return;
    }
    if (!floor) { toast('Walls block movement', 'bad'); audio.play('error'); return; }
    addStep({ k: 'move', x: tx + 0.5, y: ty + 0.5, mode });
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'q' || e.key === 'Q') setMode(m => (m === 'sneak' ? 'walk' : m === 'walk' ? 'run' : 'sneak'));
      else if (e.key === 'z' || e.key === 'Z') undo();
      else if (e.key === 'Escape') setTool({ k: 'path' });
      else if (e.key >= '1' && e.key <= '5') { const id = chosen[parseInt(e.key) - 1]; if (id) setActive(id); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const onFrame = (dt: number, ctx: CanvasRenderingContext2D, v: import('../game/render').View) => {
    update(sim, dt);
    const paths: PathViz[] = chosen.map(id => {
      const cs = sim.crew.find(c => c.id === id);
      const ref = camp.crew.find(c => c.id === id);
      if (!cs || !ref) return { color: '#fff', pts: [], dim: true };
      let prev: P = { x: cs.x, y: cs.y };
      const pts = [{ x: prev.x, y: prev.y, sym: '' }];
      (plan[id] || []).forEach((st, i) => {
        let p = prev, sym = String(i + 1);
        switch (st.k) {
          case 'move': p = { x: st.x, y: st.y }; sym = st.mode === 'sneak' ? '·' : st.mode === 'run' ? '»' : String(i + 1); break;
          case 'use': { const th = sim.byId.get(st.oid); if (th) { p = { x: th.x + 0.5, y: th.y + 0.5 }; sym = st.key ? '🗝' : ICON[th.kind]; } break; }
          case 'ambush': p = { x: st.x, y: st.y }; sym = '🗡'; break;
          case 'distract': p = { x: st.x, y: st.y }; sym = '💬'; break;
          case 'gadget': p = { x: st.x, y: st.y }; sym = GADGETS[st.g].icon; break;
          case 'extract': p = sim.w.van; sym = '🚐'; break;
          case 'wait': p = { x: prev.x + 0.3, y: prev.y - 0.3 }; sym = '⏱'; break;
          case 'signal': p = { x: prev.x + 0.3, y: prev.y - 0.3 }; sym = 'S' + 'ABC'[st.n - 1]; break;
          case 'await': p = { x: prev.x + 0.3, y: prev.y - 0.3 }; sym = 'W' + 'ABC'[st.n - 1]; break;
          case 'jam': p = { x: prev.x + 0.3, y: prev.y - 0.3 }; sym = '📡'; break;
          case 'blast': p = { x: prev.x + 0.3, y: prev.y - 0.3 }; sym = '💥'; break;
        }
        pts.push({ x: p.x, y: p.y, sym });
        prev = p;
      });
      return { color: ref.color, pts, dim: id !== active };
    });
    render(ctx, sim, v, { mode: 'plan', recon, paths, hover: hover.current, selected: active, focus: false, shake: false });
  };

  // lock summary
  const locks = { pick: 0, hack: 0, breach: 0 };
  world.things.forEach(t => { if (t.kind === 'door' && t.locked) locks[t.lock as 'pick']++; });
  const crewObjs = chosen.map(id => camp.crew.find(c => c.id === id)).filter(Boolean) as Crew[];
  const covered = { pick: crewObjs.some(c => c.skills.pick >= 1), hack: crewObjs.some(c => c.skills.hack >= 1), breach: crewObjs.some(c => c.skills.force >= 1 || c.skills.crack >= 1) };
  const crack = crewObjs.some(c => c.skills.crack >= 1);

  const toggleCrew = (c: Crew) => {
    if (chosen.includes(c.id)) {
      const n = chosen.filter(x => x !== c.id);
      setChosen(n); setPlan(p => { const q = { ...p }; delete q[c.id]; return q; });
      if (active === c.id) setActive(n[0] || '');
    } else {
      if (chosen.length >= maxSlots) { toast(`Crew slots full (${maxSlots}). Upgrade the Planning Table.`, 'bad'); audio.play('error'); return; }
      setChosen([...chosen, c.id]); setActive(c.id);
    }
    audio.play('click');
  };
  const adjustGadget = (g: GadgetId, d: number) => {
    const n = loadout[g] + d;
    if (n < 0 || n > camp.gadgets[g]) return;
    if (d > 0 && loadoutCount >= loadoutSlots(camp)) { toast(`Loadout full (${loadoutSlots(camp)}). Upgrade the Workshop.`, 'bad'); return; }
    setLoadout({ ...loadout, [g]: n });
  };

  // tutorial coach
  const allSteps = Object.values(plan).flat();
  const coach = def.id === 'pawn' && !camp.jobs[def.id]?.done;
  const checks = [
    ['Pick your crew in the roster (right). Nyx hacks, Vesper picks locks, Brick hauls.', chosen.length >= 2],
    ['Select a crew member and click the blueprint floor to add waypoints.', allSteps.some(s => s.k === 'move')],
    ['Click a 🔒 door, or buy Casing intel to reveal the 👑 safe, and click it to queue actions.', allSteps.some(s => s.k === 'use')],
    ['End every plan by clicking the 🚐 van (Extract). Add more steps if you like.', allSteps.some(s => s.k === 'extract')],
    ['Press EXECUTE. During the heist select a crew card to slow time and improvise.', false],
  ] as [string, boolean][];
  const coachIdx = checks.findIndex(c => !c[1]);

  return (
    <div className="h-screen flex flex-col lg:flex-row bg-[#050d1c] text-slate-100 overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-950/90 border-b border-cyan-900/60 flex-wrap">
          <Btn onClick={onBack}>← Hub</Btn>
          <div className="font-black tracking-wide text-sm sm:text-base">{def.name}</div>
          <div className="text-xs text-cyan-300 hidden sm:block">BLUEPRINT · {world.w}×{world.h} · {world.rooms.length} rooms</div>
          <div className="ml-auto flex gap-2 items-center"><span className="text-emerald-300 text-sm font-bold">{money(camp.cash)}</span><Btn onClick={onHelp}>?</Btn><Btn onClick={onSettings}>⚙</Btn></div>
        </div>
        {coach && (
          <div className="px-3 py-2 bg-amber-950/70 border-b border-amber-700/60 text-sm text-amber-100">
            <b>Tutorial · Step {Math.min(coachIdx < 0 ? 5 : coachIdx + 1, 5)}/5:</b> {checks[coachIdx < 0 ? 4 : coachIdx][0]}
          </div>
        )}
        <div className="flex-1 min-h-0 relative">
          <GameCanvas w={world.w} h={world.h} onFrame={onFrame} onPointer={onPointer} />
          <div className="absolute bottom-2 left-2 text-[11px] bg-slate-950/80 rounded px-2 py-1 text-slate-300 flex flex-wrap gap-x-3 pointer-events-none">
            <span><i className="inline-block w-2 h-2 rounded-full bg-amber-400" /> pick</span><span><i className="inline-block w-2 h-2 rounded-full bg-emerald-400" /> hack</span><span><i className="inline-block w-2 h-2 rounded-full bg-red-400" /> breach</span>
            <span>◐ dark room</span><span>{tool.k === 'path' ? 'Click: waypoint / action' : `Armed: ${tool.k}${tool.g ? ' ' + tool.g : ''} (Esc cancels)`}</span>
          </div>
        </div>
      </div>
      <aside className="w-full lg:w-[370px] max-h-[55vh] lg:max-h-none lg:h-full overflow-y-auto bg-slate-950 border-t lg:border-t-0 lg:border-l border-cyan-900/60 p-2 space-y-2">
        <Panel title={`Crew ${chosen.length}/${maxSlots}`}>
          <div className="space-y-1">
            {camp.crew.map(c => {
              const inn = chosen.includes(c.id);
              return (
                <div key={c.id} className={`flex items-center gap-2 p-1.5 rounded border ${active === c.id && inn ? 'border-white bg-slate-800' : 'border-slate-700 bg-slate-900/60'} ${c.jailed > 0 ? 'opacity-50' : ''}`}>
                  <button disabled={!inn} onClick={() => setActive(c.id)} className="flex-1 flex items-center gap-2 text-left disabled:cursor-default">
                    <span className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: c.color + '33', border: `2px solid ${c.color}` }}>{c.icon}</span>
                    <span className="text-sm"><b>{c.name}</b> <span className="text-[10px] text-slate-400">{ROLE_INFO[c.role].label} L{c.level}</span></span>
                  </button>
                  {c.jailed > 0 ? <span className="text-xs text-red-300">🔒 {c.jailed}d</span> : <Btn variant={inn ? 'danger' : 'primary'} onClick={() => toggleCrew(c)}>{inn ? 'Out' : 'In'}</Btn>}
                </div>
              );
            })}
          </div>
          <div className="text-[11px] mt-2 text-slate-400">Locks: {(['pick', 'hack', 'breach'] as const).map(k => <span key={k} className={`mr-2 ${locks[k] && !covered[k] ? 'text-red-300 font-bold' : ''}`}>{LOCK_LABEL[k]} ×{locks[k]}{locks[k] && !covered[k] ? '⚠' : ''}</span>)}<span className={!crack ? 'text-red-300 font-bold' : ''}>🔐 Safe crack {crack ? 'ok' : '⚠ none'}</span></div>
        </Panel>

        <Panel title="Intel">
          <div className="flex gap-2 flex-wrap">
            <Btn variant={recon >= 1 ? 'ghost' : 'gold'} disabled={recon >= 1 || camp.cash < reconCost(camp, def, 1)} onClick={() => act(c => buyIntel(c, def, 1), 'Casing complete: hazards revealed.')}>{recon >= 1 ? '✓ Casing' : `Casing ${money(reconCost(camp, def, 1))}`}</Btn>
            <Btn variant={recon >= 2 ? 'ghost' : 'gold'} disabled={recon >= 2 || recon < 1 || camp.cash < reconCost(camp, def, 2)} onClick={() => act(c => buyIntel(c, def, 2), 'Inside man: guard routes revealed.')}>{recon >= 2 ? '✓ Inside man' : `Inside man ${money(reconCost(camp, def, 2))}`}</Btn>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Casing reveals cameras, lasers, terminals, safes and loot. Inside man reveals guard positions, cones and patrol routes.</div>
        </Panel>

        <Panel title={`Gadget loadout ${loadoutCount}/${loadoutSlots(camp)}`}>
          <div className="space-y-1">
            {GADGET_IDS.map(g => (
              <div key={g} className="flex items-center gap-2 text-sm"><span>{GADGETS[g].icon}</span><span className="flex-1" title={GADGETS[g].desc}>{GADGETS[g].name} <span className="text-[10px] text-slate-500">({camp.gadgets[g]} in stock)</span></span>
                <Btn onClick={() => adjustGadget(g, -1)} disabled={loadout[g] <= 0}>−</Btn><b className="w-4 text-center">{loadout[g]}</b><Btn onClick={() => adjustGadget(g, 1)} disabled={loadout[g] >= camp.gadgets[g]}>+</Btn></div>
            ))}
          </div>
        </Panel>

        <Panel title={activeCrew ? `Orders · ${activeCrew.name}` : 'Orders'} right={<span className="text-[10px] text-slate-500">Q mode · Z undo</span>}>
          {!activeCrew ? <div className="text-sm text-slate-400">Add crew to start planning.</div> : (
            <>
              <div className="flex gap-1 mb-2">{(['sneak', 'walk', 'run'] as Mode[]).map(m => <Btn key={m} className="flex-1" variant={mode === m ? 'primary' : 'ghost'} onClick={() => setMode(m)}>{m === 'sneak' ? '🐾 Sneak' : m === 'walk' ? '🚶 Walk' : '🏃 Run'}</Btn>)}</div>
              <div className="flex flex-wrap gap-1 mb-2">
                <Btn variant="gold" active={tool.k === 'ambush' || tool.k === 'distract'} title={ROLE_INFO[activeCrew.role].specialDesc} onClick={() => {
                  const r = activeCrew.role;
                  if (r === 'hacker') addStep({ k: 'jam' }); else if (r === 'cracker') addStep({ k: 'blast' });
                  else setTool({ k: r === 'face' ? 'distract' : 'ambush' });
                }}>★ {ROLE_INFO[activeCrew.role].special}</Btn>
                {GADGET_IDS.filter(g => loadout[g] > 0).map(g => <Btn key={g} active={tool.k === (g === 'key' ? 'key' : 'gadget') && tool.g === (g === 'key' ? undefined : g)} title={GADGETS[g].desc} onClick={() => setTool(g === 'key' ? { k: 'key' } : { k: 'gadget', g })}>{GADGETS[g].icon} ×{loadout[g]}</Btn>)}
              </div>
              <div className="text-[11px] text-slate-400 mb-2">{ROLE_INFO[activeCrew.role].specialDesc}</div>
              <div className="flex flex-wrap gap-1 mb-2">
                <Btn onClick={() => addStep({ k: 'wait', sec: 3 })}>⏱ Wait 3s</Btn><Btn onClick={() => addStep({ k: 'wait', sec: 8 })}>⏱ 8s</Btn>
                {[1, 2, 3].map(n => <Btn key={'s' + n} title="Send signal" onClick={() => addStep({ k: 'signal', n })}>📣{'ABC'[n - 1]}</Btn>)}
                {[1, 2, 3].map(n => <Btn key={'a' + n} title="Await signal" onClick={() => addStep({ k: 'await', n })}>⏳{'ABC'[n - 1]}</Btn>)}
                <Btn variant="primary" onClick={() => addStep({ k: 'extract' })}>🚐 Extract</Btn>
              </div>
              <div className="max-h-44 overflow-y-auto space-y-1">
                {steps.length === 0 && <div className="text-xs text-slate-500">No steps yet. Click the map.</div>}
                {steps.map((st, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-slate-900 rounded px-2 py-1 border border-slate-800"><span className="w-4 text-slate-500">{i + 1}</span><span className="flex-1 truncate">{stepLabel(st, sim)}</span>
                    <button className="text-red-400 hover:text-red-300" onClick={() => setPlan(p => ({ ...p, [active]: (p[active] || []).filter((_, j) => j !== i) }))}>✕</button></div>))}
              </div>
              <div className="flex gap-1 mt-2"><Btn onClick={undo} disabled={!steps.length}>↶ Undo</Btn><Btn variant="danger" onClick={() => setPlan(p => ({ ...p, [active]: [] }))} disabled={!steps.length}>Clear</Btn></div>
            </>
          )}
        </Panel>

        <Panel>
          <div className="text-xs text-slate-400 mb-1">Police ETA after full alarm ≈ <b className="text-slate-200">{Math.round(sim.cfg.eta)}s</b> · Improvise orders <b className="text-slate-200">{sim.cfg.improvMax}</b></div>
          <Meter value={camp.heat} color="#fb923c" h={4} />
          <Btn variant="gold" className="w-full mt-2 py-3 text-base" disabled={!chosen.length} onClick={() => {
            const idle = chosen.filter(id => !(plan[id] || []).length).length;
            if (idle) toast(`${idle} crew member${idle > 1 ? 's have' : ' has'} no plan and will head straight to the van.`, 'info');
            audio.play('go');
            onExecute(chosen, plan, loadout);
          }}>▶ EXECUTE HEIST</Btn>
        </Panel>
      </aside>
    </div>
  );
}
