import { useCallback, useEffect, useRef, useState } from "react";
import { loadSave, persist, newCampaign, hasSave, SaveData } from "./game/save";
import { getSortie, hullById, resistFromMemory, CAMPAIGN_LEN } from "./game/data";
import { emptyLayout } from "./game/ship";
import { LaunchOpts, RunResult } from "./game/combat";
import { audio } from "./game/audio";
import { TitleScreen, SettingsPanel, HelpPanel, ResultsScreen } from "./components/Menus";
import { Hub, Tab } from "./components/Hub";
import { CombatView } from "./components/CombatView";

/** Top-level screens. */
type Screen = "title" | "hub" | "combat" | "results";

/** Coarse-pointer touch devices get on-screen controls and auto-aim. */
const isTouch = () => {
  try { return window.matchMedia("(pointer: coarse)").matches && "ontouchstart" in window; } catch { return false; }
};

export default function App() {
  const [save, setSaveState] = useState<SaveData>(() => loadSave());
  const saveRef = useRef(save);
  saveRef.current = save;
  const [screen, setScreen] = useState<Screen>("title");
  const [tab, setTab] = useState<Tab>("hangar");
  const [overlay, setOverlay] = useState<null | "settings" | "help">(null);
  const [launch, setLaunch] = useState<LaunchOpts | null>(null);
  const [result, setResult] = useState<{ res: RunResult; campaignWin: boolean } | null>(null);
  const [sel, setSel] = useState(() => Math.min(save.cleared + 1, save.cleared + 1));
  const [tut, setTut] = useState(() => (save.settings.tutHangar ? -1 : 0));
  const [progress, setProgress] = useState(() => hasSave());

  const setSave = useCallback((fn: (s: SaveData) => SaveData) => {
    setSaveState((prev) => {
      const n = fn(prev);
      saveRef.current = n;
      persist(n);
      return n;
    });
  }, []);

  // audio sync
  useEffect(() => {
    audio.setVolumes({ master: save.settings.master, music: save.settings.music, sfx: save.settings.sfx, muted: save.settings.muted });
  }, [save.settings.master, save.settings.music, save.settings.sfx, save.settings.muted]);

  // first gesture unlocks audio
  useEffect(() => {
    const unlock = () => audio.init();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, []);

  // menu music
  useEffect(() => {
    if (screen === "combat") return;
    audio.startMusic("menu");
    audio.setIntensity(0);
  }, [screen]);

  const startSortie = (n: number) => {
    const s = saveRef.current;
    const hull = hullById(s.hull);
    const layout = s.layouts[s.hull] ?? emptyLayout(hull);
    setLaunch({
      id: Date.now(), sortie: getSortie(n), hull, layout, tech: s.tech, diff: s.diff, mods: { ...s.mods },
      adapt: resistFromMemory(s.adapt, n), replay: n <= s.cleared, tutorial: !s.settings.tutFlight && n === 1,
      shake: s.settings.shake, touch: isTouch(),
    });
    setSel(n);
    setScreen("combat");
  };

  const handleEnd = (res: RunResult) => {
    const prev = saveRef.current;
    const campaignWin = res.win && res.sortie === CAMPAIGN_LEN && prev.cleared < CAMPAIGN_LEN;
    const wasTutorial = launch?.tutorial;
    setSave((s) => ({
      ...s,
      credits: Math.max(0, s.credits + res.scrap + res.bonus - res.repairBill),
      data: s.data + res.data,
      cleared: res.win ? Math.max(s.cleared, res.sortie) : s.cleared,
      best: res.win ? { ...s.best, [res.sortie]: Math.max(s.best[res.sortie] || 0, res.score) } : s.best,
      adapt: {
        energy: s.adapt.energy * 0.5 + res.dmgDealt.energy,
        kinetic: s.adapt.kinetic * 0.5 + res.dmgDealt.kinetic,
        explosive: s.adapt.explosive * 0.5 + res.dmgDealt.explosive,
      },
      settings: wasTutorial ? { ...s.settings, tutFlight: true } : s.settings,
      life: {
        kills: s.life.kills + res.kills, sorties: s.life.sorties + (res.win ? 1 : 0), losses: s.life.losses + (!res.win && !res.retreat ? 1 : 0),
        credits: s.life.credits + res.scrap + res.bonus, time: s.life.time + res.time, bosses: s.life.bosses + (res.win && res.boss ? 1 : 0),
      },
    }));
    setProgress(true);
    setResult({ res, campaignWin });
    setScreen("results");
  };

  const toHub = (t: Tab = "hangar", n?: number) => {
    setTab(t);
    if (n !== undefined) setSel(n);
    setScreen("hub");
  };

  const newGame = () => {
    const fresh = newCampaign(saveRef.current.settings);
    saveRef.current = fresh;
    persist(fresh);
    setSaveState(fresh);
    setTut(0);
    setSel(1);
    setTab("hangar");
    setOverlay(null);
    setProgress(true);
    setScreen("hub");
  };

  return (
    <div className="h-full w-full">
      {screen === "title" && (
        <TitleScreen
          hasProgress={progress}
          best={Math.max(0, ...Object.values(save.best))}
          onContinue={() => { setSel(save.cleared + 1); toHub("hangar"); }}
          onNew={newGame}
          onQuickStart={newGame}
          onSettings={() => setOverlay("settings")}
          onHelp={() => setOverlay("help")}
        />
      )}
      {screen === "hub" && (
        <Hub
          save={save} setSave={setSave} tab={tab} setTab={setTab} sel={sel} setSel={setSel}
          onLaunch={startSortie} onSettings={() => setOverlay("settings")} onHelp={() => setOverlay("help")} onTitle={() => setScreen("title")}
          tut={tut} setTut={setTut}
        />
      )}
      {screen === "combat" && launch && <CombatView key={launch.id} opts={launch} save={save} setSave={setSave} onEnd={handleEnd} onRestart={() => startSortie(launch.sortie.n)} />}
      {screen === "results" && result && (
        <ResultsScreen
          res={result.res} save={save} campaignWin={result.campaignWin}
          onHangar={() => toHub("hangar", save.cleared + 1)}
          onRetry={() => startSortie(result.res.sortie)}
          onNext={() => toHub("sorties", result.res.sortie + 1)}
          onEndless={() => toHub("sorties", CAMPAIGN_LEN + 1)}
          onTitle={() => setScreen("title")}
        />
      )}
      {overlay === "settings" && screen !== "combat" && <SettingsPanel save={save} setSave={setSave} onClose={() => setOverlay(null)} onNewCampaign={newGame} />}
      {overlay === "help" && screen !== "combat" && (
        <HelpPanel onClose={() => setOverlay(null)} onReplayTutorial={screen === "hub" ? () => { setOverlay(null); setTab("hangar"); setTut(0); } : undefined} />
      )}
    </div>
  );
}
