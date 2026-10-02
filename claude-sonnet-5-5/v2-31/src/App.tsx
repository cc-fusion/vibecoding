import { useCallback, useEffect, useRef, useState } from "react";
import { AudioEngine } from "./game/audio";
import { RESEARCH } from "./game/data";
import type { EndReport } from "./game/engine";
import { clearSave, defaultSave, loadSave, writeSave, type SaveData, type Settings } from "./game/save";
import GameView, { type RunCfg } from "./ui/GameView";
import { HelpModal, SettingsModal } from "./ui/Modals";
import { Research, Setup, Title } from "./ui/Menus";

const audio = new AudioEngine();
type Screen = "title" | "setup" | "research" | "game";

export default function App() {
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const saveRef = useRef(save);
  const [screen, setScreen] = useState<Screen>("title");
  const [cfg, setCfg] = useState<RunCfg | null>(null);
  const [modal, setModal] = useState<null | "settings" | "help">(null);
  const modalRef = useRef(modal);
  modalRef.current = modal;

  const updateSave = useCallback((fn: (s: SaveData) => SaveData) => {
    const next = fn(saveRef.current);
    saveRef.current = next;
    setSave(next);
    writeSave(next);
  }, []);

  const patchSettings = useCallback((p: Partial<Settings>) => {
    updateSave((s) => ({ ...s, settings: { ...s.settings, ...p } }));
  }, [updateSave]);

  // audio volumes
  useEffect(() => {
    audio.setVolumes({ master: save.settings.master, sfx: save.settings.sfx, music: save.settings.music, muted: save.settings.muted });
  }, [save.settings]);

  // menu music
  useEffect(() => {
    if (screen !== "game") audio.setMode("menu");
  }, [screen]);

  // global input: unlock audio, click sounds, mute, escape
  useEffect(() => {
    const unlock = () => {
      audio.init();
    };
    const click = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest && t.closest("button")) audio.sfx("click");
    };
    const key = (e: KeyboardEvent) => {
      audio.init();
      if (e.code === "KeyM" && !e.repeat) {
        patchSettings({ muted: !saveRef.current.settings.muted });
      } else if (e.code === "Escape" && modalRef.current) {
        setModal(null);
      }
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", key);
    window.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", key);
      window.removeEventListener("click", click, true);
    };
  }, [patchSettings]);

  const onReport = useCallback((r: EndReport) => {
    updateSave((s) => {
      if (r.kind === "tutorial") return { ...s, tutorialDone: true };
      const best = { ...s.best };
      if (r.difficulty) best[r.difficulty] = Math.max(best[r.difficulty] || 0, r.wave);
      return {
        ...s,
        aether: s.aether + r.aetherDelta,
        lifetimeAether: s.lifetimeAether + r.aetherDelta,
        totalKills: s.totalKills + r.killsDelta,
        bossKills: s.bossKills + r.bossDelta,
        wins: s.wins + (r.kind === "victory" ? 1 : 0),
        runs: s.runs + (r.kind === "gameover" || r.kind === "abandon" ? 1 : 0),
        best,
      };
    });
  }, [updateSave]);

  const startRun = (difficulty: string, mutators: string[], tutorial: boolean) => {
    audio.init();
    if (!tutorial) updateSave((s) => ({ ...s, lastDifficulty: difficulty, mutators }));
    setCfg({ difficulty, mutators, tutorial, key: Date.now() + Math.random() });
    setScreen("game");
  };

  const buy = (id: string) => {
    const n = RESEARCH.find((x) => x.id === id);
    if (!n) return;
    updateSave((s) => {
      const cur = s.research[id] || 0;
      if (cur >= n.costs.length) return s;
      if (n.req && (s.research[n.req] || 0) < 1) return s;
      const cost = n.costs[cur];
      if (s.aether < cost) return s;
      audio.sfx("buy");
      return { ...s, aether: s.aether - cost, research: { ...s.research, [id]: cur + 1 } };
    });
  };

  const refund = () => {
    updateSave((s) => {
      let spent = 0;
      for (const n of RESEARCH) for (let i = 0; i < (s.research[n.id] || 0); i++) spent += n.costs[i];
      return { ...s, aether: s.aether + spent, research: {} };
    });
  };

  const resetAll = () => {
    clearSave();
    const d = defaultSave();
    saveRef.current = d;
    setSave(d);
    writeSave(d);
    setModal(null);
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      {screen === "title" && (
        <Title
          save={save}
          onPlay={() => setScreen("setup")}
          onTutorial={() => startRun("apprentice", [], true)}
          onResearch={() => setScreen("research")}
          onHelp={() => setModal("help")}
          onSettings={() => setModal("settings")}
        />
      )}
      {screen === "setup" && <Setup save={save} onStart={(d, m) => startRun(d, m, false)} onBack={() => setScreen("title")} />}
      {screen === "research" && <Research save={save} onBuy={buy} onRefund={refund} onBack={() => setScreen("title")} />}
      {screen === "game" && cfg && (
        <GameView
          key={cfg.key}
          cfg={cfg}
          research={save.research}
          settings={save.settings}
          audio={audio}
          aether={save.aether}
          modalOpen={modal !== null}
          onReport={onReport}
          onQuit={() => setScreen("title")}
          onRetry={() => startRun(cfg.difficulty, cfg.mutators, cfg.tutorial)}
          onSanctum={() => setScreen("research")}
          openModal={setModal}
          toggleMute={() => patchSettings({ muted: !save.settings.muted })}
        />
      )}
      {modal === "settings" && <SettingsModal settings={save.settings} onChange={patchSettings} onClose={() => setModal(null)} onReset={resetAll} />}
      {modal === "help" && <HelpModal onClose={() => setModal(null)} />}
    </div>
  );
}
