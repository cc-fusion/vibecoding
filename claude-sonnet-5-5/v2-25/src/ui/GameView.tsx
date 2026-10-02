import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Game } from '../game/engine';
import type { Building, RunResult, Worker } from '../game/engine';
import { renderGame } from '../game/render';
import {
  WW, WH, BUILD_ORDER, BUILD_KEYS, BUILDINGS, SPECIES, SPECIES_ORDER, SPELLS, RES_KEYS, RES_META, SHIFT_META, TUTORIAL, ENEMIES, DAY_LEN,
} from '../game/data';
import type { Shift } from '../game/data';
import type { SaveData } from '../game/save';
import { audio } from '../game/audio';
import { Modal, Help, SettingsPanel, EndScreen, costText } from './Menus';

interface Props {
  game: Game;
  save: SaveData;
  onSave: (s: SaveData) => void;
  onRetry: () => void;
  onTitle: () => void;
  onDark: () => void;
}

function Meter({ v, max, color, label, h = 'h-2' }: { v: number; max: number; color: string; label?: string; h?: string }) {
  const p = max > 0 ? Math.max(0, Math.min(1, v / max)) : 0;
  return (
    <div className="w-full">
      {label && <div className="flex justify-between text-[10px] text-stone-400 leading-none mb-0.5"><span>{label}</span><span>{Math.round(v)}/{Math.round(max)}</span></div>}
      <div className={`w-full ${h} rounded-full bg-black/50 overflow-hidden border border-white/10`}><div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${p * 100}%`, background: color }} /></div>
    </div>
  );
}

const shortName = (n: string) => n.replace(/^Gravedigger.s /, 'Digger ').replace(/^Embalmer.s /, 'Embalmer ');

const STATE_LABEL: Record<string, string> = {
  idle: 'Idle', moving: 'Walking', working: 'Working', resting: 'Resting', fleeing: 'Fleeing!', fighting: 'Fighting', strike: 'On strike',
};

export default function GameView({ game, save, onSave, onRetry, onTitle, onDark }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ w: 640, h: 411, dpr: 1 });
  const saveRef = useRef(save);
  saveRef.current = save;
  const paid = useRef({ kills: 0, bosses: 0, run: false, win: false });
  const [, setTick] = useState(0);
  const [menu, setMenu] = useState<'none' | 'pause'>('none');
  const [sub, setSub] = useState<null | 'settings' | 'help'>(null);
  const [tab, setTab] = useState<'inspect' | 'roster' | 'rites'>('inspect');
  const [end, setEnd] = useState<RunResult | null>(null);
  const [hint, setHint] = useState<string>('');
  const prevSel = useRef('');
  const [confirmQuit, setConfirmQuit] = useState(false);

  // ---------- persistence of run results ----------
  const applyResult = useCallback((final: boolean) => {
    if (game.tutorial && !final) return null;
    const res = game.result();
    const s = saveRef.current;
    const p = paid.current;
    const next: SaveData = {
      ...s,
      shards: s.shards + res.shards,
      runs: s.runs + (p.run ? 0 : 1),
      wins: s.wins + (res.won && !p.win ? 1 : 0),
      bestDay: Math.max(s.bestDay, res.days),
      totalKills: s.totalKills + (res.kills - p.kills),
      bosses: s.bosses + (res.bosses - p.bosses),
    };
    p.run = true; p.win = p.win || res.won; p.kills = res.kills; p.bosses = res.bosses;
    game.shardsPaid += res.shards;
    saveRef.current = next;
    onSave(next);
    return res;
  }, [game, onSave]);

  useEffect(() => {
    game.onEnd = () => {
      const res = applyResult(true);
      if (res) setEnd(res);
    };
    return () => { game.onEnd = null; };
  }, [game, applyResult]);

  useEffect(() => { game.shakeOn = save.settings.shake; }, [game, save.settings.shake]);
  useEffect(() => { game.paused = menu === 'pause' || sub !== null; }, [game, menu, sub]);

  // ---------- main loop ----------
  useEffect(() => {
    let raf = 0;
    let alive = true;
    let last = performance.now();
    const loop = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      game.update(dt);
      const c = canvasRef.current;
      const ctx = c ? c.getContext('2d') : null;
      if (c && ctx) renderGame(game, ctx, sizeRef.current.w, sizeRef.current.h, sizeRef.current.dpr, now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    audio.startMusic();
    const iv = window.setInterval(() => {
      const key = `${game.sel.kind}:${game.sel.id}`;
      if (key !== prevSel.current) {
        prevSel.current = key;
        if (game.sel.kind) setTab('inspect');
      }
      setTick((t) => (t + 1) % 1e6);
    }, 140);
    return () => { alive = false; cancelAnimationFrame(raf); window.clearInterval(iv); };
  }, [game]);

  // ---------- resize ----------
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const fit = () => {
      const aw = wrap.clientWidth, ah = wrap.clientHeight;
      if (aw < 10 || ah < 10) return;
      const sc = Math.min(aw / WW, ah / WH);
      const w = Math.floor(WW * sc), h = Math.floor(WH * sc);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const c = canvasRef.current;
      if (c) {
        c.width = Math.floor(w * dpr); c.height = Math.floor(h * dpr);
        c.style.width = `${w}px`; c.style.height = `${h}px`;
      }
      sizeRef.current = { w, h, dpr };
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, []);

  // ---------- controls ----------
  const toggleMute = useCallback(() => {
    const s = saveRef.current;
    const next = { ...s, settings: { ...s.settings, muted: !s.settings.muted } };
    audio.setVolumes({ muted: next.settings.muted });
    saveRef.current = next;
    onSave(next);
  }, [onSave]);

  const cycleSpeed = useCallback(() => { game.speed = game.speed >= 3 ? 1 : game.speed + 1; audio.sfx('click'); }, [game]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (game.status !== 'playing' && end) return;
      if (k === 'escape') {
        e.preventDefault();
        if (sub) { setSub(null); return; }
        if (menu === 'pause') { setMenu('none'); return; }
        if (game.cancelAll()) return;
        setMenu('pause');
        return;
      }
      if (sub || menu === 'pause') return;
      if (k === ' ') { e.preventDefault(); setMenu('pause'); return; }
      if (k === 'tab') { e.preventDefault(); cycleSpeed(); return; }
      if (k === 'm') { toggleMute(); return; }
      if (k === 'h') { setSub('help'); return; }
      if (k === 'x') { game.selectTool('demolish'); return; }
      if (k === 'b') { game.bribe(); return; }
      const bi = BUILD_KEYS.indexOf(e.key);
      if (bi >= 0 && bi < BUILD_ORDER.length) {
        const def = BUILDINGS[BUILD_ORDER[bi]];
        if (!game.unlocked(def.unlock)) { audio.sfx('error'); game.say(`${def.name} is locked — research it in Dark Arts.`, '#ff7a7a'); return; }
        game.selectTool(def.id);
        return;
      }
      const sp = SPELLS.find((s) => s.key === k);
      if (sp) { game.beginSpell(sp.id); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game, menu, sub, end, cycleSpeed, toggleMute]);

  useEffect(() => {
    const pauseIt = () => { if (game.status === 'playing' && menu === 'none' && !sub) setMenu('pause'); };
    const vis = () => { if (document.hidden) pauseIt(); };
    window.addEventListener('blur', pauseIt);
    document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('blur', pauseIt); document.removeEventListener('visibilitychange', vis); };
  }, [game, menu, sub]);

  const toWorld = (e: React.PointerEvent) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0, inside: false };
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * WW;
    const y = ((e.clientY - r.top) / r.height) * WH;
    return { x, y, inside: x >= 0 && y >= 0 && x <= WW && y <= WH };
  };

  const quit = (toDark: boolean) => {
    if (game.status === 'playing') applyResult(false);
    if (toDark) onDark(); else onTitle();
  };

  // ---------- derived HUD ----------
  const c = game.cycle;
  const [b0, b1, b2] = game.bounds;
  const phaseIcon = { dawn: '🌅', day: '☀️', dusk: '🌇', night: '🌙' }[game.phase];
  const nr = game.nextRaid();
  const mau = game.mausoleum;
  const boss = game.bossAlive;
  const tut = game.tutorial ? TUTORIAL[game.tutStep] : undefined;
  const now = performance.now();

  return (
    <div className="absolute inset-0 flex flex-col bg-[#0b0d10] select-none">
      {/* ---------------- HUD ---------------- */}
      <div className="panel rounded-none border-x-0 border-t-0 px-2 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm z-10">
        <div className="flex items-center gap-2 min-w-[150px]">
          <span className="text-xl">{phaseIcon}</span>
          <div>
            <div className="font-title font-bold leading-tight">Day {game.dayNo}<span className="text-stone-500">{game.endless ? ' · Endless' : ` / ${game.goal}`}</span> <span className="capitalize text-stone-400 text-xs">{game.phase}</span></div>
            <div className="relative h-2 w-36 rounded-full overflow-hidden flex border border-white/10">
              <div style={{ width: `${b0 * 100}%`, background: '#f4a261' }} /><div style={{ width: `${(b1 - b0) * 100}%`, background: '#f2d16b' }} />
              <div style={{ width: `${(b2 - b1) * 100}%`, background: '#9b5de5' }} /><div style={{ width: `${(1 - b2) * 100}%`, background: '#2b3a67' }} />
              <div className="absolute top-[-2px] w-1 h-3.5 bg-white rounded" style={{ left: `calc(${c * 100}% - 2px)`, boxShadow: '0 0 6px #fff' }} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {RES_KEYS.map((k) => (
            <span key={k} className="chip" title={RES_META[k].name} style={{ color: RES_META[k].color }}>{RES_META[k].icon}<b>{Math.floor(game.res[k])}</b></span>
          ))}
          <span className="chip" title="Population / cap (build Crypts to raise the cap)">💀<b className={game.pop >= game.popCap ? 'text-[#ff9a6b]' : ''}>{game.pop}/{game.popCap}</b></span>
        </div>
        <div className="w-24" title="Infamy: raises raid size"><Meter v={game.infamy} max={100} color="linear-gradient(90deg,#f2c14e,#ff6b81)" label="📣 Infamy" /></div>
        <div className="w-28" title="Mausoleum health"><Meter v={mau ? mau.hp : 0} max={mau ? mau.maxHp : 1} color="linear-gradient(90deg,#b78cff,#7fe3d4)" label="🏛️ Mausoleum" /></div>
        <div className={`chip ${nr && nr.warned ? 'anim-pulse' : ''}`} style={{ color: nr ? (nr.team === 'zealot' ? '#ffd36b' : '#7bff9e') : '#999' }}>
          {nr ? `${nr.team === 'zealot' ? '✝️' : '☠️'} ${nr.label} ${Math.max(0, Math.ceil(nr.spawnAt - game.time))}s` : game.tutHold ? '🕊️ Peace (tutorial)' : '⏳ Raid pending…'}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {[1, 2, 3].map((s) => <button key={s} className={`btn btn-sm ${game.speed === s ? 'btn-primary' : ''}`} onClick={() => { game.speed = s; audio.sfx('click'); }}>{s}×</button>)}
          <button className="btn btn-sm" onClick={() => setMenu('pause')} title="Pause (Space)">⏸</button>
          <button className="btn btn-sm" onClick={toggleMute} title="Mute (M)">{save.settings.muted ? '🔇' : '🔊'}</button>
          <button className="btn btn-sm" onClick={() => setSub('help')} title="Help (H)">❓</button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div className="flex-1 min-h-0 min-w-0 flex flex-col">
          {/* ---------------- Canvas ---------------- */}
          <div ref={wrapRef} className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden bg-[#0b0d10]">
            <canvas
              ref={canvasRef}
              onPointerDown={(e) => { audio.init(); const p = toWorld(e); game.pointerMove(p.x, p.y, p.inside); game.pointerDown(p.x, p.y, e.button); setTick((t) => t + 1); }}
              onPointerMove={(e) => { const p = toWorld(e); game.pointerMove(p.x, p.y, p.inside); }}
              onPointerLeave={() => game.pointerMove(game.mouse.x, game.mouse.y, false)}
              onContextMenu={(e) => e.preventDefault()}
              style={{ cursor: game.tool ? (game.tool === 'demolish' ? 'not-allowed' : 'copy') : game.targeting ? 'crosshair' : 'default' }}
            />
            {/* boss bar */}
            {boss && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[min(520px,80%)] pointer-events-none anim-fade">
                <div className="text-center font-title font-bold text-sm" style={{ color: boss.def.color }}>{boss.def.icon} {boss.def.name}{boss.phase2 ? ' — ENRAGED' : ''}</div>
                <Meter v={boss.hp} max={boss.maxHp} color={`linear-gradient(90deg, ${boss.def.color}, #ff6b81)`} h="h-3" />
              </div>
            )}
            {/* tutorial */}
            {tut && (
              <div className="absolute top-2 left-2 max-w-[min(300px,60%)] panel p-3 text-xs anim-slide">
                <div className="flex items-center justify-between gap-2"><span className="text-[#7fe3d4] font-bold">📖 Tutorial {game.tutStep + 1}/{TUTORIAL.length}</span>
                  <button className="btn btn-sm" onClick={() => game.skipTutorial()}>Skip</button></div>
                <div className="font-title font-bold text-sm mt-1">{tut.title}</div>
                <div className="text-stone-300 mt-0.5">{tut.text}</div>
              </div>
            )}
            {/* toasts */}
            <div className="absolute bottom-2 left-2 flex flex-col gap-1 pointer-events-none max-w-[min(420px,70%)]">
              {game.log.filter((l) => now - l.t < 9000).slice(-5).map((l) => (
                <div key={l.id} className="anim-slide text-[11px] sm:text-xs px-2 py-1 rounded-md bg-black/65 border border-white/10" style={{ color: l.color, opacity: Math.max(0.2, 1 - (now - l.t) / 9000) }}>{l.msg}</div>
              ))}
            </div>
            {(game.tool || game.targeting) && (
              <div className="absolute top-2 right-2 px-2 py-1 rounded-md bg-black/70 border border-white/15 text-xs pointer-events-none">
                {game.tool === 'demolish' ? '🔨 Click a building to raze it · Esc to cancel' : game.tool ? `Placing ${BUILDINGS[game.tool].name} · right-click/Esc to cancel` : `Casting ${SPELLS.find((s) => s.id === game.targeting)?.name} · click target`}
              </div>
            )}
          </div>

          {/* ---------------- Build toolbar ---------------- */}
          <div className="panel rounded-none border-x-0 border-b-0 px-2 pt-1 pb-1.5 z-10">
            <div className="h-5 text-[11px] text-stone-400 truncate">{hint || 'Hover a building for details. Select a worker, then click a building to pin them.'}</div>
            <div className="flex gap-1.5 overflow-x-auto scroll pb-1">
              {BUILD_ORDER.map((id, i) => {
                const d = BUILDINGS[id];
                const locked = !game.unlocked(d.unlock);
                const afford = game.canAfford(d.cost);
                const active = game.tool === id;
                return (
                  <button key={id} disabled={false}
                    onPointerEnter={() => setHint(`${d.name}: ${d.desc}${locked ? ' (LOCKED — Dark Arts)' : ''}`)} onPointerLeave={() => setHint('')}
                    onClick={() => { audio.init(); if (locked) { audio.sfx('error'); game.say(`${d.name} is locked — research it in Dark Arts.`, '#ff7a7a'); } else game.selectTool(id); }}
                    className={`relative shrink-0 w-[78px] rounded-lg border px-1 py-1 text-center transition active:scale-95 ${active ? 'bg-[#b78cff]/30 border-[#b78cff] -translate-y-0.5' : 'bg-white/5 border-white/10 hover:bg-white/10'} ${locked ? 'opacity-40' : ''}`}>
                    <span className="absolute top-0.5 left-1 text-[9px] text-stone-500 font-mono">{BUILD_KEYS[i]}</span>
                    <div className="text-xl leading-none">{locked ? '🔒' : d.icon}</div>
                    <div className="text-[10px] leading-tight truncate">{shortName(d.name)}</div>
                    <div className={`text-[9px] leading-tight ${afford ? 'text-stone-400' : 'text-[#ff8f8f]'}`}>{costText(d.cost)}</div>
                  </button>
                );
              })}
              <button onClick={() => game.selectTool('demolish')} onPointerEnter={() => setHint('Demolish: raze a building for a 50% refund (X)')} onPointerLeave={() => setHint('')}
                className={`relative shrink-0 w-[70px] rounded-lg border px-1 py-1 text-center ${game.tool === 'demolish' ? 'bg-[#ff6b81]/30 border-[#ff6b81]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                <span className="absolute top-0.5 left-1 text-[9px] text-stone-500 font-mono">X</span>
                <div className="text-xl leading-none">🔨</div><div className="text-[10px]">Raze</div><div className="text-[9px] text-stone-400">50% back</div>
              </button>
            </div>
          </div>
        </div>

        {/* ---------------- Side panel ---------------- */}
        <div className="panel rounded-none border-y-0 border-r-0 lg:w-80 h-[34vh] lg:h-auto flex flex-col min-h-0 shrink-0">
          <div className="flex border-b border-white/10">
            {([['inspect', '🔍 Inspect'], ['roster', '💀 Roster'], ['rites', '🔮 Rites']] as const).map(([id, n]) => (
              <button key={id} onClick={() => { setTab(id); audio.sfx('click'); }} className={`flex-1 py-1.5 text-xs font-semibold transition ${tab === id ? 'bg-[#b78cff]/25 text-white border-b-2 border-[#b78cff]' : 'text-stone-400 hover:bg-white/5'}`}>{n}</button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-auto scroll p-2.5 text-xs">
            {tab === 'inspect' && <Inspect game={game} />}
            {tab === 'roster' && <Roster game={game} />}
            {tab === 'rites' && <Rites game={game} />}
          </div>
        </div>
      </div>

      {/* ---------------- Overlays ---------------- */}
      {menu === 'pause' && !sub && !end && (
        <Modal onClose={() => setMenu('none')}>
          <h2 className="font-title text-3xl font-bold text-center text-[#b78cff] mb-3">Paused</h2>
          <div className="grid gap-2">
            <button className="btn btn-primary" onClick={() => setMenu('none')}>▶ Resume</button>
            <button className="btn" onClick={() => setSub('settings')}>⚙️ Settings</button>
            <button className="btn" onClick={() => setSub('help')}>❓ How to Play & Controls</button>
            <button className="btn btn-teal" onClick={() => { setConfirmQuit(false); setMenu('none'); if (game.status === 'playing') applyResult(false); onRetry(); }}>🔁 Restart run</button>
            {!confirmQuit ? (
              <button className="btn btn-danger" onClick={() => setConfirmQuit(true)}>🏠 Abandon run…</button>
            ) : (
              <div className="p-2 rounded-lg bg-black/30 border border-[#ff6b81]/40 text-center text-xs">
                Abandon this run{!game.tutorial ? ` and bank ${game.result().shards} 💠?` : '?'}
                <div className="flex gap-2 justify-center mt-2"><button className="btn btn-sm btn-danger" onClick={() => quit(false)}>Yes, to title</button><button className="btn btn-sm" onClick={() => setConfirmQuit(false)}>No</button></div>
              </div>
            )}
          </div>
          <p className="text-[11px] text-stone-500 text-center mt-3">Difficulty: {game.diff.name}{game.mods.size ? ` · ${[...game.mods].join(', ')}` : ''}</p>
        </Modal>
      )}
      {sub === 'settings' && <SettingsPanel save={save} onChange={(s) => { saveRef.current = s; onSave(s); }} onClose={() => setSub(null)} />}
      {sub === 'help' && <Help onClose={() => setSub(null)} />}
      {end && (
        <EndScreen won={end.won} result={end} goal={game.goal} endless={game.endless} tutorial={game.tutorial}
          onContinue={() => { setEnd(null); game.continueEndless(); }}
          onRetry={onRetry} onDark={onDark} onTitle={onTitle} />
      )}
    </div>
  );
}

// ======================= Side panels =======================

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <div className="mb-3"><div className="font-title font-bold text-[13px] text-[#b78cff] mb-1">{title}</div>{children}</div>;
}

function ShiftButtons({ w, game }: { w: Worker; game: Game }) {
  return (
    <div className="flex gap-1">
      {(['day', 'night', 'round'] as Shift[]).map((s) => (
        <button key={s} title={`${SHIFT_META[s].name}: ${SHIFT_META[s].desc}`} onClick={() => game.setShift(w, s)}
          className={`btn btn-sm flex-1 ${w.shift === s ? 'btn-primary' : ''}`}>{SHIFT_META[s].icon}</button>
      ))}
    </div>
  );
}

function Inspect({ game }: { game: Game }) {
  const sel = game.sel;
  if (sel.kind === 'worker') {
    const w = game.wById(sel.id);
    if (!w) return <Empty />;
    const sp = SPECIES[w.species];
    const job = game.bById(w.job);
    const pin = game.bById(w.pin);
    return (
      <div className="anim-fade">
        <div className="flex items-center gap-2 mb-2"><span className="text-3xl">{sp.icon}</span><div><div className="font-title font-bold text-sm">{w.name}</div><div className="text-stone-400">{sp.name} · {STATE_LABEL[w.state] || w.state}</div></div></div>
        <div className="space-y-1.5 mb-2">
          <Meter v={w.integrity} max={w.maxInt} color="linear-gradient(90deg,#ff6b6b,#7bff9e)" label="Integrity" />
          <Meter v={w.morale} max={100} color="linear-gradient(90deg,#ff6b81,#f2c14e,#7fe3d4)" label="Morale" />
        </div>
        <div className="mb-2">Sun/night efficiency now: <b className={w.mult < 0.7 ? 'text-[#ff9a6b]' : w.mult > 1.1 ? 'text-[#7fe3d4]' : ''}>{Math.round(w.mult * 100)}%</b>
          <span className="text-stone-500"> (day ×{sp.day}, night ×{sp.night})</span></div>
        <Section title="Shift"><ShiftButtons w={w} game={game} /><div className="text-stone-500 mt-1">{SHIFT_META[w.shift].icon} {SHIFT_META[w.shift].name}: {SHIFT_META[w.shift].desc}. {game.onShift(w) ? 'On shift now.' : 'Off shift.'}</div></Section>
        <Section title="Assignment">
          <div>{job ? `${job.def.icon} ${job.def.name}` : 'None (idle or resting)'}{pin ? ' · pinned' : ' · auto'}</div>
          {pin ? <button className="btn btn-sm mt-1" onClick={() => game.unpin(w)}>📌 Unpin (auto-assign)</button> : <div className="text-stone-500 mt-1">Click a building on the map to pin this worker to it.</div>}
        </Section>
        <Section title="Skills"><div className="grid grid-cols-3 gap-1">{Object.entries(sp.skills).map(([k, v]) => <div key={k} className="chip justify-between"><span className="capitalize">{k}</span><b>{v}</b></div>)}</div></Section>
        <div className="text-stone-500">Kills: {w.kills}</div>
      </div>
    );
  }
  if (sel.kind === 'building') {
    const b = game.bById(sel.id);
    if (!b) return <Empty />;
    return <BuildingInfo game={game} b={b} />;
  }
  if (sel.kind === 'site') {
    const s = game.sites[sel.id];
    if (!s) return <Empty />;
    return (
      <div className="anim-fade">
        <div className="flex items-center gap-2 mb-2"><span className="text-3xl">{s.state === 'haunted' ? '🕯️' : '✝️'}</span><div className="font-title font-bold text-sm">{s.state === 'haunted' ? 'Haunted Site' : 'Consecrated Ground'}</div></div>
        <p className="text-stone-300 mb-2">{s.state === 'haunted' ? 'Buildings placed here work 40% faster; workers nearby gain Morale. Priests will try to consecrate it — a staffed Ward Obelisk prevents it.' : 'The holy light has burned away the haunting. Workers nearby lose Morale and bonuses are gone.'}</p>
        {s.state === 'haunted' && s.prog > 0 && <Meter v={s.prog} max={1} color="#fff3b0" label="Consecration" />}
        {s.state === 'consecrated' && <button className="btn btn-teal" onClick={() => game.rehaunt(s)}>🕯️ Re-haunt (5 👻)</button>}
      </div>
    );
  }
  return <Empty />;
}

function Empty() {
  return (
    <div className="text-stone-400 space-y-2 anim-fade">
      <div className="font-title font-bold text-sm text-[#b78cff]">Nothing selected</div>
      <p>Click a <b>worker</b> to see their condition and set a shift. Click a <b>building</b> to inspect, repair or (for the Reanimation Pit) queue new undead. Click a <b>haunted site</b> to inspect it.</p>
      <p>With a worker selected, clicking a building <b>pins</b> them to it.</p>
      <p>Press <b>H</b> for the full guide.</p>
    </div>
  );
}

function BuildingInfo({ game, b }: { game: Game; b: Building }) {
  const d = b.def;
  const crew = b.crew.map((id) => game.wById(id)).filter(Boolean) as Worker[];
  const inside = b.inside.map((id) => game.wById(id)).filter(Boolean) as Worker[];
  const repairCost = Math.ceil((b.maxHp - b.hp) / 8);
  const sel = (w: Worker) => { game.sel = { kind: 'worker', id: w.id }; };
  return (
    <div className="anim-fade">
      <div className="flex items-center gap-2 mb-1"><span className="text-3xl">{d.icon}</span><div className="font-title font-bold text-sm">{d.name}</div></div>
      <p className="text-stone-400 mb-2">{d.desc}</p>
      <Meter v={b.hp} max={b.maxHp} color="linear-gradient(90deg,#ff6b6b,#7bff9e)" label="Structure" />
      {b.fire > 0 && <div className="text-[#ff9a3c] mt-1">🔥 On fire!</div>}
      {b.haunt > 1 && <div className="text-[#7fe3d4] mt-1">🕯️ Haunted site bonus: +40% output</div>}
      <div className="flex gap-1 mt-2">
        {b.hp < b.maxHp - 1 && <button className="btn btn-sm" onClick={() => game.repair(b)}>🔧 Repair ({repairCost} 🦴)</button>}
        {d.kind !== 'core' && <button className="btn btn-sm btn-danger" onClick={() => game.demolish(b)}>🔨 Raze</button>}
      </div>
      {d.kind === 'prod' && (
        <Section title="Production">
          <div>{costText(d.inputs) || 'No input'} → <b>{costText(d.outputs)}</b> per {d.cycle}s of work</div>
          <Meter v={b.progress} max={d.cycle} color="#f2c14e" h="h-1.5" />
          <div className="text-stone-500 mt-1">Output rate now: {b.eff.toFixed(2)}× · {b.stalled ? <span className="text-[#ff8f8f]">stalled: {b.stalled}</span> : b.active ? 'working' : 'waiting for crew'}</div>
        </Section>
      )}
      {d.kind === 'turret' && <div className="mt-2 text-stone-400">Range 250 · uses 1 🦴 per 3 shots · {b.warn ? <span className="text-[#ff8f8f]">{b.warn}</span> : 'ready'}</div>}
      {d.kind === 'ward' && <div className="mt-2 text-stone-400">Radius {Math.round(b.radius)} · slows 45% · pulses necrotic damage · 1 👻 per 12s · {b.warn ? <span className="text-[#ff8f8f]">{b.warn}</span> : 'active'}</div>}
      {d.kind === 'aura' && <div className="mt-2 text-stone-400">Raises morale of nearby undead while performed. {b.active ? '🎶 Playing.' : 'Silent — needs a performer.'}</div>}
      {d.kind === 'pit' && (
        <Section title="Reanimation rites">
          <div className="grid grid-cols-1 gap-1 mb-2">
            {SPECIES_ORDER.map((id) => {
              const sp = SPECIES[id];
              const locked = !game.unlocked(sp.unlock);
              return (
                <button key={id} disabled={locked} className="btn btn-sm justify-between" onClick={() => game.queuePit(b, id)} title={sp.desc}>
                  <span>{locked ? '🔒' : sp.icon} {sp.name}</span><span className={game.canAfford(sp.cost) ? 'text-stone-300' : 'text-[#ff8f8f]'}>{costText(sp.cost)}</span>
                </button>
              );
            })}
          </div>
          <div className="text-stone-400 mb-1">Queue ({b.queue.length}/4){b.stalled && b.stalled !== 'idle' ? ` · ${b.stalled}` : ''}</div>
          {b.queue.map((q, i) => (
            <div key={i} className="flex items-center gap-2 mb-1">
              <span>{SPECIES[q].icon} {SPECIES[q].name}</span>
              {i === 0 && <div className="flex-1"><Meter v={b.progress} max={SPECIES[q].raise} color="#b78cff" h="h-1.5" /></div>}
              <button className="btn btn-sm ml-auto" onClick={() => game.cancelPit(b, i)}>✕</button>
            </div>
          ))}
          <div className="text-stone-500">Population {game.pop}/{game.popCap}. Each rite adds Infamy.</div>
        </Section>
      )}
      {(d.kind === 'house' || d.kind === 'core') && (
        <Section title={`Resting (${b.inside.length}/${game.housingOf(b)})`}>
          {inside.length === 0 ? <div className="text-stone-500">Empty. Off-shift undead rest here.</div> : inside.map((w) => <div key={w.id} className="cursor-pointer hover:text-white" onClick={() => sel(w)}>{SPECIES[w.species].icon} {w.name} <span className="text-stone-500">{Math.round(w.integrity)}%</span></div>)}
        </Section>
      )}
      {d.slots > 0 && (
        <Section title={`Crew (${crew.length}/${d.slots})`}>
          {crew.length === 0 ? <div className="text-stone-500">No one assigned. Auto-assignment fills free slots with on-shift workers; or pin a worker.</div> : crew.map((w) => (
            <div key={w.id} className="cursor-pointer hover:text-white flex justify-between" onClick={() => sel(w)}><span>{SPECIES[w.species].icon} {w.name}{w.pin === b.id ? ' 📌' : ''}</span><span className="text-stone-500">skill ×{(SPECIES[w.species].skills[d.skill] * w.mult).toFixed(2)}</span></div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Roster({ game }: { game: Game }) {
  const ws = [...game.workers].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="anim-fade">
      <Section title="Shift schedule">
        <div className="text-stone-400 mb-1">New undead & bulk shift: </div>
        <div className="grid grid-cols-3 gap-1 mb-1">
          {(['day', 'night', 'round'] as Shift[]).map((s) => <button key={s} className={`btn btn-sm ${game.defaultShift === s ? 'btn-primary' : ''}`} onClick={() => game.setAllShift(s)} title={`Set ALL workers to ${SHIFT_META[s].name}`}>{SHIFT_META[s].icon} All</button>)}
        </div>
        <button className="btn btn-sm btn-teal w-full" onClick={() => game.smartSchedule()}>🧠 Smart schedule (by species affinity)</button>
        <div className="text-stone-500 mt-1">☀️ Dayside works dawn & day · 🌙 Nightside works dusk & night · ⏳ Round-the-clock never rests but wears out fast.</div>
      </Section>
      <Section title={`Workers ${game.pop}/${game.popCap}`}>
        {ws.length === 0 && <div className="text-stone-500">No undead left! Raise more at a Reanimation Pit.</div>}
        <div className="space-y-1.5">
          {ws.map((w) => {
            const sp = SPECIES[w.species];
            const selected = game.sel.kind === 'worker' && game.sel.id === w.id;
            return (
              <div key={w.id} className={`p-1.5 rounded-lg border ${selected ? 'border-[#b78cff] bg-[#b78cff]/15' : 'border-white/10 bg-white/5'}`}>
                <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => { game.sel = { kind: 'worker', id: w.id }; audio.sfx('select'); }}>
                  <span className="text-lg">{sp.icon}</span>
                  <div className="flex-1 min-w-0"><div className="truncate font-semibold">{w.name}{w.pin != null ? ' 📌' : ''}</div><div className="text-[10px] text-stone-500">{w.inside != null ? 'Resting in crypt' : STATE_LABEL[w.state] || w.state}{w.repairing ? ' · repairing' : ''}</div></div>
                  <div className="w-14 space-y-1"><Meter v={w.integrity} max={w.maxInt} color="#7bff9e" h="h-1" /><Meter v={w.morale} max={100} color="#f2c14e" h="h-1" /></div>
                </div>
                <div className="mt-1"><ShiftButtons w={w} game={game} /></div>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function Rites({ game }: { game: Game }) {
  const raids = game.raids.filter((r) => !r.spawned);
  return (
    <div className="anim-fade">
      <Section title="Rites (spells)">
        <div className="space-y-1.5">
          {SPELLS.map((s) => {
            const locked = !game.unlocked(s.unlock);
            const cd = game.spellCd[s.id] || 0;
            const ready = game.spellReady(s.id);
            const active = game.targeting === s.id;
            return (
              <button key={s.id} onClick={() => game.beginSpell(s.id)} className={`w-full text-left p-2 rounded-lg border relative overflow-hidden transition active:scale-[0.98] ${active ? 'border-[#b78cff] bg-[#b78cff]/25' : ready ? 'border-white/20 bg-white/5 hover:bg-white/10' : 'border-white/10 bg-white/5 opacity-60'}`}>
                {cd > 0 && <div className="absolute inset-y-0 left-0 bg-black/55" style={{ width: `${(cd / (s.cd * (1 - 0.08 * game.lv('mastery')))) * 100}%` }} />}
                <div className="relative flex items-center gap-2">
                  <span className="text-xl">{locked ? '🔒' : s.icon}</span>
                  <div className="flex-1"><div className="font-semibold">{s.name} <kbd className="text-[10px] px-1 rounded bg-white/10">{s.key.toUpperCase()}</kbd></div><div className="text-[10px] text-stone-400">{locked ? 'Locked — Dark Arts' : s.desc}</div></div>
                  <div className="text-[11px] text-right"><div>{costText(game.spellCost(s.id))}</div><div className="text-stone-500">{cd > 0 ? `${Math.ceil(cd)}s` : `${s.cd}s cd`}</div></div>
                </div>
              </button>
            );
          })}
        </div>
      </Section>
      <Section title="Infamy">
        <Meter v={game.infamy} max={100} color="linear-gradient(90deg,#f2c14e,#ff6b81)" />
        <div className="text-stone-500 my-1">Raid size ×{(1 + (game.infamy / 100) * 0.7).toFixed(2)}{game.infamy >= 75 ? ' · extra Paladin' : ''}. Decays slowly.</div>
        <button className="btn btn-sm w-full" disabled={game.bribeCd > 0} onClick={() => game.bribe()}>🪙 Bribe the Bishop (B) — 80 🪙 → −30 Infamy{game.bribeCd > 0 ? ` (${Math.ceil(game.bribeCd)}s)` : ''}</button>
      </Section>
      <Section title="Raid intelligence">
        {raids.length === 0 ? <div className="text-stone-500">No raids scheduled yet.</div> : raids.map((r, i) => {
          const counts: Record<string, number> = {};
          r.units.forEach((u) => { counts[u] = (counts[u] || 0) + 1; });
          if (r.boss) counts[r.boss] = 1;
          return (
            <div key={i} className="p-2 rounded-lg bg-white/5 border border-white/10 mb-1.5">
              <div className="font-semibold" style={{ color: r.team === 'zealot' ? '#ffd36b' : '#7bff9e' }}>{r.label} · in {Math.max(0, Math.ceil(r.spawnAt - game.time))}s</div>
              <div className="flex flex-wrap gap-1 mt-1">{Object.entries(counts).map(([id, n]) => <span key={id} className="chip" title={ENEMIES[id].desc}>{ENEMIES[id].icon}×{n}</span>)}</div>
              <div className="text-stone-500 text-[10px] mt-1">From: {r.sides.map((s) => ({ W: 'west', E: 'east', N: 'north', S: 'south' } as Record<string, string>)[s.dir]).join(' & ')}</div>
            </div>
          );
        })}
        <div className="text-stone-500 text-[10px]">Day length {DAY_LEN}s at 1×. Zealots strike at midday (+sunlit fervour); rivals after dusk.</div>
      </Section>
    </div>
  );
}
