import { useCallback, useEffect, useRef, useState } from 'react';
import { computeStats, DIFFS, MODS, SITES, type Upgrade, lvl } from './game/data';
import { freshSave, loadSave, writeSave, type SaveData, type Settings } from './game/save';
import type { DiveResult } from './game/engine';
import { audio } from './game/audio';
import GameView from './ui/GameView';
import { Btn, CodexPanel, DifficultyPicker, FONT, HelpPanel, Modal, ReportScreen, SettingsPanel, Workshop } from './ui/Panels';

type Screen = 'title' | 'bay' | 'dive' | 'report';
type Tab = 'sites' | 'workshop' | 'codex' | 'rules';

function Bubbles() {
  const bubbles = useRef(Array.from({ length: 26 }, (_, i) => ({ id: i, left: Math.random() * 100, size: 4 + Math.random() * 18, dur: 8 + Math.random() * 14, delay: -Math.random() * 20 }))).current;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {bubbles.map((b) => (
        <span key={b.id} className="absolute rounded-full border border-cyan-200/30 bg-cyan-100/5" style={{ left: `${b.left}%`, bottom: -40, width: b.size, height: b.size, animation: `rise ${b.dur}s linear ${b.delay}s infinite` }} />
      ))}
    </div>
  );
}

export default function App() {
  const [save, setSave] = useState<SaveData>(loadSave);
  const [screen, setScreen] = useState<Screen>('title');
  const [tab, setTab] = useState<Tab>('sites');
  const [dive, setDive] = useState<{ siteId: number; tutorial: boolean; key: number } | null>(null);
  const [result, setResult] = useState<DiveResult | null>(null);
  const [modal, setModal] = useState<'none' | 'settings' | 'help' | 'confirm'>('none');

  useEffect(() => { writeSave(save); }, [save]);
  useEffect(() => { audio.apply(save.settings); }, [save.settings]);

  const gesture = useCallback(() => { audio.init(); audio.startMusic(); audio.apply(save.settings); }, [save.settings]);

  const startDive = (siteId: number, tutorial = false) => {
    setDive({ siteId, tutorial, key: Date.now() });
    setScreen('dive');
  };

  const handleEnd = (res: DiveResult) => {
    const r: DiveResult = res.outcome === 'training' ? { ...res, payout: save.tutorialDone ? 0 : 150 } : res;
    setSave((s) => {
      const n: SaveData = { ...s, marks: s.marks + r.payout, life: { ...s.life } };
      if (r.outcome === 'training') n.tutorialDone = true;
      else {
        n.life.dives += 1;
        if (r.outcome === 'death') n.life.deaths += 1;
        n.life.totalMarks += r.payout;
        n.life.creatures += r.creatures;
        n.life.nodes += r.nodes;
        n.life.deepest = Math.max(n.life.deepest, Math.round(r.maxDepth));
        n.life.seconds += r.time;
        n.codex = Array.from(new Set([...s.codex, ...r.tablets]));
        if (r.outcome === 'success' && r.siteId >= 0) {
          n.clears = s.clears.slice(); n.clears[r.siteId] += 1;
          n.bestHaul = s.bestHaul.slice(); n.bestHaul[r.siteId] = Math.max(n.bestHaul[r.siteId], r.cargoValue);
          n.unlocked = Math.max(s.unlocked, Math.min(4, r.siteId + 1));
          if (r.siteId === 4) n.won = true;
        }
      }
      return n;
    });
    audio.play(r.outcome === 'death' ? 'bad' : r.outcome === 'success' && r.siteId === 4 ? 'win' : 'good');
    setResult(r);
    setScreen('report');
  };

  const buy = (u: Upgrade) => {
    const l = lvl(save, u.id);
    const cost = u.cost[l];
    const reqOk = !u.req || lvl(save, u.req.id) >= u.req.lvl;
    if (l >= u.max || !reqOk || save.marks < cost) { audio.play('deny'); return; }
    audio.play('buy');
    setSave((s) => ({ ...s, marks: s.marks - cost, upgrades: { ...s.upgrades, [u.id]: (s.upgrades[u.id] || 0) + 1 } }));
  };

  const setSettings = useCallback((s: Settings) => setSave((p) => ({ ...p, settings: s })), []);
  const setDiff = useCallback((id: string) => setSave((p) => ({ ...p, difficulty: id })), []);
  const setMods = useCallback((m: string[]) => setSave((p) => ({ ...p, mods: m })), []);
  const newGame = () => { setSave((s) => freshSave(s.settings)); setModal('none'); setTab('sites'); };

  const st = computeStats(save, save.mods);
  const diff = DIFFS.find((d) => d.id === save.difficulty) || DIFFS[1];

  return (
    <div className="min-h-screen w-full text-slate-100 bg-[#03101b]" onPointerDown={gesture} style={{ fontFamily: 'system-ui, sans-serif' }}>
      {screen === 'title' && (
        <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4 py-8" style={{ background: 'radial-gradient(ellipse at 50% 0%, #1d6f8c 0%, #0b3550 35%, #04121f 75%, #01060c 100%)' }}>
          <Bubbles />
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-amber-200/20 to-transparent pointer-events-none" />
          <button className="absolute top-3 right-3 text-sm px-3 py-1.5 rounded border border-cyan-300/30 bg-slate-900/60 hover:bg-slate-800" onClick={() => setSettings({ ...save.settings, muted: !save.settings.muted })}>{save.settings.muted ? '🔇 Muted' : '🔊 Sound on'}</button>
          <div className="relative text-center mb-8">
            <div className="text-cyan-200/70 tracking-[0.5em] text-xs md:text-sm mb-2">A DEEP-SEA SALVAGE EXPEDITION</div>
            <h1 className="text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-amber-100 to-cyan-300 drop-shadow-[0_0_30px_rgba(80,220,255,0.35)]" style={FONT}>SUNKEN<br />ARCHIVE</h1>
            <div className="text-cyan-100/80 mt-3 text-sm md:text-base">Dive. Decode. Survive the dark. {save.won && <span className="text-amber-300">★ Archive Saved</span>}</div>
          </div>
          <div className="relative flex flex-col gap-3 w-full max-w-xs">
            <Btn kind="gold" onClick={() => { setScreen('bay'); setTab('sites'); }}>{save.life.dives > 0 || save.marks > 0 ? '▶ Continue Expedition' : '▶ Begin Expedition'}</Btn>
            <Btn onClick={() => startDive(-1, true)}>{save.tutorialDone ? '🎓 Training Dive' : '🎓 Training Dive (recommended)'}</Btn>
            <Btn kind="ghost" onClick={() => setModal('help')}>❓ How to Play</Btn>
            <Btn kind="ghost" onClick={() => setModal('settings')}>⚙ Settings</Btn>
            <Btn kind="ghost" onClick={() => setModal('confirm')}>🗑 New Game</Btn>
          </div>
          <div className="relative mt-8 text-xs text-cyan-100/50 text-center">Marks banked: {save.marks} ◈ · Fragments: {save.codex.length}/12 · Progress saved locally</div>
        </div>
      )}

      {screen === 'bay' && (
        <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(#0a2a40,#04101b 40%,#02070d)' }}>
          <header className="sticky top-0 z-30 flex flex-wrap items-center gap-2 justify-between px-4 py-3 bg-[#04101b]/90 backdrop-blur border-b border-cyan-300/15">
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl text-cyan-100" style={FONT}>Dive Bay</h1>
              <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-300/50 text-amber-200 font-bold">{save.marks} ◈</span>
              <span className="hidden sm:inline text-xs text-cyan-100/60">{diff.name}{save.mods.length ? ` + ${save.mods.length} mod` : ''}</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {([['sites', '🗺 Expeditions'], ['workshop', '🔧 Workshop'], ['codex', '📜 Codex'], ['rules', '⚙ Difficulty']] as [Tab, string][]).map(([t, l]) => (
                <button key={t} onClick={() => { audio.play('click'); setTab(t); }} className={`px-3 py-1.5 rounded-lg border text-sm ${tab === t ? 'bg-cyan-700 border-cyan-300 text-white' : 'bg-slate-900/70 border-slate-600/40 text-slate-200 hover:bg-slate-800'}`}>{l}</button>
              ))}
              <Btn kind="ghost" className="!py-1.5 !text-sm" onClick={() => setModal('settings')}>🔊</Btn>
              <Btn kind="ghost" className="!py-1.5 !text-sm" onClick={() => setModal('help')}>❓</Btn>
              <Btn kind="ghost" className="!py-1.5 !text-sm" onClick={() => setScreen('title')}>Title</Btn>
            </div>
          </header>
          <main className="flex-1 p-4 max-w-6xl w-full mx-auto">
            {tab === 'sites' && (
              <div className="flex flex-col gap-4">
                {!save.tutorialDone && (
                  <div className="rounded-xl border border-cyan-300/40 bg-cyan-900/30 p-3 flex flex-wrap items-center gap-3 justify-between">
                    <span className="text-sm text-cyan-50">New to the deep? The Training Dive teaches every tool and pays 150 ◈.</span>
                    <Btn onClick={() => startDive(-1, true)}>Start training</Btn>
                  </div>
                )}
                {SITES.map((s) => {
                  const locked = s.id > save.unlocked;
                  const over = s.depth > st.rating;
                  return (
                    <div key={s.id} className={`rounded-2xl border p-4 flex flex-col md:flex-row gap-4 justify-between ${locked ? 'border-slate-700/50 bg-slate-900/30 opacity-60' : 'border-cyan-300/25 bg-slate-900/50'}`} style={{ borderLeft: `6px solid ${s.accent}` }}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xl text-cyan-50" style={FONT}>{s.id + 1}. {s.name}</h3>
                          {s.boss && <span className="text-xs px-2 py-0.5 rounded bg-fuchsia-700/60 border border-fuchsia-300/50">BOSS · The Warden</span>}
                          {save.clears[s.id] > 0 && <span className="text-xs px-2 py-0.5 rounded bg-emerald-700/50 border border-emerald-300/40">Cleared ×{save.clears[s.id]}</span>}
                        </div>
                        <p className="text-sm text-cyan-100/70 mt-1">{s.blurb}</p>
                        <div className="flex gap-4 flex-wrap text-xs mt-2 text-cyan-100/80">
                          <span>Depth <b className={over ? 'text-rose-300' : 'text-emerald-300'}>{s.depth} m</b> (hull rated {st.rating} m)</span>
                          <span>Terminals {s.nodes}</span>
                          <span>Reward {s.reward} ◈</span>
                          {save.bestHaul[s.id] > 0 && <span>Best haul {save.bestHaul[s.id]} ◈</span>}
                        </div>
                        {over && !locked && <div className="text-xs text-rose-300 mt-1">⚠ The deepest part exceeds your hull rating — you will take pressure damage down there.</div>}
                      </div>
                      <div className="flex md:flex-col justify-center gap-2 items-stretch min-w-[170px]">
                        <Btn kind="gold" disabled={locked} onClick={() => startDive(s.id)}>{locked ? '🔒 Locked' : 'Dive ▶'}</Btn>
                        {locked && <div className="text-[11px] text-center text-slate-400">Clear expedition {s.id} to unlock</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {tab === 'workshop' && <Workshop save={save} onBuy={buy} />}
            {tab === 'codex' && <CodexPanel save={save} />}
            {tab === 'rules' && (
              <div className="flex flex-col gap-6">
                <DifficultyPicker save={save} onDiff={setDiff} onMods={setMods} />
                <div className="rounded-xl border border-cyan-300/20 bg-slate-900/50 p-4">
                  <h3 className="text-lg text-amber-200 mb-2" style={FONT}>Career log</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    {[['Dives', save.life.dives], ['Subs lost', save.life.deaths], ['Marks earned', save.life.totalMarks], ['Creatures downed', save.life.creatures], ['Terminals solved', save.life.nodes], ['Deepest', `${save.life.deepest} m`], ['Time below', `${Math.round(save.life.seconds / 60)} min`], ['Mods active', save.mods.map((m) => MODS.find((x) => x.id === m)?.name).join(', ') || 'none']].map(([k, v]) => (
                      <div key={String(k)} className="rounded bg-black/30 p-2"><div className="text-cyan-200/60 text-xs">{k}</div><div className="font-bold text-cyan-50">{v}</div></div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {screen === 'dive' && dive && (
        <GameView
          key={dive.key}
          siteId={dive.siteId}
          tutorial={dive.tutorial}
          save={save}
          onEnd={handleEnd}
          onRestart={() => setDive({ ...dive, key: Date.now() })}
          onSettings={setSettings}
          onDiff={setDiff}
          onMods={setMods}
        />
      )}

      {screen === 'report' && result && (
        <ReportScreen
          res={result}
          onRetry={() => startDive(result.siteId, false)}
          onBay={() => { setScreen('bay'); setTab(result.outcome === 'training' ? 'sites' : 'workshop'); }}
          onNext={result.outcome === 'success' && result.siteId >= 0 && result.siteId < 4 ? () => startDive(result.siteId + 1) : null}
          onTitle={() => setScreen('title')}
        />
      )}

      {modal === 'settings' && <Modal title="Settings" onClose={() => setModal('none')}><SettingsPanel settings={save.settings} onChange={setSettings} /></Modal>}
      {modal === 'help' && <Modal title="How to Play" onClose={() => setModal('none')} wide><HelpPanel /></Modal>}
      {modal === 'confirm' && (
        <Modal title="Start a new game?" onClose={() => setModal('none')}>
          <p className="text-cyan-100/80 mb-4">This erases all marks, upgrades, codex fragments and expedition progress. Settings are kept.</p>
          <div className="flex gap-2"><Btn kind="danger" onClick={newGame}>Erase &amp; restart</Btn><Btn kind="ghost" onClick={() => setModal('none')}>Cancel</Btn></div>
        </Modal>
      )}
    </div>
  );
}
