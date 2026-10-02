import { useCallback, useEffect, useRef, useState } from "react";
import { Game, HudSnap, Result } from "./game/engine";
import { LEVEL_COUNT, SPECS, getLevel } from "./game/core";
import { PERMITS, Save, Settings, computeRules, defaultSave, loadSave, wipeSave, writeSave } from "./game/meta";
import { audio } from "./game/audio";
import {
  ArchiveModal,
  Hud,
  HelpModal,
  LosePanel,
  MapScreen,
  MemoCard,
  PauseMenu,
  PermitsScreen,
  SettingsModal,
  TitleScreen,
  VictoryPanel,
  WinPanel,
  isUnlocked,
} from "./ui/Screens";

type Screen = "title" | "map" | "permits" | "play";
type ModalKind = null | "help" | "settings" | "archive";
interface EndState {
  r: Result;
  stamps: number;
  newBest: boolean;
}
const DEMO_BY_WING = [1, 6, 12, 18];

export default function App() {
  const [save, setSave] = useState<Save>(() => loadSave());
  const saveRef = useRef(save);
  saveRef.current = save;
  const [screen, setScreen] = useState<Screen>("title");
  const [wing, setWing] = useState(0);
  const [levelId, setLevelId] = useState(0);
  const [hud, setHud] = useState<HudSnap | null>(null);
  const [paused, setPaused] = useState(false);
  const [memo, setMemo] = useState<string[] | null>(null);
  const [end, setEnd] = useState<EndState | null>(null);
  const [victory, setVictory] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [audioOn, setAudioOn] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Game | null>(null);
  const endRef = useRef<(r: Result) => void>(() => undefined);
  const escRef = useRef<() => void>(() => undefined);
  const demoRef = useRef(-1);
  const loadTimer = useRef<number | null>(null);

  // persist
  useEffect(() => {
    writeSave(save);
  }, [save]);

  // engine lifecycle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = new Game(canvas, {
      onHud: (s) => setHud(s),
      onEnd: (r) => endRef.current(r),
      onEsc: () => escRef.current(),
    });
    engineRef.current = g;
    demoRef.current = -1;
    setReady(true);
    const ro = new ResizeObserver(() => g.resize());
    ro.observe(canvas);
    const onWin = () => g.resize();
    window.addEventListener("resize", onWin);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onWin);
      g.destroy();
      engineRef.current = null;
      setReady(false);
    };
  }, []);

  // audio + settings sync
  useEffect(() => {
    const s = save.settings;
    audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, muted: s.muted });
    engineRef.current?.setSettings({ linkHints: s.linkHints, shake: s.shake });
  }, [save.settings, ready]);

  useEffect(() => {
    const onKey = () => setAudioOn(true);
    window.addEventListener("keydown", onKey, { once: true });
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!audioOn) return;
    audio.ensure();
    const w = screen === "play" ? SPECS[levelId].wing : screen === "map" ? wing : 0;
    audio.startMusic(w);
    if (screen !== "play") audio.setIntensity(0.05);
  }, [audioOn, screen, wing, levelId]);

  // menu demo scene
  useEffect(() => {
    const g = engineRef.current;
    if (!g || !ready) return;
    if (screen === "play") {
      demoRef.current = -1;
      return;
    }
    let target = 2;
    if (screen === "map") target = DEMO_BY_WING[wing];
    else if (screen === "permits" && demoRef.current >= 0) target = demoRef.current;
    if (demoRef.current !== target) {
      demoRef.current = target;
      g.startDemo(getLevel(target));
      audio.setPaused(false);
    }
  }, [screen, wing, ready]);

  useEffect(() => {
    return () => {
      if (loadTimer.current !== null) window.clearTimeout(loadTimer.current);
    };
  }, []);

  const startLevel = useCallback((id: number) => {
    audio.ensure();
    setAudioOn(true);
    setModal(null);
    setEnd(null);
    setVictory(false);
    setPaused(false);
    setMemo(null);
    setLoading(true);
    setLevelId(id);
    setScreen("play");
    if (loadTimer.current !== null) window.clearTimeout(loadTimer.current);
    loadTimer.current = window.setTimeout(() => {
      const g = engineRef.current;
      if (!g) return;
      const L = getLevel(id);
      const s = saveRef.current;
      const rules = computeRules(L.par, s.settings.difficulty, s.settings.mods, s.permits);
      g.loadLevel(L, rules, id === 0);
      setLoading(false);
      const tips = SPECS[id].tips;
      if (id !== 0 && tips.length && !s.seenTips[id]) {
        setMemo(tips);
        g.setPaused(true);
        setSave((p) => ({ ...p, seenTips: { ...p.seenTips, [id]: true } }));
      }
    }, 40);
  }, []);

  const pause = useCallback(() => {
    setPaused(true);
    engineRef.current?.setPaused(true);
    audio.play("click");
  }, []);
  const resume = useCallback(() => {
    setPaused(false);
    engineRef.current?.setPaused(false);
    audio.play("click");
  }, []);
  const quitToMap = useCallback(() => {
    setPaused(false);
    setEnd(null);
    setVictory(false);
    setMemo(null);
    setModal(null);
    engineRef.current?.setPaused(false);
    setWing(SPECS[levelId].wing);
    setScreen("map");
    audio.play("click");
  }, [levelId]);

  const handleEnd = (r: Result) => {
    const s = saveRef.current;
    const stats = {
      ...s.stats,
      moves: s.stats.moves + r.steps,
      hops: s.stats.hops + r.hops,
      rotations: s.stats.rotations + r.rotations,
      docs: s.stats.docs + r.docs,
      seconds: s.stats.seconds + r.time,
      failures: s.stats.failures + (r.won ? 0 : 1),
      caught: s.stats.caught + (r.reason === "caught" ? 1 : 0),
      levels: s.stats.levels + (r.won ? 1 : 0),
    };
    if (!r.won) {
      setSave({ ...s, stats });
      setEnd({ r, stamps: 0, newBest: false });
      return;
    }
    const prior = s.progress[r.levelId];
    const mult = computeRules(r.par, s.settings.difficulty, s.settings.mods, s.permits).stampMult;
    const base = prior ? 3 : 12;
    const gain = Math.max(0, r.stars - (prior?.stars ?? 0)) * 8;
    const earned = Math.max(1, Math.round((base + gain) * mult));
    const newBest = !prior || r.steps < prior.best;
    const progress = {
      ...s.progress,
      [r.levelId]: { stars: Math.max(prior?.stars ?? 0, r.stars), best: prior ? Math.min(prior.best, r.steps) : r.steps },
    };
    const finalClear = r.levelId === LEVEL_COUNT - 1;
    setSave({ ...s, stats, progress, stamps: s.stamps + earned, won: s.won || finalClear, tutorialDone: true });
    setEnd({ r, stamps: earned, newBest });
    if (finalClear && !s.won) setVictory(true);
  };
  endRef.current = handleEnd;

  escRef.current = () => {
    if (modal) {
      setModal(null);
      return;
    }
    if (screen !== "play") {
      if (screen === "map" || screen === "permits") setScreen("title");
      return;
    }
    if (victory || end || loading) return;
    if (memo) {
      setMemo(null);
      engineRef.current?.setPaused(false);
      return;
    }
    if (paused) resume();
    else pause();
  };

  const changeSettings = (ns: Settings) => {
    setSave((p) => ({ ...p, settings: ns }));
    const g = engineRef.current;
    if (g && screen === "play" && !loading) {
      const L = getLevel(levelId);
      g.setRules(computeRules(L.par, ns.difficulty, ns.mods, saveRef.current.permits));
    }
  };

  const buy = (key: string) => {
    const pm = PERMITS.find((x) => x.key === key);
    if (!pm) return;
    const rank = save.permits[key] ?? 0;
    const cost = pm.cost[rank];
    if (rank >= pm.max || cost === undefined || save.stamps < cost) return;
    audio.play("buy");
    setSave((p) => ({ ...p, stamps: p.stamps - cost, permits: { ...p.permits, [key]: rank + 1 } }));
  };

  const hasProgress = Object.keys(save.progress).length > 0;
  const nextUnfinished = () => {
    for (let i = 0; i < LEVEL_COUNT; i++) if (!save.progress[i] && isUnlocked(save, i)) return i;
    return -1;
  };
  const onContinue = () => {
    audio.play("click");
    const n = nextUnfinished();
    if (n >= 0) startLevel(n);
    else {
      setScreen("map");
    }
  };
  const openModal = (m: ModalKind) => {
    audio.play("click");
    if (screen === "play" && !paused) pause();
    setModal(m);
  };
  const g = () => engineRef.current;
  const title = SPECS[levelId]?.name ?? "";
  const showHud = screen === "play" && !loading && hud?.mode === "play" && !!hud;

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ touchAction: "none" }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" style={{ touchAction: "none" }} />

      {screen === "title" && (
        <TitleScreen
          save={save}
          hasProgress={hasProgress}
          onContinue={onContinue}
          onCampaign={() => {
            audio.ensure();
            setAudioOn(true);
            audio.play("click");
            setScreen("map");
          }}
          onPermits={() => {
            audio.ensure();
            setAudioOn(true);
            audio.play("click");
            setScreen("permits");
          }}
          onHelp={() => {
            audio.ensure();
            setAudioOn(true);
            openModal("help");
          }}
          onSettings={() => {
            audio.ensure();
            setAudioOn(true);
            openModal("settings");
          }}
          onArchive={() => openModal("archive")}
          muted={save.settings.muted}
          onMute={() => {
            audio.ensure();
            setAudioOn(true);
            changeSettings({ ...save.settings, muted: !save.settings.muted });
          }}
        />
      )}
      {screen === "map" && (
        <MapScreen
          save={save}
          wing={wing}
          setWing={(w) => {
            audio.play("click");
            setWing(w);
          }}
          onPlay={(id) => {
            audio.play("click");
            startLevel(id);
          }}
          onBack={() => {
            audio.play("click");
            setScreen("title");
          }}
          setDifficulty={(d) => {
            audio.play("click");
            changeSettings({ ...save.settings, difficulty: d });
          }}
          toggleMod={(k) => {
            audio.play("click");
            changeSettings({ ...save.settings, mods: { ...save.settings.mods, [k]: !save.settings.mods[k] } });
          }}
        />
      )}
      {screen === "permits" && (
        <PermitsScreen
          save={save}
          onBuy={buy}
          onBack={() => {
            audio.play("click");
            setScreen(hasProgress ? "map" : "title");
          }}
        />
      )}

      {showHud && hud && (
        <Hud
          hud={hud}
          title={title}
          iron={save.settings.mods.iron}
          onRotate={(d) => g()?.rotate(d)}
          onWait={() => g()?.wait()}
          onUndo={() => g()?.undo()}
          onHint={() => g()?.hint()}
          onPause={pause}
          onHelp={() => openModal("help")}
        />
      )}
      {screen === "play" && loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0b0a18]/50">
          <div className="panel px-8 py-6 text-center floaty">
            <div className="serif text-3xl text-[#ffd166]">Surveying the building…</div>
            <div className="text-sm text-[#fff4de]/70 mt-1">Checking that the impossible is at least solvable.</div>
          </div>
        </div>
      )}
      {screen === "play" && paused && !end && !memo && !loading && (
        <PauseMenu
          onResume={resume}
          onRestart={() => {
            audio.play("click");
            startLevel(levelId);
          }}
          onSettings={() => openModal("settings")}
          onHelp={() => openModal("help")}
          onQuit={quitToMap}
        />
      )}
      {memo && (
        <MemoCard
          title={title}
          tips={memo}
          onClose={() => {
            audio.play("click");
            setMemo(null);
            g()?.setPaused(false);
          }}
        />
      )}
      {end && !end.r.won && (
        <LosePanel
          r={end.r}
          title={title}
          canRewind={!!hud && hud.canRewind}
          onRewind={() => {
            if (g()?.undo()) setEnd(null);
          }}
          onRetry={() => startLevel(levelId)}
          onMap={quitToMap}
        />
      )}
      {end && end.r.won && !victory && (
        <WinPanel
          r={end.r}
          title={title}
          stamps={end.stamps}
          newBest={end.newBest}
          hasNext={levelId < LEVEL_COUNT - 1}
          onNext={() => startLevel(levelId + 1)}
          onRetry={() => startLevel(levelId)}
          onMap={quitToMap}
        />
      )}
      {victory && (
        <VictoryPanel
          save={save}
          onContinue={() => setVictory(false)}
          onPermits={() => {
            setVictory(false);
            setEnd(null);
            setScreen("permits");
          }}
        />
      )}

      {modal === "help" && <HelpModal onClose={() => setModal(null)} />}
      {modal === "archive" && <ArchiveModal save={save} onClose={() => setModal(null)} />}
      {modal === "settings" && (
        <SettingsModal
          settings={save.settings}
          onChange={changeSettings}
          onClose={() => setModal(null)}
          inGame={screen === "play"}
          onReset={() => {
            wipeSave();
            setSave(defaultSave());
            setModal(null);
          }}
        />
      )}
    </div>
  );
}
