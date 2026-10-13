import { useState } from 'react';
import { ITEMS, RECIPES, STATION_NAMES, NPCS, itemDesc, fmtCoins, BIOME_NAMES, SET_DESC, TIERS, type Recipe } from '../game/data';
import type { Game } from '../game/game';
import { OBJECTIVES, currentObjective, happiness, shopPrice, flagOK, nurseCost, nurseHeal, buy, arrival, roomOf } from '../game/npc';
import { audio } from '../game/audio';
import { Icon, Slot, Panel, Coins, btn, btn2 } from './common';

type Sel = { area: string; i: number } | null;

function useSel(g: Game) {
  const [sel, setSel] = useState<Sel>(null);
  const click = (area: string, i: number) => {
    const s = g.slotArr(area)[i];
    if (!sel) { if (s) { setSel({ area, i }); audio.sfx('ui'); } return; }
    if (sel.area === area && sel.i === i) { setSel(null); return; }
    g.swapSlots(sel, { area, i }); setSel(null);
  };
  return { sel, setSel, click };
}

function InvGrid({ g, sel, click, setHover }: { g: Game; sel: Sel; click: (a: string, i: number) => void; setHover: (id: string | null) => void }) {
  const p = g.player;
  return (
    <div className="grid grid-cols-10 gap-0.5 w-max">
      {p.inv.map((s, i) => (
        <Slot key={i} s={s} sel={!!sel && sel.area === 'inv' && sel.i === i} active={i === p.sel} hint={i < 10 ? String((i + 1) % 10) : undefined}
          size="w-[clamp(28px,3.1vw,42px)] aspect-square" onClick={() => click('inv', i)} onContext={() => g.smartUse('inv', i)} onHover={setHover} />
      ))}
    </div>
  );
}

function RecipeRow({ g, r, onHover }: { g: Game; r: Recipe; onHover: (r: Recipe | null) => void }) {
  const d = ITEMS[r.out]; const ok = g.canCraft(r); const stOk = g.stations.has(r.st);
  return (
    <div onMouseEnter={() => onHover(r)} onClick={() => g.craft(r)} title={itemDesc(r.out)}
      className={`flex items-center gap-2 px-1.5 py-1 rounded border cursor-pointer ${ok ? 'border-emerald-600 bg-emerald-900/30 hover:bg-emerald-800/50' : 'border-[#4a3520] bg-black/20 opacity-60 hover:opacity-90'}`}>
      <Icon id={r.out} className="w-6 h-6" />
      <div className="flex-1 min-w-0 text-[11px] leading-tight"><div className="font-bold truncate">{d.name}{r.n > 1 ? ` ×${r.n}` : ''}</div><div className={`text-[9px] ${stOk ? 'text-emerald-300' : 'text-rose-300'}`}>{STATION_NAMES[r.st]}</div></div>
    </div>
  );
}

