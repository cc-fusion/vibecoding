import { useState } from 'react';
import { CLASSES, DIFFICULTIES, MODIFIERS, RANKS, TECH, TIPS } from '../game/data';
import { campaignScore, rewardMult, saveMeta, techLevel, type Campaign, type Meta } from '../game/campaign';
import { audio } from '../game/audio';
import { Btn, Chip, HexBackdrop, Panel } from './ui';
import { cn } from '../utils/cn';

export function TitleScreen({
  meta,
  hasSave,
  onContinue,
  onNew,
  onTutorial,
  onCollege,
  onHelp,
  onSettings,
}: {
  meta: Meta;
  hasSave: boolean;
  onContinue: () => void;
  onNew: () => void;
  onTutorial: () => void;
  onCollege: () => void;
  onHelp: () => void;
  onSettings: () => void;
}) {
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-y-auto">
      <HexBackdrop />
      <div className="relative z-10 flex w-full max-w-md flex-col items-center px-4 py-6 text-center">
        <div className="anim-float text-6xl drop-shadow-[0_0_20px_rgba(255,150,60,0.6)]">⬢</div>
        <h1 className="font-display title-shimmer text-5xl font-black leading-none tracking-wide sm:text-6xl">HEXFALL</h1>
        <h2 className="font-display mt-1 text-2xl font-extrabold tracking-[0.35em] text-[#e9d9ff] sm:text-3xl">COMMANDERS</h2>
        <p className="mt-3 text-sm text-[#b9afd8]">Lead a veteran company across ground that collapses, floods and burns.</p>
        <div className="mt-6 grid w-full gap-2.5 anim-pop">
          {hasSave && (
            <Btn variant="gold" className="py-3 text-base" onClick={onContinue}>
              ▶ Continue Campaign
            </Btn>
          )}
          <Btn variant={hasSave ? 'default' : 'gold'} className="py-3 text-base" onClick={onNew}>
            ⚔ New Campaign
          </Btn>
          <Btn onClick={onTutorial} className={cn(!meta.tutorialDone && 'anim-glow')}>
            🎓 Interactive Tutorial {meta.tutorialDone ? '' : '(recommended)'}
          </Btn>
          <div className="grid grid-cols-3 gap-2">
            <Btn onClick={onCollege}>🌿 War College</Btn>
            <Btn onClick={onHelp}>📖 Help</Btn>
            <Btn onClick={onSettings}>⚙ Settings</Btn>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs">
          <Chip color="#1f5a40">🌿 {meta.laurels} Laurels</Chip>
          <Chip color="#3a2f66">🏆 Best score {meta.best.score}</Chip>
          <Chip color="#6a5a1a">Campaigns won {meta.best.wins}</Chip>
        </div>
        <p className="mt-4 max-w-sm text-xs italic text-[#9a90b8]">💡 {tip}</p>
      </div>
    </div>
  );
}

