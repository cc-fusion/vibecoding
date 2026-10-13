import { BIOME_NAMES, LAYER_NAMES, BUFFS, ITEMS } from '../game/data';
import { CYCLE, isNight } from '../game/game';
import type { Game } from '../game/game';
import { currentObjective } from '../game/npc';
import { audio } from '../game/audio';
import { Icon, Slot, Coins } from './common';

export function Hud({ g }: { g: Game }) {
  const p = g.player, w = g.world;
  const px = p.x / 16, py = p.y / 16; const biome = w.biomeAt(px, py), layer = w.layer(px, py);
  const hour = (4.5 + (g.time / CYCLE) * 24) % 24; const hh = Math.floor(hour), mm = Math.floor((hour % 1) * 60);
  const ampm = hh >= 12 ? 'PM' : 'AM'; const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const depth = Math.round((py - w.spawn.y) * 2);
  const obj = currentObjective(g); const touch = g.settings.touch || (typeof window !== 'undefined' && 'ontouchstart' in window);
  const boss = g.boss; const hands = boss && boss.def.id === 'lunar' ? (boss.a.hands.L.alive ? 1 : 0) + (boss.a.hands.R.alive ? 1 : 0) : -1;
  const open = (name: string) => () => { audio.sfx('ui'); g.panel === name ? g.closePanel() : g.openPanel(name); };
  const hold = (k: 'left' | 'right' | 'jump' | 'down', v: boolean) => () => { g.touch[k] = v; };
  const press = (k: 'left' | 'right' | 'jump' | 'down') => ({ onPointerDown: (e: { preventDefault: () => void }) => { e.preventDefault(); g.touch[k] = true; }, onPointerUp: hold(k, false), onPointerLeave: hold(k, false), onPointerCancel: hold(k, false) });
  return (
    <div className="absolute inset-0 pointer-events-none select-none text-amber-50 font-mono">
      {/* hotbar */}
      <div className="absolute left-2 top-2 flex flex-col gap-1">
        <div className="flex gap-0.5 p-1 rounded bg-black/40 border border-black/50 pointer-events-auto">
          {p.inv.slice(0, 10).map((s, i) => (
            <Slot key={i} s={s} active={p.sel === i} hint={String((i + 1) % 10)} size="w-[clamp(30px,3.6vw,46px)] aspect-square" onClick={() => { p.sel = i; g.ver++; audio.sfx('ui'); }} />
          ))}
        </div>
        <div className="text-xs font-bold text-amber-200 [text-shadow:1px_1px_0_#000] h-4 pl-1">{p.inv[p.sel] ? ITEMS[p.inv[p.sel]!.id].name : ''}</div>
        <div className="flex gap-1 flex-wrap max-w-[420px]">
          {Object.entries(p.buffs).map(([k, v]) => { const b = BUFFS[k]; if (!b) return null; return (
            <div key={k} title={`${b.name}: ${b.desc}`} className="px-1.5 py-0.5 rounded text-[10px] font-bold border" style={{ background: b.col + '33', borderColor: b.col, color: b.bad ? '#ffb0a0' : '#fff' }}>{b.name} {Math.ceil(v)}s</div>
          ); })}
        </div>
      </div>

      {/* right stats column (below minimap) */}
      <div className="absolute right-3 top-[138px] w-[190px] flex flex-col gap-1.5">
        <div className="relative h-5 rounded border-2 border-black bg-red-950/80 overflow-hidden" title="Life">
          <div className="h-full bg-gradient-to-b from-red-400 to-red-700 transition-[width] duration-150" style={{ width: `${Math.max(0, p.hp / p.maxHp) * 100}%` }} />
          <span className="absolute inset-0 grid place-items-center text-[11px] font-bold [text-shadow:1px_1px_0_#000]">❤ {Math.ceil(p.hp)} / {p.maxHp}</span>
        </div>
        <div className="relative h-4 rounded border-2 border-black bg-blue-950/80 overflow-hidden" title="Mana">
          <div className="h-full bg-gradient-to-b from-sky-300 to-blue-600 transition-[width] duration-150" style={{ width: `${Math.max(0, p.mana / p.maxMana) * 100}%` }} />
          <span className="absolute inset-0 grid place-items-center text-[10px] font-bold [text-shadow:1px_1px_0_#000]">★ {Math.floor(p.mana)} / {p.maxMana}</span>
        </div>
        <div className="flex items-center justify-between rounded bg-black/45 px-2 py-1 border border-black/60"><Coins c={p.coins} /><span className="text-[10px] text-purple-300 font-bold">◆ {g.meta.shards}</span></div>
        <div className="rounded bg-black/45 px-2 py-1 text-[10px] leading-tight border border-black/60">
          <div className="font-bold text-amber-200">{LAYER_NAMES[layer]} · {BIOME_NAMES[biome]}</div>
          <div>{h12}:{String(mm).padStart(2, '0')} {ampm} · Day {g.day} {isNight(g.time) ? '🌙' : '☀️'}</div>
          <div>{depth >= 0 ? `${depth} ft deep` : `${-depth} ft high`} · 🛡 {p.st.def}</div>
          {w.hardmode && <div className="text-fuchsia-300 font-bold">HARDMODE</div>}
        </div>
      </div>

      {/* boss + event bars */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 w-[min(480px,40vw)] flex flex-col gap-1.5 items-stretch">
        {boss && !boss.dead && (
          <div className="rounded border-2 border-black bg-black/60 p-1">
            <div className="flex justify-between text-[11px] font-bold px-1"><span className="text-red-300">{boss.def.name}</span><span>{Math.max(0, Math.ceil(boss.hp))} / {boss.maxHp}{hands >= 0 && hands > 0 ? ` · Shielded (${hands} hand${hands > 1 ? 's' : ''})` : ''}</span></div>
            <div className="h-3 bg-red-950 rounded overflow-hidden"><div className="h-full bg-gradient-to-b from-rose-400 to-red-700 transition-[width] duration-150" style={{ width: `${Math.max(0, boss.hp / boss.maxHp) * 100}%` }} /></div>
          </div>
        )}
        {g.ev.blood && <div className="rounded bg-red-950/80 border border-red-700 text-center text-xs font-bold py-0.5 text-red-200">🌑 BLOOD MOON — monsters swarm, coins double-ish</div>}
        {g.ev.rain > 0 && <div className="rounded bg-emerald-950/80 border border-emerald-600 text-center text-xs font-bold py-0.5 text-emerald-200">🟢 SLIME RAIN — {Math.ceil(g.ev.rain)}s</div>}
        {g.ev.goblin && (
          <div className="rounded bg-lime-950/80 border border-lime-600 p-1"><div className="text-[11px] font-bold text-lime-200 text-center">⚔ GOBLIN ARMY — {g.ev.goblin.kills}/{g.ev.goblin.total}</div>
            <div className="h-2 bg-black/60 rounded overflow-hidden"><div className="h-full bg-lime-500" style={{ width: `${Math.min(100, g.ev.goblin.kills / g.ev.goblin.total * 100)}%` }} /></div></div>
        )}
      </div>

      {/* messages */}
      <div className={`absolute left-1/2 -translate-x-1/2 ${touch ? 'bottom-32' : 'bottom-4'} w-[min(620px,70vw)] flex flex-col-reverse items-center gap-0.5`}>
        {g.msgs.slice(0, 5).map((m, i) => (
          <div key={m.t + i} className="px-3 py-0.5 rounded bg-black/55 text-xs md:text-sm font-bold text-center [text-shadow:1px_1px_0_#000]" style={{ color: m.c, opacity: Math.min(1, m.life) }}>{m.t}</div>
        ))}
      </div>

      {/* objective tracker */}
      {obj && (
        <button onClick={open('journal')} className={`pointer-events-auto absolute left-2 ${touch ? 'bottom-32' : 'bottom-2'} w-[min(300px,34vw)] text-left rounded-lg border-2 border-amber-800 bg-[#1d150c]/85 p-2 hover:bg-[#2a1d10]/90 cursor-pointer`}>
          <div className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">Objective · press J</div>
          <div className="text-sm font-extrabold text-amber-100">{obj.title}</div>
          <div className="text-[11px] leading-snug text-amber-100/80 hidden sm:block">{obj.desc}</div>
        </button>
      )}

      {/* quick buttons */}
      <div className="absolute right-3 bottom-2 flex gap-1.5 pointer-events-auto">
        {[['🎒', 'Inventory & Crafting (E)', 'inventory'], ['🏠', 'Housing (H)', 'housing'], ['📜', 'Journal (J)', 'journal'], ['🗺️', 'Map (M)', 'map']].map(([ic, t, n]) => (
          <button key={n} title={t} onClick={open(n)} className={`w-10 h-10 md:w-11 md:h-11 rounded border-2 text-xl cursor-pointer ${g.panel === n ? 'border-yellow-300 bg-amber-800' : 'border-amber-900 bg-[#2a1d10]/90 hover:bg-amber-900'}`}>{ic}</button>
        ))}
        <button title="Pause (Esc)" onClick={() => g.cb.onPause && g.cb.onPause()} className="w-10 h-10 md:w-11 md:h-11 rounded border-2 border-amber-900 bg-[#2a1d10]/90 hover:bg-amber-900 text-xl cursor-pointer">⏸</button>
      </div>

      {/* touch controls */}
      {touch && (
        <>
          <div className="absolute left-3 bottom-3 flex gap-2 pointer-events-auto touch-none">
            <button {...press('left')} className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/50 text-3xl active:bg-white/40 touch-none">◀</button>
            <button {...press('right')} className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/50 text-3xl active:bg-white/40 touch-none">▶</button>
          </div>
          <div className="absolute right-3 bottom-16 flex flex-col gap-2 items-end pointer-events-auto touch-none">
            <button onClick={() => { g.touch.interact = !g.touch.interact; g.ver++; }} className={`px-3 h-12 rounded-full border-2 text-sm font-bold touch-none ${g.touch.interact ? 'bg-amber-500/70 border-amber-200' : 'bg-white/20 border-white/50'}`}>{g.touch.interact ? 'INTERACT ON' : 'Interact'}</button>
            <div className="flex gap-2"><button {...press('down')} className="w-14 h-14 rounded-full bg-white/20 border-2 border-white/50 text-2xl touch-none">▼</button><button {...press('jump')} className="w-20 h-20 rounded-full bg-white/25 border-2 border-white/60 text-3xl active:bg-white/40 touch-none">⤒</button></div>
          </div>
        </>
      )}
      {/* hint for first seconds */}
      {g.stats.play < 25 && <div className="absolute top-24 left-1/2 -translate-x-1/2 text-xs bg-black/60 px-3 py-1 rounded text-amber-200 font-bold flex items-center gap-2"><Icon id="copper_pick" className="w-4 h-4" /> Hold Left Click to dig · E for inventory & crafting · Right Click to interact</div>}
    </div>
  );
}
