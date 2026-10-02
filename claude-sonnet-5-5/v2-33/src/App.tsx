import { useCallback, useEffect, useState } from 'react';
import { loadSave, writeSave, resetSave } from './game/save';
import type { SaveData, Settings } from './game/save';
import { audio } from './game/audio';
import { META, metaCost } from './game/data';
import type { RunResult } from './game/data';
import type { Game, GameCfg } from './game/engine';
import GameScreen from './ui/GameScreen';
import { TitleScreen, SetupScreen, ArchivesScreen, Page } from './ui/screens';
import { SettingsPanel, HelpContent } from './ui/common';

type Screen = 'title' | 'setup' | 'archives' | 'help' | 'settings' | 'game';

export default function App() {
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [screen, setScreen] = useState<Screen>('title');
  const [run, setRun] = useState<{ key: number; cfg: GameCfg } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    audio.setVolumes(save.settings);
  }, [save.settings]);

  const updateSettings = useCallback((s: Settings) => {
    const d = loadSave();
    d.settings = s;
    writeSave(d);
    setSave({ ...d });
  }, []);

  const startRun = (diff: string, mods: string[], sector: number) => {
    audio.init();
    const d = loadSave();
    d.lastDiff = diff;
    d.lastMods = mods;
    writeSave(d);
    setSave({ ...d });
    setRun({ key: Date.now(), cfg: { diff, mods, meta: { ...d.meta }, sector, settings: d.settings } });
    setScreen('game');
  };

  const bank = useCallback((g: Game, kind: RunResult['kind']) => {
    const d = loadSave();
    const delta = g.renownEarned - g.renownBanked;
    g.renownBanked = g.renownEarned;
    d.renown += Math.max(0, delta);
    d.totalDelivered += g.delivered;
    if ((kind === 'lost' || kind === 'won') && g.sector > 0) d.runs += 1;
    if (kind === 'won') d.wins += 1;
    if (kind === 'trained') d.tutorialDone = true;
    if (g.sector > 0) {
      d.bestSector = Math.max(d.bestSector, kind === 'sector' || kind === 'won' ? g.sector : g.sector);
      d.bestScore = Math.max(d.bestScore, g.calcScore());
    }
    writeSave(d);
    setSave({ ...d });
  }, []);

  const buyMeta = (id: string) => {
    const def = META.find((m) => m.id === id);
    if (!def) return;
    const d = loadSave();
    const lvl = d.meta[id] || 0;
    const cost = metaCost(def, lvl);
    if (lvl >= def.max || d.renown < cost) { audio.play('error'); return; }
    d.renown -= cost;
    d.meta = { ...d.meta, [id]: lvl + 1 };
    writeSave(d);
    setSave({ ...d });
    audio.play('level');
  };

  const restart = () => {
    if (!run) return;
    const d = loadSave();
    audio.init();
    setRun({ key: Date.now(), cfg: { ...run.cfg, meta: { ...d.meta }, settings: d.settings } });
  };

  return (
    <div className="h-full w-full bg-[#03060d] text-slate-100">
      {screen === 'title' && (
        <TitleScreen
          save={save}
          onCampaign={() => { audio.init(); audio.play('click'); setScreen('setup'); }}
          onTraining={() => { audio.init(); startRun(save.lastDiff, [], 0); }}
          onArchives={() => { audio.init(); audio.play('click'); setScreen('archives'); }}
          onHelp={() => { audio.init(); audio.play('click'); setScreen('help'); }}
          onSettings={() => { audio.init(); audio.play('click'); setScreen('settings'); }}
        />
      )}
      {screen === 'setup' && <SetupScreen save={save} onBack={() => setScreen('title')} onLaunch={(d, m) => startRun(d, m, 1)} />}
      {screen === 'archives' && <ArchivesScreen save={save} onBack={() => setScreen('title')} onBuy={buyMeta} />}
      {screen === 'help' && (
        <Page title="Field manual" wide onBack={() => setScreen('title')}>
          <HelpContent />
        </Page>
      )}
      {screen === 'settings' && (
        <Page title="Settings" onBack={() => setScreen('title')}>
          <SettingsPanel s={save.settings} onChange={updateSettings} />
          <div className="mt-4 border-t border-cyan-400/20 pt-3">
            {!confirmReset ? (
              <button className="btn btn-red" onClick={() => setConfirmReset(true)}>Reset all saved progress</button>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <span>Erase renown, upgrades and records?</span>
                <button className="btn btn-red" onClick={() => { setSave(resetSave()); setConfirmReset(false); }}>Yes, erase</button>
                <button className="btn" onClick={() => setConfirmReset(false)}>Cancel</button>
              </div>
            )}
          </div>
        </Page>
      )}
      {screen === 'game' && run && (
        <GameScreen
          key={run.key}
          cfg={run.cfg}
          settings={save.settings}
          onSettings={updateSettings}
          onBank={bank}
          onRestart={restart}
          onExit={() => setScreen('title')}
          onCampaign={() => startRun(save.lastDiff, save.lastMods, 1)}
        />
      )}
    </div>
  );
}
