import { useEffect, useRef, useState } from "react";
import { SHIFTS, UPGRADES, type ModId } from "./game/data";
import { audio } from "./game/audio";
import type { ShiftResult } from "./game/sim";
import { defaultSave, loadSave, wipeSave, writeSave, type SaveData, type Settings } from "./game/storage";
import GameScreen from "./ui/GameScreen";
import { CampaignScreen, HelpPanel, ResultScreen, SettingsPanel, ShopScreen, TitleScreen } from "./ui/Screens";
import { Btn } from "./ui/ui";

type Screen = "title" | "campaign" | "shop" | "help" | "settings" | "play" | "result";


interface Run { shift: number; mods: ModId[]; key: number }
interface ResultState { r: ShiftResult; credited: number; firstCapstone: boolean }

export default function App() {
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const saveRef = useRef(save);
  const [screen, setScreen] = useState<Screen>("title");
  const screenRef = useRef<Screen>("title");
  const [run, setRun] = useState<Run | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);
  const [campaignSel, setCampaignSel] = useState<number | undefined>(undefined);

  const go = (s: Screen) => { screenRef.current = s; setScreen(s); };

  const commit = (n: SaveData) => {
    saveRef.current = n;
    setSave(n);
    writeSave(n);
  };

  const onSettings = (patch: Partial<Settings>) => {
    const cur = saveRef.current;
    const settings = { ...cur.settings, ...patch };
    commit({ ...cur, settings });
    audio.setVolumes({ master: settings.master, music: settings.music, sfx: settings.sfx, muted: settings.muted });
  };

  useEffect(() => {
    const s = saveRef.current.settings;
    audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, muted: s.muted });
    const h = () => {
      audio.init();
      if (screenRef.current !== "play") { audio.setTension(0.08); audio.startMusic(); }
    };
    window.addEventListener("pointerdown", h);
    window.addEventListener("keydown", h);
    return () => { window.removeEventListener("pointerdown", h); window.removeEventListener("keydown", h); };
  }, []);

  useEffect(() => {
    if (screen !== "play") { audio.setTension(screen === "result" ? 0.05 : 0.08); audio.startMusic(); }
  }, [screen]);

  const startShift = (id: number, mods: ModId[]) => {
    audio.init();
    const m = id === 0 ? [] : mods;
    setRun({ shift: id, mods: m, key: Date.now() });
    go("play");
  };

  const onFinish = (r: ShiftResult) => {
    const cur = saveRef.current;
    const shift = SHIFTS[r.shiftId];
    const stars = [...cur.stars];
    let credited = r.credits;
    if (r.shiftId === 0) { credited = cur.tutorialDone ? 0 : 40; }
    if (r.shiftId >= 1 && r.shiftId <= 7 && r.success) stars[r.shiftId] = Math.max(stars[r.shiftId], r.stars);
    const bad = r.outcome === "meltdown" || r.outcome === "breach" || r.outcome === "rupture";
    const firstCapstone = !!shift.boss && r.success && !cur.victory;
    const next: SaveData = {
      ...cur,
      credits: cur.credits + credited,
      stars,
      tutorialDone: cur.tutorialDone || r.shiftId === 0,
      bestEndless: shift.endless ? Math.max(cur.bestEndless, r.hours) : cur.bestEndless,
      victory: cur.victory || firstCapstone,
      stats: {
        shifts: cur.stats.shifts + 1,
        meltdowns: cur.stats.meltdowns + (bad ? 1 : 0),
        scrams: cur.stats.scrams + r.scrams,
        mwh: cur.stats.mwh + r.mwh,
        revenue: cur.stats.revenue + Math.max(0, r.revenue),
      },
    };
    commit(next);
    setResult({ r, credited, firstCapstone });
    setCampaignSel(r.shiftId >= 1 ? r.shiftId : undefined);
    go("result");
  };

  const buy = (id: string) => {
    const cur = saveRef.current;
    const u = UPGRADES.find((x) => x.id === id);
    if (!u) return;
    const lvl = cur.upgrades[id] || 0;
    if (lvl >= u.max) return;
    const cost = u.costs[lvl];
    if (cur.credits < cost) return;
    audio.play("buy");
    commit({ ...cur, credits: cur.credits - cost, upgrades: { ...cur.upgrades, [id]: lvl + 1 } });
  };

  const wipe = () => {
    wipeSave();
    const n = { ...defaultSave(), settings: saveRef.current.settings };
    commit(n);
  };

  let body;
  if (screen === "play" && run) {
    body = (
      <GameScreen
        key={run.key}
        shift={SHIFTS[run.shift]}
        mods={run.mods}
        upgrades={save.upgrades}
        settings={save.settings}
        onSettings={onSettings}
        onFinish={onFinish}
        onQuit={() => go("title")}
        onRestart={() => setRun({ ...run, key: Date.now() })}
      />
    );
  } else if (screen === "result" && result) {
    const id = result.r.shiftId;
    body = (
      <ResultScreen
        result={result.r}
        save={save}
        credited={result.credited}
        firstCapstone={result.firstCapstone}
        hasNext={id >= 1 && id < 7}
        onRetry={() => startShift(id, run?.mods ?? [])}
        onNext={() => startShift(id === 0 ? 1 : Math.min(7, id + 1), run?.mods ?? [])}
        onMenu={() => go("title")}
        onShop={() => go("shop")}
        onEndless={() => startShift(8, run?.mods ?? [])}
      />
    );
  } else if (screen === "campaign") {
    body = <CampaignScreen save={save} settings={save.settings} onSettings={onSettings} onBack={() => go("title")} onStart={startShift} initial={campaignSel} />;
  } else if (screen === "shop") {
    body = <ShopScreen save={save} onBuy={buy} onBack={() => go(result ? "result" : "title")} />;
  } else if (screen === "help") {
    body = (
      <div className="h-full overflow-auto bg-[#050c12] p-4"><div className="max-w-4xl mx-auto rounded-xl border border-cyan-800/60 bg-[#08121a] p-5"><HelpPanel /><Btn className="mt-4 w-full" onClick={() => go("title")}>← Back</Btn></div></div>
    );
  } else if (screen === "settings") {
    body = (
      <div className="h-full overflow-auto bg-[#050c12] p-4"><div className="max-w-lg mx-auto rounded-xl border border-cyan-800/60 bg-[#08121a] p-5"><h2 className="text-xl font-black text-white mb-3">Settings</h2><SettingsPanel settings={save.settings} onChange={onSettings} onWipe={wipe} /><Btn className="mt-4 w-full" onClick={() => go("title")}>← Back</Btn></div></div>
    );
  } else {
    body = <TitleScreen save={save} go={(s) => go(s)} onTutorial={() => startShift(0, [])} />;
  }

  return <div className="h-screen w-screen overflow-hidden">{body}</div>;
}
