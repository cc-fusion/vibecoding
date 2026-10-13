import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Backpack, BookOpen, Check, ChevronRight, Flame,
  Hammer, Heart, Leaf, MousePointer2, Package, Pickaxe, Play, RotateCcw, Settings2,
  Shield, Sparkles, Sword, Utensils, Volume2, VolumeX, X,
} from "lucide-react";
import { BIOME_NAMES, DIFFICULTIES, ITEMS, PERKS, RECIPES, TOOL_DURABILITY, type DifficultyId, type ItemId, type Panel, type PerkId } from "./data";
import { ItemIcon, type GameProps } from "./UI";

function PanelShell({ eyebrow, title, close, wide = false, children }: { eyebrow: string; title: string; close: () => void; wide?: boolean; children: ReactNode }) {
  return <div className="panel-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
    <section className={`game-panel ${wide ? "game-panel-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="panel-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><button className="panel-close" onClick={close} aria-label="Close panel"><X size={23} /></button></div>
      <div className="panel-body">{children}</div>
    </section>
  </div>;
}

function NewGamePanel({ game, s }: GameProps) {
  return <div className="setup-layout">
    <p className="panel-intro">Every expedition begins with a choice. The world is new each time; the skills you earn will follow you home.</p>
    <div className="difficulty-list">{(Object.keys(DIFFICULTIES) as DifficultyId[]).map((id, i) => <button key={id} className={`difficulty-row ${s.difficulty === id ? "is-selected" : ""}`} onClick={() => game.setDifficulty(id)}>
      <span className="difficulty-number">0{i + 1}</span><span className="difficulty-copy"><strong>{DIFFICULTIES[id].name}</strong><small>{DIFFICULTIES[id].subtitle}</small></span><span className="difficulty-check">{s.difficulty === id ? <Check size={19} /> : <ChevronRight size={18} />}</span>
    </button>)}</div>
    <div className="setup-footer"><span><Sparkles size={16} /> {Object.values(s.meta.perks).reduce((a, b) => a + b, 0)} LEGACY UPGRADES EQUIPPED</span><button className="button-primary" onClick={() => game.start(s.difficulty)}>ENTER THE WILD <ArrowUpRight size={19} /></button></div>
  </div>;
}

function HelpPanel({ game, s }: GameProps) {
  return <div className="help-layout">
    <p className="panel-intro">A small beginning can change an entire world. These are the only rules you need to get started.</p>
    <div className="help-grid">
      <div className="help-group"><span className="help-number">01 / MOVEMENT</span><h3>Find your footing</h3><p>Use <kbd>W A S D</kbd> to move, <kbd>SPACE</kbd> to jump and <kbd>SHIFT</kbd> to sprint. Move the mouse to look around. On touch, drag the right side to look and use the left stick to move.</p></div>
      <div className="help-group"><span className="help-number">02 / SHAPE</span><h3>Take. Make. Build.</h3><p>Hold <kbd>LEFT CLICK</kbd> to mine. Select a block in the numbered hotbar and <kbd>RIGHT CLICK</kbd> to place it. Press <kbd>C</kbd> for recipes, <kbd>I</kbd> for your pack, and <kbd>E</kbd> to use nearby stations.</p></div>
      <div className="help-group"><span className="help-number">03 / SURVIVE</span><h3>Respect the dark</h3><p>Hunger drains as you travel and sprint. Press <kbd>F</kbd> to eat or use a bandage. Hunt wildlife, roast meat, or till grass with a hoe and sow seeds. Torches ward off monsters; a bed skips the night.</p></div>
      <div className="help-group"><span className="help-number">04 / ASCEND</span><h3>Follow the emberlight</h3><p>Mine stone, smelt iron, then craft an iron pick for star crystal. Endermen leave void pearls. Carry <strong>2 pearls, 1 crystal and 2 iron ingots</strong> to the glowing altar. Break its wards before attacking the dragon.</p></div>
    </div>
    <div className="help-control-strip"><span><kbd>1-9</kbd> HOTBAR</span><span><kbd>M</kbd> MAP</span><span><kbd>H</kbd> HELP</span><span><kbd>ESC</kbd> PAUSE</span></div>
    <p className="gamepad-help">GAMEPAD: LEFT / RIGHT STICKS MOVE AND LOOK. A JUMPS. LT PLACES, RT MINES, X INTERACTS. BUMPERS CHANGE SLOTS. START PAUSES.</p>
    <div className="panel-bottom-action"><button className="button-primary" onClick={() => s.phase === "title" ? game.setPanel("newGame") : game.setPanel(null)}>{s.phase === "title" ? "CHOOSE AN EXPEDITION" : "BACK TO THE WORLD"} <ArrowRight size={18} /></button></div>
  </div>;
}

function InventoryPanel({ game, s }: GameProps) {
  const entries = (Object.entries(s.inventory) as [ItemId, number][]).filter(([, count]) => count > 0).sort((a, b) => ITEMS[a[0]].name.localeCompare(ITEMS[b[0]].name));
  const [focused, setFocused] = useState<ItemId | null>(entries[0]?.[0] || null);
  const chosen = focused && (s.inventory[focused] || 0) > 0 ? focused : entries[0]?.[0];
  return <div className="inventory-layout">
    <div className="inventory-main"><p className="section-overline">YOUR FIELD PACK <span>{entries.length} ITEMS</span></p>
      <div className="inventory-grid">{entries.map(([item, count]) => <button key={item} className={`inventory-cell ${chosen === item ? "inventory-focused" : ""}`} onClick={() => setFocused(item)} title={ITEMS[item].name}>
        <ItemIcon item={item} size={28} /><span>{count}</span>
      </button>)}</div>
      <div className="inventory-tip"><MousePointer2 size={16} /> Select an item, then equip it to the highlighted hotbar slot.</div>
    </div>
    <div className="item-detail">{chosen ? <>
      <div className="detail-icon"><ItemIcon item={chosen} size={48} /></div><span className="eyebrow">{ITEMS[chosen].kind.toUpperCase()} / IN YOUR PACK</span><h3>{ITEMS[chosen].name}</h3><p>{ITEMS[chosen].description}</p>
      <div className="detail-rows"><div><span>QUANTITY</span><strong>{s.inventory[chosen]}</strong></div>{TOOL_DURABILITY[chosen] && <div><span>CONDITION</span><strong>{Math.round((s.toolHealth[chosen] || 0) / TOOL_DURABILITY[chosen]! * 100)}%</strong></div>}</div>
      <div className="equip-slot-label">HOTBAR SLOT <strong>{s.selected + 1} / 9</strong></div>
      <div className="equip-slots">{s.hotbar.map((_, index) => <button key={index} className={s.selected === index ? "active" : ""} onClick={() => game.select(index)} aria-label={`Select hotbar slot ${index + 1}`}>{index + 1}</button>)}</div>
      <button className="button-primary full-width" onClick={() => game.equip(chosen)}>EQUIP TO SLOT {s.selected + 1} <ArrowRight size={17} /></button>
      {ITEMS[chosen].food && <button className="button-outline full-width" disabled={chosen === "bandage" ? s.health >= s.maxHealth : s.hunger >= 99 && (s.health >= s.maxHealth || !["cookedMeat", "bread"].includes(chosen))} onClick={() => game.eat(chosen)}>{chosen === "bandage" ? "USE BANDAGE" : "EAT NOW"} <Utensils size={17} /></button>}
    </> : <><Package size={32} /><h3>Your pack is empty</h3><p>There is a whole world out there.</p></>}</div>
  </div>;
}

function CraftPanel({ game, s }: GameProps) {
  const [category, setCategory] = useState<"essentials" | "equipment" | "survival">("essentials");
  return <div className="craft-layout">
    <p className="panel-intro">Everything begins in your hands. Place a workbench nearby to unlock advanced crafting.</p>
    <div className="craft-tabs">{(["essentials", "equipment", "survival"] as const).map((id) => <button key={id} className={category === id ? "active" : ""} onClick={() => setCategory(id)}>{id.toUpperCase()}</button>)}</div>
    <div className="recipe-list">{RECIPES.filter((recipe) => recipe.category === category).map((recipe) => {
      const missing = Object.entries(recipe.costs).some(([item, amount]) => (s.inventory[item as ItemId] || 0) < amount);
      const locked = recipe.station === "bench" && !s.nearBench;
      return <div className="recipe-row" key={recipe.id}>
        <div className="recipe-icon"><ItemIcon item={recipe.output} size={27} /></div>
        <div className="recipe-info"><div><strong>{ITEMS[recipe.output].name}</strong><span className="recipe-yield">x{recipe.amount}</span></div><small>{Object.entries(recipe.costs).map(([item, amount]) => <span key={item} className={(s.inventory[item as ItemId] || 0) >= amount ? "" : "cost-missing"}>{amount} {ITEMS[item as ItemId].name} <i>({s.inventory[item as ItemId] || 0})</i></span>)}</small></div>
        <div className="recipe-action"><span>{locked ? "BENCH NEEDED" : recipe.station === "bench" ? "WORKBENCH" : "BY HAND"}</span><button disabled={missing || locked} onClick={() => game.craft(recipe.id)}>{missing || locked ? "UNAVAILABLE" : "CRAFT"} <ArrowRight size={15} /></button></div>
      </div>;
    })}</div>
    <div className="craft-footer-note"><Hammer size={16} /> Right click to place a crafted station; press E beside it to use it.</div>
  </div>;
}

function SmeltPanel({ game, s }: GameProps) {
  const jobs: { input: "ironOre" | "rawMeat" | "sand"; output: ItemId; time: string }[] = [
    { input: "ironOre", output: "ironIngot", time: "7 SEC" }, { input: "rawMeat", output: "cookedMeat", time: "5 SEC" }, { input: "sand", output: "glass", time: "5 SEC" },
  ];
  return <div className="smelt-layout"><p className="panel-intro">Feed the furnace coal or timber. One piece of coal powers three jobs; timber powers one. The fire keeps burning while this menu is open.</p>
    <div className="furnace-status"><Flame size={26} /><div><span>FURNACE FIRE</span><strong>{s.furnace.job ? `Smelting ${ITEMS[s.furnace.job.output].name}` : "Ready for fuel"}</strong></div><span className="fuel-number">{s.furnace.fuel} FUEL LEFT</span></div>
    {s.furnace.job && <div className="smelt-progress"><span style={{ width: `${Math.min(100, s.furnace.job.progress / s.furnace.job.duration * 100)}%` }} /></div>}
    <div className="smelt-list">{jobs.map((job) => <div className="smelt-row" key={job.input}><div className="smelt-icons"><ItemIcon item={job.input} size={27} /><ArrowRight size={15} /><ItemIcon item={job.output} size={27} /></div><div><strong>{ITEMS[job.output].name}</strong><small>1 {ITEMS[job.input].name} + fuel / {job.time}</small></div><button disabled={!!s.furnace.job || !(s.inventory[job.input] || 0) || (!s.furnace.fuel && !(s.inventory.coal || 0) && !(s.inventory.wood || 0))} onClick={() => game.smelt(job.input)}>SMELT</button></div>)}</div>
    <div className="craft-footer-note">IN YOUR PACK: {s.inventory.coal || 0} COAL / {s.inventory.wood || 0} TIMBER</div>
  </div>;
}

function EnchantPanel({ game, s }: GameProps) {
  const effects = [
    { id: "efficiency" as const, name: "Quick Hands", effect: "+28% mining speed per rank", icon: <Pickaxe size={22} /> },
    { id: "edge" as const, name: "Keen Edge", effect: "+16% melee damage per rank", icon: <Sword size={22} /> },
    { id: "ward" as const, name: "Wild Ward", effect: "-11% incoming damage per rank", icon: <Shield size={22} /> },
    { id: "harvest" as const, name: "Bright Harvest", effect: "More ore and wheat per rank", icon: <Leaf size={22} /> },
  ];
  return <div><p className="panel-intro">Bind the knowledge of the wild into permanent enchantments for this expedition. Spend experience and one coal per rank.</p>
    <div className="enchant-balance"><Sparkles size={21} /><strong>{s.xp}</strong><span>AVAILABLE EXPERIENCE</span></div>
    <div className="upgrade-list">{effects.map((effect) => {
      const rank = s.enchants[effect.id] || 0;
      const cost = 5 + rank * 4;
      return <div className="upgrade-row" key={effect.id}><div className="upgrade-icon">{effect.icon}</div><div className="upgrade-copy"><strong>{effect.name}</strong><small>{effect.effect}</small><div className="rank-marks">{[0, 1, 2].map((n) => <i key={n} className={n < rank ? "filled" : ""} />)}</div></div><button disabled={rank >= 3 || s.xp < cost || !(s.inventory.coal || 0)} onClick={() => game.enchant(effect.id)}>{rank >= 3 ? "MAXED" : `${cost} XP + COAL`}</button></div>;
    })}</div>
  </div>;
}

function RitualPanel({ game, s }: GameProps) {
  const needs: [ItemId, number][] = [["pearl", 2], ["diamond", 1], ["ironIngot", 2]];
  return <div className="ritual-layout"><div className="ritual-sigil"><span /><span /><span /><i /></div>
    <p className="panel-intro">The ancient altar answers only to those who have mastered the wild. Gather its tribute, then face what sleeps above the clouds.</p>
    <div className="ritual-offerings">{needs.map(([item, count]) => <div key={item}><ItemIcon item={item} size={30} /><span>{ITEMS[item].name}</span><strong className={(s.inventory[item] || 0) >= count ? "enough" : "not-enough"}>{s.inventory[item] || 0} / {count}</strong></div>)}</div>
    <p className="ritual-warning"><Flame size={16} /> Once awakened, three ember wards shield the Ash Dragon. Bring a bow and food.</p>
    <button className="button-primary full-width" disabled={!s.ritualReady} onClick={() => game.summon()}>{s.ritualReady ? "AWAKEN THE ASH DRAGON" : "THE ALTAR AWAITS ITS TRIBUTE"} <ArrowUpRight size={19} /></button>
  </div>;
}

function MapPanel({ game, s }: GameProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (canvas.current) game.drawMap(canvas.current); }, [game, s.seed, s.x, s.z, s.meta.perks.miner]);
  return <div className="map-layout"><div className="map-frame"><canvas ref={canvas} width={564} height={564} aria-label="Map of the world showing biomes, player and altar" /><span className="map-north">N <span>↑</span></span></div>
    <div className="map-aside"><span className="eyebrow">WORLD / SEED {s.seed}</span><h3>Find your way.</h3><p>The pale marker is you. The ember marker is the ancient altar. Its beam can be seen beyond the horizon.</p>
      <div className="map-coordinates"><div><span>YOUR POSITION</span><strong>{Math.round(s.x)} / {Math.round(s.z)}</strong></div><div><span>ALTAR</span><strong>15 / -15</strong></div><div><span>DISTANCE</span><strong>{s.altarDistance}m {s.bearing}</strong></div></div>
      <div className="map-legend"><span><i className="legend-player" /> YOU</span><span><i className="legend-altar" /> ALTAR</span>{s.meta.perks.miner > 0 && <span><i className="legend-ore" /> ORE SEAMS</span>}</div>
      <p className="map-hint">Explore meadow, pinewood, frostline, dunes and cinder wastes. Mining experience and material finds vary by region.</p>
    </div></div>;
}

function SettingsPanel({ game, s }: GameProps) {
  return <div className="settings-layout"><p className="panel-intro">Make this world yours. Difficulty changes take effect immediately, even during an expedition.</p>
    <div className="settings-section"><span className="section-overline">SOUND</span><div className="setting-line"><div><strong>Master volume</strong><small>Procedural ambience, reactive music and effects</small></div><div className="volume-controls"><button onClick={() => game.setMuted(!s.muted)} aria-label={s.muted ? "Unmute" : "Mute"}>{s.muted ? <VolumeX size={22} /> : <Volume2 size={22} />}</button><input aria-label="Master volume" type="range" min="0" max="1" step="0.01" value={s.volume} onChange={(e) => game.setVolume(Number(e.target.value))} /><span>{Math.round(s.volume * 100)}%</span></div></div></div>
    <div className="settings-section"><span className="section-overline">WORLD RULES</span><div className="setting-line"><div><strong>Screen shake</strong><small>Impacts, mining and explosions</small></div><button className={`toggle-switch ${s.shakeEnabled ? "on" : ""}`} role="switch" aria-checked={s.shakeEnabled} onClick={() => game.setShake(!s.shakeEnabled)}><span /></button></div>
      <div className="setting-difficulty"><strong>Difficulty</strong><small>Choose how fiercely the wild fights back</small><div className="setting-options">{(Object.keys(DIFFICULTIES) as DifficultyId[]).map((id) => <button key={id} className={s.difficulty === id ? "active" : ""} onClick={() => game.setDifficulty(id)}>{DIFFICULTIES[id].name}</button>)}</div></div>
    </div>
  </div>;
}

function LegacyPanel({ game, s }: GameProps) {
  return <div className="legacy-layout"><div className="legacy-intro"><div><span className="eyebrow">A LITTLE LIGHT CARRIED FORWARD</span><p>Each ending leaves an ember. Trade them for lasting advantages on every future expedition.</p></div><div className="ember-total"><Flame size={22} /><strong>{s.meta.embers}</strong><span>EMBERS</span></div></div>
    <div className="upgrade-list">{(Object.keys(PERKS) as PerkId[]).map((id) => {
      const perk = PERKS[id], rank = s.meta.perks[id], cost = perk.baseCost * (rank + 1);
      const Icon = id === "heart" ? Heart : id === "provisions" ? Backpack : id === "miner" ? Pickaxe : Shield;
      return <div className="upgrade-row" key={id}><div className="upgrade-icon"><Icon size={22} /></div><div className="upgrade-copy"><strong>{perk.name}</strong><small>{perk.subtitle}</small><div className="rank-marks">{Array.from({ length: perk.max }, (_, n) => <i key={n} className={n < rank ? "filled" : ""} />)}</div></div><button disabled={rank >= perk.max || s.meta.embers < cost} onClick={() => game.purchasePerk(id)}>{rank >= perk.max ? "MAXED" : `${cost} EMBERS`}</button></div>;
    })}</div>
    <div className="legacy-footer"><span>{s.meta.runs} EXPEDITIONS</span><span>{s.meta.victories} DRAGONS DEFEATED</span><span>BEST SCORE {s.meta.bestScore.toLocaleString()}</span></div>
  </div>;
}

export function GamePanel({ game, s }: GameProps) {
  const panel = s.panel;
  if (!panel) return null;
  const labels: Record<Exclude<Panel, null>, [string, string]> = {
    newGame: ["THE BEGINNING", "New expedition"], help: ["FIELD MANUAL", "How to survive"], inventory: ["YOUR BELONGINGS", "Field pack"],
    craft: ["MAKE SOMETHING NEW", "Crafting"], smelt: ["FIRE & IRON", "The furnace"], enchant: ["ANCIENT KNOWLEDGE", "Enchantments"],
    ritual: ["THE LAST HORIZON", "The ancient altar"], map: ["CHART THE WILD", "World map"], settings: ["MAKE IT YOURS", "Settings"], legacy: ["AFTER EVERY ENDING", "The legacy"],
  };
  const [eyebrow, title] = labels[panel];
  return <PanelShell key={panel} eyebrow={eyebrow} title={title} wide={["help", "inventory", "craft", "map", "legacy"].includes(panel)} close={() => game.setPanel(null)}>
    {panel === "newGame" && <NewGamePanel game={game} s={s} />}
    {panel === "help" && <HelpPanel game={game} s={s} />}
    {panel === "inventory" && <InventoryPanel game={game} s={s} />}
    {panel === "craft" && <CraftPanel game={game} s={s} />}
    {panel === "smelt" && <SmeltPanel game={game} s={s} />}
    {panel === "enchant" && <EnchantPanel game={game} s={s} />}
    {panel === "ritual" && <RitualPanel game={game} s={s} />}
    {panel === "map" && <MapPanel game={game} s={s} />}
    {panel === "settings" && <SettingsPanel game={game} s={s} />}
    {panel === "legacy" && <LegacyPanel game={game} s={s} />}
  </PanelShell>;
}

export function PauseScreen({ game, s }: GameProps) {
  return <div className={`pause-layer ${s.panel ? "screen-underlay" : ""}`}><div className="pause-content"><span className="eyebrow"><span className="eyebrow-line" /> EXPEDITION PAUSED</span><h2>THE WORLD<br /><em>WAITS.</em></h2><p>Day {s.day} in the {BIOME_NAMES[s.biome]}. The wild will be here when you return.</p>
    <div className="pause-actions"><button className="button-primary" onClick={() => game.resume()}>RESUME EXPEDITION <Play size={18} fill="currentColor" /></button><button onClick={() => game.setPanel("settings")}><Settings2 size={19} /> SETTINGS <ArrowRight size={16} /></button><button onClick={() => game.setPanel("help")}><BookOpen size={19} /> FIELD GUIDE <ArrowRight size={16} /></button><button onClick={() => game.toTitle()}><ArrowLeft size={19} /> ABANDON TO TITLE <ArrowRight size={16} /></button></div>
  </div><div className="pause-watermark">W.</div></div>;
}

export function EndScreen({ game, s }: GameProps) {
  const win = s.phase === "won";
  const minutes = Math.floor(s.stats.time / 60), seconds = Math.floor(s.stats.time % 60);
  return <div className={`ending-layer ${win ? "victory-layer" : "death-layer"}`}><div className="ending-content"><span className="eyebrow"><span className="eyebrow-line" /> {win ? "THE ASH DRAGON HAS FALLEN" : "YOUR EXPEDITION HAS ENDED"}</span>
    <h2>{win ? <>THE SKY<br /><em>IS YOURS.</em></> : <>THE WILD<br /><em>ENDURES.</em></>}</h2>
    <p>{win ? "You broke the old fire and lived to see another dawn. The world you shaped is yours to keep." : "Every fallen expedition leaves a spark for the next. The world will be different, but you will be stronger."}</p>
    <div className="end-score"><span>EXPEDITION SCORE</span><strong>{s.score.toLocaleString()}</strong><span className="end-embers"><Flame size={16} /> +{s.legacyEarned} LEGACY EMBERS</span></div>
    <div className="end-stats"><div><span>TIME SURVIVED</span><strong>{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</strong></div><div><span>FINAL DAY</span><strong>{String(s.day).padStart(2, "0")}</strong></div><div><span>BLOCKS MINED</span><strong>{s.stats.mined}</strong></div><div><span>CREATURES DEFEATED</span><strong>{s.stats.kills}</strong></div><div><span>ITEMS CRAFTED</span><strong>{s.stats.crafted}</strong></div></div>
    <div className="end-actions">{win && <button className="button-primary" onClick={() => game.continueAfterVictory()}>KEEP EXPLORING <ArrowUpRight size={18} /></button>}<button className={win ? "button-outline" : "button-primary"} onClick={() => game.restart()}>{win ? "NEW EXPEDITION" : "TRY AGAIN"} <RotateCcw size={18} /></button><button className="button-quiet" onClick={() => game.toTitle()}>MAIN MENU <ArrowRight size={17} /></button></div>
  </div></div>;
}