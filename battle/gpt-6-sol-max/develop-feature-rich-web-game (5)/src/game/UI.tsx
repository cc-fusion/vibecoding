import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import {
  ArrowRight, ArrowUpRight, Backpack, BookOpen, Crosshair, Flame, Gem, Hammer, Heart,
  Map as MapIcon, Moon, MousePointer2, Package, Pause, Pickaxe, Settings2, Shovel,
  Sparkles, Sprout, Sun, Sword, Target, Utensils, Volume2, VolumeX, Wheat,
} from "lucide-react";
import { BIOME_NAMES, ITEMS, TOOL_DURABILITY, type ItemId } from "./data";
import { WildforgeGame, type GameSnapshot } from "./engine";

export type GameProps = { game: WildforgeGame; s: GameSnapshot };

export function ItemIcon({ item, size = 24 }: { item: ItemId; size?: number }) {
  const info = ITEMS[item];
  if (info.kind === "block" || info.kind === "station") return <span className="item-cube" style={{ "--item-color": info.color, width: size * .82, height: size * .82 } as CSSProperties} />;
  const common = { size, strokeWidth: 1.8, color: info.color };
  if (item.includes("Pick")) return <Pickaxe {...common} />;
  if (item.includes("Sword")) return <Sword {...common} />;
  if (item === "bow") return <Target {...common} />;
  if (item === "hoe") return <Shovel {...common} />;
  if (item === "diamond" || item === "pearl") return <Gem {...common} />;
  if (item === "coal") return <Flame {...common} />;
  if (item === "bandage") return <Heart {...common} />;
  if (item === "wheat") return <Wheat {...common} />;
  if (item === "seeds") return <Sprout {...common} />;
  if (info.kind === "food") return <Utensils {...common} />;
  if (item === "arrow") return <ArrowUpRight {...common} />;
  return <Package {...common} />;
}

