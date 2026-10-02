import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DISTRICTS, FACTIONS, PACKAGES, SEGS, DIFFS, GADGETS, contractRisk, districtUnlocked, genContracts, modPayMul, repLabel, rng, deriveStats,
} from '../game/data';
import type { Contract, Save, SegType, Settings } from '../game/data';
import { buildSegment, fitFor, legMul, makeCtx } from '../game/level';
import type { SegStats } from '../game/level';
import type { RouteLeg } from '../game/engine';
import { audio } from '../game/audio';
import { Bar, Btn, Panel, Stars, Title } from './common';
import { DifficultyPicker } from './Settings';

// ===== animated title backdrop =====
function TitleBG() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!; const c = cv.getContext('2d')!;
    let raf = 0; let t = 0; let last = performance.now();
    const layers = [0, 1, 2].map((i) => { const r = rng(i + 5); const arr: { x: number; w: number; h: number; l: number }[] = []; let x = 0; while (x < 2400) { const w = 40 + r() * 90; arr.push({ x, w, h: 90 + r() * (150 + i * 90), l: r() }); x += w + 4; } return arr; });
    const rain = Array.from({ length: 120 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() }));
    const resize = () => { cv.width = cv.clientWidth; cv.height = cv.clientHeight; };
    resize(); window.addEventListener('resize', resize);
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      const W = cv.width, H = cv.height;
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b0220'); g.addColorStop(0.7, '#5a0f6e'); g.addColorStop(1, '#12041f');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      const sg = c.createRadialGradient(W * 0.7, H * 0.38, 10, W * 0.7, H * 0.38, H * 0.34); sg.addColorStop(0, 'rgba(255,47,214,0.9)'); sg.addColorStop(0.3, 'rgba(255,47,214,0.25)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = sg; c.fillRect(0, 0, W, H);
      const cols = ['#1a0a30', '#120622', '#0a0316']; const spd = [12, 30, 70];
      layers.forEach((L, i) => {
        const tw = 2400, off = -((t * spd[i]) % tw);
        for (let rep = 0; rep < 2; rep++) for (const b of L) {
          const x = off + rep * tw + b.x; if (x > W || x + b.w < 0) continue;
          const bh = b.h * (H / 700), by = H * (0.86 + i * 0.03) - bh;
          c.fillStyle = cols[i]; c.fillRect(x, by, b.w, H - by);
          c.fillStyle = i === 2 ? '#28e0ff' : '#ff9af0'; c.globalAlpha = 0.5;
          for (let wy = by + 8; wy < by + bh - 8; wy += 14) for (let wx = x + 5; wx < x + b.w - 8; wx += 11) if (((wx * 7 + wy * 13 + Math.floor(t * 0.5)) % 5) < 1.4 + b.l) c.fillRect(wx, wy, 4, 6);
          c.globalAlpha = 1;
        }
      });
      // runner
      const rx = W * 0.28, ry = H * 0.88 + 4, ph = t * 12;
      c.fillStyle = '#05020c'; c.fillRect(0, ry, W, H - ry);
      c.fillStyle = '#28e0ff'; c.fillRect(0, ry, W, 2);
      c.strokeStyle = '#ff2fd6'; c.lineWidth = 6; c.lineCap = 'round';
      const s = H / 700;
      c.beginPath(); c.moveTo(rx, ry - 30 * s); c.lineTo(rx + 5 * s, ry - 56 * s); c.stroke();
      c.strokeStyle = '#1b1b30'; c.beginPath(); c.moveTo(rx, ry - 30 * s); c.lineTo(rx + Math.sin(ph) * 18 * s, ry - Math.max(0, Math.cos(ph)) * 8 * s); c.moveTo(rx, ry - 30 * s); c.lineTo(rx - Math.sin(ph) * 18 * s, ry - Math.max(0, -Math.cos(ph)) * 8 * s); c.stroke();
      c.fillStyle = '#e9c9a8'; c.beginPath(); c.arc(rx + 8 * s, ry - 66 * s, 9 * s, 0, 6.3); c.fill();
      c.fillStyle = '#c58bff'; c.fillRect(rx - 24 * s, ry - 56 * s, 16 * s, 22 * s);
      c.strokeStyle = '#28e0ff'; c.lineWidth = 4; c.beginPath(); c.moveTo(rx + 2 * s, ry - 62 * s); for (let i = 1; i < 9; i++) c.lineTo(rx + 2 * s - i * 10 * s, ry - 62 * s + Math.sin(t * 12 + i) * 4 * s * (i / 8)); c.stroke();
      c.strokeStyle = 'rgba(190,210,255,0.35)'; c.lineWidth = 1;
      for (const d of rain) { d.y += dt * d.s * 1.6; d.x -= dt * 0.1; if (d.y > 1) { d.y = 0; d.x = Math.random() * 1.2; } c.beginPath(); c.moveTo(d.x * W, d.y * H); c.lineTo(d.x * W - 4, d.y * H + 16); c.stroke(); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
}

