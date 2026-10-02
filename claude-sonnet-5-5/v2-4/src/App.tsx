import { useCallback, useEffect, useRef, useState } from "react";
import { audio } from "./game/audio";
import { CITIES, PERKS, perkCost } from "./game/data";
import { loadSave, persist, type SaveData, type Settings } from "./game/storage";
import type { computeResult } from "./game/sim";
import type { Sim, SimConfig } from "./game/types";
import GameScreen from "./components/GameScreen";
import { CitySelect, LegacyScreen, TitleScreen } from "./components/screens";
import { HelpContent, Modal, SettingsPanel } from "./components/ui";

type Screen = "title" | "select" | "legacy" | "game";

export default function App() {
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const saveRef = useRef(save);
  const [screen, setScreen] = useState<Screen>("title");
  const [modal, setModal] = useState<null | "help" | "settings">(null);
  const [cfg, setCfg] = useState<SimConfig | null>(null);
  const [gameKey, setGameKey] = useState(0);

  const commit = useCallback((n: SaveData) => { saveRef.current = n; setSave(n); persist(n); }, []);

  useEffect(() => { audio.setVol(saveRef.current.settings); }, []);

  const setSettings = useCallback((st: Settings) => { audio.setVol(st); commit({ ...saveRef.current, settings: st }); }, [commit]);

  const start = useCallback((c: { cityIdx: number; diffId: string; mods: string[]; tutorial: boolean }) => {
    const full: SimConfig = { ...c, mods: [...c.mods], perks: { ...saveRef.current.perks } };
    commit({ ...saveRef.current, lastDiff: c.diffId, lastMods: [...c.mods] });
    setCfg(full); setGameKey((k) => k + 1); setScreen("game");
  }, [commit]);

  const onResult = useCallback((r: ReturnType<typeof computeResult>, s: Sim) => {
    const cur = saveRef.current;
    const city = CITIES[s.cfg.cityIdx];
    const n: SaveData = {
      ...cur, legacy: cur.legacy + r.lp, runs: cur.runs + 1, wins: cur.wins + (r.win ? 1 : 0),
      totalSaved: cur.totalSaved + r.totals.alive, totalLost: cur.totalLost + r.totals.dead,
      best: { ...cur.best },
    };
    let unlocked: string | null = null;
    if (r.win) {
      const b = cur.best[city.id];
      n.best[city.id] = { stars: Math.max(b?.stars || 0, r.stars), score: Math.max(b?.score || 0, r.score), wins: (b?.wins || 0) + 1 };
      if (s.cfg.cityIdx + 1 < CITIES.length && n.unlocked < s.cfg.cityIdx + 2) {
        n.unlocked = s.cfg.cityIdx + 2; unlocked = CITIES[s.cfg.cityIdx + 1].name;
      }
    }
    commit(n);
    return { unlocked };
  }, [commit]);

  const retry = useCallback(() => {
    if (!cfg) return;
    start({ cityIdx: cfg.cityIdx, diffId: cfg.diffId, mods: cfg.mods, tutorial: cfg.tutorial && !saveRef.current.tutorialDone });
  }, [cfg, start]);

  const next = cfg && cfg.cityIdx + 1 < CITIES.length && save.unlocked > cfg.cityIdx + 1
    ? () => start({ cityIdx: cfg.cityIdx + 1, diffId: cfg.diffId, mods: cfg.mods, tutorial: false })
    : null;

  const buyPerk = (id: string) => {
    const cur = saveRef.current;
    const p = PERKS.find((x) => x.id === id);
    if (!p) return;
    const lvl = cur.perks[id] || 0;
    const cost = perkCost(lvl);
    if (lvl >= p.max || cur.legacy < cost) { audio.sfx("err"); return; }
    audio.sfx("research");
    commit({ ...cur, legacy: cur.legacy - cost, perks: { ...cur.perks, [id]: lvl + 1 } });
  };

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: "#120f0d" }}>
      {screen === "title" && <TitleScreen save={save} onPlay={() => setScreen("select")} onLegacy={() => setScreen("legacy")} onHelp={() => setModal("help")} onSettings={() => setModal("settings")} />}
      {screen === "select" && <CitySelect save={save} onStart={start} onBack={() => setScreen("title")} />}
      {screen === "legacy" && <LegacyScreen save={save} onBuy={buyPerk} onBack={() => setScreen("title")} />}
      {screen === "game" && cfg && (
        <GameScreen
          key={gameKey} cfg={cfg} settings={save.settings} onSettings={setSettings} onResult={onResult}
          onRetry={retry} onNext={next} onMap={() => setScreen("select")} onTitle={() => setScreen("title")}
          onTutorialDone={() => commit({ ...saveRef.current, tutorialDone: true })}
        />
      )}
      {modal === "help" && (
        <Modal wide onClose={() => setModal(null)} z={80}>
          <div className="flex justify-between items-center mb-2"><h2 className="font-title text-2xl text-[#e8d9b5]">How to Play</h2><button className="btn" onClick={() => setModal(null)}>✕</button></div>
          <HelpContent />
        </Modal>
      )}
      {modal === "settings" && (
        <Modal onClose={() => setModal(null)} z={80}>
          <div className="flex justify-between items-center mb-3"><h2 className="font-title text-2xl text-[#e8d9b5]">Settings</h2><button className="btn" onClick={() => setModal(null)}>✕</button></div>
          <SettingsPanel settings={save.settings} onChange={setSettings} />
        </Modal>
      )}
    </div>
  );
}