export function TitleScreen({ game, s }: GameProps) {
  return <div className={`title-layer ${s.panel ? "screen-underlay" : ""}`}>
    <header className="title-header">
      <div className="header-monogram"><span>W</span><i /></div>
      <span className="header-label">A VOXEL SURVIVAL ADVENTURE</span>
      <div className="header-actions">
        <button className="icon-link" aria-label={s.muted ? "Unmute audio" : "Mute audio"} onClick={() => game.setMuted(!s.muted)}>{s.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
        <button className="icon-link" aria-label="Settings" onClick={() => game.setPanel("settings")}><Settings2 size={18} /></button>
      </div>
    </header>
    <main className="title-main">
      <div className="eyebrow hero-eyebrow"><span className="eyebrow-line" /> THE WORLD IS YOURS TO SHAPE</div>
      <h1 className="wordmark"><span>WILD</span><span>FORGE<span className="wordmark-dot">.</span></span></h1>
      <div className="hero-description"><p>Build a life from the earth. Survive what comes after sundown. Follow the emberlight to the end of the world.</p></div>
      <div className="hero-buttons">
        <button className="button-primary hero-start" onClick={() => game.setPanel("newGame")}>BEGIN EXPEDITION <ArrowUpRight size={20} strokeWidth={1.8} /></button>
        <button className="button-quiet" onClick={() => game.setPanel("help")}><BookOpen size={18} /> HOW TO PLAY</button>
      </div>
    </main>
    <footer className="title-footer">
      <div className="footer-left"><span className="tiny-diamond" /> A LIVING WORLD, ONE BLOCK AT A TIME</div>
      <button className="footer-legacy" onClick={() => game.setPanel("legacy")}><Sparkles size={15} /> THE LEGACY <span>{s.meta.embers} EMBERS</span> <ArrowRight size={15} /></button>
      <span className="footer-version">WORLD 01 / {s.meta.victories} VICTORIES</span>
    </footer>
  </div>;
}

function HeldItem({ item, swing }: { item: ItemId | null; swing: number }) {
  const color = item ? ITEMS[item].color : "#d5ad87";
  const isSword = !!item?.includes("Sword");
  const isBow = item === "bow";
  const isBlock = !!item && (ITEMS[item].kind === "block" || ITEMS[item].kind === "station");
  return <div className="held-item" style={{ "--held-color": color, transform: `translateY(${swing * 23}px) rotate(${-12 - swing * 39}deg)` } as CSSProperties} aria-hidden="true">
    <svg viewBox="0 0 230 270" fill="none" xmlns="http://www.w3.org/2000/svg">
      {isSword ? <>
        <path d="M160 12 L189 24 L118 165 L99 150 Z" fill={color} stroke="#efe9d2" strokeWidth="4" />
        <path d="M145 31 L164 37 L110 147 L104 145 Z" fill="#fff0d4" opacity=".52" />
        <path d="M70 147 L143 183 L137 195 L63 161 Z" fill="#645041" stroke="#c9a676" strokeWidth="4" />
        <path d="M104 172 L128 184 L88 252 L66 239 Z" fill="#805f46" stroke="#d1a778" strokeWidth="4" />
      </> : isBow ? <>
        <path d="M171 15 Q36 99 105 238" stroke={color} strokeWidth="17" strokeLinecap="square" />
        <path d="M171 15 L105 238" stroke="#ede4cf" strokeWidth="2" />
        <path d="M85 138 L187 66" stroke="#d6c4a5" strokeWidth="5" />
        <path d="M187 66 L168 68 L178 82 Z" fill="#ede4cf" />
      </> : isBlock ? <>
        <path d="M77 47 L178 20 L204 115 L104 142 Z" fill={color} stroke="#f1e3ba" strokeWidth="4" />
        <path d="M77 47 L104 142 L64 173 L38 77 Z" fill="#4f5553" opacity=".75" stroke="#ddcea8" strokeWidth="4" />
        <path d="M104 142 L204 115 L167 152 L64 173 Z" fill="#343d40" opacity=".75" stroke="#d4c9ab" strokeWidth="3" />
      </> : <>
        <path d="M110 37 L125 23 L140 37 L135 110 L110 124 Z" fill={color} stroke="#f1e4bd" strokeWidth="4" />
        <path d="M48 67 L82 43 L170 81 L177 106 L137 119 L102 103 L83 118 L65 105 L39 114 Z" fill={color} stroke="#ebd8af" strokeWidth="5" />
        <path d="M106 101 L130 116 L81 248 L57 236 Z" fill="#8f6648" stroke="#dcc39b" strokeWidth="5" />
        <path d="M78 141 L112 154 M68 176 L99 189 M56 211 L87 225" stroke="#d0ac7d" strokeWidth="4" opacity=".8" />
      </>}
      <path d="M59 245 L84 222 L117 232 L147 270 L74 270 Z" fill="#c49375" stroke="#e5bb94" strokeWidth="4" />
    </svg>
  </div>;
}

function TouchControls({ game }: { game: WildforgeGame }) {
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const active = useRef<number | null>(null);
  const updateStick = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - rect.left - rect.width / 2) / (rect.width * .34)));
    const y = Math.max(-1, Math.min(1, (event.clientY - rect.top - rect.height / 2) / (rect.height * .34)));
    setStick({ x, y });
    game.setTouchMove(x, -y);
  };
  const release = () => { active.current = null; setStick({ x: 0, y: 0 }); game.setTouchMove(0, 0); };
  const action = (id: "mine" | "place" | "jump" | "interact", label: string, icon: ReactNode) => <button className={`touch-action touch-${id}`} aria-label={label}
    onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); game.setTouchAction(id, true); }}
    onPointerUp={(e) => { e.preventDefault(); game.setTouchAction(id, false); }}
    onPointerCancel={() => game.setTouchAction(id, false)}>{icon}<span>{label}</span></button>;
  return <div className="touch-controls">
    <div className="touch-joystick" onPointerDown={(e) => { active.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); updateStick(e); }}
      onPointerMove={(e) => { if (active.current === e.pointerId) updateStick(e); }} onPointerUp={release} onPointerCancel={release}>
      <div className="joystick-knob" style={{ transform: `translate(${stick.x * 33}px, ${stick.y * 33}px)` }} />
    </div>
    <div className="touch-buttons">
      {action("jump", "JUMP", <ArrowUpRight size={22} />)}
      {action("interact", "USE", <MousePointer2 size={21} />)}
      {action("place", "PLACE", <Hammer size={21} />)}
      {action("mine", "MINE", <Pickaxe size={23} />)}
    </div>
  </div>;
}

