import { useCallback, useEffect, useRef, useState } from "react";
import { PERKS, SCENARIOS } from "./game/data";
import type { Summary } from "./game/engine";
import { applyVolumes, initAudio, sfx, startMusic, setMusicMode } from "./game/audio";
import { loadSave, persist, wipeSave, type SaveData, type Settings } from "./game/save";
import { CampaignScreen, HelpModal, PerksScreen, SettingsModal, TitleScreen, type RunCfg } from "./ui/Menus";
import GameScreen from "./ui/GameScreen";

type Screen = "title" | "campaign" | "perks" | "game";

export default function App() {
  const [save, setSave] = useState<SaveData>(loadSave);
  const [screen, setScreen] = useState<Screen>("title");
  const [cfg, setCfg] = useState<RunCfg>(() => ({ scenarioId: "ashes", difficultyId: "schemer", mods: [], tutorial: !loadSave().tutorialDone }));
  const [runKey, setRunKey] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  useEffect(() => {
    persist(save);
    applyVolumes(save.settings);
  }, [save]);

  // audio must start from a user gesture
  useEffect(() => {
    const first = () => {
      initAudio();
      applyVolumes(save.settings);
      startMusic("menu");
    };
    window.addEventListener("pointerdown", first, { once: true });
    window.addEventListener("keydown", first, { once: true });
    return () => {
      window.removeEventListener("pointerdown", first);
      window.removeEventListener("keydown", first);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (screen !== "game") setMusicMode("menu");
  }, [screen]);

  const setSettings = (s: Settings) => setSave((v) => ({ ...v, settings: s }));
  const toggleMute = useCallback(() => setSave((v) => ({ ...v, settings: { ...v.settings, muted: !v.settings.muted } })), []);

  const onFinished = useCallback((s: Summary) => {
    const c = cfgRef.current;
    setSave((v) => {
      const rec = v.cleared[c.scenarioId];
      const cleared = s.won
        ? { ...v.cleared, [c.scenarioId]: { best: Math.max(rec?.best ?? 0, s.score), diff: c.difficultyId, wins: (rec?.wins ?? 0) + 1 } }
        : rec ? { ...v.cleared, [c.scenarioId]: { ...rec, best: Math.max(rec.best, s.score) } } : v.cleared;
      return { ...v, seals: v.seals + s.seals, runs: v.runs + 1, wins: v.wins + (s.won ? 1 : 0), totalRecruits: v.totalRecruits + s.recruited, cleared, tutorialDone: v.tutorialDone || s.daysSurvived >= 2 };
    });
  }, []);

  const buyPerk = (id: string) => {
    const p = PERKS.find((x) => x.id === id);
    if (!p) return;
    const lvl = save.perks[id] ?? 0;
    const list = PERKS.filter((x) => x.branch === p.branch);
    const i = list.findIndex((x) => x.id === id);
    const prev = i === 0 ? 3 : save.perks[list[i - 1].id] ?? 0;
    if (lvl >= p.costs.length || prev < 1 || save.seals < p.costs[lvl]) { sfx("fail"); return; }
    sfx("unlock");
    setSave((v) => ({ ...v, seals: v.seals - p.costs[lvl], perks: { ...v.perks, [id]: lvl + 1 } }));
  };

  const start = () => { setRunKey((k) => k + 1); setScreen("game"); };
  const idx = SCENARIOS.findIndex((s) => s.id === cfg.scenarioId);
  const hasNext = idx >= 0 && idx + 1 < SCENARIOS.length;

  return (
    <div className="h-full w-full relative overflow-hidden">
      {screen === "title" && (
        <TitleScreen save={save} onPlay={() => { sfx("click"); setScreen("campaign"); }} onPerks={() => setScreen("perks")} onHelp={() => setHelpOpen(true)} onSettings={() => setSettingsOpen(true)} />
      )}
      {screen === "campaign" && <CampaignScreen save={save} cfg={cfg} setCfg={setCfg} onStart={start} onBack={() => setScreen("title")} />}
      {screen === "perks" && <PerksScreen save={save} onBuy={buyPerk} onBack={() => setScreen("title")} />}
      {screen === "game" && (
        <GameScreen
          key={runKey}
          cfg={cfg}
          save={save}
          settings={save.settings}
          onFinished={onFinished}
          onRetry={start}
          onNav={(to) => {
            if (to === "next" && hasNext) { setCfg((c) => ({ ...c, scenarioId: SCENARIOS[idx + 1].id, tutorial: false })); setRunKey((k) => k + 1); }
            else setScreen(to === "title" ? "title" : "campaign");
          }}
          hasNext={hasNext}
          onSettings={() => setSettingsOpen(true)}
          onToggleMute={toggleMute}
        />
      )}
      {helpOpen && screen !== "game" && <HelpModal onClose={() => setHelpOpen(false)} />}
      {settingsOpen && (
        <SettingsModal settings={save.settings} onChange={setSettings} onClose={() => setSettingsOpen(false)} onReset={() => { setSave(wipeSave()); setSettingsOpen(false); }} />
      )}
    </div>
  );
}
