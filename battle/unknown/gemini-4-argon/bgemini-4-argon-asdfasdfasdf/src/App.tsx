import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, Skull } from 'lucide-react';
import { HUD } from './components/HUD';
import { InventoryModal } from './components/InventoryModal';
import { PauseModal } from './components/PauseModal';
import { TitleScreen } from './components/TitleScreen';
import { GameHUDState, GameMode, WorldSaveMeta } from './engine/constants';
import { GameEngine } from './engine/gameEngine';
import { hashSeedString } from './engine/noise';
import {
  deleteSavedWorld,
  listSavedWorlds,
  loadWorldData,
  SavedWorldPayload,
} from './engine/storage';

interface ActiveSession {
  meta: WorldSaveMeta;
  saved: SavedWorldPayload | null;
}

export function App() {
  const [savedWorlds, setSavedWorlds] = useState<WorldSaveMeta[]>([]);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [hud, setHud] = useState<GameHUDState | null>(null);

  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const refreshSavedWorlds = useCallback(async () => {
    const worlds = await listSavedWorlds();
    setSavedWorlds(worlds);
  }, []);

  useEffect(() => {
    refreshSavedWorlds();
  }, [refreshSavedWorlds]);

  useEffect(() => {
    if (!session || !canvasHostRef.current) return;

    const engine = new GameEngine(canvasHostRef.current, session, (nextHud) => {
      setHud(nextHud);
    });
    engineRef.current = engine;

    return () => {
      engine.destroy().then(() => {
        refreshSavedWorlds();
      });
      engineRef.current = null;
    };
  }, [session, refreshSavedWorlds]);

  const handleCreateWorld = (name: string, seedText: string, mode: GameMode) => {
    const now = Date.now();
    const meta: WorldSaveMeta = {
      id: `world_${now}_${Math.floor(Math.random() * 10000)}`,
      name,
      seed: hashSeedString(seedText),
      seedText,
      gameMode: mode,
      createdAt: now,
      updatedAt: now,
      dayCount: 1,
    };
    setHud(null);
    setSession({ meta, saved: null });
  };

  const handleLoadWorld = async (meta: WorldSaveMeta) => {
    const saved = await loadWorldData(meta.id);
    setHud(null);
    setSession({ meta, saved });
  };

  const handleDeleteWorld = async (id: string) => {
    await deleteSavedWorld(id);
    await refreshSavedWorlds();
  };

  const handleExitToTitle = async () => {
    if (engineRef.current) {
      await engineRef.current.destroy();
      engineRef.current = null;
    }
    await refreshSavedWorlds();
    setSession(null);
    setHud(null);
  };

  if (!session) {
    return (
      <TitleScreen
        savedWorlds={savedWorlds}
        onCreateWorld={handleCreateWorld}
        onLoadWorld={handleLoadWorld}
        onDeleteWorld={handleDeleteWorld}
      />
    );
  }

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden">
      {/* Three.js WebGL Viewport */}
      <div ref={canvasHostRef} className="w-full h-full cursor-crosshair" />

      {/* Initial Chunk Generation Progress Screen */}
      {(!hud || !hud.ready) && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
          <div className="text-2xl font-black tracking-tight text-white mb-2">
            Building <span className="text-emerald-400">{session.meta.name}</span>
          </div>
          <p className="text-xs text-slate-400 mb-5">
            {hud?.loadingMessage ?? 'Initializing noise generators & biome maps...'}
          </p>
          <div className="w-72 h-2.5 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-150"
              style={{ width: `${hud?.loadingProgress ?? 12}%` }}
            />
          </div>
        </div>
      )}

      {/* Live Game HUD */}
      {hud && hud.ready && (
        <HUD
          hud={hud}
          engine={engineRef.current}
          onSelectHotbar={(idx) => engineRef.current?.selectHotbar(idx)}
          onOpenInventory={() => engineRef.current?.toggleInventory()}
          onOpenPause={() => engineRef.current?.togglePause()}
          onLockPointer={() => engineRef.current?.requestPointerLockSafe()}
        />
      )}

      {/* Inventory, Crafting & Smelting Workshop */}
      {hud && hud.ready && hud.inventoryOpen && (
        <InventoryModal
          hud={hud}
          onClose={() => engineRef.current?.toggleInventory()}
          onSwapSlots={(a, b) => engineRef.current?.swapInventorySlots(a, b)}
          onCraft={(id) => engineRef.current?.craftRecipeById(id)}
          onSmelt={(id) => engineRef.current?.smeltRecipeById(id)}
          onGiveCreative={(itemId) => engineRef.current?.giveCreativeItem(itemId)}
        />
      )}

      {/* Pause & World Settings Menu */}
      {hud && hud.ready && hud.paused && !hud.isDead && (
        <PauseModal
          hud={hud}
          onResume={() => engineRef.current?.resumeGame()}
          onSave={() => engineRef.current?.saveNow(true)}
          onExitToTitle={handleExitToTitle}
          onSetRenderDistance={(rd) => engineRef.current?.setRenderDistance(rd)}
          onSetFov={(fov) => engineRef.current?.setFov(fov)}
          onSetTime={(t) => engineRef.current?.setTimeOfDay(t)}
          onSetWeather={(w) => engineRef.current?.setWeather(w)}
          onSetGameMode={(m) => engineRef.current?.setGameMode(m)}
          onSetSound={(flag) => engineRef.current?.setSoundEnabled(flag)}
        />
      )}

      {/* Survival Defeat / Respawn Overlay */}
      {hud && hud.ready && hud.isDead && (
        <div className="fixed inset-0 z-50 bg-rose-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="mc-panel border-rose-500/50 rounded-2xl p-7 max-w-sm w-full text-center space-y-4">
            <Skull className="w-12 h-12 text-rose-400 mx-auto" />
            <h2 className="text-2xl font-black text-white">You Perished!</h2>
            <p className="text-xs text-slate-300">
              Your backpack items and world builds remain safe. Respawn back at safe ground!
            </p>
            <button
              type="button"
              onClick={() => engineRef.current?.respawn()}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Respawn Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
