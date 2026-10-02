import { useCallback, useEffect, useRef, useState } from 'react';
import { DiffId, GadgetId, ModId } from './game/data';
import { Contract, EndReason, Meta, Settings, Summary, applyResult, checkEnd, clearSave, cloneMeta, loadMeta, loadSettings, newMeta, saveMeta, saveSettings } from './game/meta';
import { HeistResult } from './game/sim';
import { audio } from './game/audio';
import { HelpModal, Modal, SettingsModal } from './ui/common';
import { GameOver, NewGame, ResultScreen, Title, Victory } from './ui/Screens';
import Hub from './ui/Hub';
import Brief from './ui/Brief';
import HeistScreen from './ui/HeistScreen';

type Screen = 'title' | 'newgame' | 'hub' | 'brief' | 'heist' | 'result' | 'gameover' | 'victory';
interface Job { contract: Contract; crewIds: string[]; loadout: Partial<Record<GadgetId, number>>; tutorial: boolean; meta: Meta; key: number }

const TRAINING: Contract = { id: 'training', tpl: 'training', seed: 4242, client: 'The Old Fixer', fee: 300, mod: 'none', expires: 99, recon: 2 };

export default function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [meta, setMeta] = useState<Meta | null>(null);
  const metaRef = useRef<Meta | null>(null);
  const [settings, setSettingsState] = useState<Settings>(loadSettings);
  const [overlay, setOverlay] = useState<null | 'settings' | 'help' | 'menu' | 'reset'>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [endReason, setEndReason] = useState<Exclude<EndReason, null>>('raid');
  const [saveExists, setSaveExists] = useState<boolean>(() => loadMeta() !== null);
  const keyN = useRef(0);

  // audio bootstrap + tab visibility
  useEffect(() => {
    audio.setSettings(settings);
    const boot = () => { audio.init(); audio.startMusic(); };
    window.addEventListener('pointerdown', boot);
    window.addEventListener('keydown', boot);
    const vis = () => { if (document.hidden) audio.suspend(); else audio.resume(); };
    document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('pointerdown', boot); window.removeEventListener('keydown', boot); document.removeEventListener('visibilitychange', vis); audio.stopMusic(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (screen !== 'heist') { audio.setAlarm(false); audio.setTension(screen === 'gameover' ? 0.75 : screen === 'victory' ? 0.3 : 0.12); }
  }, [screen]);

  const setSettings = (s: Settings) => { setSettingsState(s); saveSettings(s); audio.setSettings(s); };

  const commit = useCallback((m: Meta) => { metaRef.current = m; setMeta(m); saveMeta(m); setSaveExists(true); }, []);
  const endGame = useCallback((reason: Exclude<EndReason, null>) => {
    clearSave(); setSaveExists(false); setEndReason(reason); setScreen('gameover'); audio.sfx('lose');
  }, []);
  const act = useCallback((fn: (m: Meta) => void) => {
    const base = metaRef.current; if (!base) return;
    const m = cloneMeta(base); fn(m); commit(m);
    const end = checkEnd(m); if (end) endGame(end);
  }, [commit, endGame]);

  const startNew = (d: DiffId, mods: Record<ModId, boolean>) => {
    const m = newMeta(d, mods); commit(m); setScreen('hub'); audio.sfx('levelup');
  };
  const doContinue = () => {
    const m = loadMeta(); if (!m) { setSaveExists(false); return; }
    metaRef.current = m; setMeta(m); setScreen('hub');
  };
  const startTutorial = () => {
    const tm = newMeta('rookie', { iron: false, paranoid: false, lean: false });
    tm.gadgets.smoke = 2;
    setJob({ contract: TRAINING, crewIds: tm.crew.map(c => c.id), loadout: { smoke: 1, noise: 1 }, tutorial: true, meta: tm, key: ++keyN.current });
    setScreen('heist');
  };
  const startHeist = (crewIds: string[], loadout: Partial<Record<GadgetId, number>>) => {
    const m = metaRef.current; const c = m?.contracts.find(x => x.id === jobId);
    if (!m || !c) { setScreen('hub'); return; }
    setJob({ contract: c, crewIds, loadout, tutorial: false, meta: m, key: ++keyN.current });
    setScreen('heist');
  };
  const leaveHeist = () => { setJob(null); setScreen(metaRef.current ? 'hub' : 'title'); };

  const onFinish = (r: HeistResult) => {
    if (!job) return;
    const base = metaRef.current;
    let sum: Summary;
    if (job.tutorial) {
      const target = base ? cloneMeta(base) : job.meta;
      sum = applyResult(target, job.contract, r);
      if (base) commit(target);
    } else {
      if (!base) return;
      const m = cloneMeta(base);
      sum = applyResult(m, job.contract, r);
      if (!job.contract.capstone) m.contracts = m.contracts.filter(c => c.id !== job.contract.id);
      commit(m);
    }
    setSummary(sum); setJob(null); setScreen('result');
  };
  const afterResult = () => {
    const m = metaRef.current;
    if (!summary || summary.tutorial) { setScreen(m ? 'hub' : 'title'); return; }
    if (m) { const end = checkEnd(m); if (end) { endGame(end); return; } }
    if (summary.won) { setScreen('victory'); audio.sfx('win'); return; }
    setScreen('hub');
  };

  const quitToTitle = () => { setOverlay(null); setScreen('title'); };

  return (
    <div className={`relative h-full w-full overflow-hidden bg-[#060b14] ${settings.reduceFlash ? 'no-flash' : ''}`}>
      {screen === 'title' && <Title hasSave={saveExists} onContinue={doContinue} onNew={() => setScreen('newgame')} onTutorial={startTutorial} onHelp={() => setOverlay('help')} onSettings={() => setOverlay('settings')} />}
      {screen === 'newgame' && <NewGame onStart={startNew} onBack={() => setScreen('title')} />}
      {screen === 'hub' && meta && <Hub meta={meta} act={act} onBrief={c => { setJobId(c.id); setScreen('brief'); }} onTutorial={startTutorial} onMenu={() => setOverlay('menu')} onSettings={() => setOverlay('settings')} onHelp={() => setOverlay('help')} />}
      {screen === 'brief' && meta && (() => { const c = meta.contracts.find(x => x.id === jobId); return c ? <Brief meta={meta} contract={c} act={act} onStart={startHeist} onBack={() => setScreen('hub')} /> : null; })()}
      {screen === 'heist' && job && (
        <HeistScreen key={job.key} contract={job.contract} meta={job.meta} crewIds={job.crewIds} loadout={job.loadout} tutorial={job.tutorial}
          settings={settings} onSettings={setSettings} onFinish={onFinish} onAbort={leaveHeist} />
      )}
      {screen === 'result' && summary && <ResultScreen s={summary} onContinue={afterResult} />}
      {screen === 'gameover' && meta && <GameOver reason={endReason} meta={meta} onRetry={() => setScreen('newgame')} onTitle={quitToTitle} />}
      {screen === 'victory' && meta && <Victory meta={meta} onContinue={() => setScreen('hub')} onRetry={() => setScreen('newgame')} onTitle={quitToTitle} />}

      {overlay === 'settings' && <SettingsModal settings={settings} onChange={setSettings} onClose={() => setOverlay(null)} />}
      {overlay === 'help' && <HelpModal onClose={() => setOverlay(null)} />}
      {overlay === 'menu' && (
        <Modal title="Menu" onClose={() => setOverlay(null)}>
          <div className="space-y-2">
            <button className="btn btn-gold w-full" onClick={() => setOverlay(null)}>Resume</button>
            <button className="btn w-full" onClick={() => setOverlay('settings')}>Settings</button>
            <button className="btn w-full" onClick={() => setOverlay('help')}>Field Manual / Controls</button>
            <button className="btn w-full" onClick={quitToTitle}>Save &amp; quit to title</button>
            <button className="btn btn-red w-full" onClick={() => setOverlay('reset')}>Abandon campaign…</button>
          </div>
        </Modal>
      )}
      {overlay === 'reset' && (
        <Modal title="Abandon campaign?" onClose={() => setOverlay('menu')}>
          <p className="mb-3 text-sm text-slate-300">This permanently deletes your save and restarts from scratch.</p>
          <div className="flex gap-2"><button className="btn flex-1" onClick={() => setOverlay('menu')}>Cancel</button>
            <button className="btn btn-red flex-1" onClick={() => { clearSave(); setSaveExists(false); metaRef.current = null; setMeta(null); setOverlay(null); setScreen('newgame'); }}>Delete &amp; restart</button></div>
        </Modal>
      )}
    </div>
  );
}
