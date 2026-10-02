import { useEffect, useState } from 'react';
import { getSave, persist, levelUnlocked } from './game/data';
import type { GameResult } from './game/engine';
import { audio } from './game/audio';
import GameView from './ui/GameView';
import type { RunConfig } from './ui/GameView';
import { TitleScreen, CampaignScreen, TechScreen, SettingsScreen, HelpScreen, ResultOverlay } from './ui/screens';

type Screen = 'title' | 'campaign' | 'tech' | 'settings' | 'help' | 'game';

export default function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [run, setRun] = useState<RunConfig | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);

  // audio bootstrap: apply saved volumes, unlock on first gesture
  useEffect(() => {
    const s = getSave().settings;
    audio.setVolumes(s.master, s.music, s.sfx, s.muted);
    const unlock = () => audio.ensure();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // ambient menu music whenever we're outside a run
  useEffect(() => {
    if (screen !== 'game') audio.startMusic('menu');
  }, [screen]);

  const startRun = (levelId: number, diffId: string, mods: string[], tutorial: boolean) => {
    setResult(null);
    setRun({ levelId, diffId, mods, tutorial, key: Date.now() });
    setScreen('game');
  };

  const commit = (r: GameResult) => {
    const sv = getSave();
    sv.jelly += r.jelly;
    sv.lifetime.games += 1;
    if (r.won) sv.lifetime.wins += 1;
    sv.lifetime.kills += r.stats.kills;
    sv.lifetime.food += Math.round(r.stats.gathered);
    sv.lifetime.ants += r.stats.born;
    if (r.won) {
      const old = sv.levels[r.levelId];
      sv.levels[r.levelId] = { stars: Math.max(old ? old.stars : 0, r.stars), best: old ? Math.min(old.best, r.time) : r.time };
    }
    if (r.endless) sv.endlessBest = Math.max(sv.endlessBest, r.time);
    persist();
    setResult(r);
  };

  const leave = (to: Screen) => {
    persist();
    setResult(null);
    setRun(null);
    setScreen(to);
  };

  if (screen === 'game' && run) {
    const nextId = result && result.won && result.levelId < 7 && levelUnlocked(result.levelId + 1) ? result.levelId + 1 : null;
    return (
      <div>
        <GameView
          key={run.key}
          run={run}
          onResult={commit}
          onExit={leave}
          onRestart={() => startRun(run.levelId, run.diffId, run.mods, false)}
        />
        {result && (
          <ResultOverlay
            r={result}
            nextId={nextId}
            newJelly={result.jelly}
            onRetry={() => startRun(run.levelId, run.diffId, run.mods, false)}
            onNext={() => nextId && startRun(nextId, run.diffId, run.mods, false)}
            onTech={() => leave('tech')}
            onCampaign={() => leave('campaign')}
            onTitle={() => leave('title')}
          />
        )}
      </div>
    );
  }

  switch (screen) {
    case 'campaign': return <CampaignScreen onBack={() => setScreen('title')} onStart={startRun} />;
    case 'tech': return <TechScreen onBack={() => setScreen('title')} />;
    case 'settings': return <SettingsScreen onBack={() => setScreen('title')} />;
    case 'help': return <HelpScreen onBack={() => setScreen('title')} />;
    default: return <TitleScreen onNav={(s) => setScreen(s)} />;
  }
}
