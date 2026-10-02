import { useCallback, useEffect, useRef, useState } from 'react';
import { Game } from './engine';
import type { Snapshot, WaveSummary, GameConfig, Tool } from './engine';
import { ADVS, EDICTS, STRUCTS, STRUCT_ORDER, SPELLS, MAX_WAVES } from './data';
import type { Cat } from './data';
import { sound } from './audio';
import type { Save } from './storage';
import { HelpPanel, Modal, SettingsPanel } from './ui';
import type { SaveUpdater } from './ui';

interface Props {
  save: Save;
  updateSave: SaveUpdater;
  cfg: GameConfig;
  onQuit: (to: 'title' | 'ledger') => void;
  onRestart: () => void;
}

const TUT: { text: string; done: (s: Snapshot) => boolean }[] = [
  { text: 'Welcome, Dungeon Lord! Heroes enter on the LEFT and march to your glowing Heart on the RIGHT. Open the Traps tab, pick 📌 Spike Pit (hotkey Q) and click the grey corridor to place it.', done: (s) => s.counts.trap >= 1 },
  { text: 'Lairs hatch monsters that guard nearby tiles. Open the Lairs tab, choose 👺 Goblin Den (A) and place it right next to your trap. Hatching costs mana (blue bar).', done: (s) => s.counts.lair >= 1 },
  { text: 'Greed is a weapon. In the Economy tab place a 💰 Treasure Cache (C) on the route. Greedy heroes will detour to steal it — kill the thief to keep the gold.', done: (s) => s.counts.cache >= 1 },
  { text: 'Longer routes mean more time under fire. Press D (Dig) and drag across rock tiles beside the corridor to carve a detour (dig 2 tiles). The dashed gold line shows the heroes\' path.', done: (s) => s.stats.digs >= 2 },
  { text: 'Pick the Inspect tool (V), click one of your structures, then press Upgrade (U) to raise it to level 2. Stronger structures win waves.', done: (s) => s.stats.upgrades >= 1 },
  { text: 'Ready? Press ▶ Start Raid (Space). Heroes arrive over several seconds. Use 2× / 3× (X) to speed up once you are comfortable.', done: (s) => s.phase === 'raid' || s.wave > 1 },
  { text: 'Cast ⚡ Smite: press 1, then click on a hero. Spells, trap rearms and monster respawns all drain mana — Mana Wells (Economy tab) keep it flowing.', done: (s) => s.stats.spells >= 1 || s.wave > 1 || s.phase === 'result' },
  { text: 'Watch the Morale meter: when it breaks, heroes flee (and come back stronger as ★ veterans). Clear 12 waves — bosses arrive on 4, 8 and 12. After each wave pick an Edict. Good luck, my Lord!', done: () => false },
];

