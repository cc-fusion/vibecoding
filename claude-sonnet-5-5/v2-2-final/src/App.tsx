import { useEffect, useRef, useState } from 'react';
import { Title } from './components/Title';
import { Hub } from './components/Hub';
import { Briefing } from './components/Briefing';
import { Stage } from './components/Stage';
import { Results } from './components/Results';
import { EndScreen, Help, NewGame, SettingsModal } from './components/Overlays';
import { audio } from './game/audio';
import { GADGET_IDS } from './game/data';
import type { Contract, DiffId, GadgetId, ModId } from './game/data';
import { genLevel } from './game/level';
import type { Level } from './game/level';
import type { Result } from './game/sim';
import {
  applyResult, casingCost, checkEnd, clearCampaign, loadBest, loadCampaign, loadSettings, newCampaign, recordBest, saveCampaign, saveSettings,
} from './game/meta';
import type { Campaign, Res, Settings, Summary } from './game/meta';

type Screen = 'title' | 'hub' | 'briefing' | 'stage' | 'results';
interface EndState { kind: 'victory' | 'loss'; title: string; text: string; camp: Campaign }

export default function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [camp, setCamp] = useState<Campaign | null>(null);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [modal, setModal] = useState<null | 'help' | 'settings' | 'new'>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [job, setJob] = useState<{ crewIds: string[]; recon: number; level: Level; key: number } | null>(null);
  const [outcome, setOutcome] = useState<{ result: Result; summary: Summary; contract: Contract } | null>(null);
  const [end, setEnd] = useState<EndState | null>(null);
  const [toast, setToast] = useState<{ msg: string; bad: boolean } | null>(null);
  const [hasSave, setHasSave] = useState(() => loadCampaign() !== null);
  const [best, setBest] = useState(loadBest);
  const toastT = useRef<number | null>(null);

  // settings -> audio + storage
  useEffect(() => { audio.set(settings); saveSettings(settings); }, [settings]);
  // unlock audio on first gesture
  useEffect(() => {
    const h = () => audio.init();
    window.addEventListener('pointerdown', h); window.addEventListener('keydown', h);
    return () => { window.removeEventListener('pointerdown', h); window.removeEventListener('keydown', h); };
  }, []);
  useEffect(() => { if (screen !== 'stage') audio.startMusic('menu'); }, [screen]);

  const showToast = (msg: string, bad = false) => {
    setToast({ msg, bad }); if (toastT.current) window.clearTimeout(toastT.current); toastT.current = window.setTimeout(() => setToast(null), 2800);
  };

  const finishRun = (c: Campaign, e: { title: string; text: string }) => {
    clearCampaign(); setHasSave(false); recordBest(c, false); setBest(loadBest()); audio.sfx('fail'); audio.setSiren(0);
    setEnd({ kind: 'loss', title: e.title, text: e.text, camp: c });
  };
  const commit = (c: Campaign) => {
    saveCampaign(c); setCamp(c); const e = checkEnd(c); if (e) finishRun(c, e);
  };
  const act = (fn: (c: Campaign) => Res | void, sfx?: string) => {
    if (!camp) return;
    const c = structuredClone(camp); const r = fn(c);
    if (r && !r.ok) { showToast(r.msg, true); audio.sfx('error'); return; }
    if (r) showToast(r.msg);
    audio.sfx(sfx ?? (r ? 'buy' : 'click')); commit(c);
  };

  const startNew = (d: DiffId, m: ModId[]) => {
    clearCampaign(); const c = newCampaign(d, m); saveCampaign(c); setCamp(c); setHasSave(true); setEnd(null); setModal(null); setOutcome(null); setScreen('hub');
    audio.sfx('start'); showToast('Welcome, boss. Start with the Training Run contract.');
  };
  const doContinue = () => {
    const c = loadCampaign(); if (!c) { setHasSave(false); showToast('No saved campaign found.', true); return; }
    setCamp(c); const e = checkEnd(c); setScreen('hub'); audio.sfx('start'); if (e) finishRun(c, e);
  };

  const beginJob = (crewIds: string[], recon: number) => {
    if (!camp || !contract) return;
    const cost = casingCost(camp, contract, recon);
    const c = structuredClone(camp); c.cash -= cost; c.stats.spent += cost; saveCampaign(c); setCamp(c);
    setJob({ crewIds, recon, level: genLevel(contract, camp.heat), key: Date.now() }); setScreen('stage'); audio.sfx('start');
  };
  const charge = (n: number) => {
    if (!camp || camp.cash < n) return false;
    const c = structuredClone(camp); c.cash -= n; c.stats.spent += n; saveCampaign(c); setCamp(c); return true;
  };
  const finishJob = (result: Result, used: Record<GadgetId, number>) => {
    if (!camp || !contract || !job) return;
    const c = structuredClone(camp);
    for (const g of GADGET_IDS) c.gadgets[g] = Math.max(0, c.gadgets[g] - (used[g] ?? 0));
    const summary = applyResult(c, contract, result, job.crewIds);
    saveCampaign(c); setCamp(c); setOutcome({ result, summary, contract }); setJob(null); setScreen('results');
  };
  const afterResults = () => {
    if (!camp) { setScreen('title'); return; }
    const e = checkEnd(camp); setScreen('hub');
    if (e) { finishRun(camp, e); return; }
    if (camp.won && !camp.freePlay) {
      recordBest(camp, true); setBest(loadBest()); audio.sfx('success');
      setEnd({ kind: 'victory', title: 'LEGEND OF THE SYNDICATE', text: '', camp });
    }
  };
  const keepPlaying = () => { if (!camp) return; const c = structuredClone(camp); c.freePlay = true; saveCampaign(c); setCamp(c); setEnd(null); };
  const toTitle = () => { setEnd(null); setScreen('title'); setHasSave(loadCampaign() !== null); };

  return (
    <div className="h-full w-full relative overflow-hidden">
      {screen === 'title' && <Title hasSave={hasSave} best={best} onNew={() => setModal('new')} onContinue={doContinue} onHelp={() => setModal('help')} onSettings={() => setModal('settings')} />}
      {screen === 'hub' && camp && <Hub camp={camp} act={act} onPlan={(ct) => { setContract(ct); setScreen('briefing'); }} onHelp={() => setModal('help')} onSettings={() => setModal('settings')} onTitle={toTitle} />}
      {screen === 'briefing' && camp && contract && <Briefing camp={camp} ct={contract} onBegin={beginJob} onBack={() => setScreen('hub')} />}
      {screen === 'stage' && camp && contract && job && (
        <Stage key={job.key} camp={camp} ct={contract} crewIds={job.crewIds} recon={job.recon} level={job.level} settings={settings}
          onExit={() => { setJob(null); setScreen('hub'); }} onFinish={finishJob} onCharge={charge} onHelp={() => setModal('help')} onSettings={() => setModal('settings')} />
      )}
      {screen === 'results' && outcome && <Results result={outcome.result} summary={outcome.summary} ct={outcome.contract} onContinue={afterResults} />}

      {end && (
        <EndScreen kind={end.kind} title={end.title} text={end.text} camp={end.camp} onRestart={() => setModal('new')} onTitle={toTitle} onContinue={end.kind === 'victory' ? keepPlaying : undefined} />
      )}
      {modal === 'help' && <Help onClose={() => setModal(null)} />}
      {modal === 'settings' && <SettingsModal s={settings} onChange={setSettings} onClose={() => setModal(null)} />}
      {modal === 'new' && <NewGame onStart={startNew} onClose={() => setModal(null)} />}
      {toast && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] panel px-4 py-2 text-sm rise pointer-events-none" style={{ borderColor: toast.bad ? '#ff4d5e' : '#5cf0a8', color: toast.bad ? '#ffb3bb' : '#c8ffe2' }}>{toast.msg}</div>
      )}
    </div>
  );
}