export function HUD({ game, s }: GameProps) {
  const selectedItem = s.hotbar[s.selected];
  const selectedExists = selectedItem && (s.inventory[selectedItem] || 0) > 0;
  const durability = selectedItem && TOOL_DURABILITY[selectedItem] ? (s.toolHealth[selectedItem] || 0) / TOOL_DURABILITY[selectedItem]! : null;
  return <div className="hud">
    <div className="hurt-overlay" style={{ opacity: s.hurt * .85 + (s.burn > 0 ? .10 : 0) }} />
    <div className="hud-top-fade" />
    <div className="hud-top">
      <div className="survival-hud">
        <div className="mini-brand"><span>W</span><i /></div>
        <div className="survival-bars">
          <div className="bar-line"><Heart size={14} fill="currentColor" /><span className="bar-track"><span className="bar-fill health-fill" style={{ width: `${s.health / s.maxHealth * 100}%` }} /></span><b>{Math.ceil(s.health)}<small>/{s.maxHealth}</small></b></div>
          <div className="bar-line hunger-line"><Utensils size={14} /><span className="bar-track"><span className="bar-fill hunger-fill" style={{ width: `${s.hunger}%` }} /></span><b>{Math.ceil(s.hunger)}<small>%</small></b></div>
          <div className="xp-line"><span>LV {String(s.xpLevel).padStart(2, "0")}</span><span className="xp-track"><span style={{ width: `${s.xpProgress / s.xpNext * 100}%` }} /></span><span>{s.xp} XP</span></div>
        </div>
      </div>
      <div className="objective-hud">
        <span className="micro-label">THE JOURNEY <span className="objective-count">{String(s.quest.step).padStart(2, "0")} / 09</span></span>
        <strong>{s.quest.title}</strong>
        <small>{s.quest.detail}</small>
      </div>
      <div className="world-hud">
        <div className="day-title">{s.night ? <Moon size={20} /> : <Sun size={20} />}<strong>DAY {String(s.day).padStart(2, "0")}</strong><span>{s.timeLabel}</span></div>
        <div className="world-location"><span>{BIOME_NAMES[s.biome]}</span><span className="location-separator">/</span><span>ALTAR {s.altarDistance}m {s.bearing}</span></div>
        <div className="hud-actions">
          <button title="Backpack (I)" aria-label="Open backpack" onClick={() => game.setPanel("inventory")}><Backpack size={17} /></button>
          <button title="Crafting (C)" aria-label="Open crafting" onClick={() => game.setPanel("craft")}><Hammer size={17} /></button>
          <button title="Map (M)" aria-label="Open map" onClick={() => game.setPanel("map")}><MapIcon size={17} /></button>
          <button title="Pause (Esc)" aria-label="Pause game" onClick={() => game.pause()}><Pause size={17} /></button>
        </div>
      </div>
    </div>
    {s.boss && <div className="boss-hud"><div className="boss-caption"><span>THE ASH DRAGON</span><span>{s.boss.crystals ? `${s.boss.crystals} EMBER WARDS` : "VULNERABLE"}</span></div><div className="boss-track"><span style={{ width: `${s.boss.hp / s.boss.maxHp * 100}%` }} /></div></div>}
    <div className={`crosshair ${s.target ? "crosshair-active" : ""}`}>
      <span className="crosshair-n" /><span className="crosshair-e" /><span className="crosshair-s" /><span className="crosshair-w" /><i />
      {s.mineProgress > 0 && <svg className="mine-ring" viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="2" /><circle cx="24" cy="24" r="20" fill="none" stroke="#f1c589" strokeWidth="3" strokeDasharray={`${s.mineProgress * 125.6} 125.6`} transform="rotate(-90 24 24)" /></svg>}
    </div>
    {s.target && <div className="target-readout"><strong>{s.target.name}</strong><span>{s.target.hint}</span>{s.target.health !== undefined && <div className="target-life"><span style={{ width: `${Math.max(0, s.target.health / (s.target.maxHealth || 1) * 100)}%` }} /></div>}</div>}
    {s.altarDistance < 5 && !s.boss && !s.dragonSlain && <div className="interact-hint"><kbd>E</kbd> AWAKEN THE ALTAR</div>}
    <div className="toast-stack">{s.toasts.map((toast) => <div key={toast.id} className={`game-toast toast-${toast.tone}`}><span className="toast-marker" /><div><strong>{toast.title}</strong>{toast.detail && <small>{toast.detail}</small>}</div></div>)}</div>
    <div className="float-layer">{s.floats.map((f) => f.opacity > 0 && <span key={f.id} className="float-text" style={{ left: f.left, top: f.top, color: f.color, opacity: f.opacity }}>{f.text}</span>)}</div>
    <HeldItem item={selectedExists ? selectedItem : null} swing={s.swing} />
    <div className="hud-bottom">
      <div className="controls-reminder"><span>WASD</span> MOVE <i /> <span>SPACE</span> JUMP <i /> <span>F</span> EAT <i /> <span>H</span> HELP</div>
      <div className="hotbar-wrap">
        <div className="selected-name">{selectedExists ? ITEMS[selectedItem!].name.toUpperCase() : "EMPTY HAND"}{durability !== null && selectedExists && <span> {Math.round(durability * 100)}% CONDITION</span>}</div>
        <div className="hotbar">{s.hotbar.map((item, i) => {
          const count = item ? s.inventory[item] || 0 : 0;
          const usable = !!item && count > 0;
          const tool = item && TOOL_DURABILITY[item];
          const condition = tool ? (s.toolHealth[item] || 0) / tool : 0;
          return <button key={i} className={`hotbar-slot ${i === s.selected ? "hotbar-selected" : ""} ${!usable ? "hotbar-empty" : ""}`} title={item ? ITEMS[item].name : `Empty slot ${i + 1}`} aria-label={`Slot ${i + 1}${item ? `: ${ITEMS[item].name}` : ""}`} onClick={() => game.select(i)}>
            <span className="slot-index">{i + 1}</span>{usable && <ItemIcon item={item!} size={29} />}{usable && <span className="slot-count">{tool ? "" : count}</span>}{usable && tool && <span className="slot-condition"><span style={{ width: `${condition * 100}%` }} /></span>}
          </button>;
        })}</div>
      </div>
      <div className="hud-right-note"><Crosshair size={15} /> CLICK TO MINE <span>/</span> RIGHT CLICK TO USE</div>
    </div>
    <TouchControls game={game} />
  </div>;
}