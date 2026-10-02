import { useEffect, useReducer, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { LEVELS, DIFFS, MODS, TECHS, getSave, persist, levelUnlocked, fmtTime } from '../game/data';
import type { LevelDef } from '../game/data';
import type { GameResult } from '../game/engine';
import { audio } from '../game/audio';
import { Btn, Panel, SettingsPanel, HelpPanel } from './common';

const FONT = { fontFamily: "'Fredoka', system-ui, sans-serif" };

export function Shell({ children, title, onBack }: { children: ReactNode; title: string; onBack: () => void }) {
  return (
    <div className="relative min-h-screen overflow-y-auto bg-[radial-gradient(ellipse_at_top,#3a2412,#150c06_70%)] p-4 text-amber-50 sm:p-8" style={FONT}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-center gap-3">
          <Btn kind="ghost" onClick={onBack}>← Back</Btn>
          <h1 className="text-3xl font-bold text-amber-300 sm:text-4xl">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ title */
function TitleBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let W = 0, H = 0;
    const resize = () => { W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const paths = Array.from({ length: 5 }, (_, i) => ({ y: 0.15 + i * 0.18, amp: 40 + i * 14, ph: i * 1.7, fr: 0.004 + i * 0.0013 }));
    const ants = Array.from({ length: 70 }, (_, i) => ({ p: i % 5, t: Math.random(), s: 0.03 + Math.random() * 0.04, dir: i % 3 === 0 ? -1 : 1 }));
    const pos = (pi: number, t: number) => {
      const p = paths[pi];
      const x = t * (W + 100) - 50;
      return { x, y: H * p.y + Math.sin(x * p.fr + p.ph) * p.amp + Math.sin(x * p.fr * 2.3) * 12 };
    };
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.fillStyle = '#150c06';
      ctx.fillRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W / 2, H * 0.4, 50, W / 2, H / 2, Math.max(W, H) * 0.8);
      g.addColorStop(0, '#3b2411'); g.addColorStop(1, '#0d0703');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < paths.length; i++) {
        ctx.strokeStyle = i % 2 ? 'rgba(90,255,160,0.18)' : 'rgba(255,200,90,0.14)';
        ctx.lineWidth = 7;
        ctx.beginPath();
        for (let x = -20; x <= W + 20; x += 14) { const q = pos(i, (x + 50) / (W + 100)); if (x === -20) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); }
        ctx.stroke();
      }
      for (const a of ants) {
        a.t += a.s * dt * a.dir * 0.6;
        if (a.t > 1.05) a.t = -0.05;
        if (a.t < -0.05) a.t = 1.05;
        const q = pos(a.p, a.t);
        const q2 = pos(a.p, a.t + 0.002 * a.dir);
        const ang = Math.atan2(q2.y - q.y, q2.x - q.x);
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(ang);
        ctx.fillStyle = a.p % 2 ? '#e3a13a' : '#c8402a';
        ctx.beginPath(); ctx.ellipse(-4, 0, 4, 2.6, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, 0, 2.2, 1.8, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(3.6, 0, 2.2, 2, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.7;
        const w = Math.sin(now / 60 + a.t * 90);
        ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(w, 5); ctx.moveTo(-1, 0); ctx.lineTo(-w, -5); ctx.moveTo(1, 0); ctx.lineTo(1 - w, 5); ctx.moveTo(1, 0); ctx.lineTo(1 + w, -5); ctx.stroke();
        ctx.restore();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

export function TitleScreen({ onNav }: { onNav: (s: 'campaign' | 'tech' | 'settings' | 'help') => void }) {
  const sv = getSave();
  const done = Object.keys(sv.levels).length;
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden text-amber-50" style={FONT}>
      <TitleBackdrop />
      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-3 p-6">
        <div className="text-6xl drop-shadow-[0_4px_0_rgba(0,0,0,0.5)]">🐜👑</div>
        <h1 className="bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-center text-6xl font-bold tracking-wider text-transparent drop-shadow-lg sm:text-7xl">FORMICA</h1>
        <p className="-mt-2 mb-3 text-center text-lg tracking-[0.35em] text-amber-200/80">SWARM COLONY</p>
        <Panel className="flex w-full flex-col gap-2.5 p-4">
          <Btn className="w-full text-lg" onClick={() => onNav('campaign')}>▶ {done ? 'Continue Campaign' : 'Begin Campaign'}</Btn>
          <Btn kind="good" className="w-full" onClick={() => onNav('tech')}>🧬 Evolution <span className="ml-1 rounded-full bg-black/25 px-2 py-0.5 text-sm">✨ {sv.jelly}</span></Btn>
          <div className="grid grid-cols-2 gap-2.5">
            <Btn kind="ghost" onClick={() => onNav('help')}>❓ How to play</Btn>
            <Btn kind="ghost" onClick={() => onNav('settings')}>⚙ Settings</Btn>
          </div>
        </Panel>
        <p className="text-center text-xs text-amber-100/50">
          Paint pheromone trails · dig tunnels · raise castes · survive the weather · topple rival queens
        </p>
        <p className="text-center text-xs text-amber-100/40">Colonies founded: {sv.lifetime.games} · Victories: {sv.lifetime.wins} · Enemies slain: {sv.lifetime.kills}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ campaign */
function objText(l: LevelDef): string {
  const o = l.objective;
  switch (o.type) {
    case 'grow': return `Reach ${o.pop} ants and stockpile ${o.food} food.`;
    case 'conquer': return `Destroy ${l.rivals.length} rival queen${l.rivals.length > 1 ? 's' : ''}.`;
    case 'survive': return `Survive ${Math.round((o.time || 0) / 60)} minutes of storms.`;
    case 'boss': return 'Slay the Anteater.';
    default: return 'Survive as long as possible. Boss at 10:00.';
  }
}

export function CampaignScreen({ onBack, onStart }: { onBack: () => void; onStart: (levelId: number, diffId: string, mods: string[], tutorial: boolean) => void }) {
  const sv = getSave();
  const firstOpen = LEVELS.find((l) => levelUnlocked(l.id) && !sv.levels[l.id]) || LEVELS[0];
  const [sel, setSel] = useState<number>(firstOpen.id);
  const [diff, setDiff] = useState(sv.lastDiff || 'normal');
  const [mods, setMods] = useState<string[]>(sv.lastMods || []);
  const [tut, setTut] = useState(!sv.tutorialDone);
  const L = LEVELS.find((l) => l.id === sel) || LEVELS[0];
  const unlocked = levelUnlocked(L.id);
  const rec = sv.levels[L.id];
  const D = DIFFS.find((d) => d.id === diff) || DIFFS[1];
  const modMul = 1 + mods.reduce((a, m) => a + (MODS.find((x) => x.id === m)?.jelly || 0), 0);
  const est = Math.round(L.jelly * D.jelly * modMul);
  const toggle = (id: string) => setMods((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  const start = () => { sv.lastDiff = diff; sv.lastMods = mods; persist(); onStart(L.id, diff, mods, tut); };

  return (
    <Shell title="Campaign" onBack={onBack}>
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Panel className="relative aspect-[16/10] overflow-hidden p-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,#3f5a24,transparent_50%),radial-gradient(circle_at_75%_30%,#5b3d1c,transparent_55%),linear-gradient(135deg,#243517,#38250f)]" />
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline
              points={LEVELS.map((l) => `${l.mapPos.x},${l.mapPos.y}`).join(' ')}
              fill="none" stroke="rgba(255,226,140,0.5)" strokeWidth="0.7" strokeDasharray="1.6 1.4" vectorEffect="non-scaling-stroke"
            />
          </svg>
          {LEVELS.map((l) => {
            const un = levelUnlocked(l.id);
            const r = sv.levels[l.id];
            const active = sel === l.id;
            return (
              <button
                key={l.id}
                onClick={() => { audio.ensure(); audio.play('click'); setSel(l.id); }}
                className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-transform hover:scale-110 ${active ? 'z-10 scale-110' : ''}`}
                style={{ left: `${l.mapPos.x}%`, top: `${l.mapPos.y}%` }}
                title={l.name}
              >
                <span className={`flex h-12 w-12 items-center justify-center rounded-full border-4 text-2xl shadow-xl sm:h-14 sm:w-14 ${active ? 'border-amber-300 bg-amber-500' : un ? (r ? 'border-lime-400 bg-green-800' : 'animate-pulse border-amber-200 bg-amber-800') : 'border-stone-600 bg-stone-800 grayscale'}`}>
                  {un ? l.icon : '🔒'}
                </span>
                <span className="mt-0.5 rounded bg-black/65 px-1.5 text-[10px] font-bold sm:text-xs">{r ? '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars) : l.id === 7 ? '∞' : `#${l.id}`}</span>
              </button>
            );
          })}
        </Panel>

        <Panel className="space-y-4 p-5">
          <div>
            <div className="flex items-start justify-between">
              <h2 className="text-2xl font-bold text-amber-300">{L.icon} {L.name}</h2>
              {rec && <span className="text-lg text-amber-300">{'★'.repeat(rec.stars)}{'☆'.repeat(3 - rec.stars)}</span>}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-amber-50/80">{L.blurb}</p>
            <div className="mt-2 rounded-lg bg-black/30 p-2 text-sm"><b className="text-amber-300">Objective:</b> {objText(L)}</div>
            <div className="mt-1 text-xs opacity-60">
              {L.rivals.length > 0 && `Rivals: ${L.rivals.map((r) => r.name).join(', ')} · `}Par time {fmtTime(L.parTime)}{rec ? ` · Best ${fmtTime(rec.best)}` : ''}
              {L.id === 7 && sv.endlessBest > 0 ? ` · Longest siege ${fmtTime(sv.endlessBest)}` : ''}
            </div>
          </div>
          {!unlocked ? (
            <div className="rounded-xl border border-stone-600 bg-stone-900/60 p-4 text-center text-sm">🔒 {L.id === 7 ? 'Complete Stormbreak Ridge to unlock.' : `Complete “${LEVELS[L.id - 2].name}” to unlock.`}</div>
          ) : (
            <>
              <div>
                <div className="mb-1 text-xs font-bold uppercase tracking-wider opacity-60">Difficulty</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {DIFFS.map((d) => <Btn key={d.id} kind={diff === d.id ? 'primary' : 'ghost'} className="!px-1 !py-2 text-xs sm:text-sm" title={d.desc} onClick={() => setDiff(d.id)}>{d.name}</Btn>)}
                </div>
                <p className="mt-1 text-xs opacity-60">{D.desc}</p>
              </div>
              <div>
                <div className="mb-1 text-xs font-bold uppercase tracking-wider opacity-60">Modifiers <span className="normal-case">(+jelly)</span></div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {MODS.map((m) => (
                    <button key={m.id} onClick={() => { audio.play('click'); toggle(m.id); }} title={m.desc} className={`rounded-lg border px-2 py-1.5 text-left text-xs transition-all ${mods.includes(m.id) ? 'border-amber-300 bg-amber-400/20' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                      <div className="font-bold">{m.icon} {m.name} <span className="text-lime-300">+{Math.round(m.jelly * 100)}%</span></div>
                      <div className="opacity-60">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              {L.id === 1 && (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={tut} onChange={(e) => setTut(e.target.checked)} className="h-4 w-4 accent-amber-400" />
                  Interactive tutorial
                </label>
              )}
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm">Reward: <b className="text-amber-300">~✨ {est}</b><span className="text-xs opacity-60"> (×{(D.jelly * modMul).toFixed(2)})</span></div>
                <Btn onClick={start} className="px-6 text-lg">Deploy ▶</Btn>
              </div>
            </>
          )}
        </Panel>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------ tech tree */
export function TechScreen({ onBack }: { onBack: () => void }) {
  const sv = getSave();
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [flash, setFlash] = useState('');
  const buy = (id: string) => {
    const t = TECHS.find((x) => x.id === id);
    if (!t) return;
    const lv = sv.tech[id] || 0;
    if (lv >= t.max) return;
    const cost = t.costs[lv];
    if (sv.jelly < cost) { audio.play('error'); setFlash(`Need ${cost - sv.jelly} more jelly`); return; }
    sv.jelly -= cost;
    sv.tech[id] = lv + 1;
    persist();
    audio.play('upgrade');
    setFlash(`${t.name} evolved to level ${lv + 1}!`);
    force();
  };
  const branches = ['Combat', 'Colony', 'Pheromone', 'Unlocks'] as const;
  return (
    <Shell title="Evolution" onBack={onBack}>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="rounded-xl border border-amber-300/40 bg-black/40 px-4 py-2 text-xl font-bold text-amber-300">✨ {sv.jelly} Royal Jelly</div>
        <div className="text-sm text-amber-100/70">{flash || 'Spend jelly earned in expeditions on permanent evolutions. Effects apply to every future run.'}</div>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {branches.map((b) => (
          <Panel key={b} className="p-4">
            <h3 className="mb-3 text-lg font-bold uppercase tracking-widest text-amber-300">{b}</h3>
            <div className="space-y-2.5">
              {TECHS.filter((t) => t.branch === b).map((t) => {
                const lv = sv.tech[t.id] || 0;
                const maxed = lv >= t.max;
                const cost = maxed ? 0 : t.costs[lv];
                const can = !maxed && sv.jelly >= cost;
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black/40 text-2xl">{t.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 font-bold">{t.name}
                        <span className="flex gap-0.5">{Array.from({ length: t.max }, (_, i) => <span key={i} className={`h-2 w-4 rounded-sm ${i < lv ? 'bg-lime-400' : 'bg-white/15'}`} />)}</span>
                      </div>
                      <div className="text-xs text-amber-50/70">{t.desc}</div>
                    </div>
                    <Btn kind={maxed ? 'ghost' : can ? 'good' : 'ghost'} disabled={maxed} className="!px-3 !py-1.5 text-sm" onClick={() => buy(t.id)}>{maxed ? 'MAX' : `✨ ${cost}`}</Btn>
                  </div>
                );
              })}
            </div>
          </Panel>
        ))}
      </div>
    </Shell>
  );
}

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  return (
    <Shell title="Settings" onBack={onBack}>
      <Panel className="mx-auto max-w-lg p-6"><SettingsPanel allowReset onReset={force} /></Panel>
    </Shell>
  );
}

export function HelpScreen({ onBack }: { onBack: () => void }) {
  return (
    <Shell title="How to play" onBack={onBack}>
      <Panel className="mx-auto max-w-3xl p-6"><HelpPanel /></Panel>
    </Shell>
  );
}

/* ------------------------------------------------------------ results */
export function ResultOverlay({ r, nextId, newJelly, onRetry, onNext, onTech, onCampaign, onTitle }: {
  r: GameResult; nextId: number | null; newJelly: number;
  onRetry: () => void; onNext: () => void; onTech: () => void; onCampaign: () => void; onTitle: () => void;
}) {
  const L = LEVELS.find((l) => l.id === r.levelId);
  const st = r.stats;
  const rows: [string, string][] = [
    ['Time', fmtTime(r.time)],
    ['Ants born', String(st.born)],
    ['Ants lost', String(st.lost)],
    ['Peak population', String(st.peakPop)],
    ['Enemies slain', String(st.kills)],
    ['Rival queens toppled', String(st.rivalsKilled)],
    ['Food gathered', String(Math.round(st.gathered))],
    ['Tunnels dug', String(st.dug)],
    ['Chambers built', String(st.chambers)],
    ['Lightning strikes', String(st.lightning)],
  ];
  const title = r.won ? 'VICTORY' : r.endless ? 'THE SIEGE ENDS' : 'DEFEAT';
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" style={FONT}>
      <Panel className="my-auto w-full max-w-xl animate-[popIn_.4s_cubic-bezier(.2,1.4,.4,1)] p-6 text-amber-50">
        <div className={`text-center text-5xl font-bold tracking-widest ${r.won ? 'text-lime-300' : 'text-red-400'}`}>{r.won ? '👑 ' : '💀 '}{title}</div>
        <p className="mt-2 text-center text-amber-100/80">{r.reason}</p>
        {L && <p className="text-center text-xs opacity-50">{L.name} · {DIFFS.find((d) => d.id === r.diffId)?.name}{r.mods.length ? ` · ${r.mods.length} modifier${r.mods.length > 1 ? 's' : ''}` : ''}</p>}
        {r.won && (
          <div className="my-3 flex justify-center gap-2 text-5xl">
            {[1, 2, 3].map((i) => <span key={i} className={`${i <= r.stars ? 'text-amber-300 drop-shadow-[0_0_10px_rgba(255,200,0,0.8)]' : 'text-white/15'}`} style={{ animation: i <= r.stars ? `popIn .5s ${i * 0.2}s both cubic-bezier(.2,1.6,.4,1)` : undefined }}>★</span>)}
          </div>
        )}
        {r.won && <p className="text-center text-xs opacity-60">★ victory · ★★ finish under par ({L ? fmtTime(L.parTime) : ''}) · ★★★ lose ≤ {L?.maxLost} ants</p>}
        <div className="my-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-white/10 py-1"><span className="opacity-70">{k}</span><b className="tabular-nums">{v}</b></div>
          ))}
        </div>
        <div className="mb-4 rounded-xl border border-amber-300/40 bg-amber-400/10 p-3 text-center text-lg font-bold text-amber-300">✨ +{newJelly} Royal Jelly{r.won && r.stars < 3 ? ' — improve your stars for more!' : ''}</div>
        <div className="grid grid-cols-2 gap-2">
          {r.won && nextId ? <Btn className="col-span-2" onClick={onNext}>Next expedition ▶</Btn> : null}
          <Btn kind={r.won ? 'ghost' : 'primary'} onClick={onRetry}>↻ {r.won ? 'Replay' : 'Retry'}</Btn>
          <Btn kind="good" onClick={onTech}>🧬 Evolution</Btn>
          <Btn kind="ghost" onClick={onCampaign}>🗺 Campaign</Btn>
          <Btn kind="ghost" onClick={onTitle}>Title</Btn>
        </div>
      </Panel>
    </div>
  );
}
