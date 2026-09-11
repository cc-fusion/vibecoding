import { useMemo, useState } from "react";
import { Saves, type GameMode, type Settings, type WorldMeta, type WorldSave } from "@/game/save";
import { hashString } from "@/game/noise";
import { getAtlas, TILE, ATLAS_COLS } from "@/game/textures";
import { Button, ControlsList, Panel, SettingsPanel } from "./common";
import { cn } from "@/utils/cn";

function tileDataUrl(name: string): string {
  const atlas = getAtlas();
  const idx = atlas.index.get(name) ?? 0;
  const c = document.createElement("canvas");
  c.width = c.height = TILE;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(atlas.canvas, (idx % ATLAS_COLS) * TILE, Math.floor(idx / ATLAS_COLS) * TILE, TILE, TILE, 0, 0, TILE, TILE);
  return c.toDataURL();
}

export function MainMenu({ onPlay, settings, onSettings }: { onPlay: (save: WorldSave) => void; settings: Settings; onSettings: (s: Settings) => void }) {
  const [worlds, setWorlds] = useState<WorldMeta[]>(() => Saves.list());
  const [view, setView] = useState<"main" | "create" | "settings" | "controls">("main");
  const [name, setName] = useState("New World");
  const [seedText, setSeedText] = useState("");
  const [mode, setMode] = useState<GameMode>("survival");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const bg = useMemo(() => tileDataUrl("dirt"), []);

  const create = () => {
    const seed = seedText.trim() === "" ? Math.floor(Math.random() * 2147483647) : /^-?\d+$/.test(seedText.trim()) ? Math.abs(parseInt(seedText.trim(), 10)) % 2147483647 : hashString(seedText.trim());
    const meta: WorldMeta = { id: Saves.newId(), name: name.trim() || "New World", seed, mode, created: Date.now(), lastPlayed: Date.now() };
    const save: WorldSave = {
      meta,
      edits: {},
      inventory: { slots: [], selected: 0 },
      time: 0.04,
      spawn: [0, 70, 0],
      stats: { blocksMined: 0, blocksPlaced: 0, crafted: 0, deaths: 0, playTime: 0 },
    };
    onPlay(save);
  };

  const play = (m: WorldMeta) => {
    const save = Saves.load(m.id);
    if (!save) {
      setWorlds(Saves.list());
      return;
    }
    onPlay(save);
  };

  const del = (id: string) => {
    Saves.delete(id);
    setWorlds(Saves.list());
    setConfirmDelete(null);
  };

  return (
    <div className="absolute inset-0 overflow-auto text-white" style={{ backgroundImage: `url(${bg})`, backgroundSize: "96px 96px", imageRendering: "pixelated" }}>
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-black/85" />
      <div className="relative flex min-h-full flex-col items-center justify-center gap-6 p-6">
        <div className="text-center">
          <h1 className="title-glow text-6xl font-black tracking-[0.2em] text-yellow-300 drop-shadow-[0_4px_0_rgba(0,0,0,0.8)] md:text-7xl">VOXELCRAFT</h1>
          <p className="mt-2 text-sm font-bold tracking-widest text-emerald-300">MINE · CRAFT · BUILD · EXPLORE</p>
        </div>

        {view === "main" && (
          <div className="flex w-full max-w-4xl flex-col gap-4 md:flex-row">
            <Panel className="flex w-full flex-col gap-2 md:w-64">
              <Button variant="primary" className="py-3 text-base" onClick={() => setView("create")}>
                Create New World
              </Button>
              <Button onClick={() => setView("settings")}>Settings</Button>
              <Button onClick={() => setView("controls")}>Controls</Button>
              <div className="mt-2 text-xs leading-relaxed text-stone-400">
                An infinite procedural voxel world with biomes, caves, ores, crafting, day/night cycle and full save/load. Everything is generated at runtime — no downloads.
              </div>
            </Panel>
            <Panel title="Your Worlds" className="flex-1">
              {worlds.length === 0 && <p className="py-8 text-center text-sm text-stone-400">No worlds yet. Create one to start playing!</p>}
              <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
                {worlds.map((w) => (
                  <div key={w.id} className="flex items-center gap-3 rounded-sm border border-stone-600 bg-stone-900/60 p-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold">{w.name}</div>
                      <div className="text-xs text-stone-400">
                        {w.mode === "creative" ? "Creative" : "Survival"} · seed {w.seed} · {new Date(w.lastPlayed).toLocaleString()}
                      </div>
                    </div>
                    <Button variant="primary" className="px-3 py-1" onClick={() => play(w)}>
                      Play
                    </Button>
                    {confirmDelete === w.id ? (
                      <div className="flex gap-1">
                        <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => del(w.id)}>
                          Confirm
                        </Button>
                        <Button className="px-2 py-1 text-xs" onClick={() => setConfirmDelete(null)}>
                          No
                        </Button>
                      </div>
                    ) : (
                      <Button className="px-2 py-1 text-xs" onClick={() => setConfirmDelete(w.id)}>
                        Delete
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {view === "create" && (
          <Panel title="Create New World" className="w-full max-w-md">
            <label className="block text-sm">
              World name
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} className="mt-1 w-full rounded-sm border border-stone-600 bg-stone-950/70 px-3 py-2 text-white outline-none focus:border-emerald-500" />
            </label>
            <label className="mt-3 block text-sm">
              Seed <span className="text-stone-400">(leave empty for random)</span>
              <input value={seedText} onChange={(e) => setSeedText(e.target.value)} placeholder="numbers or any text" className="mt-1 w-full rounded-sm border border-stone-600 bg-stone-950/70 px-3 py-2 text-white outline-none focus:border-emerald-500" />
            </label>
            <div className="mt-3 text-sm">Game mode</div>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(["survival", "creative"] as GameMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn("rounded-sm border-2 p-2 text-left text-sm", mode === m ? "border-emerald-500 bg-emerald-900/40" : "border-stone-600 bg-stone-900/50 hover:border-stone-400")}
                >
                  <div className="font-bold capitalize">{m}</div>
                  <div className="text-xs text-stone-400">{m === "survival" ? "Mine resources, craft tools, watch your health." : "Unlimited blocks, flying, instant mining."}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" onClick={() => setView("main")}>
                Back
              </Button>
              <Button variant="primary" className="flex-1" onClick={create}>
                Create & Play
              </Button>
            </div>
          </Panel>
        )}

        {view === "settings" && (
          <Panel title="Settings" className="w-full max-w-md">
            <SettingsPanel settings={settings} onChange={onSettings} />
            <Button className="mt-4 w-full" onClick={() => setView("main")}>
              Done
            </Button>
          </Panel>
        )}

        {view === "controls" && (
          <Panel title="Controls" className="w-full max-w-md">
            <ControlsList />
            <Button className="mt-4 w-full" onClick={() => setView("main")}>
              Done
            </Button>
          </Panel>
        )}
        <p className="text-xs text-stone-500">Worlds are saved automatically in your browser's local storage.</p>
      </div>
    </div>
  );
}