export function TitleScreen({ save, onContinue, onNew, onTutorial, onSettings, onHelp }: {
  save: Save | null; onContinue: () => void; onNew: () => void; onTutorial: () => void; onSettings: () => void; onHelp: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="relative h-full w-full overflow-hidden">
      <TitleBG />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-transparent" />
      <div className="relative h-full flex flex-col justify-center px-6 sm:px-16 max-w-3xl">
        <div className="text-xs sm:text-sm tracking-[0.5em] text-cyan-300 font-display mb-2 anim-flicker">SENTINEL GRID · 2087</div>
        <h1 className="font-display font-black text-5xl sm:text-7xl leading-none neon-text" style={{ color: '#ff2fd6' }}>NEON</h1>
        <h1 className="font-display font-black text-5xl sm:text-7xl leading-none neon-text mb-4" style={{ color: '#28e0ff' }}>COURIER</h1>
        <p className="text-indigo-100/80 max-w-md mb-6 text-base sm:text-lg">Build momentum. Plan the route. Hack the grid. Deliver the package — before the Sentinels catch you.</p>
        <div className="flex flex-col gap-2 w-64">
          {save && <Btn solid color="#28e0ff" onClick={onContinue}>▶ Continue · Day {save.day}</Btn>}
          {!save && <Btn solid color="#28e0ff" onClick={onNew}>▶ New Campaign</Btn>}
          {save && !confirm && <Btn color="#ff2fd6" onClick={() => setConfirm(true)}>New Campaign</Btn>}
          {save && confirm && (
            <div className="panel p-3 text-sm anim-in">Erase your progress and start over?
              <div className="flex gap-2 mt-2"><Btn color="#ff3355" onClick={onNew}>Erase</Btn><Btn onClick={() => setConfirm(false)}>Cancel</Btn></div></div>
          )}
          <Btn color="#7dff6b" onClick={onTutorial}>Training Yard {save?.tutorialDone ? '✓' : '(recommended)'}</Btn>
          <div className="flex gap-2"><Btn className="flex-1" color="#ffb02e" onClick={onHelp}>Help</Btn><Btn className="flex-1" color="#c9c4ff" onClick={onSettings}>Settings</Btn></div>
        </div>
        {save && <div className="mt-4 text-xs text-indigo-200/70">Cash ¤{save.cash} · Notoriety {Math.round(save.notoriety)}% · Deliveries {save.stats.delivered}</div>}
        <div className="mt-6 text-[11px] text-indigo-300/50">→/D run · Space jump · S slide · Shift dash · E hack · Q EMP · R smoke</div>
      </div>
    </div>
  );
}

export function payoutEstimate(c: Contract, s: Settings) { return Math.round(c.base * DIFFS[s.difficulty].pay * modPayMul(s.mods)); }

