import { useEffect, useReducer, useRef, useState } from "react";
import { Scene, W, H } from "../game/scene";
import { type Game, POTIONS, getMaxIntegrity, potionValue, ROMAN, DAY_LEN } from "../game/data";
import { PotionIcon, Pips } from "./Icons";
import { sfx, startMusic } from "../game/audio";

interface Props {
  g: Game;
  onFinish: (result: "done" | "over") => void;
}

export default function Shop({ g, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const scene = new Scene(g);
    sceneRef.current = scene;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let reported = false;
    startMusic("tense");
    sfx.open();

    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      scene.update(dt);
      scene.draw(ctx);
      acc += dt;
      if (acc > 0.1) {
        acc = 0;
        force();
      }
      if (scene.ending !== "none" && scene.endT > 1.3 && !reported) {
        reported = true;
        force();
        finishRef.current(scene.ending);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "p" || e.key === "P") {
        scene.paused = !scene.paused;
        setPaused(scene.paused);
      } else if (e.key === "Escape") {
        scene.selectStack(null);
        force();
      } else if (e.key === "f" || e.key === "F") {
        scene.speed = scene.speed === 1 ? 2 : 1;
        setSpeed(scene.speed);
      } else if (/^[1-9]$/.test(e.key)) {
        const stacks = groupShelf(g);
        const s = stacks[Number(e.key) - 1];
        if (s) {
          scene.selectStack(scene.sel === s.id ? null : s.id);
          sfx.select();
          force();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scene = sceneRef.current;

  const toCanvas = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
  };

  const stacks = groupShelf(g);
  const maxI = getMaxIntegrity(g);
  const integrityPct = Math.max(0, (g.integrity / maxI) * 100);
  const remaining = scene ? g.schedule.length - scene.spawnIdx + scene.mons.filter((m) => m.state !== "leave").length : 0;
  const prog = scene ? scene.dayProgress * 100 : 0;
  const combo = scene && scene.time - scene.lastServe < 10 ? scene.combo : 0;
  const selId = scene?.shelfIndex() !== undefined && scene.shelfIndex() >= 0 ? scene.sel : null;

  return (
    <div className="mx-auto w-full max-w-[1000px] p-2 sm:p-3 select-none">
      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm">
        <div className="font-bold text-emerald-300">Day {g.day}</div>
        <div className="rounded-md bg-amber-400/15 px-2 py-0.5 font-bold text-amber-300">{g.gold}g</div>
        <div className="flex min-w-[170px] flex-1 items-center gap-2">
          <span className="text-xs text-rose-200">Shop</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/10">
            <div className="h-full rounded-full transition-all" style={{ width: `${integrityPct}%`, background: integrityPct > 50 ? "linear-gradient(90deg,#2fbf71,#7be495)" : integrityPct > 25 ? "#e0a82e" : "#e5484d" }} />
          </div>
          <span className="w-16 text-right text-xs tabular-nums text-white/80">{Math.ceil(g.integrity)}/{maxI}</span>
        </div>
        <div className="flex min-w-[120px] items-center gap-2">
          <span className="text-xs text-sky-200">Night</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/60">
            <div className="h-full bg-sky-400/80" style={{ width: `${Math.min(100, prog)}%` }} />
          </div>
          <span className="text-xs text-white/60">{Math.max(0, Math.ceil(DAY_LEN - (scene?.time ?? 0)))}s</span>
        </div>
        <div className="text-xs text-white/70">Monsters left: <b className="text-white">{remaining}</b></div>
        {combo > 1 && <div className="animate-pulse rounded-md bg-emerald-400/20 px-2 py-0.5 text-xs font-bold text-emerald-300">Combo x{combo}</div>}
        <div className="ml-auto flex gap-1">
          <button
            className="rounded-md bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
            onClick={() => {
              if (!scene) return;
              scene.speed = scene.speed === 1 ? 2 : 1;
              setSpeed(scene.speed);
            }}
            title="Toggle speed (F)"
          >
            {speed === 1 ? ">" : ">>"} Speed
          </button>
          <button
            className="rounded-md bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
            onClick={() => {
              if (!scene) return;
              scene.paused = !scene.paused;
              setPaused(scene.paused);
            }}
            title="Pause (P)"
          >
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border-2 border-amber-900/60 shadow-[0_0_40px_rgba(0,0,0,.6)]">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block w-full cursor-crosshair bg-black"
          style={{ aspectRatio: `${W}/${H}` }}
          onMouseMove={(e) => {
            if (scene) scene.mouse = toCanvas(e);
          }}
          onMouseLeave={() => {
            if (scene) scene.mouse = { x: -1, y: -1 };
          }}
          onClick={(e) => {
            if (!scene) return;
            const p = toCanvas(e);
            scene.mouse = p;
            scene.click(p.x, p.y);
            force();
          }}
        />
        {paused && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="text-4xl font-bold text-white">Paused</div>
            <button
              className="mt-4 rounded-lg bg-emerald-500 px-6 py-2 font-bold text-black hover:bg-emerald-400"
              onClick={() => {
                if (!scene) return;
                scene.paused = false;
                setPaused(false);
              }}
            >
              Resume (P)
            </button>
          </div>
        )}
        {scene && scene.ending === "over" && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-950/60 text-4xl font-bold text-white">The shop has fallen...</div>
        )}
        {scene && scene.ending === "done" && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-950/40 text-4xl font-bold text-white">Closing time!</div>
        )}
      </div>

      <div className="mt-2 rounded-xl border border-white/10 bg-black/40 p-2">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/60">
          <span>
            <b className="text-white/80">Potion Shelf</b> - select a potion (click or keys 1-9), then click a <span className="text-emerald-300">customer</span> to serve or a <span className="text-rose-300">red-ringed raider</span> to throw it. No potion selected = swat (weak).
          </span>
          <span>{g.shelf.length} potions</span>
        </div>
        {stacks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/15 p-3 text-center text-sm text-white/50">
            Shelf empty! You can still swat raiders by clicking them, but customers will lose patience...
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {stacks.map((s, i) => (
              <button
                key={s.id}
                onClick={() => {
                  if (!scene) return;
                  scene.selectStack(scene.sel === s.id ? null : s.id);
                  sfx.select();
                  force();
                }}
                className={`relative flex items-center gap-2 rounded-lg border px-2 py-1 text-left transition ${selId === s.id ? "border-emerald-300 bg-emerald-400/20 shadow-[0_0_14px_rgba(52,211,153,.5)]" : "border-white/15 bg-white/5 hover:bg-white/10"}`}
              >
                <span className="absolute -left-1 -top-1 rounded bg-black/80 px-1 text-[10px] text-white/70">{i + 1}</span>
                <PotionIcon k={s.key} tier={s.tier} size={34} />
                <span className="leading-tight">
                  <span className="block text-xs font-semibold">{POTIONS[s.key].name}</span>
                  <span className="block text-[10px] text-white/60">
                    Tier {ROMAN[s.tier]} <Pips tier={s.tier} /> - {potionValue(s.key, s.tier)}g
                  </span>
                </span>
                <span className="ml-1 rounded-full bg-black/60 px-2 py-0.5 text-sm font-bold text-amber-200">x{s.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export interface Stack {
  id: string;
  key: string;
  tier: number;
  count: number;
}

export function groupShelf(g: Game): Stack[] {
  const m = new Map<string, Stack>();
  for (const p of g.shelf) {
    const id = `${p.key}:${p.tier}`;
    const s = m.get(id);
    if (s) s.count++;
    else m.set(id, { id, key: p.key, tier: p.tier, count: 1 });
  }
  const order = ["E", "D", "M", "S", "ED", "EM", "ES", "DM", "DS", "MS", "X"];
  return [...m.values()].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key) || a.tier - b.tier);
}
