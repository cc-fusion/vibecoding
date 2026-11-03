import { useEffect, useState } from 'react';
import type { Game, UIState, Container } from '../game/game';
import { ACHIEVEMENTS } from '../game/game';
import { BLOCKS, ITEMS, SMELT, getIcon } from '../game/blocks';
import { Slot, ItemIcon } from './Slot';
import { SettingsPanel } from './Settings';
import type { Settings } from '../game/storage';

const Heart = ({ fill }: { fill: number }) => (
  <svg width="18" height="18" viewBox="0 0 9 9" shapeRendering="crispEdges">
    <path d="M1 1h3v1h1V1h3v1h1v3H8v1H7v1H6v1H3V7H2V6H1V5H0V2h1z" fill="#1a0505" />
    <path d="M1 2h2v1h1v1h1V3h1V2h2v3H7v1H6v1H3V6H2V5H1z" fill={fill > 0 ? '#e01c1c' : '#3a1010'} />
    {fill === 0.5 && <path d="M5 3h1V2h2v3H7v1H6v1H5z" fill="#3a1010" />}
    {fill > 0 && <path d="M2 2h1v1H2z" fill="#ffb0b0" />}
  </svg>
);
const Food = ({ fill }: { fill: number }) => (
  <svg width="18" height="18" viewBox="0 0 9 9" shapeRendering="crispEdges">
    <path d="M4 0h4v1h1v4H8v1H6v1H5v1H3v1H1V8H0V6h1V5h1V4h1V2h1z" fill="#1a0f05" />
    <path d="M4 1h4v4H6v1H5v1H4V4H3V2h1z" fill={fill > 0 ? '#b5651d' : '#3a2410'} />
    <path d="M1 6h2v1h1v1H2V7H1z" fill={fill > 0 ? '#e8e0d0' : '#444'} />
    {fill === 0.5 && <path d="M3 2h2v5H4V4H3z" fill="#3a2410" />}
  </svg>
);
const Bubble = () => (
  <svg width="18" height="18" viewBox="0 0 9 9" shapeRendering="crispEdges">
    <circle cx="4.5" cy="4.5" r="3.5" fill="#2a6ad8" stroke="#0a1a40" strokeWidth="1" /><rect x="3" y="2" width="1" height="1" fill="#fff" />
  </svg>
);

function Bar({ value, El, reverse }: { value: number; El: typeof Heart; reverse?: boolean }) {
  const items = [];
  for (let i = 0; i < 10; i++) { const v = value - i * 2; items.push(<El key={i} fill={v >= 2 ? 1 : v === 1 ? 0.5 : 0} />); }
  return <div className={`flex ${reverse ? 'flex-row-reverse' : ''}`}>{items}</div>;
}

function InventoryGrid({ ui, game, creative }: { ui: UIState; game: Game; creative?: boolean }) {
  const click = (c: Container, i: number) => (r: boolean, s: boolean) => game.slotClick(c, i, r, s);
  return (
    <div className="flex flex-col gap-3">
      {!creative && <div className="grid grid-cols-9 gap-0.5">{ui.inv.slice(9).map((s, i) => <Slot key={i} stack={s} onClick={click('inv', i + 9)} />)}</div>}
      <div className="grid grid-cols-9 gap-0.5">{ui.inv.slice(0, 9).map((s, i) => <Slot key={i} stack={s} onClick={click('inv', i)} highlight={i === ui.selected} />)}</div>
    </div>
  );
}

