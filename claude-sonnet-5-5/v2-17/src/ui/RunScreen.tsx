import { useCallback, useEffect, useRef, useState } from "react";
import { BOONS, BOON_IDS, BOSSES, REALMS, RELICS, RELIC_IDS, relicScale } from "../game/data";
import { Game, type GameEvent, type HudState, type RunConfig, type RunState, type RoomKind } from "../game/engine";
import { audio } from "../game/audio";
import type { Settings } from "../game/save";
import { Btn, Modal, fmtTime } from "./common";
import { HelpModal, SettingsModal } from "./Menus";

export interface RunResult {
  outcome: "died" | "retreat" | "victory" | "tutorial";
  run: RunState;
  bosses: number;
  relics: string[];
  realm: number;
  room: number;
}
type Phase = "fight" | "boon" | "relic" | "door" | "rest" | "merchant" | "bossclear" | "victory" | "tutdone";
type DoorKind = "fight" | "gold" | "elite" | "rest" | "merchant" | "boss";

const DOOR_INFO: Record<DoorKind, { icon: string; name: string; desc: string }> = {
  fight: { icon: "⚔️", name: "Skirmish", desc: "Defeat a few waves. Reward: a boon." },
  gold: { icon: "💰", name: "Treasure Hoard", desc: "More foes guard triple room gold. No boon." },
  elite: { icon: "👹", name: "Elite Guardian", desc: "A powerful champion. Reward: an heirloom relic and a boon." },
  rest: { icon: "🏕️", name: "Quiet Camp", desc: "Rest, brew a potion, or pray for a boon." },
  merchant: { icon: "🛒", name: "Wandering Merchant", desc: "Spend your gold on boons, salves and potions." },
  boss: { icon: "💀", name: "Boss Chamber", desc: "The realm's guardian awaits." },
};

function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
function genDoors(next: number): DoorKind[] {
  if (next >= 4) return ["boss"];
  if (next === 3) return shuffle<DoorKind>(["rest", "merchant"]);
  const pool: [DoorKind, number][] = [["fight", 3], ["gold", 2], ["rest", 1.2], ["merchant", 1.2]];
  if (next >= 1) pool.push(["elite", 2.5]);
  const out: DoorKind[] = [];
  for (let n = 0; n < 2; n++) {
    const avail = pool.filter(([k]) => !out.includes(k));
    const total = avail.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [k, w] of avail) { r -= w; if (r <= 0) { out.push(k); break; } }
  }
  if (out.length < 2) out.push("fight");
  if (!out.some((k) => k === "fight" || k === "gold" || k === "elite")) out[1] = "fight";
  return out.slice(0, 2);
}
function rollBoons(owned: Record<string, number>, n: number): string[] {
  const pool = BOON_IDS.filter((id) => (owned[id] || 0) < BOONS[id].max);
  const w = (id: string) => (BOONS[id].rarity === "common" ? 6 : BOONS[id].rarity === "rare" ? 3 : 1.3);
  const out: string[] = [];
  while (out.length < n && out.length < pool.length) {
    const avail = pool.filter((id) => !out.includes(id));
    const total = avail.reduce((s, id) => s + w(id), 0);
    let r = Math.random() * total;
    for (const id of avail) { r -= w(id); if (r <= 0) { out.push(id); break; } }
  }
  return out;
}
const RARITY: Record<string, string> = { common: "border-slate-300/40 from-slate-700/60", rare: "border-sky-300/60 from-sky-800/60", epic: "border-fuchsia-300/70 from-fuchsia-800/60" };

interface Offer { id: string; icon: string; name: string; desc: string; price: number; kind: "boon" | "heal" | "potion"; boon?: string; sold: boolean }

