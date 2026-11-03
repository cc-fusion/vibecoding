import { useCallback, useEffect, useRef, useState } from 'react';
import { HUD } from './components/HUD';
import { InventoryModal } from './components/InventoryModal';
import { PauseModal } from './components/PauseModal';
import { TitleScreen } from './components/TitleScreen';
import { hashSeedString } from './game/constants';
import { VoxelEngine } from './game/engine';
import { worldStorage } from './game/storage';
import {
  EngineHUDState,
  GameMode,
  GameSettings,
  WorldSaveData,
  WorldSaveMeta,
} from './game/types';

const SETTINGS_STORAGE_KEY = 'terravox_user_settings_v1';

const DEFAULT_SETTINGS: GameSettings = {
  renderDistance: 5,
  fov: 78,
  soundVolume: 0.65,
  musicEnabled: true,
  peacefulMobs: false,
  invertY: false,
  mouseSensitivity: 1.0,
  autoStep: false,
};

function loadInitialSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

export function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<VoxelEngine | null>(null);

  const [savedWorlds, setSavedWorlds] = useState<WorldSaveMeta[]>([]);
  const [activeSession, setActiveSession] = useState<{
    meta: WorldSaveMeta;
    savedData: WorldSaveData | null;
  } | null>(null);

  const [settings, setSettings] = useState<GameSettings>(loadInitialSettings);
  const [hud, setHud] = useState<EngineHUDState | null>(null);

  const refreshWorldList = useCallback(async () => {
    const list = await worldStorage.listWorlds();
    setSavedWorlds(list);
  }, []);

  useEffect(() => {
    refreshWorldList();
  }, [refreshWorldList]);

  const handleUpdateSettings = useCallback((patch: Partial<GameSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      engineRef.current?.updateSettings(next);
      return next;
    });
  }, []);

  const handleCreateWorld = useCallback(
    (name: string, seedText: string, mode: GameMode) => {
      const meta: WorldSaveMeta = {
        id: `world_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name,
        seed: hashSeedString(seedText),
        seedText,
        mode,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        dayCount: 1,
      };
      setActiveSession({ meta, savedData: null });
    },
    []
  );

  const handleLoadWorld = useCallback(async (id: string) => {
    const data = await worldStorage.loadWorld(id);
    if (data) {
      setActiveSession({ meta: data.meta, savedData: data });
    }
  }, []);

  const handleDeleteWorld = useCallback(
    async (id: string) => {
      await worldStorage.deleteWorld(id);
      await refreshWorldList();
    },
    [refreshWorldList]
  );

  const handleExportWorld = useCallback(async (id: string) => {
    const data = await worldStorage.loadWorld(id);
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.meta.name.replace(/\s+/g, '_').toLowerCase()}_save.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImportWorld = useCallback(
    async (data: WorldSaveData) => {
      await worldStorage.saveWorld(data);
      await refreshWorldList();
    },
    [refreshWorldList]
  );

  // Mount / Teardown Three.js VoxelEngine lifecycle cleanly
  useEffect(() => {
    if (!activeSession || !containerRef.current) return;

    const engine = new VoxelEngine(
      containerRef.current,
      activeSession,
      settings,
      (nextHud) => setHud(nextHud)
    );
    engineRef.current = engine;
    setHud(engine.getHUDState());

    // Periodic non-blocking Auto-Save every 20 seconds once world is ready
    const autoSaveInterval = window.setInterval(() => {
      if (engineRef.current && engineRef.current.ready) {
        const snapshot = engineRef.current.serializeWorld();
        worldStorage.saveWorld(snapshot).catch(() => {});
      }
    }, 20000);

    return () => {
      window.clearInterval(autoSaveInterval);
      if (engineRef.current && engineRef.current.ready) {
        worldStorage.saveWorld(engineRef.current.serializeWorld()).catch(() => {});
      }
      engine.dispose();
      engineRef.current = null;
      setHud(null);
    };
  }, [activeSession]);

  const handleManualSave = useCallback(async () => {
    if (!engineRef.current) return;
    await worldStorage.saveWorld(engineRef.current.serializeWorld());
  }, []);

  const handleSaveAndQuit = useCallback(async () => {
    if (engineRef.current && engineRef.current.ready) {
      await worldStorage.saveWorld(engineRef.current.serializeWorld());
    }
    setActiveSession(null);
    await refreshWorldList();
  }, [refreshWorldList]);

  if (!activeSession) {
    return (
      <TitleScreen
        savedWorlds={savedWorlds}
        onCreateWorld={handleCreateWorld}
        onLoadWorld={handleLoadWorld}
        onDeleteWorld={handleDeleteWorld}
        onExportWorld={handleExportWorld}
        onImportWorld={handleImportWorld}
      />
    );
  }

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden">
      {/* Three.js WebGL Mount Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Initial World Generation Loading Screen */}
      {hud && !hud.ready && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white p-6">
          <div className="max-w-md w-full space-y-4 text-center">
            <div className="text-2xl font-black tracking-tight text-emerald-300">
              Generating {activeSession.meta.name}
            </div>
            <p className="text-xs text-slate-400 font-mono">{hud.loadingMessage}</p>
            <div className="w-full h-3 bg-slate-900 rounded-full border border-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-150"
                style={{ width: `${Math.round(hud.loadingProgress * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Active Gameplay HUD */}
      {hud && hud.ready && (
        <HUD
          hud={hud}
          onSelectHotbar={(idx) => engineRef.current?.selectHotbar(idx)}
          onOpenInventory={() => engineRef.current?.openInventoryUI()}
          onOpenPause={() => engineRef.current?.setPaused(true)}
          onToggleHelp={() => {
            if (engineRef.current) {
              engineRef.current.helpOpen = !engineRef.current.helpOpen;
              setHud(engineRef.current.getHUDState());
            }
          }}
          onCapturePointer={() => engineRef.current?.requestPointerLock()}
        />
      )}

      {/* Inventory, Crafting, Furnace & Creative Palette Modal */}
      {hud && hud.ready && hud.inventoryOpen && engineRef.current && (
        <InventoryModal
          hud={hud}
          engine={engineRef.current}
          onClose={() => engineRef.current?.closeInventoryUI()}
        />
      )}

      {/* Pause & World Settings Modal */}
      {hud && hud.ready && hud.paused && !hud.inventoryOpen && !hud.gameOver && engineRef.current && (
        <PauseModal
          hud={hud}
          settings={settings}
          engine={engineRef.current}
          onUpdateSettings={handleUpdateSettings}
          onSaveWorld={handleManualSave}
          onSaveAndQuit={handleSaveAndQuit}
        />
      )}

      {/* Survival Game Over Respawn Screen */}
      {hud && hud.ready && hud.gameOver && engineRef.current && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-rose-950/85 backdrop-blur-md text-white p-6 text-center space-y-5">
          <h2 className="text-5xl font-black tracking-tight text-rose-200 drop-shadow">
            You Fell in the Wilds!
          </h2>
          <p className="text-sm text-rose-100/80 max-w-md">
            Your world and inventory remain intact — respawn at your world’s safe haven to continue building and exploring.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => engineRef.current?.respawnPlayer()}
              className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm cursor-pointer shadow-xl"
            >
              Respawn Now
            </button>
            <button
              type="button"
              onClick={handleSaveAndQuit}
              className="px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-sm cursor-pointer"
            >
              Save &amp; Main Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
