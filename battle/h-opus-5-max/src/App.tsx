import { useCallback, useEffect, useRef, useState } from "react";
import { Game } from "./game/engine";
import * as persistence from "./game/persistence";
import { deleteWorld, listWorlds, loadWorld, type SaveData } from "./game/persistence";
(window as any).__persist = persistence;
import { hashString } from "./game/noise";
import { audio } from "./game/audio";
import {
  Controls,
  DEFAULT_SETTINGS,
  DeathScreen,
  FurnaceScreen,
  Hud,
  InventoryScreen,
  MenuButton,
  PauseMenu,
  useSnapshot,
  type Settings,
} from "./ui/GameUI";

type View = "menu" | "loading" | "playing";

function loadSettings(): Settings {
  try {
    const s = localStorage.getItem("vc_settings");
    if (s) return { ...DEFAULT_SETTINGS, ...JSON.parse(s) };
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

export default function App() {
  const [view, setView] = useState<View>("menu");
  const [worlds, setWorlds] = useState<{ key: string; data: SaveData }[]>([]);
  const [game, setGame] = useState<Game | null>(null);
  const [settings, setSettingsState] = useState<Settings>(loadSettings);
  const [newName, setNewName] = useState("New World");
  const [newSeed, setNewSeed] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const snap = useSnapshot(game);

  const setSettings = useCallback((s: Settings) => {
    setSettingsState(s);
    localStorage.setItem("vc_settings", JSON.stringify(s));
    audio.setVolumes(0.9, s.music, s.sfx);
  }, []);

  useEffect(() => {
    void listWorlds().then(setWorlds);
  }, [view]);

  useEffect(() => {
    audio.setVolumes(0.9, settings.music, settings.sfx);
  }, [settings.music, settings.sfx]);

  const startGame = useCallback(
    async (key: string, name: string, seed: number) => {
      setView("loading");
      setProgress(0.05);
      await new Promise((r) => setTimeout(r, 40));
      const el = containerRef.current;
      if (!el) return;
      const save = await loadWorld(key);
      const g = new Game(el, key, name, save?.seed ?? seed);
      g.sensitivity = settings.sensitivity;
      g.setRenderDistance(settings.renderDistance);
      setProgress(0.3);
      await new Promise((r) => setTimeout(r, 30));
      await g.init(save);
      setProgress(0.85);
      await new Promise((r) => setTimeout(r, 30));
      audio.resume();
      audio.setVolumes(0.9, settings.music, settings.sfx);
      g.start();
      (window as any).__game = g;
      setGame(g);
      setProgress(1);
      setView("playing");
      setTimeout(() => g.requestLock(), 120);
    },
    [settings],
  );

  const quit = useCallback(() => {
    if (game) {
      void game.save();
      game.dispose();
    }
    setGame(null);
    setView("menu");
  }, [game]);

  useEffect(() => {
    return () => {
      game?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onBeforeUnload = () => {
      if (game) void game.save();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [game]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-stone-100 select-none">
      <div ref={containerRef} className="absolute inset-0" />

      {view === "playing" && game && snap && (
        <>
          <Hud s={snap} game={game} />
          {(snap.screen === "inventory" || snap.screen === "crafting") && (
            <InventoryScreen s={snap} game={game} />
          )}
          {snap.screen === "furnace" && <FurnaceScreen s={snap} game={game} />}
          {snap.screen === "pause" && (
            <PauseMenu
              s={snap}
              game={game}
              onQuit={quit}
              settings={settings}
              setSettings={setSettings}
            />
          )}
          {snap.screen === "death" && <DeathScreen game={game} />}
          {snap.screen === "none" && !game.pointerLocked && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-black/40"
              onClick={() => game.requestLock()}
            >
              <div className="rounded-lg bg-black/60 px-6 py-3 text-sm tracking-wide ring-1 ring-white/15">
                Click to play
              </div>
            </div>
          )}
        </>
      )}

      {view === "loading" && <LoadingScreen progress={progress} />}

      {view === "menu" && (
        <MainMenu
          worlds={worlds}
          showNew={showNew}
          setShowNew={setShowNew}
          newName={newName}
          setNewName={setNewName}
          newSeed={newSeed}
          setNewSeed={setNewSeed}
          onPlay={startGame}
          onDelete={async (k) => {
            await deleteWorld(k);
            setWorlds(await listWorlds());
          }}
        />
      )}
    </div>
  );
}

function LoadingScreen({ progress }: { progress: number }) {
  const tips = [
    "Mine stone with a pickaxe to collect cobblestone.",
    "Place torches to stop monsters spawning nearby.",
    "A furnace smelts ore into ingots — fuel it with coal.",
    "Diamonds hide below y=16. Bring food.",
    "Saplings grow into trees when given light and time.",
    "Double-tap space in creative mode to fly.",
  ];
  const [tip] = useState(() => tips[Math.floor(Math.random() * tips.length)]);
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-sky-950 via-stone-900 to-stone-950">
      <h1 className="text-3xl font-black tracking-[0.3em] text-stone-100 uppercase">VoxelCraft</h1>
      <div className="h-2 w-80 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/10">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-lime-300 transition-[width] duration-300"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <p className="max-w-sm text-center text-[12px] text-stone-400">{tip}</p>
    </div>
  );
}

function MainMenu({
  worlds,
  showNew,
  setShowNew,
  newName,
  setNewName,
  newSeed,
  setNewSeed,
  onPlay,
  onDelete,
}: {
  worlds: { key: string; data: SaveData }[];
  showNew: boolean;
  setShowNew: (b: boolean) => void;
  newName: string;
  setNewName: (s: string) => void;
  newSeed: string;
  setNewSeed: (s: string) => void;
  onPlay: (key: string, name: string, seed: number) => void;
  onDelete: (key: string) => void;
}) {
  return (
    <div className="absolute inset-0 overflow-auto">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% -10%, #2b5f8f 0%, #16243a 45%, #0b0f16 100%)",
        }}
      />
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "repeating-linear-gradient(0deg,#fff 0 1px,transparent 1px 3px)" }} />
      <div className="relative mx-auto flex min-h-full max-w-5xl flex-col items-center justify-center gap-8 px-6 py-12">
        <div className="text-center">
          <h1
            className="text-6xl font-black tracking-[0.18em] text-transparent uppercase"
            style={{
              backgroundImage: "linear-gradient(180deg,#f2f7ff 0%,#9cc2e8 55%,#5d86b5 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              filter: "drop-shadow(0 6px 14px rgba(0,0,0,.6))",
            }}
          >
            VoxelCraft
          </h1>
          <p className="mt-2 text-sm tracking-[0.3em] text-sky-200/60 uppercase">
            An infinite procedural sandbox
          </p>
        </div>

        <div className="grid w-full gap-6 md:grid-cols-[1.25fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-bold tracking-[0.2em] text-stone-300 uppercase">Worlds</h2>
              <button
                onClick={() => setShowNew(!showNew)}
                className="rounded-md bg-emerald-500 px-3 py-1 text-[12px] font-bold text-emerald-950 hover:bg-emerald-400"
              >
                {showNew ? "Cancel" : "+ New world"}
              </button>
            </div>

            {showNew && (
              <div className="mb-4 flex flex-col gap-2 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="World name"
                  className="rounded-md bg-black/40 px-3 py-2 text-sm ring-1 ring-white/10 outline-none focus:ring-emerald-400/60"
                />
                <input
                  value={newSeed}
                  onChange={(e) => setNewSeed(e.target.value)}
                  placeholder="Seed (leave blank for random)"
                  className="rounded-md bg-black/40 px-3 py-2 text-sm ring-1 ring-white/10 outline-none focus:ring-emerald-400/60"
                />
                <MenuButton
                  variant="primary"
                  onClick={() => {
                    const seed = newSeed.trim()
                      ? hashString(newSeed.trim())
                      : (Math.random() * 0xffffffff) >>> 0;
                    const key = "w" + Date.now().toString(36);
                    onPlay(key, newName.trim() || "New World", seed);
                  }}
                >
                  Create &amp; play
                </MenuButton>
              </div>
            )}

            <div className="flex max-h-[330px] flex-col gap-2 overflow-y-auto pr-1">
              {worlds.length === 0 && (
                <p className="py-10 text-center text-[13px] text-stone-500">
                  No worlds yet — create one to begin.
                </p>
              )}
              {worlds.map(({ key, data }) => (
                <div
                  key={key}
                  className="group flex items-center gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10 transition hover:bg-white/10"
                >
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-stone-100">{data.name}</div>
                    <div className="text-[11px] text-stone-400">
                      seed {data.seed} · day {Math.floor(data.time / 600) + 1} ·{" "}
                      {new Date(data.savedAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => onPlay(key, data.name, data.seed)}
                    className="rounded-md bg-emerald-500 px-4 py-1.5 text-[12px] font-bold text-emerald-950 hover:bg-emerald-400"
                  >
                    Play
                  </button>
                  <button
                    onClick={() => onDelete(key)}
                    className="rounded-md px-2 py-1.5 text-[12px] text-red-300/70 opacity-0 transition group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-200"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur">
              <h2 className="mb-3 text-xs font-bold tracking-[0.2em] text-stone-300 uppercase">
                Controls
              </h2>
              <Controls />
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5 text-[12px] leading-relaxed text-stone-400 backdrop-blur">
              <h2 className="mb-2 text-xs font-bold tracking-[0.2em] text-stone-300 uppercase">
                About
              </h2>
              Infinite chunked terrain with 12 biomes, caves and ores · flood-fill lighting with
              smooth shadows · day/night cycle and weather · mobs, crafting, smelting, hunger and
              XP · worlds save automatically to your browser.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
