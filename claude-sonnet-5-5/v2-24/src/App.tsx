import { useEffect, useMemo, useState } from 'react';
import { AudioEngine } from './game/audio';
import { loadSave, writeSave, resetSave } from './game/storage';
import type { SaveData, Settings } from './game/storage';
import { LEGACY, SCENARIOS } from './game/data';
import type { GameConfig, Result } from './game/engine';
import { Title } from './components/Title';
import { Setup } from './components/Setup';
import { LegacyHall } from './components/Legacy';
import { Help } from './components/Help';
import { Screen, SettingsPanel } from './components/ui';
import { GameView } from './components/GameView';

type ScreenId = 'title' | 'setup' | 'legacy' | 'help' | 'settings' | 'play';

export default function App() {
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const audio = useMemo(() => new AudioEngine(), []);
  const [screen, setScreen] = useState<ScreenId>('title');
  const [cfg, setCfg] = useState<GameConfig | null>(null);
  const [runKey, setRunKey] = useState(0);

  const update = (fn: (s: SaveData) => SaveData) => {
    const next = fn(loadSave());
    writeSave(next);
    setSave(next);
    return next;
  };

  // audio settings + first-gesture unlock
  useEffect(() => { audio.setVolumes(save.settings.master, save.settings.music, save.settings.sfx, save.settings.muted); }, [audio, save.settings]);
  useEffect(() => {
    const unlock = () => { audio.init(); audio.startMusic(); audio.setVolumes(save.settings.master, save.settings.music, save.settings.sfx, save.settings.muted); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio]);
  useEffect(() => { if (screen !== 'title' || audio.ctx) { audio.init(); audio.startMusic(); } }, [screen, audio]);

  const setSettings = (s: Settings) => update(d => ({ ...d, settings: s }));
  const go = (s: ScreenId) => { audio.sfx('click'); setScreen(s); };
  const start = (c: GameConfig) => { audio.sfx('upgrade'); setCfg({ ...c, legacy: loadSave().legacy }); setRunKey(k => k + 1); setScreen('play'); };

  const onFinish = (r: Result): number => {
    update(d => {
      const sc = SCENARIOS[r.scenario];
      const best = { ...d.best };
      const prev = best[sc.id];
      if (r.win) best[sc.id] = { stars: Math.max(prev?.stars || 0, r.stars), score: Math.max(prev?.score || 0, r.score) };
      return {
        ...d,
        legacyPoints: d.legacyPoints + r.legacy,
        unlocked: r.win ? Math.min(SCENARIOS.length, Math.max(d.unlocked, r.scenario + 2)) : d.unlocked,
        best,
        totals: { wins: d.totals.wins + (r.win ? 1 : 0), losses: d.totals.losses + (r.win ? 0 : 1), popRaised: d.totals.popRaised + Math.round(r.stats.peakPop) },
      };
    });
    return r.legacy;
  };

  const buy = (id: string) => update(d => {
    const u = LEGACY.find(x => x.id === id);
    if (!u) return d;
    const rank = d.legacy[id] || 0;
    const cost = u.cost * (rank + 1);
    if (rank >= u.max || d.legacyPoints < cost) return d;
    return { ...d, legacyPoints: d.legacyPoints - cost, legacy: { ...d.legacy, [id]: rank + 1 } };
  });

  return (
    <div className="absolute inset-0 overflow-hidden">
      {screen === 'title' && <Title save={save} onPlay={() => go('setup')} onLegacy={() => go('legacy')} onHelp={() => go('help')} onSettings={() => go('settings')} />}
      {screen === 'setup' && <Setup save={save} onBack={() => go('title')} onStart={start} />}
      {screen === 'legacy' && <LegacyHall save={save} onBack={() => go('title')} onBuy={buy} onReset={() => setSave(resetSave())} sfx={n => audio.sfx(n)} />}
      {screen === 'help' && <Help onBack={() => go('title')} />}
      {screen === 'settings' && (
        <Screen title="Settings" subtitle="Audio, comfort and onboarding" onBack={() => go('title')}>
          <div className="panel p-4"><SettingsPanel settings={save.settings} onChange={setSettings} /></div>
        </Screen>
      )}
      {screen === 'play' && cfg && (
        <GameView key={runKey} cfg={cfg} audio={audio} settings={save.settings} onSettings={setSettings}
          onFinish={onFinish}
          onRestart={() => { audio.sfx('click'); setCfg({ ...cfg, legacy: loadSave().legacy, tutorial: false }); setRunKey(k => k + 1); }}
          onNext={cfg.scenario + 1 < SCENARIOS.length ? () => { setCfg({ ...cfg, scenario: cfg.scenario + 1, legacy: loadSave().legacy, tutorial: false }); setRunKey(k => k + 1); } : undefined}
          onQuit={() => go('title')} onLegacy={() => go('legacy')} />
      )}
    </div>
  );
}
