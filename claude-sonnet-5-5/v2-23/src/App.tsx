import { useCallback, useEffect, useRef, useState } from "react";
import { loadMeta, saveMeta, loadRun, saveRun, clearRun, type Meta, type Settings } from "./game/save";
import {
  newRun, resolveRound, settleRun, rollShop, isBossRound, type RunState, type RoundSummary, type ActResult,
} from "./game/run";
import { LAB_UPGRADES, PARTS } from "./game/data";
import type { BattleResult } from "./game/battle";
import { audio, type MusicMode } from "./game/audio";
import Forge from "./components/Forge";
import Battle from "./components/Battle";
import { Title, Setup, Lab, Help, SettingsPanel, Pause, EndScreen } from "./components/Menus";

type Screen = "title" | "setup" | "lab" | "forge" | "battle" | "gameover" | "victory";
type Overlay = null | "pause" | "settings" | "help";

function validRun(r: RunState | null): r is RunState {
  return !!r && r.v === 1 && !r.over && Array.isArray(r.team) && r.team.length === 3 && r.team.every((c) => c.parts.every((p) => !p || PARTS[p.id]));
}

export default function App() {
  const [meta, setMeta] = useState<Meta>(loadMeta);
  const [run, setRun] = useState<RunState | null>(null);
  const [screen, setScreen] = useState<Screen>("title");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [toasts, setToasts] = useState<{ id: number; text: string; err?: boolean }[]>([]);
  const [hasSave, setHasSave] = useState(() => validRun(loadRun<RunState>()));
  const [gained, setGained] = useState(0);
  const [battleKey, setBattleKey] = useState(0);

  const metaRef = useRef(meta); metaRef.current = meta;
  const runRef = useRef(run); runRef.current = run;
  const screenRef = useRef(screen); screenRef.current = screen;
  const overlayRef = useRef(overlay); overlayRef.current = overlay;
  const toastId = useRef(1);

  const toast = useCallback((text: string, err = false) => {
    const id = toastId.current++;
    setToasts((t) => [...t.slice(-3), { id, text, err }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2300);
  }, []);

  const updateMeta = useCallback((fn: (m: Meta) => void) => {
    const m = structuredClone(metaRef.current);
    fn(m);
    metaRef.current = m;
    setMeta(m); saveMeta(m);
  }, []);

  const updateSettings = useCallback((p: Partial<Settings>) => updateMeta((m) => { m.settings = { ...m.settings, ...p }; }), [updateMeta]);

  // ---- audio wiring ----
  useEffect(() => { audio.configure(meta.settings); }, [meta.settings]);
  useEffect(() => {
    const init = () => { audio.init(); audio.configure(metaRef.current.settings); };
    window.addEventListener("pointerdown", init, { once: true });
    window.addEventListener("keydown", init, { once: true });
    return () => { window.removeEventListener("pointerdown", init); window.removeEventListener("keydown", init); audio.stopAll(); };
  }, []);
  useEffect(() => {
    let mode: MusicMode = "menu";
    if (screen === "forge") mode = "forge";
    else if (screen === "battle") mode = run && isBossRound(run.round) ? "boss" : "battle";
    audio.setMode(mode);
    if (screen !== "battle") audio.setIntensity(screen === "forge" ? 0.3 : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, battleKey]);

  // keep hotkeys (Space/Enter) from double-firing on a focused button
  useEffect(() => {
    const blur = (e: MouseEvent) => { (e.target as HTMLElement | null)?.closest?.("button")?.blur(); };
    document.addEventListener("click", blur);
    return () => document.removeEventListener("click", blur);
  }, []);

  // tab blur: pause battle & suspend audio
  useEffect(() => {
    const vis = () => {
      if (document.hidden) {
        audio.suspend();
        if (screenRef.current === "battle" && !overlayRef.current) setOverlay("pause");
      } else audio.resume();
    };
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, []);

  // persist run in forge
  useEffect(() => { if (run && screen === "forge" && !run.over) saveRun(run); }, [run, screen]);

  // tutorial auto-advance
  useEffect(() => {
    if (!run || run.tut < 0 || screen !== "forge") return;
    let next = run.tut;
    if (run.tut === 1 && run.stats.bought >= 1) next = 2;
    else if (run.tut === 2 && run.moves >= 1) next = 3;
    if (next !== run.tut) { audio.sfx("coin"); setRun({ ...run, tut: next }); }
  }, [run, screen]);

  // ---- run lifecycle ----
  const startRun = useCallback((diff: string, muts: string[], seed: string, tutorial = false) => {
    const r = newRun(metaRef.current, diff, muts, seed, tutorial);
    setRun(r); saveRun(r); setHasSave(true); setScreen("forge"); setOverlay(null);
    audio.sfx("fight");
  }, []);

  const continueRun = useCallback(() => {
    const r = loadRun<RunState>();
    if (validRun(r)) { setRun(r); setScreen("forge"); audio.sfx("click"); } else { setHasSave(false); toast("Saved run could not be loaded", true); }
  }, [toast]);

  const act = useCallback((fn: (r: RunState, m: Meta, s: Settings) => ActResult) => {
    const cur = runRef.current;
    if (!cur) return;
    const r = structuredClone(cur), m = structuredClone(metaRef.current);
    const res = fn(r, m, m.settings);
    if (res.err) { audio.sfx("error"); toast(res.err, true); return; }
    setRun(r); runRef.current = r;
    if (m.seen.length !== metaRef.current.seen.length) { metaRef.current = m; setMeta(m); saveMeta(m); }
    if (res.sfx) audio.sfx(res.sfx);
    if (res.msg) toast(res.msg);
  }, [toast]);

  const onTut = useCallback((next: number) => {
    const cur = runRef.current; if (!cur) return;
    setRun({ ...cur, tut: next });
    if (next === -1) updateMeta((m) => { m.tutorialDone = true; });
    audio.sfx("click");
  }, [updateMeta]);

  const onFight = useCallback(() => {
    const cur = runRef.current; if (!cur) return;
    const r = cur.tut >= 0 && cur.tut < 6 ? { ...cur, tut: 6 } : cur;
    if (r !== cur) setRun(r);
    saveRun(r);
    setBattleKey((k) => k + 1); setScreen("battle");
  }, []);

  const onBattleFinished = useCallback((res: BattleResult): RoundSummary => {
    const r = structuredClone(runRef.current!), m = structuredClone(metaRef.current);
    const sum = resolveRound(r, m, res);
    if (r.over) { setGained(settleRun(r, m)); }
    runRef.current = r; metaRef.current = m;
    setRun(r); setMeta(m); saveMeta(m);
    return sum;
  }, []);

  const onBattleContinue = useCallback((sum: RoundSummary) => {
    if (sum.over === "lose") { clearRun(); setHasSave(false); setScreen("gameover"); setTimeout(() => audio.sfx("lose"), 100); }
    else if (sum.over === "win") { clearRun(); setHasSave(false); setScreen("victory"); setTimeout(() => audio.sfx("victory"), 100); }
    else { if (runRef.current) saveRun(runRef.current); setScreen("forge"); audio.sfx("click"); }
  }, []);

  const goEndless = useCallback(() => {
    const cur = runRef.current; if (!cur) return;
    const r = structuredClone(cur), m = structuredClone(metaRef.current);
    r.endless = true; r.over = null; r.lives = Math.min(r.maxLives, r.lives + 1); r.round++; r.gold += 8; r.freeUsed = false; r.mercy = false;
    rollShop(r, m, true);
    setRun(r); saveRun(r); setHasSave(true); setScreen("forge");
    audio.sfx("upgrade");
    toast("Endless mode! +1 life, +8 gold. Bosses return stronger every 5 rounds.");
  }, [toast]);

  const retry = useCallback(() => {
    const cur = runRef.current;
    startRun(cur?.diff ?? "journeyman", cur?.mutagens ?? [], Math.random().toString(36).slice(2, 8));
  }, [startRun]);

  const toTitle = useCallback(() => { setOverlay(null); setScreen("title"); setHasSave(validRun(loadRun<RunState>())); }, []);

  const abandon = useCallback(() => {
    const cur = runRef.current;
    if (cur) {
      const r = structuredClone(cur), m = structuredClone(metaRef.current);
      r.over = "lose";
      const g = settleRun(r, m);
      metaRef.current = m; setMeta(m); saveMeta(m);
      if (g > 0) toast(`Banked ✦ ${g} essence`);
    }
    clearRun(); setHasSave(false); setRun(null); toTitle();
  }, [toTitle, toast]);

  const saveQuit = useCallback(() => {
    const cur = runRef.current;
    if (cur && cur.over) { setOverlay(null); setScreen(cur.over === "win" ? "victory" : "gameover"); return; }
    if (cur) { saveRun(cur); setHasSave(true); }
    toTitle();
  }, [toTitle]);

  // ---- global keys ----
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" && (e.target as HTMLInputElement).type === "text") return;
      const inRun = screenRef.current === "forge" || screenRef.current === "battle";
      if (e.key === "Escape") {
        const o = overlayRef.current;
        if (o === "pause") setOverlay(null);
        else if (o === "settings" || o === "help") setOverlay(inRun ? "pause" : null);
        else if (inRun) setOverlay("pause");
        else if (screenRef.current === "setup" || screenRef.current === "lab") setScreen("title");
      } else if (e.key === "m" || e.key === "M") {
        const s = metaRef.current.settings;
        updateMeta((m) => { m.settings = { ...s, mute: !s.mute }; });
        toast(s.mute ? "Sound on" : "Muted");
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [toast, updateMeta]);

  const closeSub = () => setOverlay(screen === "forge" || screen === "battle" ? "pause" : null);
  // paused flag freezes the battle simulation while any overlay is open
  const paused = overlay !== null;

  return (
    <div className="relative h-full w-full overflow-hidden select-none">
      {screen === "title" && (
        <Title meta={meta} hasSave={hasSave} onNew={() => setScreen("setup")} onContinue={continueRun}
          onTutorial={() => startRun("apprentice", [], "tutorial", true)} onLab={() => setScreen("lab")}
          onHelp={() => setOverlay("help")} onSettings={() => setOverlay("settings")} />
      )}
      {screen === "setup" && <Setup onBack={() => setScreen("title")} onStart={(d, m, s) => startRun(d, m, s)} />}
      {screen === "lab" && (
        <Lab meta={meta} onBack={() => setScreen("title")}
          onUpgrade={(id) => {
            const u = LAB_UPGRADES.find((x) => x.id === id)!;
            const lv = meta.up[id] ?? 0, cost = u.costs[lv];
            if (cost === undefined || meta.essence < cost) { audio.sfx("error"); return; }
            updateMeta((m) => { m.essence -= cost; m.up[id] = lv + 1; }); audio.sfx("upgrade"); toast(`${u.name} → Lv ${lv + 1}`);
          }}
          onUnlock={(id) => {
            const p = PARTS[id];
            if (meta.essence < p.unlock || meta.unlocked.includes(id)) { audio.sfx("error"); return; }
            updateMeta((m) => { m.essence -= p.unlock; m.unlocked.push(id); }); audio.sfx("merge"); toast(`Unlocked ${p.name}!`);
          }} />
      )}
      {screen === "forge" && run && <Forge run={run} meta={meta} act={act} onFight={onFight} onPause={() => setOverlay("pause")} onTut={onTut} />}
      {screen === "battle" && run && (
        <Battle key={battleKey} run={run} meta={meta} settings={meta.settings} paused={paused} onPause={() => setOverlay("pause")}
          onFinished={onBattleFinished} onContinue={onBattleContinue} />
      )}
      {screen === "gameover" && run && <EndScreen run={run} kind="lose" gained={gained} onRetry={retry} onMenu={toTitle} onLab={() => setScreen("lab")} />}
      {screen === "victory" && run && <EndScreen run={run} kind="win" gained={gained} onRetry={retry} onMenu={toTitle} onLab={() => setScreen("lab")} onEndless={goEndless} />}

      {overlay === "pause" && (
        <Pause inRun={!!run && (screen === "forge" || screen === "battle")} diff={run?.diff ?? "journeyman"}
          onDiff={(id) => { const cur = runRef.current; if (cur) { setRun({ ...cur, diff: id }); toast(`Difficulty set to ${id}`); audio.sfx("click"); } }}
          onResume={() => setOverlay(null)} onSettings={() => setOverlay("settings")} onHelp={() => setOverlay("help")} onQuit={saveQuit} onAbandon={abandon} />
      )}
      {overlay === "settings" && <SettingsPanel s={meta.settings} onChange={updateSettings} onClose={closeSub} />}
      {overlay === "help" && <Help onClose={closeSub} />}

      <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 z-[70] flex flex-col items-center gap-1">
        {toasts.map((t) => (
          <div key={t.id} className={`anim-slide px-3 py-1.5 rounded-lg text-sm font-semibold border shadow-lg ${t.err ? "bg-red-950/90 border-red-500 text-red-100" : "bg-zinc-900/95 border-amber-500/60 text-amber-100"}`}>{t.text}</div>
        ))}
      </div>
    </div>
  );
}
