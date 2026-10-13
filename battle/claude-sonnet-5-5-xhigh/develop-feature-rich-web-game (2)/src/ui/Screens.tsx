import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DIFFS, MODS, PERKS, ENEMIES } from '../game/data';
import * as store from '../game/store';
import type { Game } from '../game/game';
import type { Meta, Settings, SlotInfo } from '../game/types';
import { audio } from '../game/audio';
import { btn, btn2, btnRed, Panel, fmtTime } from './common';

export function TitleBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!, ctx = cv.getContext('2d')!; let raf = 0; const t0 = performance.now();
    const stars = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random() * 0.7, p: Math.random() * 6 }));
    const flies = Array.from({ length: 24 }, () => ({ x: Math.random(), y: 0.6 + Math.random() * 0.35, p: Math.random() * 6 }));
    const shooting: { x: number; y: number; l: number }[] = [];
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const w = (cv.width = cv.clientWidth), h = (cv.height = cv.clientHeight), t = (performance.now() - t0) / 1000;
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0b0a24'); g.addColorStop(0.55, '#3a1f5a'); g.addColorStop(0.85, '#c8553a'); g.addColorStop(1, '#f0a050'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (const s of stars) { ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t + s.p)); ctx.fillStyle = '#fff'; ctx.fillRect(s.x * w, s.y * h, 2, 2); } ctx.globalAlpha = 1;
      if (Math.random() < 0.01) shooting.push({ x: Math.random() * w, y: Math.random() * h * 0.3, l: 1 });
      for (let i = shooting.length - 1; i >= 0; i--) { const s = shooting[i]; s.x += 9; s.y += 4; s.l -= 0.02; ctx.strokeStyle = `rgba(255,240,180,${s.l})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - 40, s.y - 18); ctx.stroke(); if (s.l <= 0) shooting.splice(i, 1); }
      ctx.fillStyle = '#f4f0d8'; ctx.beginPath(); ctx.arc(w * 0.78, h * 0.2, Math.min(w, h) * 0.06, 0, 6.283); ctx.fill();
      const cols = ['#4a2a6a', '#2e1a4a', '#1a0f2e', '#0c0818'];
      for (let l = 0; l < 4; l++) { ctx.fillStyle = cols[l]; ctx.beginPath(); ctx.moveTo(0, h); const base = h * (0.62 + l * 0.1); for (let x = 0; x <= w; x += 8) ctx.lineTo(x, base - (Math.sin((x + t * (8 + l * 6)) * 0.006 + l * 2) * 0.5 + Math.sin(x * 0.017 + l) * 0.3 + 0.8) * h * (0.09 - l * 0.012)); ctx.lineTo(w, h); ctx.fill(); }
      ctx.fillStyle = '#0c0818'; for (let i = 0; i < 18; i++) { const x = (i / 18) * w + ((i * 37) % 23); const th = 30 + ((i * 53) % 40); ctx.fillRect(x, h - th - 16, 5, th); ctx.beginPath(); ctx.ellipse(x + 2, h - th - 18, 16, 20, 0, 0, 6.283); ctx.fill(); }
      for (const f of flies) { const x = (f.x * w + Math.sin(t + f.p) * 20) % w, y = f.y * h + Math.cos(t * 1.3 + f.p) * 10; ctx.fillStyle = `rgba(255,240,120,${0.4 + 0.5 * Math.sin(t * 3 + f.p)})`; ctx.fillRect(x, y, 3, 3); }
    };
    draw(); return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
}

export function Title({ meta, onPlay, onLegacy, onHelp, onSettings }: { meta: Meta; onPlay: () => void; onLegacy: () => void; onHelp: () => void; onSettings: () => void }) {
  return (
    <div className="absolute inset-0 grid place-items-center overflow-hidden">
      <TitleBackdrop />
      <div className="relative z-10 flex flex-col items-center gap-6 px-4 text-center">
        <div>
          <h1 className="text-5xl sm:text-6xl md:text-8xl font-black tracking-[0.12em] text-amber-300 [text-shadow:0_4px_0_#7a3a0a,0_8px_0_#3a1a05,0_0_40px_rgba(255,180,60,0.6)] font-mono">TERRA<span className="text-emerald-400">DELVE</span></h1>
          <p className="mt-3 text-amber-100/90 tracking-widest text-xs sm:text-sm uppercase [text-shadow:0_2px_0_#000]">Explore · Mine · Craft · Fight · Ascend</p>
        </div>
        <div className="flex flex-col gap-3 w-64">
          <button className={`${btn} text-lg`} onClick={onPlay}>▶ Play</button>
          <button className={`${btn2} text-base`} onClick={onLegacy}>◆ Legacy Forge <span className="ml-1 px-1.5 rounded bg-purple-800 text-purple-200 text-xs">{meta.shards}</span></button>
          <button className={btn2} onClick={onHelp}>❓ How to Play</button>
          <button className={btn2} onClick={onSettings}>⚙ Settings & Audio</button>
        </div>
        <div className="text-xs text-amber-100/70 bg-black/40 rounded px-3 py-1.5 border border-white/10">Best day: <b>{meta.bestDay}</b> · Monsters slain: <b>{meta.totalKills}</b> · Bosses: <b>{meta.totalBosses}</b> · Victories: <b>{meta.wins}</b></div>
      </div>
    </div>
  );
}

export function Shell({ title, onBack, children, wide }: { title: string; onBack: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="absolute inset-0 overflow-y-auto">
      <TitleBackdrop /><div className="absolute inset-0 bg-black/55" />
      <div className="relative z-10 min-h-full grid place-items-center p-3 sm:p-6">
        <Panel title={title} onClose={onBack} className={`w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'}`}>{children}</Panel>
      </div>
    </div>
  );
}