// ===== campaign map =====
export function MapScreen({ save, settings, onPlan, onShop, onFactions, onMenu, onSettings, onHelp }: {
  save: Save; settings: Settings; onPlan: (c: Contract) => void; onShop: () => void; onFactions: () => void; onMenu: () => void; onSettings: () => void; onHelp: () => void;
}) {
  const [sel, setSel] = useState(() => { for (let i = 4; i >= 0; i--) if (districtUnlocked(save, i)) return Math.min(i, save.deliveries[Math.max(0, i - 1)] >= 2 && save.deliveries[i] === 0 ? i : i); return 0; });
  const d = DISTRICTS[sel]; const unlocked = districtUnlocked(save, sel);
  const contracts = useMemo(() => genContracts(save, sel), [save, sel]);
  const noto = save.notoriety;
  return (
    <div className="h-full w-full overflow-y-auto scroll-thin bg-[radial-gradient(ellipse_at_top,#1a0b3a,#06050d_70%)]">
      <div className="max-w-6xl mx-auto p-3 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div>
            <Title size="text-xl sm:text-2xl">City Grid — Day {save.day}</Title>
            <div className="text-xs text-indigo-300/70">Pick a district, take a contract, outrun the Sentinels.</div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="font-display text-yellow-300 text-lg">¤ {save.cash.toLocaleString()}</div>
            <div className="w-44" title="Sentinel notoriety: ≥50 start with +1★, ≥70 faster pack, 100 = burned (game over)">
              <div className="flex justify-between text-[10px] font-display uppercase" style={{ color: noto >= 70 ? '#ff3355' : '#c9c4ff' }}><span>Notoriety</span><span>{Math.round(noto)}%</span></div>
              <Bar v={noto / 100} h={8} color={noto >= 70 ? '#ff3355' : noto >= 50 ? '#ffb02e' : '#7a6bff'} />
            </div>
            <div className="flex gap-2"><Btn color="#ffe04a" onClick={onShop}>Safehouse</Btn><Btn color="#7dff6b" onClick={onFactions}>Factions</Btn></div>
            <div className="flex gap-2"><Btn color="#ffb02e" onClick={onHelp}>?</Btn><Btn color="#c9c4ff" onClick={onSettings}>⚙</Btn><Btn color="#ff6b8b" onClick={onMenu}>Menu</Btn></div>
          </div>
        </div>
        {noto >= 70 && <div className="panel p-2 text-sm text-red-300 border-red-500/50 anim-flicker">⚠ The Sentinels are closing in on your safehouse. Lay low — pay off officers at the Safehouse, or run clean jobs.</div>}
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-3">
          <Panel className="p-2 relative min-h-[300px]">
            <svg viewBox="0 0 100 100" className="w-full h-full min-h-[300px]" preserveAspectRatio="xMidYMid meet" style={{ maxHeight: 440 }}>
              <defs><filter id="gl"><feGaussianBlur stdDeviation="1.1" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
              {Array.from({ length: 10 }, (_, i) => <line key={'h' + i} x1="0" x2="100" y1={i * 11} y2={i * 11} stroke="rgba(120,110,255,0.08)" strokeWidth="0.2" />)}
              {Array.from({ length: 10 }, (_, i) => <line key={'v' + i} y1="0" y2="100" x1={i * 11} x2={i * 11} stroke="rgba(120,110,255,0.08)" strokeWidth="0.2" />)}
              {DISTRICTS.slice(1).map((dd, i) => {
                const a = DISTRICTS[i];
                return <line key={dd.id} x1={a.mx} y1={a.my} x2={dd.mx} y2={dd.my} stroke={districtUnlocked(save, dd.id) ? '#8f86ff' : '#3a3560'} strokeWidth="0.8" strokeDasharray={districtUnlocked(save, dd.id) ? '0' : '2 2'} />;
              })}
              {DISTRICTS.map((dd) => {
                const col = dd.owner ? FACTIONS[dd.owner].color : '#e9f0ff'; const un = districtUnlocked(save, dd.id); const heat = save.heat[dd.id] / 100;
                return (
                  <g key={dd.id} onClick={() => { audio.sfx('ui'); setSel(dd.id); }} style={{ cursor: 'pointer' }} opacity={un ? 1 : 0.5}>
                    <circle cx={dd.mx} cy={dd.my} r={7 + heat * 4} fill="none" stroke="#ff3355" strokeWidth="0.8" opacity={heat * 0.9} />
                    <circle cx={dd.mx} cy={dd.my} r="5.6" fill="#0a0818" stroke={col} strokeWidth={sel === dd.id ? 1.8 : 0.9} filter="url(#gl)" />
                    <text x={dd.mx} y={dd.my + 1.6} textAnchor="middle" fontSize="5" fill={col}>{un ? (dd.owner ? FACTIONS[dd.owner].icon : '✦') : '🔒'}</text>
                    <text x={dd.mx} y={dd.my + 12} textAnchor="middle" fontSize="3.1" fill={sel === dd.id ? '#fff' : '#a9a3e8'} fontFamily="Orbitron">{dd.name}</text>
                    <text x={dd.mx} y={dd.my + 15.5} textAnchor="middle" fontSize="2.4" fill="#7f7aba">{save.deliveries[dd.id]} delivered</text>
                  </g>
                );
              })}
            </svg>
          </Panel>
          <Panel className="p-4 space-y-3">
            <div className="flex justify-between items-start gap-2">
              <div>
                <Title size="text-lg" color={d.pal.accent}>{d.name}</Title>
                <div className="text-xs text-indigo-200/70">{d.blurb}</div>
                <div className="text-xs mt-1">{d.owner ? <>Turf of <b style={{ color: FACTIONS[d.owner].color }}>{FACTIONS[d.owner].name}</b> · rep <b>{repLabel(save.rep[d.owner])}</b></> : <>Sentinel HQ territory</>}</div>
              </div>
              <div className="w-28 text-right"><div className="text-[10px] font-display uppercase text-indigo-300">District heat</div><Bar v={save.heat[sel] / 100} color="#ff3355" h={7} /></div>
            </div>
            {!unlocked && <div className="panel p-3 text-sm text-indigo-200">🔒 Deliver <b>2 packages</b> in <b>{DISTRICTS[sel - 1].name}</b> to unlock this district. ({save.deliveries[sel - 1]}/2)</div>}
            {unlocked && contracts.map((c) => {
              const f = FACTIONS[c.client]; const pk = PACKAGES[c.pkg]; const hostile = save.rep[c.client] <= -25;
              return (
                <div key={c.id} className="rounded-lg p-3 border anim-in" style={{ borderColor: c.boss ? '#ff2255' : f.color + '77', background: c.boss ? 'linear-gradient(90deg,rgba(255,34,85,0.15),transparent)' : 'rgba(0,0,0,0.35)' }}>
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-display font-bold text-sm truncate" style={{ color: c.boss ? '#ff5577' : '#fff' }}>{c.boss ? '☠ ' : ''}{c.title}</div>
                      <div className="text-xs" style={{ color: f.color }}>{f.icon} {f.name} {hostile && <span className="text-red-400">(hostile!)</span>}</div>
                    </div>
                    <div className="text-right"><div className="font-display text-yellow-300">~¤{payoutEstimate(c, settings)}</div><Stars n={contractRisk(c)} /></div>
                  </div>
                  <div className="text-xs text-indigo-100/80 mt-1">{pk.icon} <b style={{ color: pk.color }}>{pk.name}</b> — {pk.desc}</div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[11px] text-indigo-300/70">{c.legs} legs{c.boss ? ' · Warden boss run' : ''}{c.boss && save.bossBeaten ? ' · replay' : ''}</span>
                    <Btn color={c.boss ? '#ff2255' : f.color} onClick={() => onPlan(c)}>Plan route</Btn>
                  </div>
                </div>
              );
            })}
          </Panel>
        </div>
      </div>
    </div>
  );
}