const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export default function GameView({ save, updateSave, cfg, onQuit, onRestart }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [overlay, setOverlay] = useState<null | 'pause' | 'settings' | 'help'>(null);
  const [summary, setSummary] = useState<WaveSummary | null>(null);
  const [tab, setTab] = useState<'tools' | Cat>('tools');
  const [toast, setToast] = useState<string | null>(null);
  const [tutOn, setTutOn] = useState(cfg.tutorial);
  const [tutStep, setTutStep] = useState(0);
  const [confirm, setConfirm] = useState<null | 'restart' | 'title'>(null);
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
  const counted = useRef(false);
  const winCounted = useRef(false);
  const saveFn = useRef(updateSave);
  saveFn.current = updateSave;

  const finishRun = useCallback((kind: 'won' | 'lost' | 'abandon') => {
    const g = gameRef.current;
    if (!g) return;
    const d = g.bank();
    const wasCounted = counted.current;
    const winNow = kind === 'won' && !winCounted.current;
    counted.current = true;
    if (kind === 'won') winCounted.current = true;
    saveFn.current((s) => ({
      ...s,
      souls: s.souls + d.souls,
      lifetime: {
        ...s.lifetime,
        runs: s.lifetime.runs + (wasCounted ? 0 : 1),
        wins: s.lifetime.wins + (winNow ? 1 : 0),
        kills: s.lifetime.kills + d.kills,
        bosses: s.lifetime.bosses + d.bosses,
        totalSouls: s.lifetime.totalSouls + d.souls,
        bestWave: Math.max(s.lifetime.bestWave, g.stats.wavesCleared),
      },
    }));
  }, []);

  /* engine lifecycle */
  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const g = new Game(canvas, { ...cfg, shake: save.settings.shake }, (e) => {
      if (e.type === 'wave') setSummary(e.summary);
      else if (e.type === 'won') { finishRun('won'); setSnap(g.snapshot()); }
      else if (e.type === 'lost') { finishRun('lost'); setSnap(g.snapshot()); }
      else if (e.type === 'autopause') { if (g.phase !== 'won' && g.phase !== 'lost') setOverlay((o) => o ?? 'pause'); }
      else if (e.type === 'sel') setSnap(g.snapshot());
    });
    gameRef.current = g;
    const fit = () => g.resize(box.clientWidth, box.clientHeight);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    window.addEventListener('resize', fit);
    setSnap(g.snapshot());
    const iv = window.setInterval(() => setSnap(g.snapshot()), 100);
    return () => {
      clearInterval(iv);
      ro.disconnect();
      window.removeEventListener('resize', fit);
      g.destroy();
      gameRef.current = null;
      sound.setMood('menu');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { gameRef.current?.setPaused(overlay !== null); }, [overlay]);
  useEffect(() => { if (gameRef.current) gameRef.current.cfg.shake = save.settings.shake; }, [save.settings.shake]);

  /* keyboard */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g) return;
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
      if (g.phase === 'won' || g.phase === 'lost' || g.phase === 'result') return;
      if (e.key === 'Escape') {
        if (overlayRef.current) setOverlay(null);
        else if (!g.cancel()) setOverlay('pause');
        return;
      }
      if (overlayRef.current) return;
      if (e.key === 'p' || e.key === 'P') { setOverlay('pause'); return; }
      if (e.repeat && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const ae = document.activeElement as HTMLElement | null;
      if (ae && ae.tagName === 'BUTTON') ae.blur();
      if (g.handleKey(e.key)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* toast */
  const noticeId = snap?.notice?.id;
  useEffect(() => {
    if (!snap?.notice) return;
    setToast(snap.notice.text);
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noticeId]);

  /* tutorial progression */
  useEffect(() => {
    if (!tutOn || !snap) return;
    if (tutStep < TUT.length - 1 && TUT[tutStep].done(snap)) {
      setTutStep((s) => s + 1);
      sound.sfx('edict');
    }
  }, [snap, tutOn, tutStep]);
  const endTutorial = () => {
    setTutOn(false);
    updateSave((s) => ({ ...s, tutorialDone: true }));
  };

  const g = gameRef.current;
  const quit = (to: 'title' | 'ledger') => { finishRun('abandon'); onQuit(to); };
  const restart = () => { finishRun('abandon'); onRestart(); };

  const s = snap;
  const tools: { id: Tool; icon: string; name: string; key: string; hint: string }[] = [
    { id: 'inspect', icon: '🔍', name: 'Inspect', key: 'V', hint: 'Select structures to upgrade or sell' },
    { id: 'dig', icon: '⛏️', name: 'Dig', key: 'D', hint: 'Dig rock beside tunnels (10g) — drag to dig many' },
    { id: 'fill', icon: '🧱', name: 'Fill', key: 'F', hint: 'Refill an empty tunnel (refund 5g)' },
  ];

  const barW = (v: number, m: number) => `${Math.max(0, Math.min(100, (v / Math.max(1, m)) * 100))}%`;

  return (
    <div className="relative h-full w-full flex flex-col bg-[#0b0813]">
      {/* top HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 py-1.5 bg-gradient-to-b from-[#2a1d3d] to-[#170f24] border-b border-amber-200/10 text-sm">
        <div className="flex items-center gap-1 font-bold text-amber-300 text-lg min-w-[84px]" title="Gold">🪙 {s?.gold ?? 0}</div>
        <div className="w-36 sm:w-44" title="Mana: traps, lairs and spells all spend it">
          <div className="flex justify-between text-[11px] text-blue-200"><span>🔷 Mana {Math.floor(s?.mana ?? 0)}/{s?.maxMana ?? 0}</span><span>+{(s?.regen ?? 0).toFixed(1)}/s</span></div>
          <div className="bar"><div style={{ width: barW(s?.mana ?? 0, s?.maxMana ?? 1), background: 'linear-gradient(90deg,#2f6fe0,#6fc3ff)' }} /></div>
        </div>
        <div className="w-36 sm:w-44" title="Dungeon Heart HP — if it breaks, you lose">
          <div className="flex justify-between text-[11px] text-pink-200"><span>❤️ Heart</span><span>{Math.ceil(s?.heart ?? 0)}/{s?.maxHeart ?? 0}</span></div>
          <div className="bar"><div style={{ width: barW(s?.heart ?? 0, s?.maxHeart ?? 1), background: 'linear-gradient(90deg,#c0245e,#ff77a9)' }} /></div>
        </div>
        <div className="w-28 sm:w-36" title="Reputation: bigger parties & bounties as it rises">
          <div className="flex justify-between text-[11px] text-amber-200"><span>👑 {s?.repTier}</span><span>{Math.round(s?.rep ?? 0)}</span></div>
          <div className="bar"><div style={{ width: barW(s?.rep ?? 0, 100), background: 'linear-gradient(90deg,#b8801a,#ffd86b)' }} /></div>
        </div>
        <div className={`w-28 sm:w-36 transition-opacity ${s?.phase === 'raid' ? 'opacity-100' : 'opacity-40'}`} title="Party morale — below 25 the heroes flee">
          <div className="flex justify-between text-[11px] text-cyan-200"><span>🏳️ Morale</span><span>{Math.round(s?.morale ?? 100)}</span></div>
          <div className="bar"><div style={{ width: barW(s?.morale ?? 100, 100), background: (s?.morale ?? 100) < 25 ? '#ff5d73' : 'linear-gradient(90deg,#27a3b8,#7be7ff)' }} /></div>
        </div>
        <div className="flex-1 min-w-[90px] text-center">
          <div className="font-display text-amber-200 text-base leading-none">Wave {s?.wave ?? 1}{s?.endless ? '' : `/${MAX_WAVES}`} {s?.bossWave && <span title="Boss wave">💀</span>}</div>
          <div className="text-[11px] text-purple-300">{s?.phase === 'raid' ? `⚔️ Raid · ${s.enemiesLeft} heroes left` : s?.phase === 'prep' ? '🛠️ Preparation' : ''}</div>
        </div>
        <div className="flex gap-1">
          <button className="btn !px-2 !py-1" title="Game speed (X)" onClick={() => g?.cycleSpeed()}>{s?.speed ?? 1}×</button>
          <button className="btn !px-2 !py-1" title="Help" onClick={() => setOverlay('help')}>❓</button>
          <button className="btn !px-2 !py-1" title="Pause (P)" onClick={() => setOverlay('pause')}>⏸</button>
        </div>
      </div>

      {/* playfield */}
      <div ref={boxRef} className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        <canvas ref={canvasRef} className="block rounded shadow-2xl" style={{ cursor: s?.castMode ? 'crosshair' : s && s.tool !== 'inspect' ? 'cell' : 'default' }} />

        {/* scouting report */}
        {s?.phase === 'prep' && (
          <div className="absolute top-1 left-1 panel p-2 text-xs w-48 sm:w-56 pointer-events-none">
            <div className="font-display text-amber-300 text-sm">📜 Scouting Report · Wave {s.wave}</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {s.preview.map((p) => (
                <span key={p.cls + p.vet} className="bg-black/40 rounded px-1.5 py-0.5" title={ADVS[p.cls].name}>
                  {ADVS[p.cls].icon} ×{p.n}{p.vet ? '★' : ''}
                </span>
              ))}
              {s.previewBoss && <span className="bg-red-900/60 rounded px-1.5 py-0.5 font-bold">{ADVS[s.previewBoss].icon} {ADVS[s.previewBoss].name}</span>}
            </div>
            {s.vetCount > 0 && <div className="text-amber-200 mt-1">★ {s.vetCount} returning veterans</div>}
            <div className="text-purple-300 mt-1">Reputation {s.repTier}: parties +{Math.floor(s.rep / 30)} heroes, +{(s.rep * 0.3).toFixed(0)}% HP, +{(s.rep * 0.4).toFixed(0)}% bounty</div>
            {!s.connected && <div className="text-red-300 mt-1 font-bold">⚠ Route to the Heart is blocked!</div>}
          </div>
        )}

        {/* log */}
        <div className="absolute top-1 right-1 w-52 sm:w-64 text-[11px] pointer-events-none hidden sm:block">
          {s?.log.slice(-5).map((l) => (
            <div key={l.id} className="mb-0.5 px-1.5 py-0.5 rounded bg-black/55 truncate" style={{ color: l.color }}>{l.text}</div>
          ))}
        </div>

        {/* selection */}
        {s?.sel && (
          <div className="absolute bottom-1 right-1 panel p-2 w-60 sm:w-72 text-xs pop">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{s.sel.icon}</span>
              <div className="font-display text-amber-200 text-base">{s.sel.name} <span className="text-xs text-amber-400">Lv {s.sel.level}/3</span></div>
            </div>
            {s.sel.lines.map((l, i) => <div key={i} className={i === 0 ? 'text-purple-200 mt-1' : 'text-cyan-200'}>{l}</div>)}
            <div className="flex gap-2 mt-2">
              <button className="btn btn-gold !py-1 !px-2 flex-1" disabled={!s.sel.canUp || s.gold < s.sel.upCost} onClick={() => g?.upgradeSelected()}>
                {s.sel.canUp ? `⬆ Upgrade ${s.sel.upCost}g (U)` : 'Max level'}
              </button>
              <button className="btn btn-red !py-1 !px-2" onClick={() => g?.sellSelected()}>Sell +{s.sel.sellValue}g</button>
            </div>
          </div>
        )}

        {/* tutorial */}
        {tutOn && (
          <div className="absolute bottom-1 left-1 panel p-3 w-64 sm:w-80 text-xs sm:text-sm border-amber-300/50 pulse-glow">
            <div className="flex justify-between items-center mb-1">
              <span className="font-display text-amber-300">Tutorial {tutStep + 1}/{TUT.length}</span>
              <button className="text-purple-300 underline text-xs" onClick={endTutorial}>skip</button>
            </div>
            <div className="text-purple-100">{TUT[tutStep].text}</div>
            {tutStep === TUT.length - 1 && <button className="btn btn-gold !py-1 mt-2 w-full" onClick={endTutorial}>Got it!</button>}
          </div>
        )}

        {toast && <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-red-900/90 border border-red-300/40 px-4 py-1.5 rounded-lg text-sm pop pointer-events-none">{toast}</div>}
        {s?.castMode && <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-purple-900/90 border border-purple-300/40 px-3 py-1 rounded-lg text-sm pointer-events-none">Click a target to cast {SPELLS.find((x) => x.id === s.castMode)?.name} · Esc cancels</div>}
      </div>

      {/* bottom bar */}
      <div className="bg-gradient-to-t from-[#150e20] to-[#231833] border-t border-amber-200/10 px-2 py-1.5">
        <div className="flex flex-wrap items-stretch gap-2">
          <div className="flex-1 min-w-[260px]">
            <div className="flex gap-1 mb-1">
              {([['tools', '🛠️ Tools'], ['trap', '📌 Traps'], ['lair', '👺 Lairs'], ['econ', '💰 Economy']] as [string, string][]).map(([id, label]) => (
                <button key={id} className={`btn !py-0.5 !px-2 text-xs ${tab === id ? 'btn-gold' : ''}`} onClick={() => { setTab(id as 'tools' | Cat); sound.sfx('click'); }}>{label}</button>
              ))}
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {tab === 'tools' && tools.map((t) => (
                <button key={t.id} title={t.hint} className={`tool ${s?.tool === t.id ? 'active' : ''}`} onClick={() => g?.setTool(t.id)}>
                  <div className="text-xl leading-6">{t.icon}</div>
                  <div className="text-[10px] font-bold">{t.name}</div>
                  <div className="text-[9px] text-amber-300">[{t.key}]</div>
                </button>
              ))}
              {tab !== 'tools' && STRUCT_ORDER.filter((id) => STRUCTS[id].cat === tab).map((id) => {
                const d = STRUCTS[id];
                const locked = !!d.unlock && !(save.levels[d.unlock] > 0);
                const cost = Math.round(d.cost * (s?.phase === 'raid' ? 1.5 : 1));
                const poor = (s?.gold ?? 0) < cost;
                return (
                  <button key={id} title={locked ? `${d.name} — locked (unlock in the Ledger)` : `${d.name}: ${d.desc}`} className={`tool ${s?.tool === id ? 'active' : ''} ${locked ? 'locked' : ''} ${poor && !locked ? 'poor' : ''}`} onClick={() => g?.setTool(id)}>
                    <div className="text-xl leading-6">{locked ? '🔒' : d.icon}</div>
                    <div className="text-[10px] font-bold whitespace-nowrap">{d.name}</div>
                    <div className="text-[9px] text-amber-300">{cost}g · [{d.key.toUpperCase()}]</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col justify-end">
            <div className="text-[10px] text-purple-300 mb-0.5">Spells (click target after selecting)</div>
            <div className="flex gap-1">
              {s?.spells.map((sp) => {
                const def = SPELLS.find((x) => x.id === sp.id)!;
                const pct = sp.cdMax > 0 ? (sp.cd / sp.cdMax) * 100 : 0;
                return (
                  <button key={sp.id} title={`${def.name} — ${def.desc}`} className={`tool relative overflow-hidden ${s.castMode === sp.id ? 'active' : ''} ${!sp.unlocked ? 'locked' : ''} ${s.mana < sp.cost ? 'poor' : ''}`} onClick={() => g?.beginCast(sp.id)}>
                    <div className="text-xl leading-6">{sp.unlocked ? def.icon : '🔒'}</div>
                    <div className="text-[10px] font-bold whitespace-nowrap">{def.name}</div>
                    <div className="text-[9px] text-blue-300">{sp.cost}🔷 · [{def.key}]</div>
                    {pct > 0 && <div className="absolute left-0 bottom-0 w-full bg-black/60 pointer-events-none" style={{ height: `${pct}%` }} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col justify-end min-w-[130px]">
            {s?.phase === 'prep' ? (
              <button className="btn btn-gold pulse-glow !py-3 text-base" disabled={!s.connected} onClick={() => g?.startWave()}>▶ Start Raid<br /><span className="text-[10px] font-normal">Wave {s.wave} · Space</span></button>
            ) : (
              <div className="text-center text-xs text-purple-200 panel p-2">
                {s?.phase === 'raid' ? <>⚔️ Raid in progress<br />Heroes left: <b className="text-amber-200">{s.enemiesLeft}</b></> : '…'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* wave result + edict choice */}
      {s?.phase === 'result' && (
        <Modal wide>
          <div className="text-center">
            <h2 className="font-display text-3xl text-green-300">{summary ? `Wave ${summary.wave} Repelled!` : 'Endless Descent'}</h2>
            {summary ? (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 my-3 text-xs text-purple-200">
                <div className="bg-black/30 rounded p-2">Heroes slain<br /><b className="text-lg text-amber-200">{summary.kills}</b></div>
                <div className="bg-black/30 rounded p-2">Escaped<br /><b className="text-lg text-amber-200">{summary.escaped}</b></div>
                <div className="bg-black/30 rounded p-2">Heart damage<br /><b className="text-lg text-amber-200">{summary.heartLost}</b></div>
                <div className="bg-black/30 rounded p-2">Bounties<br /><b className="text-lg text-amber-200">+{summary.gold}g</b></div>
                <div className="bg-black/30 rounded p-2">Wave bonus<br /><b className="text-lg text-amber-200">+{summary.bonus}g</b></div>
                <div className="bg-black/30 rounded p-2">Veterans back<br /><b className="text-lg text-amber-200">{summary.vets}★</b></div>
              </div>
            ) : <p className="text-purple-200 my-2">The legend grows. Waves continue forever, ever stronger.</p>}
            <div className="font-display text-amber-300 mb-2">Choose an Edict — a permanent decree for this run</div>
            <div className="grid sm:grid-cols-3 gap-3">
              {s.edictChoices.map((id) => {
                const e = EDICTS.find((x) => x.id === id)!;
                return (
                  <button key={id} className="btn !p-4 text-left hover:!brightness-125" onClick={() => { g?.pickEdict(id); setSummary(null); }}>
                    <div className="text-4xl mb-1">{e.icon}</div>
                    <div className="font-display text-lg text-amber-200">{e.name}</div>
                    <div className="text-xs font-normal text-purple-100">{e.desc}</div>
                  </button>
                );
              })}
            </div>
            {s.owned.length > 0 && <div className="mt-3 text-xs text-purple-300">Active edicts: {s.owned.map((id) => EDICTS.find((x) => x.id === id)?.icon).join(' ')}</div>}
          </div>
        </Modal>
      )}

      {/* victory / defeat */}
      {(s?.phase === 'won' || s?.phase === 'lost') && (
        <Modal wide>
          <div className="text-center">
            <div className="text-6xl">{s.phase === 'won' ? '👑' : '💔'}</div>
            <h2 className={`font-display text-4xl font-black ${s.phase === 'won' ? 'text-amber-300' : 'text-red-400'}`}>{s.phase === 'won' ? 'The Dungeon Endures!' : 'The Heart Is Shattered'}</h2>
            <p className="text-purple-200 mt-1">
              {s.phase === 'won' ? `You repelled all ${MAX_WAVES} waves, including the Hero of Dawn. Your ledger is balanced.` : `You fell on wave ${s.wave}. The heroes loot your hoard…`}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-4 text-xs text-purple-200">
              {[
                ['Waves cleared', s.stats.wavesCleared], ['Heroes slain', s.stats.kills], ['Bosses felled', s.stats.bossKills], ['Escaped', s.stats.escaped],
                ['Gold earned', s.stats.goldEarned], ['Gold stolen', s.stats.goldLost], ['Traps fired', s.stats.trapsFired], ['Spells cast', s.stats.spells],
                ['Monsters lost', s.stats.monstersLost], ['Structures built', s.stats.built], ['Heart damage', Math.round(s.stats.heartDamage)], ['Time', fmtTime(s.stats.time)],
                ['Thieves stopped', s.stats.thievesStopped], ['Peak reputation', Math.round(s.stats.peakRep)], ['Upgrades', s.stats.upgrades], ['Tiles dug', s.stats.digs],
              ].map(([k, v]) => (
                <div key={String(k)} className="bg-black/30 rounded p-2">{k}<br /><b className="text-base text-amber-200">{v}</b></div>
              ))}
            </div>
            <div className="text-lg text-purple-100 mb-3">✦ <b className="text-amber-300">{s.soulsPreview}</b> souls banked in your Ledger</div>
            <div className="flex flex-wrap gap-2 justify-center">
              {s.phase === 'won' && <button className="btn btn-gold" onClick={() => g?.continueEndless()}>♾️ Continue (Endless)</button>}
              <button className={`btn ${s.phase === 'lost' ? 'btn-gold' : ''}`} onClick={onRestart}>{s.phase === 'lost' ? '🔁 Retry' : '🔁 New Run'}</button>
              <button className="btn" onClick={() => onQuit('ledger')}>📖 Spend Souls</button>
              <button className="btn" onClick={() => onQuit('title')}>🏠 Title</button>
            </div>
          </div>
        </Modal>
      )}

      {/* pause */}
      {overlay === 'pause' && (
        <Modal title="⏸ Paused">
          <div className="flex flex-col gap-2">
            <button className="btn btn-gold" onClick={() => setOverlay(null)}>▶ Resume</button>
            <button className="btn" onClick={() => setOverlay('settings')}>⚙️ Settings & Difficulty</button>
            <button className="btn" onClick={() => setOverlay('help')}>❓ Help & Controls</button>
            {confirm === 'restart' ? (
              <div className="flex gap-2 items-center justify-center text-sm"><span>Abandon this run?</span><button className="btn btn-red !py-1" onClick={restart}>Restart</button><button className="btn !py-1" onClick={() => setConfirm(null)}>No</button></div>
            ) : <button className="btn" onClick={() => setConfirm('restart')}>🔁 Restart Run</button>}
            {confirm === 'title' ? (
              <div className="flex gap-2 items-center justify-center text-sm"><span>Souls so far are banked.</span><button className="btn btn-red !py-1" onClick={() => quit('title')}>Quit</button><button className="btn !py-1" onClick={() => setConfirm(null)}>No</button></div>
            ) : <button className="btn" onClick={() => setConfirm('title')}>🏠 Abandon to Title</button>}
          </div>
        </Modal>
      )}
      {overlay === 'settings' && (
        <Modal title="⚙️ Settings" onClose={() => setOverlay('pause')}>
          <SettingsPanel save={save} updateSave={updateSave} onDifficulty={(id) => g?.setDifficulty(id)} />
        </Modal>
      )}
      {overlay === 'help' && (
        <Modal title="❓ Dungeon Lord's Handbook" wide onClose={() => setOverlay(s?.phase ? 'pause' : null)}>
          <HelpPanel />
        </Modal>
      )}
    </div>
  );
}
