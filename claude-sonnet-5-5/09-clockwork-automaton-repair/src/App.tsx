import { useCallback, useRef, useState } from 'react';
import Game, { Award, FinishInfo } from './components/Game';
import { Ending, LevelSelect, Manual, Title, Workshop } from './components/Screens';
import { LEVELS, LevelDef, generateShift } from './game/levels';
import { Save, UPGRADES, loadSave, persist, statsOf, upgradeCost } from './game/save';
import { sfx } from './game/audio';

type Screen = 'title' | 'levels' | 'workshop' | 'manual' | 'play' | 'ending';

interface PlayCtx {
  mode: 'campaign' | 'overtime';
  index: number; // campaign level index, or overtime shift number (1-based)
  level: LevelDef;
  key: number;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [save, setSave] = useState<Save>(loadSave);
  const saveRef = useRef<Save>(save);
  const [play, setPlay] = useState<PlayCtx | null>(null);
  const [muted, setMuted] = useState(sfx.isMuted());
  const keyCounter = useRef(1);
  const lastWon = useRef(true);

  const updateSave = useCallback((fn: (s: Save) => Save) => {
    const next = fn(saveRef.current);
    saveRef.current = next;
    setSave(next);
    persist(next);
  }, []);

  const startCampaign = (idx: number) => {
    lastWon.current = true;
    setPlay({ mode: 'campaign', index: idx, level: LEVELS[idx], key: keyCounter.current++ });
    setScreen('play');
  };

  const startOvertime = (shift: number) => {
    lastWon.current = true;
    setPlay({ mode: 'overtime', index: shift, level: generateShift(shift), key: keyCounter.current++ });
    setScreen('play');
  };

  const handleFinish = (f: FinishInfo): Award => {
    if (!play) return { cogs: 0, newBest: false };
    const s = saveRef.current;
    if (play.mode === 'campaign') {
      if (!f.won) return { cogs: 0, newBest: false };
      const id = play.level.id;
      const first = !(s.stars[id] > 0);
      const base = 20 + f.stars * 15 + Math.floor((100 - f.pressure) / 4);
      const cogs = first ? base : Math.max(5, Math.round(base * 0.3));
      const newBest = f.score > (s.score[id] || 0);
      updateSave((cur) => ({
        ...cur,
        cogs: cur.cogs + cogs,
        stars: { ...cur.stars, [id]: Math.max(cur.stars[id] || 0, f.stars) },
        score: { ...cur.score, [id]: Math.max(cur.score[id] || 0, f.score) },
      }));
      return { cogs, newBest, note: first ? 'First clear bonus!' : 'Replay payout: 30% cogs.' };
    }
    // overtime
    if (!f.won) {
      lastWon.current = false;
      return { cogs: 0, newBest: false, note: `You cleared ${play.index - 1} shift${play.index - 1 === 1 ? '' : 's'} this run.` };
    }
    const cogs = 10 + play.index * 4 + f.stars * 4;
    const newBest = play.index > s.otBest;
    updateSave((cur) => ({ ...cur, cogs: cur.cogs + cogs, otBest: Math.max(cur.otBest, play.index) }));
    return { cogs, newBest, note: newBest ? 'New Overtime record!' : undefined };
  };

  const buy = (id: string) => {
    const u = UPGRADES.find((x) => x.id === id);
    if (!u) return;
    const s = saveRef.current;
    const lvl = s.upgrades[id] || 0;
    const cost = upgradeCost(u, lvl);
    if (lvl >= u.max || s.cogs < cost) return;
    sfx.buy();
    updateSave((cur) => ({ ...cur, cogs: cur.cogs - cost, upgrades: { ...cur.upgrades, [id]: lvl + 1 } }));
  };

  const toggleMute = () => {
    sfx.setMuted(!muted);
    setMuted(!muted);
  };

  if (screen === 'play' && play) {
    return (
      <Game
        key={play.key}
        level={play.level}
        seed={play.index + 1}
        stats={statsOf(save)}
        mode={play.mode}
        index={play.index}
        overtimeBest={save.otBest}
        isLast={play.mode === 'campaign' && play.index === LEVELS.length - 1}
        onFinish={handleFinish}
        onExit={() => setScreen(play.mode === 'campaign' ? 'levels' : 'title')}
        onRetry={() => {
          if (play.mode === 'overtime' && !lastWon.current) startOvertime(1);
          else {
            lastWon.current = true;
            setPlay({ ...play, key: keyCounter.current++ });
          }
        }}
        onNext={() => {
          if (play.mode === 'overtime') startOvertime(play.index + 1);
          else if (play.index + 1 < LEVELS.length) startCampaign(play.index + 1);
          else setScreen('ending');
        }}
      />
    );
  }

  if (screen === 'levels') return <LevelSelect save={save} onPlay={startCampaign} onBack={() => setScreen('title')} />;
  if (screen === 'workshop') return <Workshop save={save} onBuy={buy} onBack={() => setScreen('title')} />;
  if (screen === 'manual') return <Manual onBack={() => setScreen('title')} />;
  if (screen === 'ending')
    return <Ending save={save} onLevels={() => setScreen('levels')} onTitle={() => setScreen('title')} onWorkshop={() => setScreen('workshop')} />;

  return (
    <Title
      save={save}
      muted={muted}
      onMute={toggleMute}
      onCampaign={() => setScreen('levels')}
      onOvertime={() => startOvertime(1)}
      onWorkshop={() => setScreen('workshop')}
      onManual={() => setScreen('manual')}
    />
  );
}