// ===== route planner =====
export function legOptions(c: Contract, leg: number): { type: SegType; seed: number }[] {
  const pool = DISTRICTS[c.district].pool.slice();
  const r = rng(c.seed + leg * 977 + 3);
  const out: { type: SegType; seed: number }[] = [];
  for (let i = 0; i < 3 && pool.length; i++) { const k = Math.floor(r() * pool.length); out.push({ type: pool.splice(k, 1)[0], seed: Math.floor(r() * 1e9) }); }
  return out;
}
interface Opt { type: SegType; seed: number; st: SegStats; fit: { stars: number; why: string }; mul: number }

export function Planner({ contract: c, save, settings, onSettings, onGo, onBack }: {
  contract: Contract; save: Save; settings: Settings; onSettings: (s: Settings) => void; onGo: (route: RouteLeg[]) => void; onBack: () => void;
}) {
  const [choice, setChoice] = useState<number[]>(() => Array.from({ length: c.legs }, () => 0));
  const opts: Opt[][] = useMemo(() => Array.from({ length: c.legs }, (_, i) => legOptions(c, i).map((o) => {
    const seg = buildSegment(o.type, o.seed, 0, 520, 0, makeCtx(c, i, save, settings));
    return { ...o, st: seg.stats, fit: fitFor(c.pkg, seg.stats), mul: legMul(seg.stats) };
  })), [c, save, settings.difficulty, settings.mods.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const route: RouteLeg[] = choice.map((k, i) => ({ type: opts[i][k].type, seed: opts[i][k].seed, mul: opts[i][k].mul }));
  const avg = route.reduce((a, l) => a + l.mul, 0) / route.length;
  const est = Math.round(payoutEstimate(c, settings) * avg);
  const pk = PACKAGES[c.pkg], f = FACTIONS[c.client], d = DISTRICTS[c.district];
  const stats = deriveStats(save);
  const startHeat = Math.min(3, (settings.mods.includes('hot') ? 2 : 0) + (save.notoriety >= 50 ? 1 : 0) + Math.floor(save.heat[c.district] / 40));
  const totalFit = route.reduce((a, _, i) => a + opts[i][choice[i]].fit.stars, 0) / route.length;
  return (
    <div className="h-full w-full overflow-y-auto scroll-thin bg-[radial-gradient(ellipse_at_top,#12203a,#06050d_70%)]">
      <div className="max-w-5xl mx-auto p-3 sm:p-5 space-y-3">
        <div className="flex flex-wrap justify-between gap-2 items-center">
          <div><Title color={d.pal.accent} size="text-xl">Route Planning — {c.title}</Title>
            <div className="text-xs text-indigo-300/70">{d.name} · client <b style={{ color: f.color }}>{f.name}</b></div></div>
          <Btn color="#c9c4ff" onClick={onBack}>← Back</Btn>
        </div>
        <Panel className="p-3 grid sm:grid-cols-3 gap-3 text-sm">
          <div><div className="text-[10px] font-display uppercase text-indigo-300">Cargo</div>
            <div className="text-base">{pk.icon} <b style={{ color: pk.color }}>{pk.name}</b></div><div className="text-xs text-indigo-100/70">{pk.desc}</div><div className="text-xs text-cyan-300 mt-1">Tip: {pk.tip}</div></div>
          <div><div className="text-[10px] font-display uppercase text-indigo-300">Loadout</div>
            <div className="text-xs space-y-0.5">
              {GADGETS.map((g) => <div key={g.id}>{g.icon} {g.name}: <b>{Math.min(save.gadgets[g.id], stats.cap)}</b></div>)}
              <div>Start heat: <b className={startHeat ? 'text-red-400' : 'text-green-300'}>{startHeat}★</b>{startHeat ? ' (district/notoriety)' : ''}</div>
              <div>Gear: air-hop {stats.airHop ? '✓' : '✗'} · wall-run {stats.wallTime.toFixed(2)}s · dash cd {stats.dashCd.toFixed(1)}s</div>
            </div></div>
          <div><div className="text-[10px] font-display uppercase text-indigo-300">Forecast</div>
            <div className="font-display text-yellow-300 text-xl">~¤{est}</div>
            <div className="text-xs">Cargo fit <Stars n={Math.round(totalFit)} max={3} color="#42ffa8" /> · route ×{avg.toFixed(2)}</div>
            <div className="text-[11px] text-indigo-300/70 mt-1">Fee scales with final integrity, route risk, difficulty and modifiers.</div></div>
        </Panel>
        <Panel className="p-3"><DifficultyPicker settings={settings} onChange={onSettings} /></Panel>
        {opts.map((row, li) => (
          <div key={li}>
            <div className="font-display text-xs uppercase tracking-widest text-indigo-300 mb-1">Leg {li + 1} of {c.legs}{li === c.legs - 1 ? ' — drop point' : ''}</div>
            <div className="grid md:grid-cols-3 gap-2">
              {row.map((o, k) => {
                const on = choice[li] === k, info = SEGS[o.type], st = o.st;
                return (
                  <button key={k} onClick={() => { audio.sfx('ui'); setChoice((cs) => cs.map((v, i) => (i === li ? k : v))); }}
                    className="text-left rounded-lg p-3 border transition" style={{ borderColor: on ? d.pal.accent : 'rgba(255,255,255,0.12)', background: on ? d.pal.accent + '1c' : 'rgba(0,0,0,0.35)', boxShadow: on ? `0 0 18px ${d.pal.accent}55` : 'none' }}>
                    <div className="flex justify-between"><span className="font-display font-bold text-sm">{info.icon} {info.name}</span><span className="text-xs text-yellow-300">×{o.mul.toFixed(2)}</span></div>
                    <div className="text-[11px] text-indigo-100/70">{info.desc}</div>
                    <div className="flex justify-between text-xs mt-1"><span>Threat <Stars n={st.threat} /></span><span title={o.fit.why}>Fit <Stars n={o.fit.stars} max={3} color="#42ffa8" /></span></div>
                    <div className="text-[10px] text-indigo-200/80 mt-1 leading-snug">
                      gaps {st.gaps} · drops {st.drops} · walls {st.walls + st.pipes} · lasers {st.lasers} · turrets {st.turrets} · guards {st.cops + st.peds} · drones {st.drones} · terminals {st.terms} · chips {st.chips}{st.zips ? ` · ziplines ${st.zips}` : ''}
                    </div>
                    <div className="text-[10px] mt-1" style={{ color: o.fit.stars === 3 ? '#42ffa8' : o.fit.stars === 1 ? '#ff7788' : '#ffcf88' }}>{o.fit.why}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex justify-end gap-2 pb-6 sticky bottom-0 py-3 bg-gradient-to-t from-[#06050d] to-transparent">
          <Btn color="#c9c4ff" onClick={onBack}>Cancel</Btn>
          <Btn solid color={c.boss ? '#ff2255' : '#42ffa8'} onClick={() => onGo(route)}>Start run ▶</Btn>
        </div>
      </div>
    </div>
  );
}
