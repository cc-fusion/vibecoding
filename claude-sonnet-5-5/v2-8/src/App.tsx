import { useCallback, useEffect, useRef, useState } from "react";
import Archive from "./components/Archive";
import GameView from "./components/GameView";
import Help from "./components/Help";
import Setup from "./components/Setup";
import SettingsPanel from "./components/Settings";
import Title from "./components/Title";
import { Modal } from "./components/ui";
import { audio } from "./game/audio";
import { META } from "./game/data";
import { createRun, renownOf, scoreOf, type Run } from "./game/run";
import { loadSave, persist, resetSave, type SaveData, type Settings } from "./game/save";

type Screen = "title" | "setup" | "archive" | "play";
interface Session { run: Run; tutorial: boolean; key: number; }

export default function App() {
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const saveRef = useRef(save);
  const [screen, setScreen] = useState<Screen>("title");
  const [overlay, setOverlay] = useState<null | "help" | "settings">(null);
  const [session, setSession] = useState<Session | null>(null);
  const keyRef = useRef(1);

  const update = useCallback((fn: (s: SaveData) => SaveData) => {
    const next = fn(saveRef.current);
    saveRef.current = next;
    persist(next);
    setSave(next);
  }, []);

  const setSettings = useCallback((p: Partial<Settings>) => {
    update((s) => ({ ...s, settings: { ...s.settings, ...p } }));
  }, [update]);

  useEffect(() => {
    const s = save.settings;
    audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, muted: s.muted });
  }, [save.settings]);

  useEffect(() => {
    const first = () => { audio.init(); audio.startMusic(); };
    window.addEventListener("pointerdown", first, { once: true });
    window.addEventListener("keydown", first, { once: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "m" && !e.repeat) setSettings({ muted: !saveRef.current.settings.muted });
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("pointerdown", first); window.removeEventListener("keydown", first); window.removeEventListener("keydown", onKey); };
  }, [setSettings]);

  const startRun = useCallback((tutorial: boolean) => {
    const s = saveRef.current;
    const run = createRun(s.settings.diff, s.settings.mods, s.levels, Math.floor(Math.random() * 1e9));
    if (tutorial) { run.credits = 999; run.diffIdx = 0; }
    setSession({ run, tutorial, key: keyRef.current++ });
    setScreen("play");
  }, []);

  const onFinish = useCallback((run: Run, win: boolean) => {
    const score = scoreOf(run, win);
    const renown = renownOf(run, win);
    let best = false;
    update((s) => {
      best = score > s.life.bestScore;
      return {
        ...s,
        renown: s.renown + renown,
        life: {
          ...s.life, runs: s.life.runs + 1, wins: s.life.wins + (win ? 1 : 0),
          distance: s.life.distance + run.stats.distance, bestScore: Math.max(s.life.bestScore, score),
          bestLegs: Math.max(s.life.bestLegs, run.stats.legs), raiders: s.life.raiders + run.stats.raiders,
        },
      };
    });
    return { score, renown, best };
  }, [update]);

  const buyMeta = (id: string) => {
    const m = META.find((x) => x.id === id);
    if (!m) return;
    update((s) => {
      const lvl = s.levels[id] || 0;
      if (lvl >= m.max) return s;
      const cost = m.costs[Math.min(lvl, m.costs.length - 1)];
      if (s.renown < cost) return s;
      return { ...s, renown: s.renown - cost, levels: { ...s.levels, [id]: lvl + 1 } };
    });
  };

  const toTitle = () => { setSession(null); setScreen("title"); };

  return (
    <div className="fixed inset-0 overflow-hidden">
      {screen === "title" && (
        <Title
          save={save}
          onStart={() => setScreen("setup")}
          onTutorial={() => startRun(true)}
          onHelp={() => setOverlay("help")}
          onArchive={() => setScreen("archive")}
          onSettings={() => setOverlay("settings")}
          onMute={() => setSettings({ muted: !save.settings.muted })}
        />
      )}
      {screen === "setup" && (
        <Setup
          diff={save.settings.diff} mods={save.settings.mods}
          onDiff={(i) => setSettings({ diff: i })}
          onMod={(id) => setSettings({ mods: save.settings.mods.includes(id) ? save.settings.mods.filter((m) => m !== id) : [...save.settings.mods, id] })}
          onBegin={() => startRun(false)} onBack={() => setScreen("title")}
        />
      )}
      {screen === "archive" && (
        <Archive save={save} onBuy={buyMeta} onReset={() => { const d = resetSave(); saveRef.current = d; setSave(d); }} onBack={() => setScreen("title")} />
      )}
      {screen === "play" && session && (
        <GameView
          key={session.key}
          run={session.run} tutorial={session.tutorial} settings={save.settings}
          onSettings={setSettings}
          onFinish={onFinish}
          onTutorialDone={() => update((s) => ({ ...s, tutorialDone: true }))}
          onRetry={() => startRun(session.tutorial)}
          onSetup={() => { setSession(null); setScreen(session.tutorial ? "setup" : "setup"); }}
          onTitle={toTitle}
          onArchive={() => { setSession(null); setScreen("archive"); }}
        />
      )}
      {overlay === "help" && screen !== "play" && (
        <Modal wide z={60}>
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-display text-3xl text-amber-300">HOW TO PLAY</h2>
            <button className="btn btn-sm" onClick={() => { audio.sfx("back"); setOverlay(null); }}>Close</button>
          </div>
          <Help />
        </Modal>
      )}
      {overlay === "settings" && screen !== "play" && (
        <Modal z={60}>
          <h2 className="font-display text-3xl text-amber-300 mb-3">SETTINGS</h2>
          <SettingsPanel s={save.settings} onChange={setSettings} />
          <div className="mt-4 text-right"><button className="btn" onClick={() => { audio.sfx("back"); setOverlay(null); }}>Close</button></div>
        </Modal>
      )}
    </div>
  );
}