export function InventoryPanel({ g }: { g: Game }) {
  const { sel, setSel, click } = useSel(g);
  const [hover, setHover] = useState<string | null>(null);
  const [rec, setRec] = useState<Recipe | null>(null);
  const [tab, setTab] = useState<'avail' | 'all'>('avail');
  const [q, setQ] = useState('');
  const p = g.player, st = p.st;
  const list = RECIPES.filter(r => ITEMS[r.out].name.toLowerCase().includes(q.toLowerCase())).filter(r => tab === 'all' || g.canCraft(r));
  const sorted = tab === 'all' ? [...list].sort((a, b) => Number(g.canCraft(b)) - Number(g.canCraft(a))) : list;
  const chest = g.chestKey !== null ? g.world.chests.get(g.chestKey) : null;
  const setBonuses = TIERS.filter(t => p.armor.filter(s => s && ITEMS[s.id].set === t.k).length >= 3).map(t => SET_DESC[t.k]);
  return (
    <Panel title="Inventory & Crafting" onClose={() => g.closePanel()} className="absolute left-1/2 -translate-x-1/2 top-16 w-[min(1120px,97vw)] max-h-[calc(100vh-80px)] overflow-y-auto">
      <div className="grid grid-cols-1 lg:grid-cols-[270px_1fr_210px] gap-3">
        {/* crafting */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex gap-1">
            <button className={`${tab === 'avail' ? btn : btn2} !px-2 !py-1 text-xs flex-1`} onClick={() => setTab('avail')}>Available</button>
            <button className={`${tab === 'all' ? btn : btn2} !px-2 !py-1 text-xs flex-1`} onClick={() => setTab('all')}>All recipes</button>
          </div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search recipes…" className="w-full rounded bg-black/50 border-2 border-[#4a3520] px-2 py-1 text-xs outline-none focus:border-amber-500" />
          <div className="text-[10px] text-amber-300/80">Nearby: {Array.from(g.stations).map(s => STATION_NAMES[s]).join(', ')}</div>
          <div className="flex flex-col gap-1 max-h-[34vh] overflow-y-auto pr-1">
            {sorted.length === 0 && <div className="text-xs text-amber-200/60 p-2">{tab === 'avail' ? 'Nothing craftable right now. Gather materials, or stand near a crafting station (Work Bench, Furnace, Anvil…).' : 'No recipes match.'}</div>}
            {sorted.map(r => <RecipeRow key={r.out + r.st} g={g} r={r} onHover={setRec} />)}
          </div>
          {rec && (
            <div className="rounded border-2 border-[#5a3d1e] bg-black/40 p-2 text-xs">
              <div className="flex items-center gap-2 mb-1"><Icon id={rec.out} className="w-8 h-8" /><div><div className="font-bold text-amber-200">{ITEMS[rec.out].name} {rec.n > 1 ? `×${rec.n}` : ''}</div><div className={g.stations.has(rec.st) ? 'text-emerald-300' : 'text-rose-300'}>Needs: {STATION_NAMES[rec.st]}</div></div></div>
              {rec.ing.map(([id, n]) => { const have = g.countItem(id); return <div key={id} className={`flex items-center gap-1.5 ${have >= n ? 'text-emerald-300' : 'text-rose-300'}`}><Icon id={id} className="w-4 h-4" />{ITEMS[id].name}<span className="ml-auto">{have}/{n}</span></div>; })}
              <button disabled={!g.canCraft(rec)} onClick={() => g.craft(rec)} className={`${btn} w-full mt-2 !py-1 text-sm`}>Craft</button>
            </div>
          )}
        </div>
        {/* inventory + chest */}
        <div className="flex flex-col gap-2 min-w-0 items-center">
          {chest && (
            <div className="rounded border-2 border-[#5a3d1e] bg-black/30 p-2 w-max">
              <div className="flex items-center justify-between mb-1"><span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Chest</span><button className={`${btn2} !py-0.5 !px-2 text-xs`} onClick={() => { g.lootAll(); }}>Loot all</button></div>
              <div className="grid grid-cols-10 gap-0.5">{chest.map((s, i) => <Slot key={i} s={s} sel={!!sel && sel.area === 'chest' && sel.i === i} size="w-[clamp(28px,3.1vw,42px)] aspect-square" onClick={() => click('chest', i)} onContext={() => g.smartUse('chest', i)} onHover={setHover} />)}</div>
            </div>
          )}
          <div className="rounded border-2 border-[#5a3d1e] bg-black/30 p-2 w-max">
            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-1">Backpack <span className="text-amber-200/50 normal-case font-normal">— click to pick up / swap · right-click to equip, use{chest ? ' or stash' : ''}</span></div>
            <InvGrid g={g} sel={sel} click={click} setHover={setHover} />
          </div>
          <div className="flex items-center gap-3 w-full justify-between text-xs">
            <Coins c={p.coins} />
            <button className={`${btn2} !py-1`} disabled={!sel} onClick={() => { if (sel) { g.trash(sel.area, sel.i); setSel(null); } }}>🗑 Trash selected</button>
          </div>
          <div className="w-full min-h-[3.2rem] rounded bg-black/40 border border-[#4a3520] p-1.5 text-xs">
            {hover ? <><div className="font-bold text-amber-200">{ITEMS[hover].name}</div><div className="whitespace-pre-line text-amber-100/80">{itemDesc(hover) || '—'}</div><div className="text-yellow-300/80">Sells for {fmtCoins(Math.max(1, Math.floor(ITEMS[hover].value * 0.2)))}</div></> : <span className="text-amber-200/50">Hover an item for details.</span>}
          </div>
        </div>
        {/* equipment */}
        <div className="flex flex-col gap-2">
          <div className="rounded border-2 border-[#5a3d1e] bg-black/30 p-2">
            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-1">Armor</div>
            <div className="flex gap-1">{p.armor.map((s, i) => <Slot key={i} s={s} sel={!!sel && sel.area === 'armor' && sel.i === i} label={['Head', 'Body', 'Legs'][i]} size="w-11 h-11" onClick={() => click('armor', i)} onContext={() => g.smartUse('armor', i)} onHover={setHover} />)}</div>
            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider mt-2 mb-1">Accessories</div>
            <div className="grid grid-cols-4 gap-1">{p.acc.map((s, i) => <Slot key={i} s={s} sel={!!sel && sel.area === 'acc' && sel.i === i} label="Acc" size="w-11 h-11" onClick={() => click('acc', i)} onContext={() => g.smartUse('acc', i)} onHover={setHover} />)}</div>
          </div>
          <div className="rounded border-2 border-[#5a3d1e] bg-black/30 p-2 text-[11px] leading-snug">
            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-1">Stats</div>
            <div>🛡 Defense: <b>{st.def}</b></div><div>❤ Max life: <b>{p.maxHp}</b></div><div>★ Max mana: <b>{p.maxMana}</b></div>
            <div>⚔ Damage: <b>+{Math.round((st.dmg - 1) * 100)}%</b> · Crit: <b>{st.crit}%</b></div>
            <div>👟 Speed: <b>+{Math.round((st.speed - 1) * 100)}%</b> · ⛏ Mining: <b>+{Math.round((st.mine - 1) * 100)}%</b></div>
            {st.doubleJump && <div className="text-sky-300">Double jump</div>}{st.wings && <div className="text-sky-300">Flight</div>}{st.noFall && <div className="text-sky-300">No fall damage</div>}{st.lava && <div className="text-orange-300">Lava immunity</div>}
            {setBonuses.map(b => <div key={b} className="text-emerald-300 mt-1">✔ {b}</div>)}
          </div>
        </div>
      </div>
    </Panel>
  );
}

const GUIDE_TIPS = ['Dig down, find ore, and smelt it at a Furnace. Better tools mean deeper mining.', 'A valid house needs: enclosed walls, background walls, a Door, Table (or Work Bench), Chair and Torch. Press H to check any room.', 'Place torches — darkness hides cave dangers. Hold a torch to light your way.', 'Smash Life Crystals underground for more health; collect Fallen Stars at night and craft Mana Crystals.', 'Boss summons are crafted from monster parts. Build a flat arena and bring healing potions!', 'Enemies spawn less near your town. Housed NPCs lower the spawn rate.', 'The Blight spreads over time — the Dryad sells Purification Powder to cleanse it.'];
export function NpcPanel({ g }: { g: Game }) {
  const n = g.talk; const { sel, click } = useSel(g); const [hover, setHover] = useState<string | null>(null);
  if (!n) return null;
  const h = happiness(g, n); const obj = currentObjective(g); const li = (n as any).line || 0;
  const line = n.id === 'guide' ? (obj ? `Your next goal: “${obj.title}”. ${obj.desc}` : 'You have done everything I can advise. The world is yours!') + '\n\nTip: ' + GUIDE_TIPS[li % GUIDE_TIPS.length] : n.def.lines[li % n.def.lines.length];
  return (
    <Panel title={n.def.name} onClose={() => g.closePanel()} className="absolute left-1/2 -translate-x-1/2 top-16 w-[min(900px,97vw)] max-h-[calc(100vh-80px)] overflow-y-auto">
      <div className="flex gap-3 flex-col md:flex-row">
        <div className="md:w-[45%] flex flex-col gap-2">
          <div className="flex gap-3 items-start">
            <div className="w-16 h-16 rounded border-2 border-[#5a3d1e] relative overflow-hidden shrink-0" style={{ background: n.def.col }}>
              <div className="absolute left-3 top-4 w-10 h-8 rounded-sm" style={{ background: '#f0c8a0' }} /><div className="absolute left-2 top-2 w-12 h-4" style={{ background: n.def.hair }} /><div className="absolute left-6 top-7 w-1.5 h-1.5 bg-black" /><div className="absolute left-10 top-7 w-1.5 h-1.5 bg-black" />
            </div>
            <div className="text-sm bg-black/40 rounded p-2 border border-[#4a3520] whitespace-pre-line flex-1">{n.def.intro}<div className="mt-1 text-amber-100/90 text-xs">{line}</div></div>
          </div>
          <div className="text-xs rounded bg-black/30 border border-[#4a3520] p-2">
            <div className="font-bold">Mood: <span className={h.mood === 'Happy' ? 'text-emerald-300' : h.mood === 'Content' ? 'text-amber-200' : 'text-rose-300'}>{h.mood}</span> · prices ×{h.mult.toFixed(2)}</div>
            {h.notes.map((t, i) => <div key={i} className="text-amber-100/70">• {t}</div>)}
          </div>
          {n.id === 'nurse' && <button className={btn} disabled={nurseCost(g, n) <= 0} onClick={() => nurseHeal(g, n)}>{g.player.hp >= g.player.maxHp ? 'You are healthy' : `Heal me — ${fmtCoins(nurseCost(g, n))}`}</button>}
          <div className="text-[11px] text-amber-200/70">Right-click an item in your backpack to sell it (20% of value).</div>
          <div className="rounded border-2 border-[#5a3d1e] bg-black/30 p-2 w-max max-w-full overflow-x-auto"><InvGrid g={g} sel={sel} click={click} setHover={setHover} /></div>
          <div className="flex items-center justify-between"><Coins c={g.player.coins} /><div className="text-xs text-amber-100/70">{hover ? ITEMS[hover].name : ''}</div></div>
        </div>
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">{n.def.shop.length ? 'Wares' : 'No wares'}</div>
          {n.def.shop.map((e, i) => {
            if (!flagOK(g, e.flag)) return (<div key={i} className="rounded border border-dashed border-[#4a3520] p-2 text-xs text-amber-200/40">??? — locked (defeat more bosses)</div>);
            const q = e.n || 1, price = shopPrice(g, n, e.id, q), can = g.player.coins >= price;
            return (
              <div key={i} className="flex items-center gap-2 rounded border-2 border-[#4a3520] bg-black/30 p-1.5" title={itemDesc(e.id)}>
                <Icon id={e.id} className="w-8 h-8" /><div className="flex-1 min-w-0 text-xs"><div className="font-bold truncate">{ITEMS[e.id].name}{q > 1 ? ` ×${q}` : ''}</div><div className="text-amber-100/60 truncate">{itemDesc(e.id).split('\n')[0]}</div></div>
                <div className={`text-xs font-bold ${can ? 'text-yellow-300' : 'text-rose-400'}`}>{fmtCoins(price)}</div><button className={`${btn2} !py-1`} disabled={!can} onClick={() => buy(g, n, i)}>Buy</button>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

export function HousingPanel({ g }: { g: Game }) {
  const hr = g.hoverRoom;
  const checks: [string, boolean][] = hr && hr.tiles.length ? [['Enclosed by solid blocks / doors', !hr.leaked], ['At least 30 open tiles', !hr.leaked && hr.area >= 30], ['Background walls behind the room', !hr.leaked && hr.walls >= hr.area * 0.8], ['Table or Work Bench', hr.table], ['Chair', hr.chair], ['Torch', hr.light]] : [];
  const free = g.rooms.filter(r => !g.npcs.some(n => n.home === r.id)).length;
  return (
    <Panel title="Housing" onClose={() => g.closePanel()} className="absolute left-2 top-24 w-[min(340px,92vw)] max-h-[calc(100vh-110px)] overflow-y-auto">
      <div className="text-xs text-amber-100/80 mb-2">Move your cursor over a room in the world to inspect it. <span className="text-emerald-300">Green</span> = valid home, <span className="text-rose-300">red</span> = problems. Valid rooms (<b>{g.rooms.length}</b>, vacant <b>{free}</b>) are outlined faintly.</div>
      <div className="rounded border-2 border-[#4a3520] bg-black/30 p-2 mb-2 text-xs">
        <div className="font-bold text-amber-300 uppercase tracking-wider mb-1">Room under cursor</div>
        {checks.length === 0 ? <div className="text-amber-200/60">Not an open tile.</div> : checks.map(([t, ok]) => <div key={t} className={ok ? 'text-emerald-300' : 'text-rose-300'}>{ok ? '✔' : '✘'} {t}</div>)}
        {hr && hr.tiles.length > 0 && <div className="mt-1 font-bold">{hr.ok ? '✔ Suitable for a resident!' : `Area: ${hr.leaked ? '—' : hr.area} tiles`}</div>}
      </div>
      <div className="flex flex-col gap-1.5">
        {Object.values(NPCS).map(def => {
          const n = g.npcs.find(x => x.id === def.id); const h = n ? happiness(g, n) : null; const room = n ? roomOf(g, n) : undefined;
          return (
            <div key={def.id} className="flex items-start gap-2 rounded border border-[#4a3520] bg-black/25 p-1.5">
              <div className="w-8 h-8 rounded shrink-0 relative overflow-hidden" style={{ background: def.col }}><div className="absolute left-1.5 top-2 w-5 h-4" style={{ background: '#f0c8a0' }} /><div className="absolute left-1 top-1 w-6 h-2" style={{ background: def.hair }} /></div>
              <div className="text-[11px] leading-snug min-w-0">
                <div className="font-bold text-amber-200">{def.name}</div>
                {!n ? <div className={arrival(g, def.id) ? 'text-lime-300' : 'text-amber-100/60'}>{arrival(g, def.id) ? 'Wants to move in — needs a vacant valid house!' : `Not arrived · ${def.need}`}</div>
                  : n.deadT > 0 ? <div className="text-rose-300">Slain — returns at dawn</div>
                    : n.home < 0 ? <div className="text-amber-300">Homeless — build a valid house</div>
                      : <div className="text-emerald-300">Lives in a {room?.area}-tile house · {h?.mood} · ×{h?.mult.toFixed(2)}</div>}
                <div className="text-amber-100/50">Likes {BIOME_NAMES[def.like]} · dislikes {BIOME_NAMES[def.dislike]}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export function JournalPanel({ g }: { g: Game }) {
  const cur = currentObjective(g); const done = OBJECTIVES.filter(o => g.objDone[o.id]).length;
  return (
    <Panel title="Journal — Objectives" onClose={() => g.closePanel()} className="absolute left-1/2 -translate-x-1/2 top-16 w-[min(720px,96vw)] max-h-[calc(100vh-90px)] overflow-y-auto">
      <div className="text-xs text-amber-200 mb-2">Progress: <b>{done}/{OBJECTIVES.length}</b> objectives · Legacy Shards this run: <b className="text-purple-300">{g.runShards}</b></div>
      <div className="h-2 bg-black/50 rounded overflow-hidden mb-3"><div className="h-full bg-amber-500" style={{ width: `${done / OBJECTIVES.length * 100}%` }} /></div>
      <div className="flex flex-col gap-1.5">
        {OBJECTIVES.map(o => {
          const d = !!g.objDone[o.id], isCur = cur && cur.id === o.id;
          return (
            <div key={o.id} className={`rounded border-2 p-2 ${isCur ? 'border-amber-400 bg-amber-900/30' : d ? 'border-emerald-800 bg-emerald-950/30' : 'border-[#3a2a18] bg-black/20 opacity-70'}`}>
              <div className="flex items-center gap-2"><span className={`w-5 h-5 grid place-items-center rounded text-xs font-bold ${d ? 'bg-emerald-600' : isCur ? 'bg-amber-500 text-black' : 'bg-stone-700'}`}>{d ? '✔' : isCur ? '▶' : '·'}</span><span className="font-bold text-sm">{o.title}</span><span className="ml-auto text-[10px] text-yellow-300/80">{o.coins ? fmtCoins(o.coins) : ''}{o.shards ? ` · ◆${o.shards}` : ''}</span></div>
              {(isCur || d) && <div className="text-xs text-amber-100/80 mt-1 pl-7">{o.desc}</div>}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
