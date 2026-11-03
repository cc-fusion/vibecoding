import { useEffect, useReducer, useRef, useState } from 'react';
import { Game, Container, ACHIEVEMENTS } from '../game/engine';
import { BLOCKS, ITEMS, getName, NUM_BLOCKS, ITEMS as IT } from '../game/blocks';
import { recipeList, SMELT_TIME } from '../game/inventory';
import type { Slot } from '../game/inventory';
import type { WorldMeta, Settings } from '../game/storage';
import { saveSettings } from '../game/storage';
import { audio } from '../game/audio';
import { SlotView, ItemIcon } from './Slot';

const CREATIVE_IDS = [
  ...Array.from({ length: NUM_BLOCKS }, (_, i) => i).filter((i) => i > 0 && BLOCKS[i] && BLOCKS[i].hardness >= 0 && i !== 6),
  ...Object.keys(IT).map(Number),
];

function Heart({ fill, kind }: { fill: number; kind: 'heart' | 'food' | 'air' }) {
  const col = kind === 'heart' ? '#e8262b' : kind === 'food' ? '#c27a35' : '#7ec8ff';
  const path = kind === 'heart'
    ? 'M1 2h2v-1h2v1h1v-1h2v1h1v3h-1v1h-1v1h-1v1h-1v1h-1v-1h-1v-1h-1v-1h-1v-1h-1z'
    : kind === 'food' ? 'M2 3h3v-1h1v-1h2v1h1v2h-1v1h-1v1h-1v1h-1v1h-2v-1h-1v-2h1z' : 'M3 1h3v1h1v1h1v3h-1v1h-1v1h-3v-1h-1v-1h-1v-3h1v-1h1z';
  return (
    <svg width="18" height="18" viewBox="0 0 10 10" style={{ shapeRendering: 'crispEdges' }}>
      <path d={path} fill="#1a1a1a" transform="translate(0.5,0.5)" />
      <path d={path} fill="#3a2a2a" />
      <defs><clipPath id={`c${kind}${fill}`}><rect x="0" y="0" width={10 * fill} height="10" /></clipPath></defs>
      <path d={path} fill={col} clipPath={`url(#c${kind}${fill})`} />
    </svg>
  );
}