function CraftingGrid({ ui, game }: { ui: UIState; game: Game }) {
  const n = ui.craftSize;
  const cells = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const i = y * 3 + x; cells.push(<Slot key={i} stack={ui.craft[i]} onClick={(r, s) => game.slotClick('craft', i, r, s)} />); }
  return (
    <div className="flex items-center gap-4">
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${n}, auto)` }}>{cells}</div>
      <div className="text-4xl text-[#555] font-pixel">➜</div>
      <Slot big stack={ui.craftOut} onClick={(r, s) => game.slotClick('out', 0, r, s)} title={ui.craftOut ? `Craft ${ITEMS[ui.craftOut.id].name}` : 'Place items in the grid'} />
    </div>
  );
}

const CREATIVE_ITEMS = [
  ...BLOCKS.filter(b => b && b.id > 0 && b.id !== 9 && b.id !== 15 && b.id !== 36).map(b => b.id),
  ...Object.keys(ITEMS).map(Number).filter(id => id >= 256),
];

function RecipeBook() {
  const tips: [number[], string][] = [
    [[5], 'Log → 4 Planks (any grid)'], [[7], '2 Planks stacked → 4 Sticks'], [[19], '2×2 Planks → Crafting Table'],
    [[270], 'Pickaxe: 3 material top, 2 sticks below'], [[20], '8 Cobblestone ring → Furnace (3×3)'], [[21], 'Coal over Stick → 4 Torches'],
    [[24], 'Glass ring + Torch center → Lamp'], [[33], 'Coal/Sand checker → TNT'], [[262], 'Gold ring + Apple → Golden Apple'],
  ];
  return (
    <div className="mc-panel p-3 w-64 text-[#3f3f3f] font-pixel text-lg leading-tight self-stretch overflow-auto max-h-[70vh]">
      <div className="text-xl mb-2">Recipe Hints</div>
      {tips.map(([ids, t], i) => (
        <div key={i} className="flex items-center gap-2 mb-1.5">
          <img src={getIcon(ids[0])} width={24} height={24} style={{ imageRendering: 'pixelated' }} alt="" />
          <span>{t}</span>
        </div>
      ))}
      <div className="mt-2 text-base text-[#555]">Axe, shovel & sword follow classic shapes. Tools: Wood → Stone → Iron → Diamond.</div>
    </div>
  );
}

function FurnacePanel({ ui, game }: { ui: UIState; game: Game }) {
  const f = ui.furnace!;
  const burnPct = f.burnMax ? Math.max(0, f.burn / f.burnMax) : 0;
  return (
    <div className="flex items-center gap-6 justify-center py-2">
      <div className="flex flex-col items-center gap-1">
        <Slot stack={f.input} onClick={(r, s) => game.slotClick('fIn', 0, r, s)} title="Input (smeltable)" />
        <div className="w-6 h-6 relative">
          <div className="absolute inset-0 bg-[#555] [clip-path:polygon(50%_0,100%_60%,80%_100%,20%_100%,0_60%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#ff4000] to-[#ffd000] [clip-path:polygon(50%_0,100%_60%,80%_100%,20%_100%,0_60%)]" style={{ clipPath: `inset(${(1 - burnPct) * 100}% 0 0 0)` }} />
        </div>
        <Slot stack={f.fuel} onClick={(r, s) => game.slotClick('fFuel', 0, r, s)} title="Fuel (coal, wood...)" />
      </div>
      <div className="w-16 h-5 bg-[#555] relative"><div className="h-full bg-white/90" style={{ width: `${f.progress * 100}%` }} /></div>
      <Slot big stack={f.output} onClick={(r, s) => game.slotClick('fOut', 0, r, s)} title="Output" />
    </div>
  );
}

export function GameUI({ game, ui, onQuit, settings, setSettings }: { game: Game; ui: UIState; onQuit: () => void; settings: Settings; setSettings: (s: Settings) => void }) {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [pauseTab, setPauseTab] = useState<'main' | 'settings' | 'progress'>('main');
  const [, force] = useState(0);
  useEffect(() => { const h = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY }); window.addEventListener('mousemove', h); return () => window.removeEventListener('mousemove', h); }, []);
  useEffect(() => { const t = setInterval(() => force(n => n + 1), 250); return () => clearInterval(t); }, []);
  useEffect(() => { if (ui.screen !== 'pause') setPauseTab('main'); }, [ui.screen]);

  const containerScreen = ui.screen === 'inventory' || ui.screen === 'table' || ui.screen === 'furnace';
  const showName = ui.heldName && performance.now() - ui.heldNameT < 2000;
  const creative = ui.mode === 'creative';

  if (ui.screen === 'loading') {
    return (
      <div className="absolute inset-0 mc-dirt flex flex-col items-center justify-center gap-4 text-white font-pixel">
        <div className="text-3xl" style={{ textShadow: '3px 3px 0 #222' }}>Generating terrain…</div>
        <div className="w-80 h-3 bg-[#222] border-2 border-[#111]"><div className="h-full bg-[#5fa83a] transition-all" style={{ width: `${ui.loading * 100}%` }} /></div>
        <div className="text-lg text-gray-300">Building chunks, carving caves, growing trees</div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none select-none font-pixel">
      {/* overlays */}
      {ui.underwater && <div className="absolute inset-0 bg-[#0a3a8a]/35" />}
      {ui.hurt > 0 && <div className="absolute inset-0" style={{ boxShadow: `inset 0 0 160px rgba(200,0,0,${ui.hurt * 0.6})` }} />}
      {ui.mode === 'survival' && ui.health <= 4 && ui.screen !== 'dead' && <div className="absolute inset-0 animate-pulse" style={{ boxShadow: 'inset 0 0 120px rgba(150,0,0,0.5)' }} />}

      {/* crosshair */}
      {ui.screen === 'none' && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 mix-blend-difference">
          <div className="absolute w-[18px] h-[2px] bg-white -left-[9px] -top-px" /><div className="absolute w-[2px] h-[18px] bg-white -top-[9px] -left-px" />
        </div>
      )}

      {/* debug */}
      {ui.debug && <pre className="absolute top-2 left-2 text-white text-lg leading-tight bg-black/40 px-2 py-1 whitespace-pre">{ui.debugText}</pre>}
      {!ui.debug && ui.screen === 'none' && <div className="absolute top-2 left-2 text-white/80 text-lg" style={{ textShadow: '2px 2px 0 #000' }}>☀ {ui.time} · Day {ui.stats.days + 1}{ui.flying ? ' · Flying' : ''}</div>}

      {/* toast */}
      {ui.toast && (
        <div className="absolute top-3 right-3 mc-toast px-3 py-2 flex items-center gap-3 animate-[slidein_0.4s_ease-out]">
          <div className="text-3xl">🏆</div>
          <div><div className="text-[#ffff55] text-xl leading-none">Achievement Get!</div><div className="text-white text-lg leading-tight">{ui.toast.title}</div></div>
        </div>
      )}
      {ui.message && <div className="absolute top-[30%] left-1/2 -translate-x-1/2 text-white text-2xl" style={{ textShadow: '2px 2px 0 #000' }}>{ui.message}</div>}

      {/* HUD */}
      {ui.screen !== 'dead' && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center">
          {showName && <div className="text-white text-2xl mb-2" style={{ textShadow: '2px 2px 0 #000' }}>{ui.heldName}</div>}
          {ui.mode === 'survival' && (
            <div className="flex justify-between w-[472px] mb-1">
              <div className="flex flex-col gap-0.5"><Bar value={ui.health} El={Heart} /></div>
              <div className="flex flex-col gap-0.5 items-end">
                {(ui.underwater || ui.air < 10) && <div className="flex flex-row-reverse">{Array.from({ length: ui.air }, (_, i) => <Bubble key={i} />)}</div>}
                <Bar value={ui.hunger} El={Food} reverse />
              </div>
            </div>
          )}
          <div className="mc-hotbar flex p-[3px] gap-[2px]">
            {ui.inv.slice(0, 9).map((s, i) => (
              <div key={i} className={`relative w-[50px] h-[50px] flex items-center justify-center ${i === ui.selected ? 'mc-hot-sel' : 'mc-hot-slot'}`}>
                {s && <ItemIcon stack={s} size={36} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Container screens */}
      {containerScreen && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-4 pointer-events-auto" onMouseDown={() => game.dropCursor()} onContextMenu={e => e.preventDefault()}>
          {ui.screen !== 'furnace' && !creative && <RecipeBook />}
          <div className="mc-panel p-4 flex flex-col gap-3" onMouseDown={e => e.stopPropagation()}>
            {creative && ui.screen === 'inventory' ? (
              <>
                <div className="text-[#3f3f3f] text-2xl">Creative Inventory</div>
                <div className="grid grid-cols-9 gap-0.5 max-h-[300px] overflow-y-auto pr-1">
                  {CREATIVE_ITEMS.map(id => <Slot key={id} stack={{ id, count: 1 }} onClick={(r, s) => game.slotClick('creative', id, r, s)} />)}
                </div>
                <div className="text-[#555] text-base">Click: pick stack · Shift-click: send to inventory · Click outside panel: discard held</div>
              </>
            ) : (
              <>
                <div className="text-[#3f3f3f] text-2xl">{ui.screen === 'table' ? 'Crafting Table' : ui.screen === 'furnace' ? 'Furnace' : 'Inventory'}</div>
                {ui.screen === 'furnace' ? <FurnacePanel ui={ui} game={game} /> : (
                  <div className="flex justify-center py-2"><CraftingGrid ui={ui} game={game} /></div>
                )}
              </>
            )}
            <InventoryGrid ui={ui} game={game} creative={creative && ui.screen === 'inventory'} />
            {ui.screen === 'furnace' && <div className="text-[#555] text-base">Smeltables: {Object.keys(SMELT).map(k => ITEMS[+k].name).slice(0, 6).join(', ')}…</div>}
          </div>
          {ui.cursor && <div className="fixed pointer-events-none z-50" style={{ left: mouse.x - 20, top: mouse.y - 20 }}><ItemIcon stack={ui.cursor} size={40} /></div>}
        </div>
      )}

      {/* Pause */}
      {ui.screen === 'pause' && (
        <div className="absolute inset-0 bg-black/55 flex items-center justify-center pointer-events-auto">
          <div className="flex flex-col items-center gap-3 w-[420px]">
            {pauseTab === 'main' && (
              <>
                <div className="text-white text-4xl mb-3" style={{ textShadow: '3px 3px 0 #222' }}>Game Menu</div>
                <button className="mc-btn w-full" onClick={() => game.resume()}>Back to Game</button>
                <div className="flex gap-3 w-full">
                  <button className="mc-btn flex-1" onClick={() => setPauseTab('progress')}>Achievements</button>
                  <button className="mc-btn flex-1" onClick={() => setPauseTab('settings')}>Options…</button>
                </div>
                <button className="mc-btn w-full" onClick={() => game.save()}>Save World</button>
                <button className="mc-btn w-full" onClick={onQuit}>Save and Quit to Title</button>
                {ui.saveStatus && <div className="text-gray-300 text-lg">{ui.saveStatus}</div>}
                <div className="text-gray-300 text-lg text-center mt-2 leading-tight">
                  WASD move · Space jump · Shift sneak · Double-tap W / Ctrl sprint · E inventory · Q drop · 1-9 / wheel hotbar · Mouse: break / use · Middle: pick · F3 debug{ui.mode === 'creative' ? ' · Double-space / F fly' : ''}
                </div>
              </>
            )}
            {pauseTab === 'settings' && (
              <div className="mc-panel p-4 w-full text-[#3f3f3f]">
                <SettingsPanel settings={settings} onChange={setSettings} />
                <button className="mc-btn w-full mt-3" onClick={() => setPauseTab('main')}>Done</button>
              </div>
            )}
            {pauseTab === 'progress' && (
              <div className="mc-panel p-4 w-[520px] text-[#3f3f3f]">
                <div className="text-2xl mb-2">Achievements ({ui.achievements.length}/{Object.keys(ACHIEVEMENTS).length})</div>
                <div className="grid grid-cols-2 gap-1.5 max-h-[45vh] overflow-auto">
                  {Object.entries(ACHIEVEMENTS).map(([k, a]) => {
                    const got = ui.achievements.includes(k);
                    return (
                      <div key={k} className={`px-2 py-1 border-2 ${got ? 'bg-[#5fa83a]/30 border-[#3c7a24]' : 'bg-black/10 border-[#777] opacity-60'}`}>
                        <div className="text-lg leading-none">{got ? '★' : '☆'} {a.name}</div><div className="text-base leading-tight text-[#555]">{a.desc}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="text-lg mt-3 grid grid-cols-2">
                  <span>Blocks mined: {ui.stats.mined}</span><span>Blocks placed: {ui.stats.placed}</span>
                  <span>Zombies defeated: {ui.stats.killed}</span><span>Days: {ui.stats.days + 1}</span>
                  <span>Deaths: {ui.stats.deaths}</span>
                </div>
                <button className="mc-btn w-full mt-3" onClick={() => setPauseTab('main')}>Done</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Death */}
      {ui.screen === 'dead' && (
        <div className="absolute inset-0 bg-[#8a0000]/50 flex flex-col items-center justify-center gap-4 pointer-events-auto">
          <div className="text-white text-6xl" style={{ textShadow: '4px 4px 0 #300' }}>You died!</div>
          <div className="text-white text-xl">Your items were dropped where you fell.</div>
          <button className="mc-btn w-80" onClick={() => game.respawn()}>Respawn</button>
          <button className="mc-btn w-80" onClick={onQuit}>Title Screen</button>
        </div>
      )}

      {!ui.locked && ui.screen === 'none' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto cursor-pointer" onClick={() => game.requestLock()}>
          <div className="text-white text-2xl bg-black/50 px-4 py-2">Click to play</div>
        </div>
      )}
    </div>
  );
}
