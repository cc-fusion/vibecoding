import { useCallback, useEffect, useRef, useState } from 'react';
import { GameEngine, GameState } from './game/engine';
import { BLOCKS, ITEMS, RECIPES, PLACEABLE } from './game/blocks';

type Screen = 'menu' | 'playing' | 'paused' | 'dead' | 'help' | 'settings';

interface Toast { id: number; msg: string; icon: string; }
interface Settings { fov: number; sensitivity: number; renderDist: number; volume: number; muted: boolean; }

const SAVE_KEY = 'voxelcraft_save_v1';
const MOD_KEY = 'voxelcraft_mods_v1';

function itemLabel(id: string): string {
  if (id.startsWith('b')) return BLOCKS[parseInt(id.slice(1))]?.name ?? id;
  return ITEMS[id]?.name ?? id;
}
function itemIcon(id: string): string {
  if (id.startsWith('b')) return '🧊';
  return ITEMS[id]?.icon ?? '📦';
}
function itemColor(id: string): string {
  if (id.startsWith('b')) {
    const c = BLOCKS[parseInt(id.slice(1))]?.color ?? 0xffffff;
    return '#' + c.toString(16).padStart(6, '0');
  }
  return ITEMS[id]?.color ?? '#fff';
}
function fmtTime(t: number) {
  const h = Math.floor(((t / 24000) * 24 + 6) % 24);
  const m = Math.floor((((t / 24000) * 24 + 6) % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function biomeName(engine: GameEngine | null): string {
  if (!engine) return '—';
  try { return engine.world.getBiome(Math.floor(engine.pos.x), Math.floor(engine.pos.z)); } catch { return '—'; }
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const [screen, setScreen] = useState<Screen>('menu');
  const [seedInput, setSeedInput] = useState('');
  const [activeSeed, setActiveSeed] = useState<number>(() => Math.floor(Math.random() * 900000) + 100000);
  const [state, setState] = useState<GameState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showInventory, setShowInventory] = useState(false);
  const [settings, setSettings] = useState<Settings>({ fov: 75, sensitivity: 0.0022, renderDist: 6, volume: 0.7, muted: false });
  const [fps, setFps] = useState(0);
  const [lookBlock, setLookBlock] = useState('');
  const [giveSearch, setGiveSearch] = useState('');
  const [hasSave, setHasSave] = useState(false);
  const [saveInfo, setSaveInfo] = useState('');
  const [tab, setTab] = useState<'inventory' | 'crafting' | 'stats' | 'cheats'>('inventory');
  const [locked, setLocked] = useState(false);
  const toastId = useRef(0);
  const screenRef = useRef<Screen>('menu');
  screenRef.current = screen;
  const invRef = useRef(false);
  invRef.current = showInventory;

  const pushToast = useCallback((msg: string, icon = '✨') => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-4), { id, msg, icon }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  // check save
  useEffect(() => {
    try {
      const s = localStorage.getItem(SAVE_KEY);
      if (s) {
        const parsed = JSON.parse(s);
        setHasSave(true);
        setSaveInfo(`Seed ${parsed.seed} • Level ${parsed.level} • ${Object.keys(parsed.inventory ?? {}).length} item types • ${new Date(parsed.savedAt ?? Date.now()).toLocaleDateString()}`);
        setActiveSeed(parsed.seed ?? activeSeed);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startGame = useCallback((seed: number, loadSave: boolean) => {
    if (!containerRef.current) return;
    if (engineRef.current) { engineRef.current.dispose(); engineRef.current = null; }
    let saved: Partial<GameState> | null = null;
    let mods: Record<string, number> | null = null;
    if (loadSave) {
      try {
        const s = localStorage.getItem(SAVE_KEY);
        if (s) saved = JSON.parse(s);
        const m = localStorage.getItem(MOD_KEY);
        if (m) mods = JSON.parse(m);
      } catch { /* ignore */ }
    }
    const engine = new GameEngine(containerRef.current, seed, saved, {
      onState: (s) => setState((prev) => ({ ...(prev as GameState), ...s } as GameState)),
      onToast: pushToast,
      onDeath: () => { document.exitPointerLock(); setScreen('dead'); },
      onPickup: (item, count) => pushToast(`+${count} ${itemLabel(item)}`, itemIcon(item)),
    });
    engineRef.current = engine;
    engine.setFov(settings.fov);
    engine.setSensitivity(settings.sensitivity);
    engine.setRenderDist(settings.renderDist);
    engine.sound.setVolume(settings.volume);
    engine.sound.setMuted(settings.muted);
    if (mods) {
      engine.world.modified = new Map(Object.entries(mods));
      for (const [k, v] of Object.entries(mods)) {
        const [x, y, z] = k.split(',').map(Number);
        const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
        const chunk = engine.world.chunks.get(engine.world.key(cx, cz));
        if (chunk) chunk.set(x - cx * 16, y, z - cz * 16, v);
      }
      for (const [, c] of engine.world.chunks) c.dirty = true;
      engine.updateChunks(true);
    }
    setActiveSeed(seed);
    setScreen('playing');
    setShowInventory(false);
    engine.lockPointer();
    setTimeout(() => { if (document.pointerLockElement == null && screenRef.current === 'playing') engine.lockPointer(); }, 400);
  }, [pushToast, settings]);

  // save loop
  useEffect(() => {
    const id = setInterval(() => {
      const e = engineRef.current;
      if (!e) return;
      try {
        const snap = e.getSnapshot();
        localStorage.setItem(SAVE_KEY, JSON.stringify({ ...snap, savedAt: Date.now() }));
        localStorage.setItem(MOD_KEY, JSON.stringify(Object.fromEntries(e.world.modified)));
        setHasSave(true);
      } catch { /* ignore */ }
    }, 4000);
    return () => clearInterval(id);
  }, []);

  // pointer lock / pause handling + inventory keys
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.code === 'KeyE' && screenRef.current === 'playing') {
        ev.preventDefault();
        setShowInventory((v) => !v);
        setTab('inventory');
        if (!showInventory) engineRef.current?.unlockPointer();
        else engineRef.current?.lockPointer();
      }
      if (ev.code === 'KeyT' && screenRef.current === 'playing') {
        ev.preventDefault();
        setShowInventory((v) => !v);
        setTab('crafting');
        if (!showInventory) engineRef.current?.unlockPointer();
        else engineRef.current?.lockPointer();
      }
      if (ev.code === 'Escape' && screenRef.current === 'playing' && !showInventory) {
        // pointer lock exit triggers pause via pointerlockchange
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showInventory]);

  useEffect(() => {
    const onLock = () => {
      const isLocked = document.pointerLockElement != null;
      setLocked(isLocked);
      if (!isLocked && screenRef.current === 'playing' && !invRef.current) {
        setScreen('paused');
        engineRef.current?.setPaused(true);
      }
      if (isLocked && screenRef.current === 'paused') {
        setScreen('playing');
        engineRef.current?.setPaused(false);
      }
    };
    document.addEventListener('pointerlockchange', onLock);
    return () => document.removeEventListener('pointerlockchange', onLock);
  }, []);

  // FPS + HUD poll + minimap
  useEffect(() => {
    let frames = 0; let last = performance.now();
    let raf = 0;
    const tick = () => {
      frames++;
      const now = performance.now();
      if (now - last >= 500) { setFps(Math.round((frames * 1000) / (now - last))); frames = 0; last = now; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const poll = setInterval(() => {
      const e = engineRef.current;
      if (!e) return;
      const hit = e.raycast();
      setLookBlock(hit ? (BLOCKS[hit.block]?.name ?? '') : '');
      // minimap
      const cv = minimapRef.current;
      if (cv) {
        const ctx = cv.getContext('2d');
        if (ctx) {
          const S = cv.width;
          const px = Math.floor(e.pos.x), pz = Math.floor(e.pos.z);
          const range = 48;
          const img = ctx.createImageData(S, S);
          for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
            const wx = px + Math.floor(((sx / S) - 0.5) * range * 2);
            const wz = pz + Math.floor(((sy / S) - 0.5) * range * 2);
            const h = e.world.getHeight(wx, wz);
            const b = e.world.getBlock(wx, h, wz);
            const col = BLOCKS[b]?.color ?? 0x3a7a2a;
            const r = (col >> 16) & 255, g = (col >> 8) & 255, bl = col & 255;
            const i = (sy * S + sx) * 4;
            img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = bl; img.data[i + 3] = 255;
          }
          ctx.putImageData(img, 0, 0);
          ctx.fillStyle = '#fff';
          ctx.fillRect(S / 2 - 1, S / 2 - 1, 3, 3);
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
        }
      }
    }, 400);
    return () => { cancelAnimationFrame(raf); clearInterval(poll); };
  }, []);

  const resume = () => { setScreen('playing'); engineRef.current?.setPaused(false); engineRef.current?.lockPointer(); };
  const quitToMenu = () => {
    const e = engineRef.current;
    if (e) {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({ ...e.getSnapshot(), savedAt: Date.now() }));
        localStorage.setItem(MOD_KEY, JSON.stringify(Object.fromEntries(e.world.modified)));
      } catch { /* ignore */ }
      e.dispose(); engineRef.current = null;
    }
    setScreen('menu'); setShowInventory(false);
  };
  const newWorld = () => {
    const seed = seedInput.trim() ? Math.abs([...seedInput.trim()].reduce((a, c) => a * 31 + c.charCodeAt(0), 0)) % 900000 + 100000 : Math.floor(Math.random() * 900000) + 100000;
    localStorage.removeItem(SAVE_KEY); localStorage.removeItem(MOD_KEY);
    startGame(seed, false);
  };
  const continueWorld = () => {
    try {
      const s = localStorage.getItem(SAVE_KEY);
      if (s) { const p = JSON.parse(s); startGame(p.seed, true); return; }
    } catch { /* ignore */ }
    startGame(activeSeed, false);
  };

  const applySettings = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    const e = engineRef.current;
    if (e) {
      e.setFov(next.fov); e.setSensitivity(next.sensitivity); e.setRenderDist(next.renderDist);
      e.sound.setVolume(next.volume); e.sound.setMuted(next.muted);
    }
  };

  const craft = (recipe: (typeof RECIPES)[number]) => {
    const e = engineRef.current;
    if (!e) return;
    const inv = e.inventory;
    for (const [k, v] of Object.entries(recipe.inputs)) {
      if ((inv[k] ?? 0) < v) return;
    }
    for (const [k, v] of Object.entries(recipe.inputs)) e.consumeItem(k, v);
    e.addItem(recipe.output, recipe.count);
    e.sound.craft();
    pushToast(`Crafted ${recipe.count}× ${itemLabel(recipe.output)}`, itemIcon(recipe.output));
  };
  const canCraft = (recipe: (typeof RECIPES)[number]) => {
    const inv = engineRef.current?.inventory ?? {};
    return Object.entries(recipe.inputs).every(([k, v]) => (inv[k] ?? 0) >= v);
  };

  const assignHotbar = (item: string) => {
    const e = engineRef.current;
    if (!e || !state) return;
    e.hotbar[state.selected] = item;
    e.updateHand();
    e.emitState();
    pushToast(`${itemLabel(item)} → slot ${state.selected + 1}`, itemIcon(item));
  };

  const allItems = [...PLACEABLE.map((b) => `b${b}`), ...Object.keys(ITEMS)];
  const invEntries = Object.entries(state?.inventory ?? {}).sort((a, b) => itemLabel(a[0]).localeCompare(itemLabel(b[0])));
  const filteredGive = allItems.filter((i) => itemLabel(i).toLowerCase().includes(giveSearch.toLowerCase())).slice(0, 60);

  const hearts = state ? Math.ceil(state.health / 2) : 10;
  const hungerIcons = state ? Math.ceil(state.hunger / 2) : 10;
  const xpPct = state ? Math.min(100, (state.xp / (7 + state.level * 2)) * 100) : 0;
  const compass = state ? ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((((-state.yaw) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8] : 'N';

  return (
    <div className="fixed inset-0 overflow-hidden bg-black font-mono select-none">
      <div ref={containerRef} className="absolute inset-0" onClick={() => { if (screen === 'playing' && !showInventory && document.pointerLockElement == null) engineRef.current?.lockPointer(); }} />
      {screen === 'playing' && !showInventory && !locked && (
        <button onClick={() => engineRef.current?.lockPointer()} className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded bg-green-600 px-6 py-3 font-bold text-white shadow-xl hover:bg-green-500">▶ Click to Play</button>
      )}

      {/* ---------- HUD ---------- */}
      {screen === 'playing' && state && (
        <>
          {/* crosshair */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
            <div className="relative h-6 w-6">
              <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-white/90 mix-blend-difference" />
              <div className="absolute top-1/2 left-0 w-full h-[2px] -translate-y-1/2 bg-white/90 mix-blend-difference" />
            </div>
          </div>
          {/* look block */}
          {lookBlock && (
            <div className="pointer-events-none absolute left-1/2 top-[54%] z-20 -translate-x-1/2 rounded bg-black/60 px-3 py-1 text-xs text-white border border-white/20">
              {lookBlock}
            </div>
          )}
          {/* top-left info */}
          <div className="pointer-events-none absolute left-3 top-3 z-20 space-y-1 text-[11px] leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            <div className="rounded bg-black/45 px-2 py-1 backdrop-blur-sm">
              <div>XYZ: {state.pos.map((n) => n.toFixed(1)).join(' / ')}</div>
              <div>Biome: <span className="capitalize">{biomeName(engineRef.current)}</span> • {fmtTime(state.time)} {state.time > 6000 && state.time < 18000 ? '☀️' : '🌙'}</div>
              <div>Weather: {state.weather === 'clear' ? '☀️ Clear' : state.weather === 'rain' ? '🌧️ Rain' : '⛈️ Storm'} • {fps} FPS • Seed {state.seed}</div>
              <div>Compass: {compass} • {state.fly ? '🕊️ Flying' : '🚶 Walking'}</div>
            </div>
          </div>
          {/* minimap */}
          <div className="pointer-events-none absolute right-3 top-3 z-20">
            <canvas ref={minimapRef} width={120} height={120} className="rounded border-2 border-white/30 shadow-lg" />
            <div className="mt-1 text-center text-[10px] text-white/90 drop-shadow">Map • {compass}</div>
          </div>
          {/* toasts */}
          <div className="pointer-events-none absolute right-3 top-36 z-30 flex w-64 flex-col gap-1">
            {toasts.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded border border-white/20 bg-black/70 px-3 py-2 text-xs text-white backdrop-blur animate-[slideIn_0.2s_ease]">
                <span className="text-base">{t.icon}</span><span>{t.msg}</span>
              </div>
            ))}
          </div>
          {/* bottom HUD */}
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
            <div className="mb-1 flex items-end justify-between px-1">
              <div className="flex gap-[2px] text-base leading-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
                {Array.from({ length: 10 }).map((_, i) => (
                  <span key={i} className={i < hearts ? '' : 'opacity-30 grayscale'}>❤️</span>
                ))}
              </div>
              <div className="flex gap-[2px] text-base leading-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
                {Array.from({ length: 10 }).map((_, i) => (
                  <span key={i} className={i < hungerIcons ? '' : 'opacity-30 grayscale'}>🍗</span>
                ))}
              </div>
            </div>
            {/* xp bar */}
            <div className="mx-auto mb-1 h-[6px] w-[340px] overflow-hidden rounded-full border border-black/60 bg-black/60">
              <div className="h-full bg-gradient-to-r from-lime-400 to-green-500 transition-all" style={{ width: `${xpPct}%` }} />
            </div>
            <div className="mb-1 text-center text-xs font-bold text-lime-300 drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">Level {state.level}</div>
            {/* hotbar */}
            <div className="flex gap-1 rounded-lg border-2 border-black/70 bg-black/50 p-1 backdrop-blur-sm">
              {state.hotbar.map((item, i) => (
                <button
                  key={i}
                  onClick={() => engineRef.current?.selectSlot(i)}
                  className={`pointer-events-auto relative flex h-12 w-12 items-center justify-center rounded border-2 text-xl transition ${state.selected === i ? 'border-white bg-white/25 scale-105' : 'border-white/25 bg-black/40 hover:bg-white/10'}`}
                  title={item ? itemLabel(item) : 'Empty'}
                >
                  {item ? (
                    <>
                      <span style={{ filter: `drop-shadow(0 2px 2px rgba(0,0,0,0.8))` }}>{itemIcon(item)}</span>
                      <span className="absolute bottom-0 right-0 rounded bg-black/70 px-1 text-[10px] text-white">{state.inventory[item] ?? 0}</span>
                      <span className="absolute inset-0 rounded-sm" style={{ background: `linear-gradient(135deg, ${itemColor(item)}33, transparent)` }} />
                    </>
                  ) : <span className="text-white/20 text-xs">{i + 1}</span>}
                </button>
              ))}
            </div>
            <div className="mt-1 text-center text-[11px] text-white/80 drop-shadow">
              {state.hotbar[state.selected] ? itemLabel(state.hotbar[state.selected]!) : 'Empty hand'} • E Inventory • T Crafting • F Fly • Q Drop • R Eat
            </div>
          </div>
        </>
      )}

      {/* ---------- Inventory / Crafting overlay ---------- */}
      {showInventory && screen === 'playing' && state && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { setShowInventory(false); engineRef.current?.lockPointer(); }}>
          <div className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-xl border-2 border-[#5a4a2a] bg-[#c6c6c6] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b-2 border-[#8a8a8a] bg-[#a8a8a8] px-4 py-2">
              <div className="flex gap-1">
                {(['inventory', 'crafting', 'stats', 'cheats'] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)} className={`rounded px-3 py-1 text-sm font-bold capitalize ${tab === t ? 'bg-[#5a4a2a] text-white' : 'bg-[#d6d6d6] text-black hover:bg-white'}`}>
                    {t === 'inventory' ? '🎒 Inventory' : t === 'crafting' ? '🔨 Crafting' : t === 'stats' ? '📊 Stats' : '⚡ Cheats'}
                  </button>
                ))}
              </div>
              <button onClick={() => { setShowInventory(false); engineRef.current?.lockPointer(); }} className="rounded bg-red-600 px-3 py-1 text-sm font-bold text-white hover:bg-red-500">✕ Close (E)</button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-4 bg-[#c6c6c6]">
              {tab === 'inventory' && (
                <div>
                  <p className="mb-2 text-xs text-[#3a3a3a]">Click an item to assign it to the selected hotbar slot ({state.selected + 1}). Scroll / 1-9 to change slot. You have {invEntries.length} item types.</p>
                  {invEntries.length === 0 ? <p className="text-sm text-[#555]">Your inventory is empty. Punch trees and mine stone!</p> : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                      {invEntries.map(([id, count]) => (
                        <button key={id} onClick={() => assignHotbar(id)} className="group relative flex flex-col items-center rounded border-2 border-[#8a8a8a] bg-[#a8a8a8] p-2 hover:border-white hover:bg-[#b8b8b8]" title={`${itemLabel(id)} ×${count} — click to equip`}>
                          <span className="text-2xl">{itemIcon(id)}</span>
                          <span className="mt-1 line-clamp-2 text-center text-[10px] leading-tight text-black">{itemLabel(id)}</span>
                          <span className="absolute right-1 top-1 rounded bg-black/70 px-1 text-[10px] text-white">{count}</span>
                          <span className="absolute inset-0 rounded-sm opacity-20" style={{ background: itemColor(id) }} />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-4">
                    <h3 className="mb-2 text-sm font-bold text-black">Hotbar (click to select)</h3>
                    <div className="flex gap-1">
                      {state.hotbar.map((item, i) => (
                        <button key={i} onClick={() => engineRef.current?.selectSlot(i)} className={`flex h-12 w-12 items-center justify-center rounded border-2 text-xl ${state.selected === i ? 'border-[#5a4a2a] bg-white' : 'border-[#8a8a8a] bg-[#a8a8a8]'}`}>
                          {item ? itemIcon(item) : <span className="text-xs text-[#666]">{i + 1}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {tab === 'crafting' && (
                <div>
                  <p className="mb-2 text-xs text-[#3a3a3a]">Craft tools, food, armor and blocks. Green = you have the ingredients.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {RECIPES.map((r) => {
                      const ok = canCraft(r);
                      return (
                        <div key={r.id} className={`flex items-center justify-between rounded border-2 p-2 ${ok ? 'border-green-700 bg-[#d8e8c8]' : 'border-[#8a8a8a] bg-[#b8b8b8] opacity-80'}`}>
                          <div className="flex items-center gap-2">
                            <span className="flex h-10 w-10 items-center justify-center rounded bg-white text-xl border border-[#8a8a8a]">{itemIcon(r.output)}</span>
                            <div>
                              <div className="text-xs font-bold text-black">{r.count}× {itemLabel(r.output)}</div>
                              <div className="text-[10px] text-[#444]">{Object.entries(r.inputs).map(([k, v]) => `${v}× ${itemLabel(k)}`).join(' + ')}</div>
                            </div>
                          </div>
                          <button disabled={!ok} onClick={() => craft(r)} className={`rounded px-3 py-1 text-xs font-bold ${ok ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-[#888] text-white cursor-not-allowed'}`}>Craft</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {tab === 'stats' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm text-black">
                  {[
                    ['❤️ Health', `${state.health}/20`], ['🍗 Hunger', `${state.hunger}/20`],
                    ['✨ Level', `${state.level} (${state.xp} XP)`], ['⛏️ Blocks mined', `${state.blocksMined}`],
                    ['🧱 Blocks placed', `${state.blocksPlaced}`], ['⚔️ Mobs killed', `${state.kills}`],
                    ['👣 Distance', `${state.distance} m`], ['💀 Deaths', `${state.deaths}`],
                    ['🌍 Seed', `${state.seed}`], ['📍 Position', state.pos.map((n) => n.toFixed(0)).join(', ')],
                    ['🕐 Time', fmtTime(state.time)], ['🌦️ Weather', state.weather],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded border-2 border-[#8a8a8a] bg-[#b8b8b8] p-3"><div className="text-xs text-[#555]">{k}</div><div className="text-lg font-bold">{v}</div></div>
                  ))}
                </div>
              )}
              {tab === 'cheats' && (
                <div>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button onClick={() => { engineRef.current?.heal(); pushToast('Healed!', '❤️'); }} className="rounded bg-green-600 px-3 py-1 text-xs font-bold text-white">❤️ Heal & Feed</button>
                    <button onClick={() => { engineRef.current?.setTime(6000); pushToast('Set to morning', '☀️'); }} className="rounded bg-amber-600 px-3 py-1 text-xs font-bold text-white">☀️ Set Day</button>
                    <button onClick={() => { engineRef.current?.setTime(18000); pushToast('Set to night', '🌙'); }} className="rounded bg-indigo-600 px-3 py-1 text-xs font-bold text-white">🌙 Set Night</button>
                    <button onClick={() => { engineRef.current?.teleport(engineRef.current.pos.x, 60, engineRef.current.pos.z); pushToast('Teleported up', '🕊️'); }} className="rounded bg-sky-600 px-3 py-1 text-xs font-bold text-white">🕊️ Teleport Up</button>
                  </div>
                  <input value={giveSearch} onChange={(e) => setGiveSearch(e.target.value)} placeholder="Search items to give…" className="mb-2 w-full rounded border-2 border-[#8a8a8a] bg-white px-3 py-2 text-sm text-black outline-none" />
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {filteredGive.map((id) => (
                      <button key={id} onClick={() => { engineRef.current?.giveItem(id, id.startsWith('b') ? 16 : 1); pushToast(`+1 ${itemLabel(id)}`, itemIcon(id)); }} className="flex flex-col items-center rounded border-2 border-[#8a8a8a] bg-[#a8a8a8] p-2 hover:bg-white" title={`Give ${itemLabel(id)}`}>
                        <span className="text-xl">{itemIcon(id)}</span><span className="mt-1 text-[9px] leading-tight text-black text-center">{itemLabel(id)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- Pause ---------- */}
      {screen === 'paused' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border-2 border-white/20 bg-[#1a1a1a]/95 p-6 text-center shadow-2xl">
            <h2 className="mb-1 text-3xl font-black tracking-widest text-white">PAUSED</h2>
            <p className="mb-4 text-xs text-white/60">VoxelCraft • Seed {state?.seed ?? activeSeed}</p>
            <div className="space-y-2">
              <button onClick={resume} className="w-full rounded bg-green-600 py-3 font-bold text-white hover:bg-green-500">▶ Back to Game</button>
              <button onClick={() => setScreen('settings')} className="w-full rounded bg-[#3a3a3a] py-3 font-bold text-white hover:bg-[#4a4a4a]">⚙️ Settings</button>
              <button onClick={() => setScreen('help')} className="w-full rounded bg-[#3a3a3a] py-3 font-bold text-white hover:bg-[#4a4a4a]">❓ How to Play</button>
              <button onClick={quitToMenu} className="w-full rounded bg-red-700 py-3 font-bold text-white hover:bg-red-600">💾 Save & Quit to Menu</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-1 text-left text-[11px] text-white/70">
              <span>WASD Move</span><span>Mouse Look</span><span>Space Jump / Swim</span><span>Shift Sprint / Fly down</span>
              <span>LMB Break / Attack</span><span>RMB Place / Eat</span><span>E Inventory</span><span>T Crafting</span>
              <span>F Toggle Fly</span><span>Q Drop</span><span>R Eat food</span><span>1-9 Hotbar</span>
              <span>MMB Pick block</span><span>Esc Pause</span>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Death ---------- */}
      {screen === 'dead' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-red-950/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="mb-2 text-6xl">💀</div>
            <h2 className="mb-2 text-4xl font-black text-red-400">YOU DIED!</h2>
            <p className="mb-6 text-white/80">You have died {state?.deaths ?? 1} times. Your items are safe — respawn and keep going!</p>
            <button onClick={() => { setScreen('playing'); engineRef.current?.setPaused(false); engineRef.current?.lockPointer(); }} className="rounded bg-green-600 px-8 py-3 text-lg font-bold text-white hover:bg-green-500">↻ Respawn</button>
          </div>
        </div>
      )}

      {/* ---------- Settings ---------- */}
      {screen === 'settings' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border-2 border-white/20 bg-[#1a1a1a] p-6 shadow-2xl">
            <h2 className="mb-4 text-2xl font-black text-white">⚙️ Settings</h2>
            <div className="space-y-4 text-sm text-white">
              <label className="block">FOV: {settings.fov}°<input type="range" min={60} max={110} value={settings.fov} onChange={(e) => applySettings({ fov: Number(e.target.value) })} className="w-full accent-green-500" /></label>
              <label className="block">Mouse Sensitivity: {settings.sensitivity.toFixed(4)}<input type="range" min={0.0008} max={0.005} step={0.0002} value={settings.sensitivity} onChange={(e) => applySettings({ sensitivity: Number(e.target.value) })} className="w-full accent-green-500" /></label>
              <label className="block">Render Distance: {settings.renderDist} chunks<input type="range" min={3} max={8} value={settings.renderDist} onChange={(e) => applySettings({ renderDist: Number(e.target.value) })} className="w-full accent-green-500" /></label>
              <label className="block">Volume: {Math.round(settings.volume * 100)}%<input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(e) => applySettings({ volume: Number(e.target.value) })} className="w-full accent-green-500" /></label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={settings.muted} onChange={(e) => applySettings({ muted: e.target.checked })} className="h-4 w-4 accent-red-500" /> Mute audio</label>
            </div>
            <div className="mt-6 flex gap-2">
              <button onClick={() => setScreen(engineRef.current ? 'paused' : 'menu')} className="flex-1 rounded bg-green-600 py-2 font-bold text-white hover:bg-green-500">Done</button>
              <button onClick={() => { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(MOD_KEY); setHasSave(false); pushToast('Save deleted', '🗑️'); }} className="rounded bg-red-700 px-4 py-2 font-bold text-white hover:bg-red-600">Delete Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Help ---------- */}
      {screen === 'help' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border-2 border-white/20 bg-[#1a1a1a] p-6 text-white shadow-2xl">
            <h2 className="mb-3 text-2xl font-black">❓ How to Play</h2>
            <div className="space-y-3 text-sm leading-relaxed text-white/85">
              <p><b className="text-green-400">Goal:</b> Explore infinite procedural worlds, mine resources, craft tools & armor, build anything, survive the night.</p>
              <p><b className="text-green-400">Mine:</b> Hold Left-Click to break blocks. Different tools mine faster (pickaxe→stone/ores, axe→wood, shovel→dirt/sand). Ores drop coal, iron, gold, diamonds & more.</p>
              <p><b className="text-green-400">Build:</b> Right-Click to place the selected block. Middle-Click picks the block you're looking at.</p>
              <p><b className="text-green-400">Craft:</b> Press T for 80+ recipes — planks, sticks, torches, tools, armor, food, TNT, buckets and more. Press E for inventory.</p>
              <p><b className="text-green-400">Survive:</b> Eat food (R) to restore hunger, which regenerates health. Zombies & skeletons burn in daylight; creepers explode! Build a shelter before nightfall.</p>
              <p><b className="text-green-400">Explore:</b> Find houses, desert pyramids (with TNT treasure!), igloos and ruins. Dive for prismarine, dig deep for diamonds (y&lt;16).</p>
              <p><b className="text-green-400">Fly:</b> Press F to toggle flight (Space up, Shift/C down). Your world auto-saves every few seconds.</p>
            </div>
            <button onClick={() => setScreen(engineRef.current ? 'paused' : 'menu')} className="mt-5 w-full rounded bg-green-600 py-2 font-bold text-white hover:bg-green-500">Got it!</button>
          </div>
        </div>
      )}

      {/* ---------- Main Menu ---------- */}
      {screen === 'menu' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-sky-400 via-sky-300 to-green-300">
          {/* animated voxel bg */}
          <div className="pointer-events-none absolute inset-0 opacity-30">
            <div className="absolute bottom-0 left-0 right-0 h-40 bg-[repeating-linear-gradient(90deg,#5fae3f_0_40px,#4f9a34_40px_80px)]" />
            <div className="absolute bottom-40 left-10 h-24 w-24 rounded bg-[#6b4f2a] shadow-xl animate-bounce" />
            <div className="absolute bottom-52 right-16 h-16 w-16 rounded bg-[#b08a4f] shadow-xl animate-pulse" />
            <div className="absolute top-16 left-1/4 h-10 w-32 rounded bg-white/80" />
            <div className="absolute top-24 right-1/4 h-8 w-24 rounded bg-white/70" />
          </div>
          <div className="relative z-10 w-full max-w-md px-4 text-center">
            <div className="mb-1 flex justify-center gap-1 text-4xl">
              <span className="inline-block h-12 w-12 rounded border-2 border-black/30 bg-[#5fae3f] shadow-lg" style={{ transform: 'rotate(-6deg)' }}>🌱</span>
              <span className="inline-block h-12 w-12 rounded border-2 border-black/30 bg-[#7d7d7d] shadow-lg" style={{ transform: 'rotate(4deg)' }}>⛏️</span>
              <span className="inline-block h-12 w-12 rounded border-2 border-black/30 bg-[#5fe8e0] shadow-lg" style={{ transform: 'rotate(-3deg)' }}>💎</span>
            </div>
            <h1 className="text-5xl font-black tracking-tight text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.4)]">VOXEL<span className="text-green-300">CRAFT</span></h1>
            <p className="mb-5 text-sm font-bold text-white/90 drop-shadow">Infinite worlds • Survival • Building • Crafting</p>

            <div className="space-y-2 rounded-xl border-2 border-black/20 bg-black/40 p-4 backdrop-blur">
              {hasSave && (
                <button onClick={continueWorld} className="w-full rounded bg-green-600 py-3 text-lg font-black text-white shadow hover:bg-green-500">▶ Continue World</button>
              )}
              {hasSave && <p className="text-[11px] text-white/70">{saveInfo}</p>}
              <button onClick={newWorld} className="w-full rounded bg-[#5a8a3a] py-3 text-lg font-black text-white shadow hover:bg-[#6a9a4a]">🌍 New World</button>
              <div className="flex gap-2">
                <input value={seedInput} onChange={(e) => setSeedInput(e.target.value)} placeholder="Seed (blank = random)" className="min-w-0 flex-1 rounded border-2 border-black/30 bg-white px-3 py-2 text-sm text-black outline-none" />
                <button onClick={() => setSeedInput(String(Math.floor(Math.random() * 900000) + 100000))} className="rounded bg-white/20 px-3 py-2 text-sm font-bold text-white hover:bg-white/30">🎲</button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setScreen('help')} className="flex-1 rounded bg-white/20 py-2 font-bold text-white hover:bg-white/30">❓ How to Play</button>
                <button onClick={() => setScreen('settings')} className="flex-1 rounded bg-white/20 py-2 font-bold text-white hover:bg-white/30">⚙️ Settings</button>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-white/80 drop-shadow">WASD + Mouse • E Inventory • T Crafting • F Fly • Your world saves automatically</p>
            <p className="mt-1 text-[10px] text-white/60">Three.js voxel engine • Procedural biomes, caves, structures, mobs, day/night & weather</p>
          </div>
        </div>
      )}

      <style>{`@keyframes slideIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </div>
  );
}