export default function GameView({ meta, settings, onQuit }: { meta: WorldMeta; settings: Settings; onQuit: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<Slot | null>(null);
  const [panel, setPanel] = useState<'main' | 'settings' | 'adv'>('main');
  const [showRecipes, setShowRecipes] = useState(false);
  const [creativeTab, setCreativeTab] = useState(true);
  const [selName, setSelName] = useState({ name: '', t: 0 });

  useEffect(() => {
    const g = new Game(ref.current!, meta, settings);
    gameRef.current = g;
    let raf = 0;
    g.onUpdate = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(force); };
    (window as unknown as { game: Game }).game = g;
    return () => { g.dispose(); gameRef.current = null; };
  }, [meta, settings]);

  const g = gameRef.current;
  const held = g?.held();
  const heldName = held ? getName(held.id) : '';
  useEffect(() => { if (heldName) setSelName({ name: heldName, t: Date.now() }); }, [heldName, g?.sel]);

  if (!g) return <div ref={ref} className="fixed inset-0 bg-black" />;
  const survival = meta.mode === 'survival';
  const open = g.screen === 'inventory' || g.screen === 'crafting' || g.screen === 'furnace';
  const click = (c: Container, i: number) => (e: React.MouseEvent) => g.clickSlot(c, i, e.button === 2, e.shiftKey);
  const updateSetting = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    g.settings[k] = v; saveSettings(g.settings);
    if (k === 'volume') audio.setVolume(v as number);
    if (k === 'renderDist') g.lastChunk = '';
    force();
  };

  const invGrid = (
    <div>
      <div className="grid grid-cols-[repeat(9,42px)] gap-0">{g.inv.slots.slice(9).map((s, i) => <SlotView key={i} slot={s} onClick={click('inv', i + 9)} onHover={setHover} />)}</div>
      <div className="grid grid-cols-[repeat(9,42px)] gap-0 mt-2">{g.inv.slots.slice(0, 9).map((s, i) => <SlotView key={i} slot={s} onClick={click('inv', i)} onHover={setHover} />)}</div>
    </div>
  );
  const craftRes = g.craftResult();
  const furnace = g.openFurnace ? g.furnaces.get(g.openFurnace) : null;

  return (
    <div className="fixed inset-0 overflow-hidden bg-black" onMouseMove={(e) => open && setMouse({ x: e.clientX, y: e.clientY })}>
      <div ref={ref} className="absolute inset-0" />

      {/* overlays */}
      {g.headInWater && <div className="pointer-events-none absolute inset-0 bg-blue-900/30" />}
      <div className="pointer-events-none absolute inset-0 transition-opacity duration-300" style={{ opacity: g.hurtT > 0 ? 1 : 0, boxShadow: 'inset 0 0 160px 40px rgba(200,0,0,0.55)' }} />
      {survival && g.health <= 6 && g.health > 0 && <div className="pointer-events-none absolute inset-0 animate-pulse" style={{ boxShadow: 'inset 0 0 120px 20px rgba(120,0,0,0.35)' }} />}

      {/* crosshair */}
      {g.screen === 'none' && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 mix-blend-difference">
          <div className="absolute w-[18px] h-[2px] bg-white -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute w-[2px] h-[18px] bg-white -translate-x-1/2 -translate-y-1/2" />
        </div>
      )}

      {/* info */}
      <div className="pointer-events-none absolute left-3 top-3 mc-text text-sm leading-5">
        {g.debug ? (
          <div className="bg-black/40 p-2">
            <div>VoxelCraft · {g.fps} fps</div>
            <div>XYZ: {g.pos.x.toFixed(2)} / {g.pos.y.toFixed(2)} / {g.pos.z.toFixed(2)}</div>
            <div>Chunk: {Math.floor(g.pos.x / 16)}, {Math.floor(g.pos.z / 16)} · loaded {g.chunks.size}</div>
            <div>Biome: {g.biomeName()} · Day {g.day + 1} {g.timeLabel()}</div>
            <div>Weather: {g.rain > 0.05 ? (g.thunder ? 'Thunderstorm' : 'Rain') : 'Clear'} · Mobs {g.mobs.length} · Drops {g.drops.length}</div>
            <div>Seed: {meta.seedText}</div>
            {g.target && <div>Looking at: {BLOCKS[g.target.id].name} ({g.target.x}, {g.target.y}, {g.target.z})</div>}
          </div>
        ) : (
          <div className="opacity-90">
            <div>{g.biomeName()} · Day {g.day + 1} · {g.timeLabel()}</div>
            <div className="text-xs opacity-75">{Math.floor(g.pos.x)}, {Math.floor(g.pos.y)}, {Math.floor(g.pos.z)} · F3 debug</div>
          </div>
        )}
      </div>

      {/* toasts */}
      <div className="pointer-events-none absolute right-3 top-3 flex flex-col gap-2">
        {g.toasts.map((t) => (
          <div key={t.id} className="mc-toast px-4 py-2 min-w-56 animate-[slide_.3s_ease-out]">
            <div className="text-yellow-300 text-sm">{t.title}</div>
            {t.text && <div className="text-white text-sm">{t.text}</div>}
          </div>
        ))}
      </div>

      {/* HUD bottom */}
      {g.screen !== 'loading' && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center">
          {selName.name && Date.now() - selName.t < 2000 && g.screen === 'none' && <div className="mc-text mb-2 text-base">{selName.name}</div>}
          {survival && (
            <div className="flex justify-between w-[364px] mb-1">
              <div className="flex">{Array.from({ length: 10 }, (_, i) => <Heart key={i} kind="heart" fill={Math.max(0, Math.min(1, (g.health - i * 2) / 2))} />)}</div>
              <div className="flex flex-col items-end">
                {g.air < 10 && <div className="flex flex-row-reverse mb-0.5">{Array.from({ length: 10 }, (_, i) => <Heart key={i} kind="air" fill={i < g.air ? 1 : 0} />)}</div>}
                <div className="flex flex-row-reverse">{Array.from({ length: 10 }, (_, i) => <Heart key={i} kind="food" fill={Math.max(0, Math.min(1, (g.hunger - i * 2) / 2))} />)}</div>
              </div>
            </div>
          )}
          <div className="mc-hotbar flex p-[2px]">
            {g.inv.slots.slice(0, 9).map((s, i) => <SlotView key={i} slot={s} selected={i === g.sel} />)}
          </div>
        </div>
      )}

      {/* container screens */}
      {open && (
        <div className="absolute inset-0 bg-black/55 flex items-center justify-center gap-4" onMouseDown={(e) => { if (e.target === e.currentTarget && g.cursor) { g.cursor = null; force(); } }}>
          {meta.mode === 'creative' && g.screen === 'inventory' && creativeTab && (
            <div className="mc-panel p-3 w-[392px] max-h-[80vh] overflow-y-auto">
              <div className="mc-label mb-2">All Items (click: stack · right-click: one · shift: to inventory)</div>
              <div className="grid grid-cols-[repeat(9,42px)]">{CREATIVE_IDS.map((id) => <SlotView key={id} slot={{ id, count: 1 }} onClick={(e) => g.clickSlot('creative', id, e.button === 2, e.shiftKey)} onHover={setHover} />)}</div>
            </div>
          )}
          <div className="mc-panel p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="mc-label">{g.screen === 'crafting' ? 'Crafting Table' : g.screen === 'furnace' ? 'Furnace' : 'Inventory'}</div>
              <div className="flex gap-1">
                {meta.mode === 'creative' && g.screen === 'inventory' && <button className="mc-btn-sm" onClick={() => setCreativeTab(!creativeTab)}>Items</button>}
                <button className="mc-btn-sm" onClick={() => setShowRecipes(!showRecipes)}>Recipes</button>
                <button className="mc-btn-sm" onClick={() => g.sortInventory()}>Sort</button>
              </div>
            </div>
            {g.screen !== 'furnace' ? (
              <div className="flex items-center justify-center gap-6 mb-4 py-2">
                <div className="grid" style={{ gridTemplateColumns: `repeat(${g.craftW}, 40px)` }}>
                  {g.craftGrid.map((s, i) => <SlotView key={i} slot={s} onClick={click('craft', i)} onHover={setHover} />)}
                </div>
                <div className="mc-arrow">➜</div>
                <SlotView big slot={craftRes ? { id: craftRes[0], count: craftRes[1] } : null} onClick={click('craftOut', 0)} onHover={setHover} />
              </div>
            ) : furnace && (
              <div className="flex items-center justify-center gap-6 mb-4 py-2">
                <div className="flex flex-col items-center gap-1">
                  <SlotView slot={furnace.input} onClick={click('furnIn', 0)} onHover={setHover} />
                  <div className="w-6 h-6 relative bg-[#555]"><div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-red-600 via-orange-400 to-yellow-300" style={{ height: `${furnace.burnMax ? (furnace.burn / furnace.burnMax) * 100 : 0}%` }} /></div>
                  <SlotView slot={furnace.fuel} onClick={click('furnFuel', 0)} onHover={setHover} />
                </div>
                <div className="w-16 h-4 bg-[#555] relative"><div className="absolute inset-y-0 left-0 bg-white" style={{ width: `${(furnace.progress / SMELT_TIME) * 100}%` }} /></div>
                <SlotView big slot={furnace.output} onClick={click('furnOut', 0)} onHover={setHover} />
              </div>
            )}
            {invGrid}
            <div className="mc-label text-xs mt-2 opacity-70">Left: pick/place · Right: split/one · Shift: quick-move · E/Esc: close</div>
          </div>
          {showRecipes && (
            <div className="mc-panel p-3 w-[300px] max-h-[80vh] overflow-y-auto">
              <div className="mc-label mb-2">Recipe Book</div>
              {recipeList().map((r, i) => {
                const needsTable = r.grid.length > 2 || r.grid.some((row) => row.length > 2);
                return (
                  <div key={i} className="flex items-center gap-2 mb-2 border-b border-black/10 pb-2">
                    <div className="grid gap-[1px]" style={{ gridTemplateColumns: `repeat(${Math.max(...r.grid.map((x) => x.length))}, 20px)` }}>
                      {r.grid.flat().map((id, j) => <div key={j} className="w-5 h-5 bg-[#8b8b8b] flex items-center justify-center">{id ? <ItemIcon id={id} size={18} /> : null}</div>)}
                    </div>
                    <span className="text-[#333]">➜</span>
                    <ItemIcon id={r.out[0]} size={26} />
                    <div className="text-xs text-[#333] leading-tight">{getName(r.out[0])}{r.out[1] > 1 ? ` ×${r.out[1]}` : ''}{needsTable && <div className="text-[10px] text-[#666]">needs table</div>}</div>
                  </div>
                );
              })}
              <div className="mc-label mt-2 mb-1">Smelting</div>
              <div className="text-xs text-[#333]">Sand→Glass · Cobble→Stone · Ores→Ingots · Raw meat→Cooked · Logs→Coal · Clay→Brick. Fuel: coal, wood, sticks.</div>
            </div>
          )}
          {hover && !g.cursor && (
            <div className="pointer-events-none fixed mc-tooltip px-2 py-1 text-sm" style={{ left: mouse.x + 16, top: mouse.y - 10 }}>
              {getName(hover.id)}
              {ITEMS[hover.id]?.tool && <div className="text-xs text-gray-400">Durability {hover.dur ?? ITEMS[hover.id].tool!.durability}/{ITEMS[hover.id].tool!.durability}</div>}
              {ITEMS[hover.id]?.food && <div className="text-xs text-green-400">Restores {ITEMS[hover.id].food} hunger</div>}
            </div>
          )}
          {g.cursor && (
            <div className="pointer-events-none fixed" style={{ left: mouse.x - 16, top: mouse.y - 16 }}>
              <ItemIcon id={g.cursor.id} />
              {g.cursor.count > 1 && <span className="mc-count absolute right-0 bottom-0 text-[13px]">{g.cursor.count}</span>}
            </div>
          )}
        </div>
      )}

      {/* loading */}
      {g.screen === 'loading' && (
        <div className="absolute inset-0 mc-dirt flex flex-col items-center justify-center">
          <div className="mc-text text-xl mb-4">Generating world “{meta.name}”…</div>
          <div className="w-72 h-3 bg-black/60 border border-white/30"><div className="h-full bg-green-500 transition-all" style={{ width: `${g.loadedFrac * 100}%` }} /></div>
        </div>
      )}

      {/* pause */}
      {g.screen === 'pause' && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 w-[420px]">
            {panel === 'main' && <>
              <div className="mc-title text-4xl mb-4">{g.stats.mined + g.stats.placed === 0 && g.day === 0 ? meta.name : 'Game Menu'}</div>
              <button className="mc-btn w-full" onClick={() => g.resume()}>{g.stats.mined + g.stats.placed === 0 && g.day === 0 ? 'Play' : 'Back to Game'}</button>
              <div className="flex gap-2 w-full">
                <button className="mc-btn flex-1" onClick={() => setPanel('adv')}>Advancements</button>
                <button className="mc-btn flex-1" onClick={() => setPanel('settings')}>Options…</button>
              </div>
              <button className="mc-btn w-full" onClick={() => { g.save(); g.toast('Game saved', '', 2); }}>Save Game</button>
              <button className="mc-btn w-full" onClick={() => { g.save(); onQuit(); }}>Save and Quit to Title</button>
              <div className="mc-panel mt-4 p-3 text-sm text-[#333] w-full leading-6">
                <b>Controls</b> — WASD move · Mouse look · Space jump{meta.mode === 'creative' ? ' (double-tap: fly)' : ''} · Shift sneak · Ctrl / double-W sprint ·
                Left click mine/attack · Right click place/use/eat · 1–9 / wheel hotbar · E inventory · Q drop (Ctrl+Q stack) · F3 debug · Esc pause
              </div>
            </>}
            {panel === 'settings' && <div className="mc-panel p-5 w-full text-[#333] flex flex-col gap-3">
              <div className="mc-label text-lg">Options</div>
              {([['renderDist', 'Render Distance', 2, 12, 1], ['fov', 'FOV', 50, 110, 1], ['sens', 'Mouse Sensitivity', 0.2, 3, 0.1], ['volume', 'Volume', 0, 1, 0.05]] as const).map(([k, label, min, max, step]) => (
                <label key={k} className="flex flex-col text-sm">
                  <span>{label}: {k === 'volume' ? Math.round(g.settings[k] * 100) + '%' : k === 'renderDist' ? g.settings[k] + ' chunks' : g.settings[k]}</span>
                  <input type="range" min={min} max={max} step={step} value={g.settings[k]} onChange={(e) => updateSetting(k, +e.target.value)} />
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={g.settings.autoJump} onChange={(e) => updateSetting('autoJump', e.target.checked)} /> Auto-jump</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={g.settings.music} onChange={(e) => updateSetting('music', e.target.checked)} /> Ambient music</label>
              <button className="mc-btn w-full" onClick={() => setPanel('main')}>Done</button>
            </div>}
            {panel === 'adv' && <div className="mc-panel p-5 w-full text-[#333]">
              <div className="mc-label text-lg mb-2">Advancements ({g.achievements.size}/{Object.keys(ACHIEVEMENTS).length})</div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {Object.entries(ACHIEVEMENTS).map(([k, [t, d]]) => (
                  <div key={k} className={`p-2 text-xs border-2 ${g.achievements.has(k) ? 'bg-[#e8d080] border-[#a08020]' : 'bg-[#999] border-[#666] opacity-70'}`}>
                    <div className="font-bold">{g.achievements.has(k) ? '★ ' : '☆ '}{t}</div><div>{d}</div>
                  </div>
                ))}
              </div>
              <div className="text-xs mb-3">Blocks mined {g.stats.mined} · placed {g.stats.placed} · items crafted {g.stats.crafted} · mobs defeated {g.stats.kills} · deaths {g.stats.deaths}</div>
              <button className="mc-btn w-full" onClick={() => setPanel('main')}>Done</button>
            </div>}
          </div>
        </div>
      )}

      {/* death */}
      {g.screen === 'dead' && (
        <div className="absolute inset-0 bg-red-900/60 flex flex-col items-center justify-center gap-3">
          <div className="mc-title text-5xl">You Died!</div>
          <div className="mc-text">Player {g.deathMsg}</div>
          <div className="mc-text text-sm opacity-80">Your inventory is kept.</div>
          <button className="mc-btn w-80 mt-4" onClick={() => g.respawn()}>Respawn</button>
          <button className="mc-btn w-80" onClick={() => { g.respawn(); g.save(); onQuit(); }}>Title Screen</button>
        </div>
      )}
    </div>
  );
}
