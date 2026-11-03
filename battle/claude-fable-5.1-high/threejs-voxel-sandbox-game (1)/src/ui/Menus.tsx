import { useEffect, useState } from "react";
import { type Settings, type WorldMeta, type GameMode, type Difficulty, listWorlds, createWorldMeta, deleteWorld, storageUsageKB } from "../game/save";
import { hashString } from "../game/noise";
import { useHud } from "../game/store";
import { ItemIcon } from "./ItemIcon";
import { B, I } from "../game/blocks";

// ---------- Settings ----------
export function SettingsPanel({ settings, onChange, onBack }: { settings: Settings; onChange: (s: Settings) => void; onBack: () => void }) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });
  const Range = ({ label, k, min, max, step = 1, fmt }: { label: string; k: keyof Settings; min: number; max: number; step?: number; fmt?: (v: number) => string }) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="text-white/60">{fmt ? fmt(settings[k] as number) : settings[k]}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={settings[k] as number} onChange={(e) => set(k, parseFloat(e.target.value) as never)} />
    </label>
  );
  const Toggle = ({ label, k }: { label: string; k: keyof Settings }) => (
    <button className="mc-btn !py-1.5 text-sm" onClick={() => set(k, !(settings[k] as boolean) as never)}>
      {label}: {(settings[k] as boolean) ? "ON" : "OFF"}
    </button>
  );
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <div className="mc-panel w-[520px] p-6">
      <h2 className="mb-4 text-xl font-bold">Settings</h2>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <Range label="Render Distance" k="renderDistance" min={3} max={14} fmt={(v) => `${v} chunks`} />
        <Range label="Field of View" k="fov" min={50} max={110} fmt={(v) => `${v}°`} />
        <Range label="Mouse Sensitivity" k="sensitivity" min={0.2} max={3} step={0.1} fmt={pct} />
        <Range label="Master Volume" k="master" min={0} max={1} step={0.05} fmt={pct} />
        <Range label="Sound Effects" k="sfx" min={0} max={1} step={0.05} fmt={pct} />
        <Range label="Music" k="music" min={0} max={1} step={0.05} fmt={pct} />
        <Range label="Ambience" k="ambient" min={0} max={1} step={0.05} fmt={pct} />
        <div />
        <Toggle label="View Bobbing" k="bobbing" />
        <Toggle label="Particles" k="particles" />
        <Toggle label="Invert Mouse Y" k="invertY" />
        <Toggle label="Debug Info (F3)" k="showDebug" />
      </div>
      <div className="mt-5 flex justify-end">
        <button className="mc-btn" onClick={onBack}>
          Done
        </button>
      </div>
    </div>
  );
}

