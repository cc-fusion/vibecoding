import { useCallback, useEffect, useRef, useState } from "react";
import {
  CARD_MAP, DIFF_MAP, METAS, ORDER_MAP, RELICS, computeAsh, newStats, vowAshBonus, type RunState,
} from "./game/data";
import { loadSave, wipeSave, writeSave, type SaveData, type Settings } from "./game/save";
import { audio } from "./game/audio";
import GameView from "./components/GameView";
import Interlude, { grantRelic } from "./components/Interlude";
import EndScreen, { type EndInfo } from "./components/EndScreens";
import { Reliquary, Setup, Title } from "./components/Menus";
import { Codex, SettingsPanel } from "./components/Panels";

type Screen = "title" | "setup" | "game" | "tutorial" | "interlude" | "gameover" | "victory" | "reliquary" | "help" | "settings";

function buildRun(save: SaveData): RunState {
  const st = save.setup;
  const order = ORDER_MAP[st.order] && save.unlockedOrders.includes(st.order) ? ORDER_MAP[st.order] : ORDER_MAP.acolyte;
  const diff = DIFF_MAP[st.diff] || DIFF_MAP.zealot;
  const maxHp = Math.max(1, order.hp + (save.meta.vest || 0) + diff.hpBonus - (st.vows.includes("frail") ? 1 : 0));
  const run: RunState = {
    order: order.id, diff: diff.id, vows: [...st.vows],
    deck: order.deck.map((id, i) => ({ uid: i + 1, id, up: false })), relics: [],
    hp: maxHp, maxHp, act: 1, stage: "wave", endless: false, stats: newStats(), ashClaimed: 0,
    ashMult: diff.ash * vowAshBonus(st.vows), uid: 100, won: false,
  };
  if (save.meta.token) grantRelic(run, RELICS[Math.floor(Math.random() * RELICS.length)].id);
  return run;
}

function buildTutorialRun(): RunState {
  const ids = ["aspersion", "needle", "barrier", "purge", "litany", "fasting", "wave", "guide"];
  return {
    order: "acolyte", diff: "pilgrim", vows: [], deck: ids.map((id, i) => ({ uid: i + 1, id, up: false })), relics: [],
    hp: 5, maxHp: 5, act: 1, stage: "wave", endless: false, stats: newStats(), ashClaimed: 0, ashMult: 0, uid: 100, won: false,
  };
}