export function WorldSelect({ slots, onContinue, onNew, onDelete, onBack }: { slots: (SlotInfo | null)[]; onContinue: (i: number) => void; onNew: (i: number) => void; onDelete: (i: number) => void; onBack: () => void }) {
  const [confirm, setConfirm] = useState<number | null>(null);
  return (
    <Shell title="Choose a World" onBack={onBack}>
      <div className="flex flex-col gap-3">
        {slots.map((s, i) => (
          <div key={i} className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-[#5a3d1e] bg-black/30 p-3">
            <div className="w-12 h-12 rounded bg-gradient-to-b from-sky-400 to-emerald-700 border-2 border-black grid place-items-center text-2xl">{s ? '🌍' : '✚'}</div>
            <div className="flex-1 min-w-[160px]">
              {s ? (<>
                <div className="font-extrabold text-amber-200">{s.name} {s.hardmode && <span className="text-[10px] px-1.5 py-0.5 rounded bg-fuchsia-800 text-fuchsia-200 ml-1">HARDMODE</span>}</div>
                <div className="text-xs text-amber-100/70">{DIFFS.find(d => d.id === s.diff)?.name} · Day {s.day} · {fmtTime(s.play)} · Bosses {s.bosses}/5{s.mods.length ? ` · ${s.mods.join(', ')}` : ''}</div>
                <div className="text-[10px] text-amber-100/40">Saved {new Date(s.saved).toLocaleString()}</div>
              </>) : <div className="font-bold text-amber-100/60">Empty slot {i + 1}</div>}
            </div>
            {s ? (<div className="flex gap-2">
              <button className={btn} onClick={() => onContinue(i)}>Continue</button>
              {confirm === i ? <button className={btnRed} onClick={() => { onDelete(i); setConfirm(null); }}>Confirm delete</button> : <button className={btn2} onClick={() => setConfirm(i)}>Delete</button>}
            </div>) : <button className={btn} onClick={() => onNew(i)}>New World</button>}
          </div>
        ))}
        <p className="text-xs text-amber-100/60">Worlds save automatically every minute and when you quit. Hardcore worlds are deleted on death.</p>
      </div>
    </Shell>
  );
}

export function NewWorld({ slot, meta, onStart, onBack }: { slot: number; meta: Meta; onStart: (o: { name: string; seed: number; diff: string; mods: string[] }) => void; onBack: () => void }) {
  const [name, setName] = useState(`World ${slot + 1}`); const [seed, setSeed] = useState(''); const [diff, setDiff] = useState(1); const [mods, setMods] = useState<string[]>([]);
  const toggle = (id: string) => setMods(m => (m.includes(id) ? m.filter(x => x !== id) : [...m, id]));
  const perks = PERKS.filter(p => (meta.perks[p.id] || 0) > 0);
  const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  return (
    <Shell title="Create World" onBack={onBack} wide>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-amber-300">World name<input value={name} maxLength={20} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded bg-black/50 border-2 border-[#4a3520] px-2 py-1.5 text-sm text-amber-50 outline-none focus:border-amber-500" /></label>
          <label className="text-xs font-bold uppercase tracking-wider text-amber-300">Seed (optional)<input value={seed} maxLength={24} onChange={e => setSeed(e.target.value)} placeholder="random" className="mt-1 w-full rounded bg-black/50 border-2 border-[#4a3520] px-2 py-1.5 text-sm text-amber-50 outline-none focus:border-amber-500" /></label>
          <div className="text-xs font-bold uppercase tracking-wider text-amber-300">Modifiers</div>
          {MODS.map(m => (
            <button key={m.id} onClick={() => toggle(m.id)} className={`text-left rounded border-2 p-2 cursor-pointer ${mods.includes(m.id) ? 'border-amber-400 bg-amber-900/40' : 'border-[#4a3520] bg-black/30 hover:border-amber-700'}`}>
              <div className="font-bold text-sm">{mods.includes(m.id) ? '☑' : '☐'} {m.name}</div><div className="text-[11px] text-amber-100/70">{m.desc}</div>
            </button>
          ))}
          {perks.length > 0 && <div className="text-[11px] text-purple-200 bg-purple-950/40 rounded p-2 border border-purple-800">Active Legacy perks: {perks.map(p => `${p.icon} ${p.name} ${meta.perks[p.id]}`).join(' · ')}</div>}
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-300">Difficulty</div>
          {DIFFS.map((d, i) => (
            <button key={d.id} onClick={() => setDiff(i)} className={`text-left rounded border-2 p-2 cursor-pointer ${diff === i ? 'border-amber-400 bg-amber-900/40' : 'border-[#4a3520] bg-black/30 hover:border-amber-700'}`}>
              <div className="font-extrabold text-sm">{diff === i ? '◉' : '○'} {d.name}</div><div className="text-[11px] text-amber-100/70">{d.desc}</div>
              <div className="text-[10px] text-amber-300/60 mt-0.5">Enemy life ×{d.hp} · damage ×{d.dmg} · spawns ×{d.spawn} · loot ×{d.loot}</div>
            </button>
          ))}
          <button className={`${btn} mt-2 text-lg`} onClick={() => onStart({ name: name.trim() || `World ${slot + 1}`, seed: seed.trim() ? (/^\d+$/.test(seed.trim()) ? parseInt(seed.trim()) >>> 0 : hash(seed.trim())) : Math.floor(Math.random() * 4294967295), diff: DIFFS[diff].id, mods })}>Generate World ▶</button>
        </div>
      </div>
    </Shell>
  );
}

export function Legacy({ meta, onChange, onBack }: { meta: Meta; onChange: () => void; onBack: () => void }) {
  const buy = (id: string) => {
    const p = PERKS.find(x => x.id === id)!; const r = meta.perks[id] || 0; if (r >= p.max) return; const c = p.cost[r]; if (meta.shards < c) { audio.sfx('error'); return; }
    meta.shards -= c; meta.perks[id] = r + 1; store.saveMeta(meta); audio.sfx('level'); onChange();
  };
  return (
    <Shell title="Legacy Forge" onBack={onBack} wide>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-amber-100/80 max-w-md">Earn <b className="text-purple-300">Legacy Shards</b> by defeating bosses, repelling invasions, finishing objectives and surviving days. Perks are permanent and apply to every new world you create.</p>
        <div className="text-2xl font-black text-purple-300">◆ {meta.shards}</div>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {PERKS.map(p => {
          const r = meta.perks[p.id] || 0; const maxed = r >= p.max; const cost = p.cost[r];
          return (
            <div key={p.id} className="rounded-lg border-2 border-[#5a3d1e] bg-black/30 p-3 flex gap-3">
              <div className="text-3xl">{p.icon}</div>
              <div className="flex-1"><div className="font-extrabold text-amber-200">{p.name}</div><div className="text-[11px] text-amber-100/70 mb-1">{p.desc}</div>
                <div className="flex gap-1 mb-2">{Array.from({ length: p.max }).map((_, i) => <span key={i} className={`w-4 h-2 rounded-sm ${i < r ? 'bg-purple-400' : 'bg-stone-700'}`} />)}</div>
                <button className={btn2} disabled={maxed || meta.shards < cost} onClick={() => buy(p.id)}>{maxed ? 'Maxed' : `Upgrade — ◆ ${cost}`}</button>
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

export function HelpContent() {
  const [tab, setTab] = useState(0);
  const keys: [string, string][] = [['A / D  or  ← / →', 'Run'], ['Space / W / ↑', 'Jump (hold for height). Double-jump with Cloud in a Bottle; hold in air with Wings'], ['S / ↓', 'Drop through platforms'], ['Left Click (hold)', 'Dig, place blocks, swing, shoot, cast — uses the selected hotbar item'], ['Right Click', 'Interact: open chests, talk to NPCs, sleep in beds'], ['1–0 / Mouse wheel', 'Select hotbar slot'], ['E / I / Tab', 'Inventory & crafting'], ['Q / R', 'Quick-heal / quick-mana potion'], ['H', 'Housing inspector'], ['J', 'Journal & objectives'], ['M', 'World map'], ['Esc', 'Pause / close panels'], ['Touch', 'On-screen D-pad & jump; tap the world to use items; toggle “Interact” for right-click']];
  const systems: [string, string][] = [
    ['⛏ Mining & building', 'Everything is destructible and placeable. Pickaxe power gates ores: Gold ≥ 40%, Shadowite ≥ 55%, Hellstone ≥ 65%, Cobalt ≥ 100%, Adamant ≥ 110%. Trees fall in one chop; plant Acorns on grass to regrow them.'],
    ['⚒ Crafting stations', 'Work Bench → Furnace (smelt ore) → Iron Anvil → Hellforge (Underworld) → Arcane Anvil (hardmode). Stand within a few tiles of a station to use its recipes.'],
    ['🏠 NPC housing', 'Build a room with solid enclosure, background walls, a Door, Table, Chair and Torch, then check it with H. NPCs arrive when their condition is met (coins, max life, ammo, bombs, bosses). Happy NPCs sell cheaper — biome and neighbours matter. Towns also reduce monster spawns.'],
    ['🌗 Day & night', 'Zombies and Demon Eyes roam at night; Blood Moons are deadlier and pay more. Sleep in a Bed to skip the night. Falling stars become Mana Crystals.'],
    ['⚔ Combat', 'Melee, bows & guns (need ammo), and magic (mana). Crits double damage. Armor sets give bonuses when all three pieces match. Potions and accessories change your stats.'],
    ['👁 Bosses', 'Eye of Cthulhu → Bone Lord → Wall of Flesh (starts Hardmode, spreads the Blight faster, unlocks Cobalt/Adamant) → The Destroyer → Lunar Colossus (final boss: destroy its hands, then the head).'],
    ['🌊 Events', 'Blood Moon, Slime Rain and Goblin Army invasions. The Goblin Army can be called with a Battle Standard.'],
    ['◆ Legacy Forge', 'Bosses, invasions and objectives award shards that buy permanent perks for all future worlds.'],
  ];
  return (
    <div>
      <div className="flex gap-1 mb-3">{['Controls', 'Systems', 'Tips'].map((t, i) => <button key={t} className={`${tab === i ? btn : btn2} !py-1`} onClick={() => setTab(i)}>{t}</button>)}</div>
      {tab === 0 && <div className="grid gap-1 text-sm">{keys.map(([k, v]) => <div key={k} className="grid grid-cols-[150px_1fr] gap-2 items-start"><kbd className="rounded bg-black/60 border border-amber-800 px-2 py-0.5 text-xs font-mono text-amber-200 text-center">{k}</kbd><span className="text-amber-100/90 text-xs sm:text-sm">{v}</span></div>)}</div>}
      {tab === 1 && <div className="grid gap-2">{systems.map(([k, v]) => <div key={k} className="rounded bg-black/30 border border-[#4a3520] p-2"><div className="font-bold text-amber-200 text-sm">{k}</div><div className="text-xs text-amber-100/80">{v}</div></div>)}</div>}
      {tab === 2 && <ul className="list-disc pl-5 text-sm text-amber-100/90 grid gap-1.5"><li>The Journal (J) always shows your next objective — the first ones are an interactive tutorial.</li><li>Hold a Torch (select it) to carry light. Caves are very dark.</li><li>Build a flat arena with platforms and torches before summoning a boss.</li><li>Potion Sickness lasts 25s — don’t rely on a single heal. Nurse heals cost coins, not potions.</li><li>Bombs destroy blocks quickly (and hurt you). Water meets lava to make Obsidian.</li><li>The Wall of Flesh chases you across the Underworld — build a long bridge to run on and keep your distance.</li><li>Dig straight down only if you have an escape: Grappling Hook or Magic Mirror.</li><li>Higher difficulties earn more loot and Legacy Shards — Hardcore deletes the world on death.</li>
        <li>Enemies in your housing area cannot open doors: closed Doors keep zombies out.</li></ul>}
    </div>
  );
}

export function SettingsContent({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const set = (p: Partial<Settings>) => onChange({ ...settings, ...p });
  const Slider = ({ label, k }: { label: string; k: 'master' | 'music' | 'sfx' }) => (
    <label className="grid grid-cols-[110px_1fr_40px] items-center gap-2 text-sm"><span>{label}</span><input type="range" min={0} max={1} step={0.01} value={settings[k]} onChange={e => set({ [k]: parseFloat(e.target.value) } as any)} className="accent-amber-500" /><span className="text-xs text-right">{Math.round(settings[k] * 100)}%</span></label>
  );
  const Toggle = ({ label, k }: { label: string; k: 'shake' | 'numbers' | 'touch' | 'muted' }) => (
    <button className={`${settings[k] ? btn : btn2} !py-1 text-xs`} onClick={() => set({ [k]: !settings[k] } as any)}>{settings[k] ? '☑' : '☐'} {label}</button>
  );
  return (
    <div className="grid gap-3">
      <Slider label="Master volume" k="master" /><Slider label="Music" k="music" /><Slider label="Sound effects" k="sfx" />
      <div className="flex flex-wrap gap-2"><Toggle label="Mute all" k="muted" /><Toggle label="Screen shake" k="shake" /><Toggle label="Damage numbers" k="numbers" /><Toggle label="Touch controls" k="touch" /><button className={`${btn2} !py-1 text-xs`} onClick={() => { audio.resume(); audio.sfx('craft'); audio.sfx('explosion'); }}>🔊 Test sound</button></div>
      <div className="grid grid-cols-[110px_1fr] items-center gap-2 text-sm"><span>Zoom</span><div className="flex gap-1">{[[0, 'Auto'], [2, '2×'], [3, '3×'], [4, '4×']].map(([v, l]) => <button key={v} className={`${settings.zoom === v ? btn : btn2} !py-1 text-xs`} onClick={() => set({ zoom: v as number })}>{l}</button>)}</div></div>
      <div className="grid grid-cols-[110px_1fr] items-center gap-2 text-sm"><span>Particles</span><div className="flex gap-1">{['Low', 'Medium', 'High'].map((l, i) => <button key={l} className={`${settings.particles === i ? btn : btn2} !py-1 text-xs`} onClick={() => set({ particles: i })}>{l}</button>)}</div></div>
    </div>
  );
}

export function StatsGrid({ g }: { g: Game }) {
  const s = g.stats; const bosses = Object.keys(s.bosses).map(id => ENEMIES[id]?.name || id);
  const rows: [string, string][] = [['Time played', fmtTime(s.play)], ['Days survived', String(g.day)], ['Monsters slain', String(s.kills)], ['Deaths', String(s.deaths)], ['Blocks mined', String(s.mined)], ['Deepest point', `${Math.round(s.maxDepth * 2)} ft`], ['Damage dealt', String(s.dmgDealt)], ['Damage taken', String(s.dmgTaken)], ['Coins earned', String(Math.round(s.coinsEarned / 100)) + ' silver'], ['Events survived', String(s.events)], ['Residents', String(g.npcs.length)], ['Legacy shards', `◆ ${g.runShards}`]];
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">{rows.map(([k, v]) => <div key={k} className="rounded bg-black/40 border border-[#4a3520] px-2 py-1"><div className="text-[10px] uppercase tracking-wider text-amber-300/70">{k}</div><div className="font-bold text-sm">{v}</div></div>)}</div>
      <div className="mt-2 text-xs text-amber-100/80"><b className="text-amber-300">Bosses defeated:</b> {bosses.length ? bosses.join(', ') : 'none yet'}</div>
    </div>
  );
}

export function Overlay({ children }: { children: ReactNode }) {
  return <div className="absolute inset-0 z-50 grid place-items-center bg-black/65 p-3 overflow-y-auto pointer-events-auto">{children}</div>;
}
export function PauseMenu({ g, settings, onSettings, onResume, onQuit }: { g: Game; settings: Settings; onSettings: (s: Settings) => void; onResume: () => void; onQuit: () => void }) {
  const [tab, setTab] = useState<'menu' | 'settings' | 'help'>('menu'); const [saved, setSaved] = useState('');
  return (
    <Overlay>
      <Panel title={tab === 'menu' ? 'Paused' : tab === 'settings' ? 'Settings' : 'How to Play'} onClose={tab === 'menu' ? onResume : () => setTab('menu')} className="w-full max-w-xl" z="z-50">
        {tab === 'menu' && (
          <div className="flex flex-col gap-2.5 items-stretch">
            <button className={btn} onClick={onResume}>▶ Resume</button>
            <button className={btn2} onClick={() => setTab('settings')}>⚙ Settings & Audio</button>
            <button className={btn2} onClick={() => setTab('help')}>❓ Controls & Help</button>
            <div className="rounded border border-[#4a3520] bg-black/30 p-2">
              <div className="text-[10px] uppercase tracking-wider text-amber-300 mb-1">Difficulty {g.diff.perma ? '— Hardcore is locked' : '(changes apply instantly)'}</div>
              <div className="flex flex-wrap gap-1.5">{DIFFS.filter(d => !d.perma).map(d => <button key={d.id} disabled={g.diff.perma} className={`${g.diff.id === d.id ? btn : btn2} !py-1 text-xs`} onClick={() => { g.diff = d; g.say(`Difficulty set to ${d.name}`, '#ffe9a0', 3); g.ver++; }}>{d.name}</button>)}</div>
            </div>
            <button className={btn2} onClick={() => { setSaved(g.save() ? 'World saved!' : 'Save failed (storage unavailable?)'); }}>💾 Save now</button>
            <button className={btnRed} onClick={onQuit}>⏏ Save & Quit to Title</button>
            {saved && <div className="text-xs text-emerald-300 text-center">{saved}</div>}
            <div className="text-[11px] text-amber-100/60 text-center">{g.name} · {g.diff.name} · Day {g.day}</div>
            <StatsGrid g={g} />
          </div>
        )}
        {tab === 'settings' && <SettingsContent settings={settings} onChange={onSettings} />}
        {tab === 'help' && <HelpContent />}
      </Panel>
    </Overlay>
  );
}
