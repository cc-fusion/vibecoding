import { useCallback, useEffect, useState } from 'react';
import Title from './components/Title';
import { Campaign, Briefing } from './components/Campaign';
import { Barracks, Research } from './components/Barracks';
import Battle from './components/Battle';
import { HelpPanel, SettingsPanel } from './components/Panels';
import { Modal } from './components/ui';
import { LEVELS, LevelDef } from './game/data';
import { Save, Settings, loadSave, resetSave, writeSave } from './game/save';
import { Game, Result } from './game/engine';
import { audio } from './game/audio';

type Screen = 'title' | 'campaign' | 'briefing' | 'battle' | 'barracks' | 'research';

function defaultDeploy(save: Save, lvl: LevelDef): string[] {
  const core = save.roster.find((r) => r.type === 'core');
  const rest = save.roster
    .filter((r) => r.type !== 'core')
    .sort((a, b) => b.promo.length - a.promo.length || b.xp - a.xp)
    .slice(0, Math.max(0, lvl.deploy - 1))
    .map((r) => r.id);
  return core ? [core.id, ...rest] : rest;
}

export default function App() {
  const [save, setSave] = useState<Save>(() => loadSave());
  const [screen, setScreen] = useState<Screen>('title');
  const [lvl, setLvl] = useState<LevelDef>(LEVELS[0]);
  const [deployed, setDeployed] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [modal, setModal] = useState<null | 'help' | 'settings'>(null);

  useEffect(() => {
    writeSave(save);
  }, [save]);

  const s = save.settings;
  useEffect(() => {
    audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, muted: s.muted });
  }, [s.master, s.music, s.sfx, s.muted]);

  useEffect(() => {
    const unlock = () => {
      audio.init();
      audio.startMusic();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    if (screen !== 'battle') audio.setIntensity(0.12);
  }, [screen]);

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  const updateSave = useCallback((fn: (s: Save) => Save) => setSave((p) => fn(p)), []);
  const setSettings = useCallback((ns: Settings) => setSave((p) => ({ ...p, settings: ns })), []);

  const applyResult = useCallback(
    (r: Result, g: Game) => {
      setSave((p) => {
        const iron = p.settings.mods.includes('iron');
        let roster = p.roster.map((u) => {
          const x = r.xp[u.id];
          return x ? { ...u, xp: u.xp + x.xp, kills: u.kills + x.kills } : u;
        });
        if (iron) roster = roster.filter((u) => !r.dead.includes(u.id) || u.type === 'core');
        const id = g.lvl.id;
        return {
          ...p,
          roster,
          stardust: p.stardust + r.stardust,
          cleared: r.win ? Math.max(p.cleared, id) : p.cleared,
          stars: r.win ? { ...p.stars, [id]: Math.max(p.stars[id] || 0, r.stars) } : p.stars,
          bestRounds: r.win && g.lvl.obj !== 'survive' ? { ...p.bestRounds, [id]: Math.min(p.bestRounds[id] || 999, g.round) } : p.bestRounds,
          totals: {
            battles: p.totals.battles + 1,
            wins: p.totals.wins + (r.win ? 1 : 0),
            kills: p.totals.kills + g.stats.kills,
            losses: p.totals.losses + g.stats.losses,
            hazard: p.totals.hazard + g.stats.hazardKills,
            rounds: p.totals.rounds + g.round,
          },
          tutSeen: true,
          campaignDone: p.campaignDone || (r.win && id === LEVELS.length),
        };
      });
    },
    []
  );

  const openBriefing = (l: LevelDef) => {
    setLvl(l);
    setDeployed(defaultDeploy(save, l));
    setScreen('briefing');
  };
  const launch = () => {
    const valid = deployed.filter((id) => save.roster.some((r) => r.id === id));
    setDeployed(valid);
    setAttempt((a) => a + 1);
    setScreen('battle');
  };
  const retry = () => {
    setDeployed((d) => d.filter((id) => save.roster.some((r) => r.id === id)));
    setAttempt((a) => a + 1);
    setModal(null);
  };
  const nextLevel = lvl.id < LEVELS.length ? () => openBriefing(LEVELS[lvl.id]) : null;

  return (
    <div className="h-dvh w-screen overflow-hidden bg-[#05060f] text-slate-100">
      {screen === 'title' && <Title save={save} onPlay={() => setScreen('campaign')} onHelp={() => setModal('help')} onSettings={() => setModal('settings')} />}
      {screen === 'campaign' && (
        <Campaign
          save={save}
          onSelect={openBriefing}
          onNav={(x) => (x === 'help' || x === 'settings' ? setModal(x) : setScreen(x))}
        />
      )}
      {screen === 'briefing' && (
        <Briefing
          save={save}
          lvl={lvl}
          deployed={deployed}
          setDeployed={setDeployed}
          setSettings={setSettings}
          onStart={launch}
          onBack={() => setScreen('campaign')}
          onHelp={() => setModal('help')}
        />
      )}
      {screen === 'barracks' && <Barracks save={save} update={updateSave} onBack={() => setScreen('campaign')} onHelp={() => setModal('help')} />}
      {screen === 'research' && <Research save={save} update={updateSave} onBack={() => setScreen('campaign')} onHelp={() => setModal('help')} />}
      {screen === 'battle' && (
        <Battle
          key={attempt}
          lvl={lvl}
          save={save}
          deployed={deployed}
          modalOpen={modal !== null}
          onResult={applyResult}
          onRetry={retry}
          onNext={nextLevel}
          onMap={() => setScreen('campaign')}
          onBarracks={() => setScreen('barracks')}
          openHelp={() => setModal('help')}
          openSettings={() => setModal('settings')}
          setSettings={setSettings}
        />
      )}
      {modal === 'help' && (
        <Modal onClose={() => setModal(null)} wide>
          <HelpPanel onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal === 'settings' && (
        <Modal onClose={() => setModal(null)}>
          <SettingsPanel
            settings={save.settings}
            onChange={setSettings}
            onClose={() => setModal(null)}
            onReset={() => {
              setSave(resetSave());
              setModal(null);
              setScreen('title');
            }}
          />
        </Modal>
      )}
    </div>
  );
}
