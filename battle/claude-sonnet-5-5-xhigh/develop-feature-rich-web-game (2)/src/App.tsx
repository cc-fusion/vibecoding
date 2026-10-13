import { useEffect, useReducer, useRef, useState } from 'react';
import { Game, type GameOpts } from './game/game';
import * as store from './game/store';
import { audio } from './game/audio';
import type { Meta, Settings } from './game/types';
import { Hud } from './ui/Hud';
import { InventoryPanel, NpcPanel, HousingPanel, JournalPanel } from './ui/Panels';
import { Title, WorldSelect, NewWorld, Legacy, Shell, HelpContent, SettingsContent, PauseMenu, Overlay, StatsGrid } from './ui/Screens';
import { Panel, btn, btn2 } from './ui/common';

type Screen = 'title' | 'worlds' | 'new' | 'legacy' | 'help' | 'settings' | 'play';
type Launch = { opts: Omit<GameOpts, 'settings'>; key: number };

function GameView({ launch, settings, onSettings, onQuit }: { launch: Launch; settings: Settings; onSettings: (s: Settings) => void; onQuit: () => void }) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const gRef = useRef<Game | null>(null);
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const [ready, setReady] = useState(false); const [err, setErr] = useState('');
  const [paused, setPaused] = useState(false); const [dead, setDead] = useState(false); const [won, setWon] = useState(false);
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    let cancelled = false; let g: Game | null = null; let iv: any = null;
    const t = setTimeout(() => {
      if (cancelled || !cvRef.current) return;
      try { g = new Game(cvRef.current, { ...launch.opts, settings: settingsRef.current }); } catch (e: any) { console.error(e); setErr(String(e && e.stack ? e.stack : e)); return; }
      gRef.current = g;
      g.cb.onPause = () => { g!.setPaused(true); setPaused(true); };
      g.cb.onDeath = () => setDead(true); g.cb.onWin = () => setWon(true); g.cb.onChange = () => force();
      g.start(); audio.startMusic();
      if (!launch.opts.save) { g.save(); const m = store.loadMeta(); m.worlds++; store.saveMeta(m); }
      setReady(true); iv = setInterval(force, 100);
    }, 60);
    return () => { cancelled = true; clearTimeout(t); if (iv) clearInterval(iv); if (g) { try { g.save(); } catch { /* ignore */ } g.stop(); } gRef.current = null; audio.setDuck(false); };
  }, [launch.key]);

  useEffect(() => { const g = gRef.current; if (g) { g.settings = settings; g.applyAudio(); g.resize(); } }, [settings]);
  const g = gRef.current;
  const resume = () => { const gg = gRef.current; if (gg) gg.setPaused(false); setPaused(false); };
  useEffect(() => {
    if (!paused) return; const h = (e: KeyboardEvent) => { if (e.key === 'Escape') resume(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [paused]);

  const quit = () => { const gg = gRef.current; if (gg) gg.save(); onQuit(); };
  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <canvas ref={cvRef} className="absolute inset-0 w-full h-full block touch-none cursor-crosshair" />
      {!ready && !err && <div className="absolute inset-0 grid place-items-center bg-[#120c06] text-amber-200 font-mono"><div className="text-center"><div className="w-14 h-14 mx-auto mb-4 border-4 border-amber-700 border-t-amber-300 rounded-full animate-spin" /><div className="text-xl font-bold tracking-widest">GENERATING WORLD…</div><div className="text-xs text-amber-100/60 mt-2">Carving caves · placing ore · planting trees · raising the Blight</div></div></div>}
      {err && <div className="absolute inset-0 grid place-items-center bg-black p-6"><Panel title="Something went wrong" className="max-w-xl"><pre className="text-xs whitespace-pre-wrap text-red-300 max-h-60 overflow-auto">{err}</pre><button className={`${btn} mt-3`} onClick={onQuit}>Back to title</button></Panel></div>}
      {ready && g && (
        <div className="absolute inset-0 pointer-events-none">
          {g.panel !== 'map' && <Hud g={g} />}
          {g.panel === 'inventory' && <InventoryPanel g={g} />}
          {g.panel === 'npc' && <NpcPanel g={g} />}
          {g.panel === 'housing' && <HousingPanel g={g} />}
          {g.panel === 'journal' && <JournalPanel g={g} />}
          {g.panel === 'map' && <button onClick={() => g.closePanel()} className={`${btn} pointer-events-auto absolute right-4 bottom-4`}>Close map (M)</button>}
          {paused && !dead && !won && <PauseMenu g={g} settings={settings} onSettings={onSettings} onResume={resume} onQuit={quit} />}
          {dead && g.player.dead && (
            <Overlay>
              <Panel title="You were slain" className="w-full max-w-2xl" z="z-50">
                <div className="text-center mb-3"><div className="text-3xl font-black text-red-400 [text-shadow:0_3px_0_#400]">{g.permaDead ? 'YOUR WORLD IS LOST' : 'DEFEATED'}</div><div className="text-sm text-amber-100/80">Slain by {g.deathCause || 'the world'}{g.diff.coinLoss > 0 ? ` — you dropped ${Math.round(g.diff.coinLoss * 100)}% of your coins.` : '.'}{g.permaDead ? ' Hardcore worlds cannot be recovered.' : ''}</div></div>
                <StatsGrid g={g} />
                <div className="flex flex-wrap gap-2 mt-4 justify-center">
                  {!g.permaDead && <button className={btn} disabled={g.respawnT > 0} onClick={() => { g.respawn(); setDead(false); }}>{g.respawnT > 0 ? `Respawn in ${Math.ceil(g.respawnT)}s` : '↺ Respawn & Retry'}</button>}
                  <button className={btn2} onClick={quit}>Quit to Title</button>
                </div>
              </Panel>
            </Overlay>
          )}
          {won && (
            <Overlay>
              <Panel title="Victory" className="w-full max-w-2xl" z="z-50">
                <div className="text-center mb-3"><div className="text-4xl font-black text-yellow-300 [text-shadow:0_3px_0_#7a4a00,0_0_30px_#fc0]">THE COLOSSUS FALLS</div><div className="text-sm text-amber-100/80 mt-1">You conquered {g.name} on {g.diff.name} difficulty. Your legend is carved into the stars.</div></div>
                <StatsGrid g={g} />
                <div className="flex flex-wrap gap-2 mt-4 justify-center"><button className={btn} onClick={() => { g.won = false; g.flags.wonShown = true; setWon(false); }}>Keep Exploring</button><button className={btn2} onClick={quit}>Quit to Title</button></div>
              </Panel>
            </Overlay>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [settings, setSettings] = useState<Settings>(() => store.loadSettings());
  const [slots, setSlots] = useState(() => store.listSlots());
  const [newSlot, setNewSlot] = useState(0);
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const meta: Meta = store.loadMeta();

  useEffect(() => {
    const h = () => { audio.resume(); audio.startMusic(); };
    window.addEventListener('pointerdown', h); window.addEventListener('keydown', h);
    return () => { window.removeEventListener('pointerdown', h); window.removeEventListener('keydown', h); };
  }, []);
  useEffect(() => { audio.setVolumes(settings.master, settings.music, settings.sfx, settings.muted); }, [settings]);
  const changeSettings = (s: Settings) => { setSettings(s); store.saveSettings(s); };
  const toTitle = () => { setLaunch(null); setSlots(store.listSlots()); setScreen('title'); audio.setMood('title'); audio.setIntensity(0); };
  const startNew = (o: { name: string; seed: number; diff: string; mods: string[] }) => { setLaunch({ opts: { slot: newSlot, name: o.name, seed: o.seed, diff: o.diff, mods: o.mods }, key: Date.now() }); setScreen('play'); };
  const cont = (i: number) => {
    const data = store.loadSlot(i); if (!data) { setSlots(store.listSlots()); return; }
    setLaunch({ opts: { slot: i, name: data.name, seed: data.seed, diff: data.diff, mods: data.mods || [], save: data }, key: Date.now() }); setScreen('play');
  };

  return (
    <div className="fixed inset-0 bg-black text-amber-50 font-sans">
      {screen === 'title' && <Title meta={meta} onPlay={() => { setSlots(store.listSlots()); setScreen('worlds'); }} onLegacy={() => setScreen('legacy')} onHelp={() => setScreen('help')} onSettings={() => setScreen('settings')} />}
      {screen === 'worlds' && <WorldSelect slots={slots} onContinue={cont} onNew={i => { setNewSlot(i); setScreen('new'); }} onDelete={i => { store.deleteSlot(i); setSlots(store.listSlots()); }} onBack={() => setScreen('title')} />}
      {screen === 'new' && <NewWorld slot={newSlot} meta={meta} onStart={startNew} onBack={() => setScreen('worlds')} />}
      {screen === 'legacy' && <Legacy meta={meta} onChange={bump} onBack={() => setScreen('title')} />}
      {screen === 'help' && <Shell title="How to Play" onBack={() => setScreen('title')}><HelpContent /></Shell>}
      {screen === 'settings' && <Shell title="Settings & Audio" onBack={() => setScreen('title')}><SettingsContent settings={settings} onChange={changeSettings} /></Shell>}
      {screen === 'play' && launch && <GameView key={launch.key} launch={launch} settings={settings} onSettings={changeSettings} onQuit={toTitle} />}
    </div>
  );
}