export default function App() {
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const saveRef = useRef(save);
  saveRef.current = save;
  const [screen, setScreen] = useState<Screen>("title");
  const [run, setRun] = useState<RunState>(() => buildRun(loadSave()));
  const [stageKey, setStageKey] = useState(0);
  const [interKind, setInterKind] = useState<"wave" | "boss">("wave");
  const [healed, setHealed] = useState(false);
  const [endInfo, setEndInfo] = useState<EndInfo>({ ash: 0, newBest: false, total: 0 });
  const [, setTick] = useState(0);
  const endedRef = useRef<RunState | null>(null);

  const commit = useCallback((fn: (s: SaveData) => SaveData) => {
    const next = fn(saveRef.current);
    saveRef.current = next;
    writeSave(next);
    setSave(next);
  }, []);

  // audio settings + first gesture unlock
  useEffect(() => {
    audio.setVol({ master: save.settings.master, sfx: save.settings.sfx, music: save.settings.music, muted: save.settings.muted });
  }, [save.settings]);

  useEffect(() => {
    const unlock = () => { audio.init(); if (!audio.musicOn) audio.startMusic(0); };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, []);

  // menu music mood
  useEffect(() => {
    if (["title", "setup", "reliquary", "help", "settings", "interlude", "victory"].includes(screen)) {
      audio.setIntensity(screen === "victory" ? 0.4 : 0.15, 0);
      if (audio.ctx && !audio.musicOn) audio.startMusic(0);
    }
  }, [screen]);

  const finishRun = useCallback((r: RunState, won: boolean): EndInfo => {
    let info: EndInfo = { ash: 0, newBest: false, total: 0 };
    commit((cur) => {
      const total = computeAsh(r, cur.meta.ash || 0);
      const gain = Math.max(0, total - r.ashClaimed);
      r.ashClaimed = Math.max(r.ashClaimed, total);
      const rec = { ...cur.records, bestScore: { ...cur.records.bestScore } };
      if (!r.recorded) {
        r.recorded = true;
        rec.runs += 1; rec.kills += r.stats.kills; rec.grazes += r.stats.grazes; rec.bosses += r.stats.bosses; rec.playtime += r.stats.time;
        if (won) rec.wins += 1;
      }
      const prev = rec.bestScore[r.diff] || 0;
      const newBest = r.stats.score > prev;
      if (newBest) rec.bestScore[r.diff] = r.stats.score;
      rec.bestAct = Math.max(rec.bestAct, r.act);
      info = { ash: gain, newBest, total };
      return { ...cur, ash: cur.ash + gain, records: rec };
    });
    return info;
  }, [commit]);

  const startRun = useCallback(() => {
    const r = buildRun(saveRef.current);
    endedRef.current = null;
    setRun(r);
    setStageKey((k) => k + 1);
    setScreen("game");
  }, []);

  const startTutorial = () => {
    audio.init();
    endedRef.current = null;
    setRun(buildTutorialRun());
    setStageKey((k) => k + 1);
    setScreen("tutorial");
  };

  const onClear = () => {
    if (screen === "tutorial") {
      commit((s) => ({ ...s, tutorialDone: true }));
      setScreen("title");
      return;
    }
    if (run.stage === "wave") {
      const h = run.hp < run.maxHp;
      if (h) run.hp += 1;
      setHealed(h);
      setInterKind("wave");
      setScreen("interlude");
      return;
    }
    setHealed(false);
    if (run.act >= 3 && !run.endless) {
      run.won = true;
      const info = finishRun(run, true);
      setEndInfo(info);
      setScreen("victory");
      return;
    }
    setInterKind("boss");
    setScreen("interlude");
  };

  const onDeath = () => {
    if (endedRef.current === run) return;
    endedRef.current = run;
    const info = finishRun(run, false);
    setEndInfo(info);
    audio.stopMusic();
    if (run.hp <= 0) audio.sfx("defeat");
    setScreen("gameover");
  };

  const onInterDone = () => {
    if (interKind === "wave") run.stage = "boss";
    else { run.act += 1; run.stage = "wave"; }
    setStageKey((k) => k + 1);
    setScreen("game");
  };

  const onContinue = () => {
    run.endless = true;
    run.act += 1;
    run.stage = "wave";
    run.hp = Math.min(run.maxHp, run.hp + 2);
    endedRef.current = null;
    setStageKey((k) => k + 1);
    setScreen("game");
  };

  const onRestart = () => {
    if (endedRef.current !== run) { endedRef.current = run; finishRun(run, false); }
    audio.stopMusic();
    startRun();
  };

  const onDiff = (d: string) => {
    const nd = DIFF_MAP[d];
    if (!nd) return;
    run.diff = d;
    run.ashMult = Math.min(run.ashMult, nd.ash * vowAshBonus(run.vows));
    setTick((t) => t + 1);
  };

  const setSettings = (s: Settings) => commit((cur) => ({ ...cur, settings: s }));

  const buyMetaChecked = (id: string) => {
    const m = METAS.find((x) => x.id === id);
    const cur = saveRef.current;
    if (!m) return;
    const lvl = cur.meta[id] || 0;
    if (lvl >= m.max) return;
    const cost = m.cost[lvl];
    if (cur.ash < cost) return;
    audio.sfx("buy");
    commit((s) => ({ ...s, ash: s.ash - cost, meta: { ...s.meta, [id]: lvl + 1 } }));
  };

  const unlockCard = (id: string) => {
    const c = CARD_MAP[id];
    const cur = saveRef.current;
    if (!c?.unlock || cur.ash < c.unlock || cur.unlockedCards.includes(id)) return;
    audio.sfx("buy");
    commit((s) => ({ ...s, ash: s.ash - c.unlock!, unlockedCards: [...s.unlockedCards, id] }));
  };
  const unlockOrder = (id: string) => {
    const o = ORDER_MAP[id];
    const cur = saveRef.current;
    if (!o?.unlock || cur.ash < o.unlock || cur.unlockedOrders.includes(id)) return;
    audio.sfx("buy");
    commit((s) => ({ ...s, ash: s.ash - o.unlock!, unlockedOrders: [...s.unlockedOrders, id] }));
  };

  return (
    <div className="h-full w-full overflow-hidden">
      {screen === "title" && (
        <Title save={save} onPlay={() => { audio.init(); audio.sfx("ui"); setScreen("setup"); }} onTutorial={startTutorial}
          onReliquary={() => { audio.sfx("ui"); setScreen("reliquary"); }} onHelp={() => { audio.sfx("ui"); setScreen("help"); }} onSettings={() => { audio.sfx("ui"); setScreen("settings"); }} />
      )}
      {screen === "setup" && (
        <Setup save={save} onBack={() => setScreen("title")} onStart={() => { audio.sfx("pop"); startRun(); }} onUnlockOrder={unlockOrder}
          onChange={(setup) => commit((s) => ({ ...s, setup }))} />
      )}
      {(screen === "game" || screen === "tutorial") && (
        <GameView key={stageKey} run={run} kind={screen === "tutorial" ? "tutorial" : run.stage} save={save}
          onSettings={setSettings} onDiff={onDiff} onClear={onClear} onDeath={onDeath} onQuit={() => setScreen("title")} onRestart={onRestart} />
      )}
      {screen === "interlude" && (
        <Interlude key={stageKey + "i"} run={run} kind={interKind} save={save} onDone={onInterDone} healed={healed}
          onAsh={(n) => commit((s) => ({ ...s, ash: s.ash + n }))} />
      )}
      {(screen === "gameover" || screen === "victory") && (
        <EndScreen run={run} info={endInfo} victory={screen === "victory"}
          onRetry={() => { audio.sfx("ui"); startRun(); }} onSetup={() => setScreen("setup")} onTitle={() => setScreen("title")}
          onReliquary={() => setScreen("reliquary")} onContinue={screen === "victory" ? onContinue : undefined} />
      )}
      {screen === "reliquary" && (
        <Reliquary save={save} onBack={() => setScreen("title")} onBuyMeta={buyMetaChecked} onUnlockCard={unlockCard} onUnlockOrder={unlockOrder}
          onWipe={() => { const d = wipeSave(); saveRef.current = d; setSave(d); }} />
      )}
      {screen === "help" && (
        <div className="h-full w-full glass-bg overflow-y-auto p-3 sm:p-6">
          <div className="max-w-4xl mx-auto flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <button className="btn" onClick={() => setScreen("title")}>← Back</button>
              <h2 className="text-xl sm:text-3xl tracking-[0.25em] text-amber-100 title-glow">CODEX</h2>
              <button className="btn" onClick={startTutorial}>Tutorial</button>
            </div>
            <div className="panel rounded p-4"><Codex save={save} /></div>
          </div>
        </div>
      )}
      {screen === "settings" && (
        <div className="h-full w-full glass-bg overflow-y-auto p-3 sm:p-6 flex items-center justify-center">
          <div className="panel rounded-lg p-6 w-[min(96vw,520px)] flex flex-col gap-4">
            <h2 className="text-center text-2xl tracking-[0.3em] text-amber-100 title-glow">SETTINGS</h2>
            <SettingsPanel settings={save.settings} onChange={setSettings} />
            <button className="btn self-center" onClick={() => setScreen("title")}>Back</button>
          </div>
        </div>
      )}
    </div>
  );
}
