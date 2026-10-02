import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { audio } from "./game/audio";
import type { MusicMode } from "./game/audio";
import { PERKS } from "./game/data";
import {
  applySortieResult, calcRenown, checkAchievements, hasSave, loadCampaign, loadMeta, newCampaign, perkCost, saveCampaign, saveMeta, travel,
} from "./game/state";
import type { Campaign, Meta, Settings, SortieResult } from "./game/state";
import type { TravelEvent } from "./game/state";
import Port from "./components/Port";
import SortieView from "./components/SortieView";
import { EndScreen, LegacyScreen, NewGameScreen, ResultScreen, TitleScreen } from "./components/Screens";
import { Btn, HelpPanel, Modal, SettingsPanel } from "./components/ui";

type Screen = "title" | "new" | "legacy" | "port" | "sortie" | "result" | "end";
type ModalKind = null | "help" | "settings" | "menu";

export default function App() {
  const [meta, setMeta] = useState<Meta>(() => loadMeta());
  const metaRef = useRef(meta);
  const [camp, setCamp] = useState<Campaign | null>(null);
  const campRef = useRef<Campaign | null>(null);
  const [screen, setScreen] = useState<Screen>("title");
  const [modal, setModal] = useState<ModalKind>(null);
  const [sortie, setSortie] = useState<{ apex: boolean; ambush: boolean; tutorial: boolean; key: number } | null>(null);
  const [result, setResult] = useState<{ res: SortieResult; msgs: string[]; fresh: string[] } | null>(null);
  const [end, setEnd] = useState<{ kind: "win" | "lose"; gain: number } | null>(null);
  const [event, setEvent] = useState<TravelEvent | null>(null);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const toastId = useRef(1);

  const updateMeta = useCallback((fn: (m: Meta) => void) => {
    const n = structuredClone(metaRef.current);
    fn(n);
    metaRef.current = n; setMeta(n); saveMeta(n);
  }, []);

  const toast = useCallback((msgs: string[]) => {
    const items = msgs.filter(Boolean).slice(-3).map((text) => ({ id: toastId.current++, text }));
    if (!items.length) return;
    setToasts((t) => [...t, ...items].slice(-4));
    items.forEach((it) => window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== it.id)), 3800));
  }, []);

  const commit = useCallback((c: Campaign) => { campRef.current = c; setCamp(c); saveCampaign(c); }, []);

  // audio setup
  useEffect(() => {
    const unlock = () => audio.init();
    window.addEventListener("pointerdown", unlock); window.addEventListener("keydown", unlock);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, []);
  useEffect(() => { audio.setVolumes(meta.settings); }, [meta.settings]);
  useEffect(() => {
    const mode: MusicMode = screen === "sortie" ? "sortie" : screen === "port" || screen === "result" ? "port" : "menu";
    if (screen !== "sortie") audio.setMode(mode);
  }, [screen]);

  const endGame = useCallback((kind: "win" | "lose") => {
    const c = structuredClone(campRef.current!);
    const gain = Math.max(0, calcRenown(c) - (c.renownPaid || 0));
    const first = !c.renownPaid;
    c.renownPaid = (c.renownPaid || 0) + gain;
    if (kind === "lose" && !c.over) c.over = "retired";
    campRef.current = c; setCamp(c); saveCampaign(c);
    updateMeta((m) => {
      m.renown += gain;
      if (first) m.campaigns++;
      if (kind === "win") { m.wins++; if (!m.bestDays || c.day < m.bestDays) m.bestDays = c.day; }
      checkAchievements(c, m);
    });
    setEnd({ kind, gain }); setScreen("end"); setModal(null);
    window.setTimeout(() => audio.sfx(kind === "win" ? "win" : "lose"), 150);
  }, [updateMeta]);

  // run an action on a cloned campaign
  const act = useCallback((fn: (c: Campaign) => string | string[] | void, sfx = "click") => {
    const cur = campRef.current; if (!cur) return;
    const n = structuredClone(cur);
    const r = fn(n);
    const msgs = Array.isArray(r) ? r : r ? [r] : [];
    const before = JSON.stringify(cur), after = JSON.stringify(n);
    audio.sfx(before === after ? "deny" : sfx);
    if (before === after) { toast(msgs); return; }
    commit(n);
    let fresh: string[] = [];
    updateMeta((m) => { fresh = checkAchievements(n, m); });
    toast([...msgs, ...fresh.map((f) => `🏆 Achievement: ${f}`)]);
    if (n.over) endGame("lose");
  }, [commit, toast, updateMeta, endGame]);

  const onTravel = useCallback((to: number) => {
    const cur = campRef.current; if (!cur) return;
    const n = structuredClone(cur);
    const r = travel(n, to);
    if (!r.ok) { audio.sfx("deny"); toast(r.msgs); return; }
    audio.sfx("launch");
    commit(n);
    toast(r.msgs.slice(-3));
    updateMeta((m) => { checkAchievements(n, m); });
    if (n.over) { endGame("lose"); return; }
    if (r.event) setEvent(r.event);
  }, [commit, toast, updateMeta, endGame]);

  const launch = (apex: boolean) => {
    const c = campRef.current; if (!c) return;
    const rs = c.regions[c.loc];
    const m = metaRef.current;
    setSortie({ apex, ambush: !apex && rs.threat >= 100 && !rs.cleared, tutorial: !m.tutorialDone && m.settings.tips, key: Date.now() });
    setScreen("sortie");
  };

  const onSortieEnd = useCallback((res: SortieResult) => {
    const cur = campRef.current; if (!cur) return;
    audio.sfx(res.outcome === "wreck" ? "lose" : res.outcome === "apex" ? "win" : "bell");
    const c = structuredClone(cur);
    const msgs = applySortieResult(c, res);
    commit(c);
    let fresh: string[] = [];
    updateMeta((m) => { fresh = checkAchievements(c, m); });
    setResult({ res, msgs, fresh });
    setScreen("result");
  }, [commit, updateMeta]);

  const afterResult = () => {
    const c = campRef.current; if (!c) return;
    if (c.over) endGame("lose");
    else if (c.won) endGame("win");
    else setScreen("port");
  };

  const startNew = (diff: number, storm: boolean, iron: boolean) => {
    const c = newCampaign(diff, storm, iron, metaRef.current);
    commit(c); setEnd(null); setResult(null);
    setScreen("port");
    toast(["Welcome aboard, Captain. Tap ? for help, then launch your first hunt for a guided tutorial."]);
  };

  const onSettings = (s: Settings) => updateMeta((m) => { m.settings = s; });
  const saveExists = useMemo(() => hasSave(), [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  const toTitle = () => { setModal(null); setScreen("title"); };

  return (
    <div className="h-full w-full relative overflow-hidden">
      {screen === "title" && (
        <TitleScreen
          hasSave={saveExists} meta={meta}
          onContinue={() => { const c = loadCampaign(); if (c) { commit(c); setScreen("port"); } }}
          onNew={() => setScreen("new")} onHelp={() => setModal("help")} onSettings={() => setModal("settings")} onLegacy={() => setScreen("legacy")}
        />
      )}
      {screen === "new" && <NewGameScreen onStart={startNew} onBack={() => setScreen("title")} />}
      {screen === "legacy" && (
        <LegacyScreen
          meta={meta} onBack={() => setScreen("title")}
          onBuy={(id) => updateMeta((m) => {
            const p = PERKS.find((x) => x.id === id)!; const lv = m.perks[id] || 0; const cost = perkCost(id, lv);
            if (lv < p.max && m.renown >= cost) { m.renown -= cost; m.perks[id] = lv + 1; }
          })}
        />
      )}
      {screen === "port" && camp && (
        <Port camp={camp} meta={meta} act={act} onLaunch={launch} onTravel={onTravel} onMenu={() => setModal("menu")} onHelp={() => setModal("help")} />
      )}
      {screen === "sortie" && camp && sortie && (
        <SortieView
          key={sortie.key} camp={camp} apex={sortie.apex} ambush={sortie.ambush} tutorial={sortie.tutorial}
          settings={meta.settings} onSettings={onSettings} onEnd={onSortieEnd} onQuit={() => { setScreen("title"); }}
          onTutorialDone={() => updateMeta((m) => { m.tutorialDone = true; })}
        />
      )}
      {screen === "result" && result && camp && <ResultScreen res={result.res} msgs={result.msgs} fresh={result.fresh} camp={camp} onContinue={afterResult} />}
      {screen === "end" && end && camp && (
        <EndScreen
          kind={end.kind} camp={camp} renownGain={end.gain}
          onNew={() => setScreen("new")} onTitle={toTitle}
          onContinue={end.kind === "win" ? () => { const c = structuredClone(campRef.current!); c.won = false; commit(c); setScreen("port"); } : undefined}
        />
      )}

      {modal === "help" && (
        <Modal wide onClose={() => setModal(null)}>
          <h2 className="text-2xl font-bold text-amber-200 mb-3">📖 How to Play</h2>
          <HelpPanel />
          <Btn variant="steel" className="mt-4" onClick={() => setModal(null)}>Close</Btn>
        </Modal>
      )}
      {modal === "settings" && (
        <Modal onClose={() => setModal(null)}>
          <h2 className="text-2xl font-bold text-amber-200 mb-3">⚙ Settings</h2>
          <SettingsPanel settings={meta.settings} onChange={onSettings} />
          <div className="mt-3"><Btn variant="steel" onClick={() => { updateMeta((m) => { m.tutorialDone = false; m.settings.tips = true; }); toast(["The tutorial will replay on your next hunt."]); }}>Replay tutorial</Btn></div>
          <Btn variant="steel" className="mt-4" onClick={() => setModal(null)}>Close</Btn>
        </Modal>
      )}
      {modal === "menu" && (
        <Modal onClose={() => setModal(null)}>
          <h2 className="text-2xl font-bold text-amber-200 mb-3 text-center">Captain's Menu</h2>
          <div className="space-y-2">
            <Btn className="w-full" onClick={() => setModal(null)}>▶ Back to port</Btn>
            <Btn variant="steel" className="w-full" onClick={() => setModal("settings")}>⚙ Settings</Btn>
            <Btn variant="steel" className="w-full" onClick={() => setModal("help")}>📖 Help</Btn>
            <Btn variant="green" className="w-full" onClick={toTitle}>💾 Save & quit to title</Btn>
            <Btn variant="red" className="w-full" onClick={() => endGame("lose")}>🏳 Retire this voyage</Btn>
          </div>
          <div className="text-xs text-amber-100/60 mt-2 text-center">The voyage autosaves after every action.</div>
        </Modal>
      )}
      {event && (
        <Modal>
          <h2 className="text-2xl font-bold text-amber-200 mb-1">🌬 {event.title}</h2>
          <p className="text-amber-50/90 mb-4">{event.text}</p>
          <div className="space-y-2">
            {event.choices.map((ch) => (
              <Btn key={ch.label} variant="steel" className="w-full" onClick={() => { const e = event; setEvent(null); act((c) => ch.run(c), "bell"); void e; }}>{ch.label}</Btn>
            ))}
          </div>
        </Modal>
      )}

      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] flex flex-col gap-2 items-center pointer-events-none px-3 w-full max-w-xl">
        {toasts.map((t) => (
          <div key={t.id} className="pop-in px-4 py-2 rounded-lg bg-slate-950/90 border border-amber-400/50 text-amber-50 shadow-xl text-sm text-center">{t.text}</div>
        ))}
      </div>
    </div>
  );
}
