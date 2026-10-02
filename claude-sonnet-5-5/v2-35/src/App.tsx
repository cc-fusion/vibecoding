import { useEffect, useState } from 'react';
import BattleScreen from './components/BattleScreen';
import Camp from './components/Camp';
import { CollegeScreen, EndScreen, SetupScreen, TitleScreen } from './components/Screens';
import { HelpPanel, SettingsPanel, applyAudio } from './components/Panels';
import { Btn, Modal } from './components/ui';
import { audio } from './game/audio';
import { campaignScore, createCampaign, deployCap, loadCampaign, loadMeta, rewardMult, saveCampaign, saveMeta, type Campaign, type Meta } from './game/campaign';
import type { BattleConfig, BattleResult } from './game/battle';
import { DIFFICULTIES, MAX_TIER, MISSIONS, type MissionDef } from './game/data';

type Screen = 'title' | 'setup' | 'camp' | 'battle' | 'college' | 'end';

export default function App() {
  const [meta, setMetaState] = useState<Meta>(() => loadMeta());
  const [campaign, setCampaignState] = useState<Campaign | null>(() => loadCampaign());
  const [screen, setScreen] = useState<Screen>('title');
  const [cfg, setCfg] = useState<BattleConfig | null>(null);
  const [battleKey, setBattleKey] = useState(0);
  const [overlay, setOverlay] = useState<null | 'help' | 'settings'>(null);
  const [endInfo, setEndInfo] = useState<{ won: boolean; laurels: number; campaign: Campaign } | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const [from, setFrom] = useState<Screen>('title');

  const setMeta = (m: Meta) => {
    setMetaState(m);
    saveMeta(m);
  };

  useEffect(() => {
    applyAudio(meta.settings);
    const first = () => {
      audio.init();
      audio.startMusic();
    };
    window.addEventListener('pointerdown', first);
    window.addEventListener('keydown', first);
    return () => {
      window.removeEventListener('pointerdown', first);
      window.removeEventListener('keydown', first);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (screen !== 'battle') audio.intensity = screen === 'title' || screen === 'setup' ? 0.22 : screen === 'end' ? 0.4 : 0.3;
  }, [screen]);

  const setCampaign = (c: Campaign | null) => {
    setCampaignState(c);
    saveCampaign(c);
  };

  const startCampaign = (diff: string, mods: string[], classes: string[]) => {
    const c = createCampaign(diff, mods, classes, meta);
    setCampaign(c);
    setScreen('camp');
    audio.sfx('victory');
  };

  const deploy = (m: MissionDef) => {
    if (!campaign) return;
    const diff = DIFFICULTIES.find((d) => d.id === campaign.diff) || DIFFICULTIES[1];
    const cap = deployCap(meta);
    const roster = JSON.parse(JSON.stringify(campaign.roster.filter((u) => u.deploy).slice(0, cap)));
    setCfg({
      mission: m,
      diff,
      mods: campaign.mods,
      meta,
      roster,
      seed: campaign.seed + m.id * 7919,
      rewardMult: rewardMult(campaign),
      chestBonus: 0,
    });
    setBattleKey((k) => k + 1);
    setScreen('battle');
  };

  const startTutorial = () => {
    const diff = DIFFICULTIES[1];
    setCfg({
      mission: { ...MISSIONS[0], name: 'Tutorial', w: 8, h: 6, objective: 'rout' },
      diff,
      mods: [],
      meta,
      roster: [],
      seed: 4242,
      tutorial: true,
      rewardMult: 1,
      chestBonus: 0,
    });
    setBattleKey((k) => k + 1);
    setScreen('battle');
  };

  const endCampaign = (c: Campaign, won: boolean, base: Meta = meta) => {
    const bonus = won ? Math.ceil(6 * rewardMult(c)) : Math.max(0, c.stats.missions);
    const score = campaignScore(c);
    const nm: Meta = {
      ...base,
      laurels: base.laurels + bonus,
      best: {
        score: Math.max(base.best.score, score),
        wins: base.best.wins + (won ? 1 : 0),
        campaigns: base.best.campaigns + 1,
        kills: base.best.kills + c.stats.kills,
      },
    };
    setMeta(nm);
    const done: Campaign = { ...c, status: won ? 'won' : 'lost' };
    setCampaign(null);
    setCampaignState(null);
    setEndInfo({ won, laurels: bonus, campaign: done });
    setScreen('end');
  };

  const onFinish = (r: BattleResult) => {
    if (cfg?.tutorial) {
      if (r.won && !meta.tutorialDone) setMeta({ ...meta, tutorialDone: true, laurels: meta.laurels + 1 });
      setScreen('title');
      return;
    }
    if (!campaign || !cfg) {
      setScreen('title');
      return;
    }
    const c: Campaign = JSON.parse(JSON.stringify(campaign));
    c.stats.kills += r.kills;
    c.stats.envKills += r.envKills;
    c.stats.rounds += r.rounds;
    c.stats.damage += r.dealt;
    c.stats.shores += r.shores;
    c.stats.lost += r.lost;
    if (!r.won) {
      c.fallen.push(...r.fallen);
      endCampaign(c, false);
      return;
    }
    const deployedIds = new Set(cfg.roster.map((u) => u.id));
    const updated = new Map(r.units.map((u) => [u.id, u]));
    c.roster = c.roster.flatMap((u) => (deployedIds.has(u.id) ? (updated.has(u.id) ? [updated.get(u.id)!] : []) : [u]));
    c.fallen.push(...r.fallen);
    c.crowns += r.crowns;
    c.done.push(cfg.mission.id);
    c.stats.missions += 1;
    const metaAfter: Meta = { ...meta, laurels: meta.laurels + r.laurels };
    setMeta(metaAfter);
    if (cfg.mission.tier >= MAX_TIER) {
      endCampaign(c, true, metaAfter);
      return;
    }
    if (c.roster.length === 0) {
      endCampaign(c, false, metaAfter);
      return;
    }
    c.tier = cfg.mission.tier + 1;
    // keep squad flags valid
    const cap = deployCap(meta);
    let n = 0;
    c.roster.forEach((u) => {
      if (u.deploy && n < cap) n++;
      else u.deploy = false;
    });
    if (n === 0) c.roster.slice(0, cap).forEach((u) => (u.deploy = true));
    setCampaign(c);
    setScreen('camp');
  };

  const openOverlay = (o: 'help' | 'settings') => {
    setFrom(screen);
    setOverlay(o);
  };

  return (
    <div className="h-full w-full overflow-hidden bg-[#0d0b16] text-[#e9e3f5]">
      {screen === 'title' && (
        <TitleScreen
          meta={meta}
          hasSave={!!campaign}
          onContinue={() => setScreen('camp')}
          onNew={() => (campaign ? setConfirmNew(true) : setScreen('setup'))}
          onTutorial={startTutorial}
          onCollege={() => {
            setFrom('title');
            setScreen('college');
          }}
          onHelp={() => openOverlay('help')}
          onSettings={() => openOverlay('settings')}
        />
      )}
      {screen === 'setup' && <SetupScreen meta={meta} onStart={startCampaign} onBack={() => setScreen('title')} />}
      {screen === 'college' && <CollegeScreen meta={meta} setMeta={setMeta} onBack={() => setScreen(campaign && from === 'camp' ? 'camp' : 'title')} />}
      {screen === 'camp' && campaign && (
        <Camp
          campaign={campaign}
          meta={meta}
          setCampaign={setCampaign}
          onDeploy={deploy}
          onTitle={() => setScreen('title')}
          onHelp={() => openOverlay('help')}
          onSettings={() => openOverlay('settings')}
          onCollege={() => {
            setFrom('camp');
            setScreen('college');
          }}
        />
      )}
      {screen === 'battle' && cfg && (
        <BattleScreen
          key={battleKey}
          cfg={cfg}
          meta={meta}
          setMeta={setMeta}
          onFinish={onFinish}
          onRetry={() => setBattleKey((k) => k + 1)}
          onQuit={() => setScreen(cfg.tutorial || !campaign ? 'title' : 'camp')}
        />
      )}
      {screen === 'end' && endInfo && (
        <EndScreen
          campaign={endInfo.campaign}
          won={endInfo.won}
          laurels={endInfo.laurels}
          onNew={() => setScreen('setup')}
          onTitle={() => setScreen('title')}
        />
      )}

      {overlay && (
        <Modal title={overlay === 'help' ? 'Field Manual' : 'Settings'} wide={overlay === 'help'} onClose={() => setOverlay(null)}>
          {overlay === 'help' ? (
            <HelpPanel />
          ) : (
            <SettingsPanel
              meta={meta}
              setMeta={setMeta}
              onResetAll={
                from === 'title'
                  ? () => {
                      setCampaign(null);
                      setCampaignState(null);
                    }
                  : undefined
              }
            />
          )}
          <Btn className="mt-4" variant="gold" onClick={() => setOverlay(null)}>
            Close
          </Btn>
        </Modal>
      )}

      {confirmNew && (
        <Modal title="Abandon current campaign?" onClose={() => setConfirmNew(false)}>
          <p className="mb-3 text-sm text-[#d9d1ee]">You have a campaign in progress. Starting a new one will erase its saved progress (laurels and War College upgrades are kept).</p>
          <div className="flex gap-2">
            <Btn
              variant="danger"
              onClick={() => {
                setConfirmNew(false);
                setCampaign(null);
                setCampaignState(null);
                setScreen('setup');
              }}
            >
              Start new campaign
            </Btn>
            <Btn onClick={() => setConfirmNew(false)}>Keep playing</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