export function SetupScreen({ meta, onStart, onBack }: { meta: Meta; onStart: (diff: string, mods: string[], classes: string[]) => void; onBack: () => void }) {
  const [diff, setDiff] = useState('captain');
  const [mods, setMods] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({ vanguard: 1, fusilier: 1, ranger: 1, sapper: 1 });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const d = DIFFICULTIES.find((x) => x.id === diff)!;
  const mult = d.laurel + mods.reduce((a, m) => a + (MODIFIERS.find((x) => x.id === m)?.bonus || 0), 0);
  const adj = (k: string, delta: number) => {
    const cur = counts[k] || 0;
    const nv = cur + delta;
    if (nv < 0 || nv > 2) return;
    if (delta > 0 && total >= 4) return;
    audio.sfx('click');
    setCounts({ ...counts, [k]: nv });
  };
  return (
    <div className="relative h-full w-full overflow-y-auto scroll-thin">
      <HexBackdrop intensity={0.5} />
      <div className="relative z-10 mx-auto max-w-5xl p-4">
        <div className="mb-3 flex items-center gap-3">
          <Btn small onClick={onBack}>
            ← Back
          </Btn>
          <h2 className="font-display text-3xl font-black text-[#f5d78a]">Raise Your Banner</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel className="p-4">
            <h3 className="font-display mb-2 text-xl font-extrabold">Difficulty</h3>
            <div className="grid gap-2">
              {DIFFICULTIES.map((x) => (
                <button
                  key={x.id}
                  onClick={() => {
                    audio.sfx('select');
                    setDiff(x.id);
                  }}
                  className={cn('rounded-xl border-2 p-3 text-left transition', diff === x.id ? 'border-[#f5d78a] bg-[#2d2348]' : 'border-[#3d3460] bg-[#1b1630] hover:bg-[#241d3d]')}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-lg font-extrabold">{x.name}</span>
                    <span className="text-xs text-[#9a90b8]">Start 👑 {x.start}</span>
                  </div>
                  <div className="text-xs text-[#cfc6ea]">{x.desc}</div>
                  {x.id === 'warlord' && <div className="mt-1 text-[11px] font-bold text-[#ff9aa6]">Ironman: defeat ends the campaign.</div>}
                </button>
              ))}
            </div>
            <h3 className="font-display mb-2 mt-4 text-xl font-extrabold">Modifiers</h3>
            <div className="grid gap-2">
              {MODIFIERS.map((m) => {
                const on = mods.includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      audio.sfx('click');
                      setMods(on ? mods.filter((x) => x !== m.id) : [...mods, m.id]);
                    }}
                    className={cn('flex items-center justify-between rounded-lg border p-2 text-left text-sm', on ? 'border-[#ff9a5a] bg-[#3a2230]' : 'border-[#3d3460] bg-[#1b1630]')}
                  >
                    <span>
                      <b>{m.name}</b> <span className="text-xs text-[#cfc6ea]">— {m.desc}</span>
                    </span>
                    <span className={cn('rounded px-2 py-0.5 text-xs font-bold', on ? 'bg-[#ff9a5a] text-black' : 'bg-[#2a2342]')}>{on ? '+' + m.bonus.toFixed(1) : 'off'}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-[#8dffb0]">Laurel reward multiplier: ×{mult.toFixed(2)}</p>
          </Panel>

          <Panel className="p-4">
            <h3 className="font-display mb-1 text-xl font-extrabold">Muster Your Company</h3>
            <p className="mb-2 text-xs text-[#cfc6ea]">
              Choose 4 founders (max 2 of a kind): <b className={total === 4 ? 'text-[#8dffb0]' : 'text-[#ffd75a]'}>{total}/4</b>. You can recruit more with crowns later.
            </p>
            <div className="grid gap-2">
              {Object.values(CLASSES).map((c) => (
                <div key={c.id} className={cn('flex items-center gap-2 rounded-lg border p-2', (counts[c.id] || 0) > 0 ? 'border-[#3fa078] bg-[#173a2e]' : 'border-[#3d3460] bg-[#1b1630]')}>
                  <span className="text-2xl">{c.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">{c.name}</div>
                    <div className="truncate text-[11px] text-[#9a90b8]" title={c.desc}>
                      {c.desc}
                    </div>
                  </div>
                  <Btn small onClick={() => adj(c.id, -1)} disabled={(counts[c.id] || 0) <= 0}>
                    −
                  </Btn>
                  <span className="w-4 text-center font-bold">{counts[c.id] || 0}</span>
                  <Btn small onClick={() => adj(c.id, 1)} disabled={total >= 4 || (counts[c.id] || 0) >= 2}>
                    +
                  </Btn>
                </div>
              ))}
            </div>
            <Btn
              variant="gold"
              className="mt-4 w-full py-3 text-base"
              disabled={total !== 4}
              onClick={() => {
                const cls: string[] = [];
                Object.entries(counts).forEach(([k, n]) => {
                  for (let i = 0; i < n; i++) cls.push(k);
                });
                onStart(diff, mods, cls);
              }}
            >
              Begin Campaign ▶
            </Btn>
            <p className="mt-2 text-center text-[11px] text-[#9a90b8]">Starting crowns: {d.start + techLevel(meta, 'chest') * 8} · 7 battles to the Cataclysm Citadel</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

export function CollegeScreen({ meta, setMeta, onBack }: { meta: Meta; setMeta: (m: Meta) => void; onBack: () => void }) {
  const buy = (id: string) => {
    const t = TECH.find((x) => x.id === id)!;
    const lvl = techLevel(meta, id);
    if (lvl >= t.max) return;
    const cost = t.cost[lvl];
    if (meta.laurels < cost) {
      audio.sfx('error');
      return;
    }
    audio.sfx('levelup');
    const nm = { ...meta, laurels: meta.laurels - cost, tech: { ...meta.tech, [id]: lvl + 1 } };
    saveMeta(nm);
    setMeta(nm);
  };
  return (
    <div className="relative h-full w-full overflow-y-auto scroll-thin">
      <HexBackdrop intensity={0.4} />
      <div className="relative z-10 mx-auto max-w-5xl p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Btn small onClick={onBack}>
            ← Back
          </Btn>
          <h2 className="font-display text-3xl font-black text-[#f5d78a]">🎓 War College</h2>
          <Chip color="#1f5a40" className="text-sm">
            🌿 {meta.laurels} Laurels
          </Chip>
        </div>
        <p className="mb-3 text-sm text-[#cfc6ea]">Laurels earned in any campaign are kept forever. Permanent upgrades apply to every future battle and campaign.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TECH.map((t) => {
            const lvl = techLevel(meta, t.id);
            const maxed = lvl >= t.max;
            const cost = t.cost[lvl];
            return (
              <Panel key={t.id} className={cn('p-3', maxed && 'border-[#3fa078]')}>
                <div className="flex items-center gap-2">
                  <span className="text-3xl">{t.icon}</span>
                  <div className="font-display text-lg font-extrabold text-[#f5d78a]">{t.name}</div>
                </div>
                <p className="my-2 min-h-[2.5rem] text-xs text-[#cfc6ea]">{t.desc}</p>
                <div className="mb-2 flex gap-1">
                  {Array.from({ length: t.max }).map((_, i) => (
                    <span key={i} className={cn('h-2 flex-1 rounded', i < lvl ? 'bg-[#f5d78a]' : 'bg-[#2a2342]')} />
                  ))}
                </div>
                <Btn variant={maxed ? 'green' : 'gold'} className="w-full" disabled={maxed || meta.laurels < cost} onClick={() => buy(t.id)}>
                  {maxed ? '✔ Mastered' : `Upgrade — 🌿 ${cost}`}
                </Btn>
              </Panel>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function EndScreen({ campaign, won, laurels, onNew, onTitle }: { campaign: Campaign; won: boolean; laurels: number; onNew: () => void; onTitle: () => void }) {
  const s = campaign.stats;
  const score = campaignScore(campaign);
  const rows: [string, string | number][] = [
    ['Battles won', s.missions],
    ['Enemies slain', s.kills],
    ['Environment kills', s.envKills],
    ['Total rounds', s.rounds],
    ['Damage dealt', s.damage],
    ['Hazards shored', s.shores],
    ['Heroes lost', s.lost],
    ['Score', score],
  ];
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-y-auto scroll-thin">
      <HexBackdrop intensity={won ? 1.4 : 0.3} />
      <div className="relative z-10 w-full max-w-2xl p-4 text-center anim-pop">
        <div className="text-6xl">{won ? '🏆' : '💀'}</div>
        <h1 className={cn('font-display text-5xl font-black', won ? 'title-shimmer' : 'text-[#ff7a6a]')}>{won ? 'THE HEXFALL ENDS' : 'THE COMPANY FALLS'}</h1>
        <p className="mt-2 text-[#d9d1ee]">
          {won ? 'The Cataclysm Warden is slain and the ground grows still. Your legend will be sung.' : 'Your banner is torn and your company scattered. The land crumbles on.'}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {rows.map(([k, v]) => (
            <div key={k} className="rounded-lg border border-[#3d3460] bg-[#1b1630]/90 p-2">
              <div className="text-xl font-extrabold text-[#f5d78a]">{v}</div>
              <div className="text-[11px] text-[#9a90b8]">{k}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm font-bold text-[#8dffb0]">+{laurels} 🌿 Laurels banked for the War College (×{rewardMult(campaign).toFixed(2)} difficulty)</p>
        {campaign.roster.length > 0 && won && (
          <div className="mt-3 rounded-lg bg-[#1d1733]/90 p-2 text-xs text-[#cfc6ea]">
            <b>Surviving heroes:</b> {campaign.roster.map((u) => `${CLASSES[u.kind].icon} ${u.name} (${RANKS[u.level - 1]})`).join(' · ')}
          </div>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Btn variant="gold" onClick={onNew}>
            ⚔ New Campaign
          </Btn>
          <Btn onClick={onTitle}>Return to Title</Btn>
        </div>
      </div>
    </div>
  );
}