export function RunScreen({ cfg, startRealm, tutorial, settings, onSettings, onEnd, keepPct }: { cfg: RunConfig; startRealm: number; tutorial: boolean; settings: Settings; onSettings: (s: Settings) => void; onEnd: (r: RunResult) => void; keepPct: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const ctl = useRef<{ onEvent: (e: GameEvent) => void }>({ onEvent: () => {} });
  const prog = useRef({ realm: startRealm, room: 0, bosses: 0, relics: [] as string[], ended: false });
  const boonNext = useRef<(() => void) | null>(null);
  const relicNext = useRef<(() => void) | null>(null);
  const phaseRef = useRef<Phase>("fight");

  const [hud, setHud] = useState<HudState | null>(null);
  const [phase, setPhaseState] = useState<Phase>("fight");
  const [paused, setPausedState] = useState(false);
  const [modal, setModal] = useState<"settings" | "help" | "abandon" | null>(null);
  const [scale, setScale] = useState(1);
  const [loc, setLoc] = useState({ realm: startRealm, room: 0 });
  const [boonChoices, setBoonChoices] = useState<string[]>([]);
  const [relicChoices, setRelicChoices] = useState<string[]>([]);
  const [doors, setDoors] = useState<DoorKind[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [gold, setGold] = useState(0);
  const [isTouch, setIsTouch] = useState(false);
  const [stick, setStick] = useState({ x: 0, y: 0, on: false });

  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };
  const g = () => gameRef.current!;

  const setPaused = useCallback((v: boolean) => {
    setPausedState(v);
    gameRef.current?.setPaused(v);
    audio.setDim(v);
    if (!v) setModal(null);
  }, []);

  // ---- flow helpers (re-bound each render, called through ctl) ----
  const finish = (outcome: RunResult["outcome"]) => {
    if (prog.current.ended) return;
    prog.current.ended = true;
    const run = { ...g().run, boons: { ...g().run.boons } };
    onEnd({ outcome, run, bosses: prog.current.bosses, relics: prog.current.relics.slice(), realm: prog.current.realm, room: prog.current.room });
  };
  const startBoon = (after: () => void) => {
    setBoonChoices(rollBoons(g().run.boons, 3));
    boonNext.current = after;
    setPhase("boon");
  };
  const openDoors = () => {
    const next = prog.current.room + 1;
    setDoors(genDoors(next));
    setPhase("door");
    g().setFrozen(true);
  };
  const rollRelics = () => shuffle(RELIC_IDS).slice(0, 2);
  const onEvent = (e: GameEvent) => {
    if (e.type === "pause") {
      if (phaseRef.current !== "fight") return;
      if (e.force) setPaused(true);
      else setPaused(!gameRef.current?.paused);
    } else if (e.type === "died") finish("died");
    else if (e.type === "tutorialDone") { g().setFrozen(true); setPhase("tutdone"); audio.sfx("boon"); }
    else if (e.type === "roomCleared") {
      g().setFrozen(true);
      if (e.kind === "elite") { setRelicChoices(rollRelics()); relicNext.current = () => startBoon(openDoors); setPhase("relic"); }
      else if (e.kind === "gold") openDoors();
      else startBoon(openDoors);
    } else if (e.type === "bossDown") {
      g().setFrozen(true);
      prog.current.bosses = Math.max(prog.current.bosses, prog.current.realm + 1);
      setRelicChoices(rollRelics());
      relicNext.current = () => setPhase(prog.current.realm >= REALMS.length - 1 ? "victory" : "bossclear");
      setPhase("relic");
    }
  };
  ctl.current.onEvent = onEvent;

  const pickBoon = (id: string) => {
    g().addBoon(id);
    const n = boonNext.current; boonNext.current = null;
    n?.();
  };
  const pickRelic = (id: string) => {
    prog.current.relics.push(id);
    const game = g();
    const m = { ...game.cfg.mods };
    RELICS[id].apply(m, relicScale(1));
    game.cfg.mods = m;
    game.recomputeMods();
    game.run.relics.push(id);
    audio.sfx("relic");
    game.burst(game.p.x, game.p.y, "#ffe9a0", 40, 260, 1, 4);
    const n = relicNext.current; relicNext.current = null;
    n?.();
  };
  const enterDoor = (k: DoorKind) => {
    const p = prog.current;
    p.room += 1;
    setLoc({ realm: p.realm, room: p.room });
    audio.sfx("door");
    if (k === "rest") setPhase("rest");
    else if (k === "merchant") {
      const r = p.realm;
      const bs = rollBoons(g().run.boons, 2);
      const price = (id: string) => Math.round((45 + 25 * r) * (BOONS[id].rarity === "common" ? 1 : BOONS[id].rarity === "rare" ? 1.35 : 1.8));
      setOffers([
        ...bs.map((id) => ({ id: "b" + id, icon: BOONS[id].icon, name: BOONS[id].name, desc: BOONS[id].desc, price: price(id), kind: "boon" as const, boon: id, sold: false })),
        { id: "heal", icon: "🍖", name: "Hearty Salve", desc: "Restore 50% of your health.", price: 35 + 15 * r, kind: "heal", sold: false },
        { id: "potion", icon: "🧪", name: "Healing Potion", desc: "+1 potion.", price: 30 + 10 * r, kind: "potion", sold: false },
      ]);
      setGold(Math.floor(g().run.gold));
      setPhase("merchant");
    } else {
      g().startRoom(k as RoomKind, p.realm, p.room);
      setPhase("fight");
    }
  };
  const buy = (o: Offer) => {
    const game = g();
    if (o.sold || game.run.gold < o.price) { audio.sfx("error"); return; }
    game.run.gold -= o.price;
    setGold(Math.floor(game.run.gold));
    setOffers((os) => os.map((x) => (x.id === o.id ? { ...x, sold: true } : x)));
    if (o.kind === "boon" && o.boon) game.addBoon(o.boon);
    else if (o.kind === "heal") game.healFrac(0.5);
    else { game.p.potions++; audio.sfx("potion"); }
  };
  const descend = () => {
    const p = prog.current;
    p.realm += 1; p.room = 0;
    setLoc({ realm: p.realm, room: 0 });
    g().healFrac(0.3);
    g().startRoom("fight", p.realm, 0);
    setPhase("fight");
  };

  // ---- mount game ----
  useEffect(() => {
    const canvas = canvasRef.current!;
    audio.init();
    const game = new Game(canvas, {
      getSettings: () => settingsRef.current,
      onHud: (h) => setHud(h),
      onEvent: (e) => ctl.current.onEvent(e),
    });
    gameRef.current = game;
    game.start(cfg);
    if (tutorial) game.startRoom("tutorial", 0, 0);
    else game.startRoom("fight", startRealm, 0);
    const ro = new ResizeObserver(() => {
      const w = boxRef.current?.clientWidth ?? 1280;
      setScale(w / 1280);
      game.resize();
    });
    if (boxRef.current) ro.observe(boxRef.current);
    setIsTouch(typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0));
    return () => {
      ro.disconnect();
      game.destroy();
      gameRef.current = null;
      audio.setDim(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // number-key shortcuts in choice overlays
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (!n) return;
      if (phase === "boon" && boonChoices[n - 1]) pickBoon(boonChoices[n - 1]);
      else if (phase === "relic" && relicChoices[n - 1]) pickRelic(relicChoices[n - 1]);
      else if (phase === "door" && doors[n - 1]) enterDoor(doors[n - 1]);
    };
    window.addEventListener("keydown", kd);
    return () => window.removeEventListener("keydown", kd);
  });

  // ---- touch controls ----
  const stickRef = useRef<HTMLDivElement>(null);
  const moveStick = (e: React.PointerEvent) => {
    const r = stickRef.current!.getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    if (l < 0.15) { x = 0; y = 0; }
    setStick({ x, y, on: true });
    if (gameRef.current) { gameRef.current.touch.mx = x; gameRef.current.touch.my = y; }
  };
  const endStick = () => { setStick({ x: 0, y: 0, on: false }); if (gameRef.current) { gameRef.current.touch.mx = 0; gameRef.current.touch.my = 0; } };
  const tbtn = (label: string, cls: string, down: () => void, up?: () => void) => (
    <button
      className={`rounded-full text-2xl font-bold border-2 border-white/30 bg-black/40 text-white active:scale-90 select-none touch-none ${cls}`}
      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); down(); }}
      onPointerUp={() => up?.()} onPointerCancel={() => up?.()}
    >{label}</button>
  );

  const realmDef = REALMS[loc.realm];
  const boss = hud?.boss;
  const isBossLoc = loc.room >= 4;
  const keepGold = Math.floor((hud?.gold ?? 0) * keepPct);

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
      <div ref={boxRef} className="relative" style={{ width: "min(100vw, calc(100dvh * 16 / 9))", aspectRatio: "16 / 9" }}>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block cursor-crosshair" />
        {/* HUD (design space 1280x720, scaled) */}
        {hud && (
          <div className="absolute left-0 top-0 pointer-events-none" style={{ width: 1280, height: 720, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
            <div className="absolute left-4 top-3 w-[330px]">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-9 h-9 rounded-full border-2 border-white/40" style={{ background: hud.color }} />
                <div className="font-title text-xl text-amber-100 drop-shadow">{hud.name} <span className="text-sm text-violet-300">Gen {cfg.gen}</span></div>
              </div>
              <div className="relative h-6 rounded bg-black/60 border border-white/20 overflow-hidden">
                <div className="h-full transition-all duration-150" style={{ width: `${(hud.hp / hud.maxHp) * 100}%`, background: hud.hp / hud.maxHp < 0.3 ? "linear-gradient(#ff4a4a,#a81616)" : "linear-gradient(#ff7a7a,#c22)" }} />
                <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white drop-shadow">{hud.hp} / {hud.maxHp}</div>
              </div>
              <div className="relative h-3.5 mt-1 rounded bg-black/60 border border-white/20 overflow-hidden">
                <div className="h-full" style={{ width: `${hud.special}%`, background: hud.special >= 100 ? "linear-gradient(90deg,#ffcf5a,#fff,#ffcf5a)" : "linear-gradient(#e0a93a,#9a6a12)" }} />
                <div className="absolute inset-0 text-[10px] font-bold text-center leading-3 text-white drop-shadow">{hud.special >= 100 ? "ANCESTRAL ROAR READY — Q" : `Roar ${Math.floor(hud.special)}%`}</div>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-sm text-white">
                <div className="flex items-center gap-1">💨<div className="w-14 h-2 rounded bg-black/60 border border-white/20 overflow-hidden"><div className="h-full bg-sky-300" style={{ width: `${hud.dash * 100}%` }} /></div></div>
                <div>🧪 ×{hud.potions}</div>
                <div title="Ancestors empowering your Roar">👻 {hud.ancestors}</div>
                {hud.revive && <div title="Ancestor's Mercy ready">🕊️</div>}
              </div>
            </div>
            <div className="absolute right-4 top-3 text-right text-white">
              <div className="text-2xl font-bold text-amber-300 drop-shadow">🪙 {hud.gold}</div>
              <div className="text-sm text-violet-200">☠ {hud.kills} · ⏱ {fmtTime(hud.time)}</div>
              <div className="text-sm text-violet-300">👹 {hud.enemies} left</div>
              <button className="pointer-events-auto mt-1 rounded bg-black/50 border border-white/30 px-3 py-1 text-sm hover:bg-black/70 cursor-pointer" onClick={() => setPaused(true)}>⏸ Pause</button>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 top-3 text-center">
              {!tutorial && <div className="text-sm font-title" style={{ color: realmDef.accent }}>{realmDef.name} · {isBossLoc ? "Boss" : `Room ${loc.room + 1}/4`} {hud.wave && `· ${hud.wave}`}</div>}
              {tutorial && <div className="text-sm font-title text-amber-200">Training Grounds · Step {Math.min((hud.tut?.step ?? 0) + 1, hud.tut?.total ?? 7)}/{hud.tut?.total}</div>}
              {boss && (
                <div className="mt-1 w-[520px]">
                  <div className="font-title text-lg text-red-200 drop-shadow">{boss.name} <span className="text-xs text-violet-300 italic">{boss.title}</span></div>
                  <div className="h-4 rounded bg-black/70 border border-white/30 overflow-hidden"><div className="h-full transition-all duration-150" style={{ width: `${(boss.hp / boss.max) * 100}%`, background: `linear-gradient(#ff6a6a,${BOSSES[REALMS[loc.realm].boss].color})` }} /></div>
                </div>
              )}
            </div>
            <div className="absolute left-4 bottom-3 flex flex-wrap gap-1 max-w-[560px]">
              {Object.entries(hud.boons).map(([id, lv]) => BOONS[id] && lv > 0 && (
                <div key={id} className="relative w-9 h-9 rounded-lg bg-black/60 border border-amber-200/40 flex items-center justify-center text-lg" title={`${BOONS[id].name} Lv${lv}`}>
                  {BOONS[id].icon}<span className="absolute -bottom-1 -right-1 text-[10px] bg-amber-300 text-black rounded px-1 font-bold">{lv}</span>
                </div>
              ))}
            </div>
            {hud.tut && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-8 max-w-[760px] text-center rounded-xl bg-black/75 border-2 border-amber-300/70 px-6 py-3 text-xl text-amber-100 anim-glow">{hud.tut.text}</div>
            )}
          </div>
        )}
      </div>

      {/* touch controls */}
      {isTouch && phase === "fight" && !paused && (
        <>
          <div ref={stickRef} className="fixed left-4 bottom-4 w-36 h-36 rounded-full bg-white/10 border-2 border-white/30 touch-none" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); moveStick(e); }} onPointerMove={(e) => stick.on && moveStick(e)} onPointerUp={endStick} onPointerCancel={endStick}>
            <div className="absolute w-14 h-14 rounded-full bg-white/40 left-1/2 top-1/2" style={{ transform: `translate(calc(-50% + ${stick.x * 40}px), calc(-50% + ${stick.y * 40}px))` }} />
          </div>
          <div className="fixed right-4 bottom-4 w-52 h-52">
            {tbtn("⚔", "absolute right-0 bottom-0 w-24 h-24 !bg-red-800/60", () => { if (gameRef.current) gameRef.current.touch.atk = true; }, () => { if (gameRef.current) gameRef.current.touch.atk = false; })}
            {tbtn("💨", "absolute left-0 bottom-2 w-16 h-16", () => gameRef.current?.touchAction("dash"))}
            {tbtn("📢", "absolute left-4 top-0 w-16 h-16", () => gameRef.current?.touchAction("special"))}
            {tbtn("🧪", "absolute right-2 top-2 w-14 h-14 !text-xl", () => gameRef.current?.touchAction("potion"))}
          </div>
        </>
      )}

      {/* overlays */}
      {phase === "boon" && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/65 p-3">
          <h2 className="font-title text-3xl sm:text-4xl text-amber-200 mb-1 anim-pop">Choose a Boon</h2>
          <p className="text-violet-300 text-sm mb-4">The ancestors offer their gifts. Press 1-3 or click.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {boonChoices.map((id, i) => {
              const b = BOONS[id], lv = (hud?.boons[id] || 0);
              return (
                <button key={id} onClick={() => pickBoon(id)} className={`anim-up w-52 rounded-2xl border-2 bg-gradient-to-b ${RARITY[b.rarity]} to-black/70 p-4 text-left hover:scale-105 hover:brightness-125 transition cursor-pointer`} style={{ animationDelay: `${i * 80}ms` }}>
                  <div className="text-xs uppercase tracking-widest text-violet-300 flex justify-between"><span>{b.rarity}</span><span>[{i + 1}]</span></div>
                  <div className="text-4xl my-2">{b.icon}</div>
                  <div className="font-title text-xl text-amber-100">{b.name}</div>
                  <div className="text-sm text-violet-100 mt-1">{b.desc}</div>
                  <div className="text-xs text-emerald-300 mt-2">{lv > 0 ? `Level ${lv} → ${lv + 1}` : "New"}</div>
                </button>
              );
            })}
          </div>
          <Btn variant="ghost" className="mt-4" onClick={() => { g().run.gold += 25; audio.sfx("coin"); const n = boonNext.current; boonNext.current = null; n?.(); }}>Skip (+25 gold)</Btn>
        </div>
      )}
      {phase === "relic" && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/70 p-3">
          <h2 className="font-title text-3xl sm:text-4xl text-amber-200 mb-1 anim-pop">An Heirloom Appears</h2>
          <p className="text-violet-300 text-sm mb-4 text-center">Relics are kept forever and grow stronger every generation they are carried. Choose one.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {relicChoices.map((id, i) => (
              <button key={id} onClick={() => pickRelic(id)} className="anim-up w-60 rounded-2xl border-2 border-amber-300/70 bg-gradient-to-b from-amber-700/40 to-black/70 p-4 text-left hover:scale-105 transition cursor-pointer" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="text-xs uppercase tracking-widest text-amber-300">Heirloom [{i + 1}]</div>
                <div className="text-5xl my-2">{RELICS[id].icon}</div>
                <div className="font-title text-xl text-amber-100">{RELICS[id].name}</div>
                <div className="text-sm text-violet-100 mt-1">{RELICS[id].desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      {phase === "door" && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/65 p-3">
          <h2 className="font-title text-3xl sm:text-4xl text-amber-200 mb-1 anim-pop">{doors[0] === "boss" ? "The Final Door" : "Choose Your Path"}</h2>
          <p className="text-violet-300 text-sm mb-4">Gold carried: <b className="text-amber-300">🪙 {hud?.gold ?? 0}</b> · HP {hud?.hp}/{hud?.maxHp}</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {doors.map((k, i) => (
              <button key={k + i} onClick={() => enterDoor(k)} className={`anim-up w-56 rounded-2xl border-2 p-4 text-left hover:scale-105 transition cursor-pointer bg-gradient-to-b to-black/70 ${k === "boss" ? "border-red-400/70 from-red-900/60" : k === "elite" ? "border-amber-300/70 from-amber-800/50" : "border-violet-300/40 from-violet-800/50"}`} style={{ animationDelay: `${i * 100}ms` }}>
                <div className="text-xs text-violet-300">[{i + 1}]</div>
                <div className="text-5xl my-2">{DOOR_INFO[k].icon}</div>
                <div className="font-title text-xl text-amber-100">{k === "boss" ? BOSSES[REALMS[loc.realm].boss].name : DOOR_INFO[k].name}</div>
                <div className="text-sm text-violet-100 mt-1">{DOOR_INFO[k].desc}</div>
              </button>
            ))}
          </div>
          <Btn variant="ghost" className="mt-5" onClick={() => finish("retreat")}>🏠 Return Home (keep all {hud?.gold ?? 0} gold)</Btn>
        </div>
      )}
      {phase === "rest" && (
        <Modal title="🏕️ Quiet Camp" z={40}>
          <p className="text-violet-200 mb-3">A rare moment of peace. Choose how to spend it.</p>
          <div className="grid gap-2">
            <Btn variant="good" onClick={() => { g().healFrac(0.5); openDoors(); }}>🍖 Rest: heal 50% of max health</Btn>
            <Btn onClick={() => { g().p.potions++; audio.sfx("potion"); openDoors(); }}>🧪 Brew: gain a healing potion</Btn>
            <Btn variant="primary" onClick={() => startBoon(openDoors)}>🙏 Pray: choose a boon</Btn>
          </div>
        </Modal>
      )}
      {phase === "merchant" && (
        <Modal title="🛒 Wandering Merchant" z={40} wide>
          <p className="text-violet-200 mb-3">You have <b className="text-amber-300">🪙 {gold}</b>.</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {offers.map((o) => (
              <div key={o.id} className={`rounded-lg border p-3 flex items-center gap-3 ${o.sold ? "opacity-40 border-white/10" : "border-white/20 bg-white/5"}`}>
                <div className="text-3xl">{o.icon}</div>
                <div className="flex-1"><div className="font-bold text-amber-100">{o.name}</div><div className="text-xs text-violet-300">{o.desc}</div></div>
                <Btn variant="primary" className="!py-1 !text-sm" disabled={o.sold || gold < o.price} onClick={() => buy(o)}>{o.sold ? "Sold" : `${o.price}g`}</Btn>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end"><Btn variant="primary" onClick={openDoors}>Leave →</Btn></div>
        </Modal>
      )}
      {phase === "bossclear" && (
        <Modal title={`${BOSSES[REALMS[prog.current.realm].boss].name} is slain!`} z={40}>
          <p className="text-violet-200 mb-1">The realm of <b style={{ color: REALMS[prog.current.realm].accent }}>{REALMS[prog.current.realm].name}</b> is conquered. Future heroes may begin their delve at the next realm.</p>
          <p className="text-violet-300 text-sm mb-4">Gold carried: <b className="text-amber-300">{hud?.gold ?? 0}</b>. You may descend now, restoring 30% health, or return home and keep everything.</p>
          <div className="grid gap-2">
            <Btn variant="primary" onClick={descend}>⬇ Descend into {REALMS[Math.min(4, prog.current.realm + 1)].name}</Btn>
            <Btn onClick={() => finish("retreat")}>🏠 Return Home with {hud?.gold ?? 0} gold</Btn>
          </div>
        </Modal>
      )}
      {phase === "victory" && (
        <Modal title="👑 THE HOLLOW KING FALLS" z={40}>
          <p className="text-violet-100 mb-4 font-title text-lg italic">The first heir lets go at last. The crown crumbles. Your family's long vigil is over.</p>
          <div className="flex justify-end"><Btn variant="primary" onClick={() => finish("victory")}>Claim the Dynasty's Glory →</Btn></div>
        </Modal>
      )}
      {phase === "tutdone" && (
        <Modal title="🎓 Training Complete" z={40}>
          <p className="text-violet-100 mb-4">You know the basics: move, strike, dash, roar, heal and deflect. The rest is learned in blood and gold. Go found your dynasty.</p>
          <div className="flex justify-end"><Btn variant="primary" onClick={() => finish("tutorial")}>Finish →</Btn></div>
        </Modal>
      )}

      {paused && modal === null && (
        <Modal title="⏸ Paused" z={60}>
          <div className="grid gap-2">
            <Btn variant="primary" onClick={() => setPaused(false)}>▶ Resume</Btn>
            <Btn onClick={() => setModal("settings")}>⚙️ Settings & Volume</Btn>
            <Btn onClick={() => setModal("help")}>❓ How to Play & Controls</Btn>
            {tutorial ? <Btn variant="danger" onClick={() => finish("tutorial")}>Exit Training</Btn> : <Btn variant="danger" onClick={() => setModal("abandon")}>🏳️ Abandon Run</Btn>}
          </div>
        </Modal>
      )}
      {paused && modal === "settings" && <SettingsModal settings={settings} onChange={onSettings} onClose={() => setModal(null)} />}
      {paused && modal === "help" && <HelpModal onClose={() => setModal(null)} />}
      {paused && modal === "abandon" && (
        <Modal title="Abandon this run?" z={70}>
          <p className="text-violet-100 mb-4">Your hero will fall here. You keep {Math.round(keepPct * 100)}% of the gold carried ({keepGold}), then an heir takes over.</p>
          <div className="flex gap-2 justify-end">
            <Btn variant="ghost" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={() => { setPaused(false); g().killPlayer(); }}>Abandon</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
