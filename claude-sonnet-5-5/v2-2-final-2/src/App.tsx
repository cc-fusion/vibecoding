import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Campaign, GadgetId, HeistDef, HeistResult, Mods, Plan, Settings } from './game/types';
import { HEISTS } from './game/data';
import { genWorld } from './game/mapgen';
import { extraGuards, makeCfg } from './game/sim';
import { applyResult, checkOver, clearSave, loadCampaign, loadSettings, newCampaign, saveCampaign, saveSettings } from './game/store';
import type { ResultNotes } from './game/store';
import { audio } from './game/audio';
import { HelpModal, NewGame, SettingsModal, Title } from './components/Menus';
import { Hub } from './components/Hub';
import { Planner } from './components/Planner';
import { Exec } from './components/Exec';
import { GameOver, Results, Victory } from './components/Results';
import { Toasts } from './components/ui';

type Screen = 'title' | 'new' | 'hub' | 'plan' | 'exec' | 'result' | 'over' | 'victory';
interface RunData { ids: string[]; plan: Plan; loadout: Record<GadgetId, number>; key: number }
interface ResData { r: HeistResult; notes: ResultNotes; def: HeistDef; names: Record<string, string> }

function ExecHost({ camp, job, run, settings, modalOpen, onFinish, onReplan, onQuit, onHelp, onSettings, toast }: {
  camp: Campaign; job: HeistDef; run: RunData; settings: Settings; modalOpen: boolean; onFinish: (r: HeistResult) => void; onReplan: () => void; onQuit: () => void; onHelp: () => void; onSettings: () => void; toast: (m: string, k?: string) => void;
}) {
  const world = useMemo(() => genWorld(job, extraGuards(camp)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const cfg = useMemo(() => makeCfg(camp, job), []); // eslint-disable-line react-hooks/exhaustive-deps
  const crew = useMemo(() => run.ids.map(id => camp.crew.find(c => c.id === id)!).filter(Boolean), []); // eslint-disable-line react-hooks/exhaustive-deps
  return <Exec world={world} crew={crew} plan={run.plan} loadout={run.loadout} cfg={cfg} camp={camp} settings={settings} modalOpen={modalOpen} onFinish={onFinish} onReplan={onReplan} onQuit={onQuit} onHelp={onHelp} onSettings={onSettings} toast={toast} />;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [camp, setCamp] = useState<Campaign | null>(null);
  const campRef = useRef<Campaign | null>(null);
  const [save, setSave] = useState<Campaign | null>(() => loadCampaign());
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [job, setJob] = useState<HeistDef | null>(null);
  const [run, setRun] = useState<RunData | null>(null);
  const [res, setRes] = useState<ResData | null>(null);
  const [help, setHelp] = useState(false);
  const [showSet, setShowSet] = useState(false);
  const [wonShown, setWonShown] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: string }[]>([]);
  const toastId = useRef(0);
  const screenRef = useRef<Screen>('title');
  screenRef.current = screen;

  const toast = useCallback((msg: string, kind = 'info') => {
    const id = ++toastId.current;
    setToasts(t => [...t.slice(-3), { id, msg, kind }]);
    window.setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2800);
  }, []);

  const act = useCallback((fn: (c: Campaign) => string | null | void, ok?: string): boolean => {
    const cur = campRef.current;
    if (!cur) return false;
    const n = structuredClone(cur);
    const err = fn(n);
    if (typeof err === 'string' && err) { toast(err, 'bad'); audio.play('error'); return false; }
    checkOver(n);
    campRef.current = n; setCamp(n); saveCampaign(n);
    if (ok) toast(ok, 'good');
    if (n.over && screenRef.current === 'hub') { clearSave(); setSave(null); setScreen('over'); }
    return true;
  }, [toast]);

  // audio setup
  useEffect(() => { audio.set(settings); saveSettings(settings); }, [settings]);
  useEffect(() => {
    const init = () => audio.init();
    window.addEventListener('pointerdown', init);
    window.addEventListener('keydown', init);
    const key = (e: KeyboardEvent) => { if ((e.key === 'm' || e.key === 'M') && !(e.target instanceof HTMLInputElement)) setSettings(s => ({ ...s, muted: !s.muted })); };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('pointerdown', init); window.removeEventListener('keydown', init); window.removeEventListener('keydown', key); };
  }, []);
  useEffect(() => { audio.setScene(screen === 'exec' ? 'run' : screen === 'plan' ? 'plan' : screen === 'over' ? 'off' : 'menu'); }, [screen]);

  const startNew = (d: 0 | 1 | 2, m: Mods) => {
    const c = newCampaign(d, m);
    campRef.current = c; setCamp(c); saveCampaign(c); setSave(c); setWonShown(false); setScreen('hub');
    audio.play('go');
  };
  const toTitle = () => { setSave(loadCampaign()); setShowSet(false); setHelp(false); setScreen('title'); };

  const onFinish = (r: HeistResult) => {
    const def = HEISTS.find(h => h.id === r.heistId) || job!;
    let notes: ResultNotes = { lines: [], levelUps: [], raid: false, payout: 0 };
    const names: Record<string, string> = {};
    (campRef.current?.crew || []).forEach(c => { names[c.id] = c.name; });
    act(c => { notes = applyResult(c, r, def); });
    audio.play(r.success ? 'win' : 'lose');
    setRes({ r, notes, def, names });
    setScreen('result');
  };
  const afterResult = () => {
    const c = campRef.current;
    if (!c) { toTitle(); return; }
    if (c.over) { clearSave(); setSave(null); audio.play('lose'); setScreen('over'); }
    else if (c.won && !wonShown) { setWonShown(true); audio.play('win'); setScreen('victory'); }
    else setScreen('hub');
  };

  const modalOpen = showSet || help;
  return (
    <div className="font-sans text-slate-100 bg-[#050d1c] min-h-screen">
      {screen === 'title' && <Title save={save} onNew={() => setScreen('new')} onContinue={() => { if (save) { campRef.current = save; setCamp(save); setWonShown(save.won); setScreen('hub'); } }} onHelp={() => setHelp(true)} onSettings={() => setShowSet(true)} />}
      {screen === 'new' && <NewGame onStart={startNew} onBack={() => setScreen('title')} />}
      {screen === 'hub' && camp && <Hub camp={camp} act={act} toast={toast} onPlan={d => { setJob(d); setScreen('plan'); }} onSettings={() => setShowSet(true)} onHelp={() => setHelp(true)} onTitle={toTitle} />}
      {screen === 'plan' && camp && job && <Planner key={job.id} camp={camp} def={job} act={act} toast={toast} onBack={() => setScreen('hub')} onHelp={() => setHelp(true)} onSettings={() => setShowSet(true)} onExecute={(ids, plan, loadout) => { setRun({ ids, plan, loadout, key: Date.now() }); setScreen('exec'); }} />}
      {screen === 'exec' && camp && job && run && <ExecHost key={run.key} camp={camp} job={job} run={run} settings={settings} modalOpen={modalOpen} onFinish={onFinish} onReplan={() => setScreen('plan')} onQuit={toTitle} onHelp={() => setHelp(true)} onSettings={() => setShowSet(true)} toast={toast} />}
      {screen === 'result' && res && <Results r={res.r} notes={res.notes} def={res.def} names={res.names} onContinue={afterResult} />}
      {screen === 'over' && camp && <GameOver camp={camp} onRetry={() => setScreen('new')} onTitle={toTitle} />}
      {screen === 'victory' && camp && <Victory camp={camp} onContinue={() => setScreen('hub')} onRetry={() => setScreen('new')} />}
      {help && <HelpModal onClose={() => setHelp(false)} />}
      {showSet && <SettingsModal settings={settings} onChange={setSettings} camp={camp && screen !== 'title' && screen !== 'new' ? camp : null} onDiff={d => act(c => { c.diff = d; }, 'Difficulty changed')} onClose={() => setShowSet(false)}
        onReset={camp && screen !== 'title' && screen !== 'new' ? () => { clearSave(); setSave(null); campRef.current = null; setCamp(null); setShowSet(false); setScreen('title'); } : undefined} />}
      <Toasts items={toasts} />
    </div>
  );
}