// ---------- Main menu ----------
export function MainMenu({ settings, onSettings, onPlay }: { settings: Settings; onSettings: (s: Settings) => void; onPlay: (meta: WorldMeta) => void }) {
  const [worlds, setWorlds] = useState<WorldMeta[]>(() => listWorlds());
  const [view, setView] = useState<"main" | "create" | "settings">("main");
  const [name, setName] = useState("New World");
  const [seedText, setSeedText] = useState("");
  const [mode, setMode] = useState<GameMode>("survival");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const create = () => {
    const st = seedText.trim();
    const seed = st === "" ? Math.floor(Math.random() * 2147483647) : /^-?\d+$/.test(st) ? parseInt(st) >>> 0 : hashString(st);
    const meta = createWorldMeta(name.trim() || "New World", st || String(seed), mode, difficulty, seed);
    onPlay(meta);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 20%, #2a4f8a 0%, #0f1a33 55%, #070a14 100%)" }}>
      <BackgroundBlocks />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="mc-title text-6xl text-white">VOXELCRAFT</h1>
          <p className="mt-2 text-sm tracking-widest text-yellow-300">A BLOCKY SANDBOX ADVENTURE</p>
        </div>
        {view === "main" && (
          <div className="mc-panel w-[560px] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Your Worlds</h2>
              <span className="text-xs text-white/50">{storageUsageKB()} KB saved</span>
            </div>
            <div className="scroll-thin max-h-72 space-y-2 overflow-y-auto pr-1">
              {worlds.length === 0 && <div className="py-8 text-center text-white/50">No worlds yet. Create one to begin!</div>}
              {worlds.map((w) => (
                <div key={w.id} className="flex items-center gap-3 border-2 border-white/10 bg-white/5 p-2 hover:bg-white/10">
                  <ItemIcon id={w.mode === "creative" ? B.DIAMOND_ORE : B.GRASS} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{w.name}</div>
                    <div className="text-xs text-white/60">
                      {w.mode === "creative" ? "Creative" : `Survival · ${w.difficulty}`} · seed {w.seedText} · {new Date(w.lastPlayed).toLocaleDateString()} · {Math.round(w.playTime / 60)} min played
                    </div>
                  </div>
                  <button className="mc-btn primary !px-3 !py-1 text-sm" onClick={() => onPlay(w)}>
                    Play
                  </button>
                  {confirmDelete === w.id ? (
                    <button
                      className="mc-btn danger !px-3 !py-1 text-sm"
                      onClick={() => {
                        deleteWorld(w.id);
                        setWorlds(listWorlds());
                        setConfirmDelete(null);
                      }}
                    >
                      Confirm
                    </button>
                  ) : (
                    <button className="mc-btn !px-3 !py-1 text-sm" onClick={() => setConfirmDelete(w.id)}>
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="mc-btn primary" onClick={() => setView("create")}>
                Create New World
              </button>
              <button className="mc-btn" onClick={() => setView("settings")}>
                Settings
              </button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] text-white/50">
              <div>WASD · Space · Ctrl sprint · Shift sneak</div>
              <div>LMB break · RMB place/use · E inventory</div>
              <div>1-9 / wheel hotbar · Q drop · F3 debug</div>
            </div>
          </div>
        )}
        {view === "create" && (
          <div className="mc-panel w-[520px] p-6">
            <h2 className="mb-4 text-lg font-bold">Create New World</h2>
            <label className="mb-3 block text-sm">
              World Name
              <input className="mc-input mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} maxLength={32} />
            </label>
            <label className="mb-3 block text-sm">
              Seed <span className="text-white/50">(leave blank for random)</span>
              <input className="mc-input mt-1 w-full" value={seedText} onChange={(e) => setSeedText(e.target.value)} placeholder="e.g. 42 or 'emerald valley'" />
            </label>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <button className="mc-btn" onClick={() => setMode(mode === "survival" ? "creative" : "survival")}>
                Game Mode: {mode === "survival" ? "Survival" : "Creative"}
              </button>
              <button className="mc-btn" disabled={mode === "creative"} onClick={() => setDifficulty(difficulty === "normal" ? "peaceful" : "normal")}>
                Difficulty: {difficulty === "normal" ? "Normal" : "Peaceful"}
              </button>
            </div>
            <p className="mb-4 text-xs text-white/60">
              {mode === "survival" ? "Gather resources, craft tools, survive the night. Hunger, fall damage and monsters are enabled." : "Unlimited blocks, flight (double-tap Space) and instant mining. Build without limits."}
            </p>
            <div className="flex justify-between">
              <button className="mc-btn" onClick={() => setView("main")}>
                Back
              </button>
              <button className="mc-btn primary" onClick={create}>
                Create World
              </button>
            </div>
          </div>
        )}
        {view === "settings" && <SettingsPanel settings={settings} onChange={onSettings} onBack={() => setView("main")} />}
      </div>
    </div>
  );
}

function BackgroundBlocks() {
  const ids = [B.GRASS, B.STONE, B.LOG, B.DIAMOND_ORE, B.SAND, B.GLOWSTONE, B.LEAVES, B.BRICK, B.GOLD_ORE, B.CRAFTING_TABLE, B.PUMPKIN, B.ICE, I.DIAMOND_PICKAXE, B.BOOKSHELF, B.FURNACE, B.SNOW];
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      setT((performance.now() - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-40">
      {ids.map((id, i) => {
        const x = ((i * 137.5) % 100) + Math.sin(t * 0.3 + i) * 2;
        const y = ((i * 61.8 + t * (4 + (i % 3) * 2)) % 120) - 10;
        return (
          <div key={i} className="absolute" style={{ left: `${x}%`, top: `${y}%`, transform: `rotate(${Math.sin(t * 0.5 + i) * 15}deg) scale(${1 + (i % 3) * 0.4})` }}>
            <ItemIcon id={id} size={48} />
          </div>
        );
      })}
    </div>
  );
}

// ---------- Loading ----------
export function LoadingScreen() {
  const hud = useHud();
  const tips = ["Punch trees to collect wood — it's the start of everything.", "Craft a crafting table from 4 planks to unlock tools.", "Torches keep monsters from spawning nearby.", "Zombies burn in sunlight. Survive until dawn!", "Cook meat in a furnace for more nourishment.", "Diamonds hide below Y=16. Bring an iron pickaxe.", "Sleep in a bed at night to skip to morning and set your spawn.", "Hold Ctrl to sprint. Sprinting makes you hungry faster.", "Shift-sneak at ledges so you don't fall off.", "Water breaks your fall. Lava does not."];
  const [tip] = useState(() => tips[Math.floor(Math.random() * tips.length)]);
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0b0f1a] text-white">
      <div className="mc-panel w-[480px] p-6 text-center">
        <h2 className="mc-title text-2xl">Building {hud.worldName}</h2>
        <div className="mt-4 h-4 w-full border-2 border-white/30 bg-black/50">
          <div className="h-full bg-gradient-to-r from-green-500 to-lime-400 transition-all" style={{ width: `${Math.round(hud.loadingProgress * 100)}%` }} />
        </div>
        <div className="mt-2 text-sm text-white/70">{hud.loadingText}</div>
        <div className="mt-5 text-xs italic text-yellow-200/80">Tip: {tip}</div>
      </div>
    </div>
  );
}

// ---------- Pause ----------
export function PauseMenu({ settings, onSettings, onResume, onQuit, stats, achievements }: { settings: Settings; onSettings: (s: Settings) => void; onResume: () => void; onQuit: () => void; stats: Record<string, number>; achievements: number }) {
  const [view, setView] = useState<"main" | "settings">("main");
  const hud = useHud();
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50">
      {view === "main" ? (
        <div className="mc-panel w-[380px] p-6 text-center">
          <h2 className="mc-title mb-5 text-2xl">Game Paused</h2>
          <div className="flex flex-col gap-2">
            <button className="mc-btn primary" onClick={onResume}>
              Back to Game
            </button>
            <button className="mc-btn" onClick={() => setView("settings")}>
              Settings
            </button>
            <button className="mc-btn danger" onClick={onQuit}>
              Save & Quit to Title
            </button>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-1 text-left text-xs text-white/70">
            <span>Blocks mined</span>
            <span className="text-right">{stats.mined}</span>
            <span>Blocks placed</span>
            <span className="text-right">{stats.placed}</span>
            <span>Items crafted</span>
            <span className="text-right">{stats.crafted}</span>
            <span>Mobs slain</span>
            <span className="text-right">{stats.kills}</span>
            <span>Deaths</span>
            <span className="text-right">{stats.deaths}</span>
            <span>Achievements</span>
            <span className="text-right">{achievements} / 16</span>
            <span>Time played</span>
            <span className="text-right">{Math.floor(hud.playTime / 60)}m</span>
          </div>
          <div className="mt-3 text-[11px] text-white/40">Progress is saved automatically.</div>
        </div>
      ) : (
        <SettingsPanel settings={settings} onChange={onSettings} onBack={() => setView("main")} />
      )}
    </div>
  );
}

// ---------- Death ----------
export function DeathScreen({ onRespawn, onQuit }: { onRespawn: () => void; onQuit: () => void }) {
  const hud = useHud();
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-red-900/60">
      <div className="text-center text-white">
        <h2 className="mc-title text-5xl">You Died!</h2>
        <p className="mt-3 text-lg text-white/80">{hud.deathCause}</p>
        <p className="mt-1 text-sm text-yellow-200">Score: {hud.xp}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button className="mc-btn primary" onClick={onRespawn}>
            Respawn
          </button>
          <button className="mc-btn" onClick={onQuit}>
            Title Screen
          </button>
        </div>
      </div>
    </div>
  );
}
