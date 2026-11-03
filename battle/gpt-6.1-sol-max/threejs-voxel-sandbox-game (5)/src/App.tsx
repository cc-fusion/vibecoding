import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, BookOpen, Check, ChevronRight,
  CircleHelp, CloudRain, Compass, Download, Feather, Flame, FolderOpen, Hammer, Heart,
  Leaf, Map, Maximize, Menu, Minimize, Moon, MousePointer2, Move, Navigation, Package,
  Pickaxe, Plus, RotateCcw, Settings2, ShieldCheck, Sparkles, Sprout, Sun, Trash2,
  Upload, Volume2, VolumeX, WandSparkles, X,
} from 'lucide-react';
import { GameEngine } from './game/engine';
import { B, BLOCKS, RECIPES, getQuests } from './game/blocks';
import { DEFAULT_SETTINGS, deleteWorld, getActiveWorld, getWorlds, isWorldSave, loadSettings, newWorld, persistWorld, saveSettings } from './game/storage';
import type { GameSnapshot, Screen, Settings, Toast, WorldSave } from './game/types';
import { ItemIcon, WorldMark } from './components/ItemIcon';
import WorldMap from './components/WorldMap';

function initialSnapshot(world: WorldSave): GameSnapshot {
  return {
    ready: false, loading: 0, health: world.health, stamina: 100, air: 10,
    selected: world.selected, hotbar: world.hotbar, inventory: world.inventory,
    position: world.position || [24, 25, 34], yaw: world.yaw, biome: 'Wildflower meadow',
    time: world.time, day: world.day, weather: 'clear', mining: 0, target: null, fps: 60,
    savedAt: 0, stats: world.stats, flying: false, inWater: false,
  };
}

function Key({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <kbd className={className}>{children}</kbd>;
}

function PixelHeart({ filled }: { filled: number }) {
  return <svg className="pixel-heart" width="17" height="16" viewBox="0 0 17 16" aria-hidden="true" shapeRendering="crispEdges">
    <path d="M2 2h4v2h4V2h4v2h2v6h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V4h2z" fill="#3a493a" fillOpacity=".45" />
    {filled > 0 && <path d={filled >= 1 ? 'M2 2h4v2h4V2h4v2h2v6h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V4h2z' : 'M2 2h4v2h2v12H6v-2H4v-2H2v-2H0V4h2z'} fill="#e7a18b" />}
    {filled > 0 && <path d="M2 4h4v2H2z" fill="#ffdbc1" />}
  </svg>;
}

export default function App() {
  const [world, setWorld] = useState<WorldSave>(getActiveWorld);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [snapshot, setSnapshot] = useState<GameSnapshot>(() => initialSnapshot(world));
  const [screen, setScreen] = useState<Screen>('welcome');
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [hideHud, setHideHud] = useState(false);
  const [selectedItem, setSelectedItem] = useState<number>(B.GRASS);
  const [recipeId, setRecipeId] = useState('bench');
  const [recipeCategory, setRecipeCategory] = useState('All');
  const [bagCategory, setBagCategory] = useState('Everything');
  const [guideTab, setGuideTab] = useState('Your journey');
  const [worldList, setWorldList] = useState<WorldSave[]>([]);
  const [creatingWorld, setCreatingWorld] = useState(false);
  const [worldName, setWorldName] = useState('A new beginning');
  const [worldSeed, setWorldSeed] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const [waypoint, setWaypoint] = useState<[number, number] | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const screenRef = useRef<Screen>('welcome');
  const returnRef = useRef<Screen>('playing');
  const settingsRef = useRef(settings);
  const toastTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const previousVolume = useRef(settings.volume || 45);

  const changeScreen = useCallback((next: Screen) => { screenRef.current = next; setScreen(next); }, []);
  const notify = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts(current => [...current.slice(-2), { ...toast, id }]);
    const timer = setTimeout(() => { setToasts(current => current.filter(t => t.id !== id)); toastTimers.current.delete(timer); }, toast.kind === 'achievement' ? 5500 : 3500);
    toastTimers.current.add(timer);
  }, []);

  const openScreen = useCallback((next: Screen) => {
    const current = screenRef.current;
    returnRef.current = current === 'playing' ? 'playing' : current === 'welcome' ? 'welcome' : 'paused';
    changeScreen(next);
    engineRef.current?.pause(false);
    if (next === 'worlds') { setWorldList(getWorlds()); setCreatingWorld(false); setDeleteId(''); }
  }, [changeScreen]);

  const closeModal = useCallback(() => {
    if (screenRef.current === 'paused') { engineRef.current?.play(); return; }
    if (returnRef.current === 'playing') engineRef.current?.play(); else changeScreen(returnRef.current);
  }, [changeScreen]);

  useEffect(() => {
    if (!viewportRef.current) return;
    setSnapshot(initialSnapshot(world)); setError('');
    let engine: GameEngine | null = null;
    try {
      engine = new GameEngine(viewportRef.current, world, settingsRef.current, {
        snapshot: setSnapshot, notify,
        screen: next => {
          if (next === 'paused') changeScreen('paused');
          else { returnRef.current = screenRef.current === 'playing' ? 'playing' : 'paused'; changeScreen(next); }
        },
        pointer: locked => {
          if (locked) changeScreen('playing');
          else if (screenRef.current === 'playing') changeScreen('paused');
        },
      });
      engineRef.current = engine;
      if (import.meta.env.DEV) (window as unknown as { __everwild: GameEngine | null }).__everwild = engine;
    } catch (e) {
      console.error(e); setError('This little world needs WebGL 2. Try a current browser with hardware acceleration enabled.');
    }
    return () => {
      engine?.dispose(); engineRef.current = null;
      if (import.meta.env.DEV) (window as unknown as { __everwild: GameEngine | null }).__everwild = null;
    };
    // A world owns one renderer. Settings update that renderer in place.
  }, [world.id, changeScreen, notify]);

  useEffect(() => { settingsRef.current = settings; saveSettings(settings); engineRef.current?.updateSettings(settings); }, [settings]);
  useEffect(() => {
    const listener = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', listener);
    return () => document.removeEventListener('fullscreenchange', listener);
  }, []);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.defaultPrevented || (e.target as HTMLElement)?.matches('input, textarea, select')) return;
      if (e.code === 'F1') { e.preventDefault(); setHideHud(current => !current); return; }
      const current = screenRef.current;
      if (current === 'welcome' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); engineRef.current?.play(); return; }
      if (e.code === 'Escape') {
        e.preventDefault();
        if (current === 'playing') { changeScreen('paused'); engineRef.current?.pause(false); }
        else if (current !== 'welcome') closeModal();
      }
      if (e.code === 'KeyE' && current === 'inventory') { e.preventDefault(); closeModal(); }
      if (e.code === 'KeyJ' && current === 'guide') { e.preventDefault(); closeModal(); }
      if (e.code === 'Tab' && modalRef.current && current !== 'welcome' && current !== 'playing') {
        const elements = Array.from(modalRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, [tabindex="0"]'));
        if (!elements.length) return;
        if (e.shiftKey && document.activeElement === elements[0]) { e.preventDefault(); elements[elements.length - 1].focus(); }
        if (!e.shiftKey && document.activeElement === elements[elements.length - 1]) { e.preventDefault(); elements[0].focus(); }
      }
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [changeScreen, closeModal]);
  useEffect(() => {
    if (screen !== 'playing' && screen !== 'welcome') {
      const timer = setTimeout(() => modalRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus(), 60);
      return () => clearTimeout(timer);
    }
  }, [screen]);
  useEffect(() => () => { toastTimers.current.forEach(clearTimeout); }, []);

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings(current => ({ ...current, [key]: value }));
  const toggleFullscreen = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await appRef.current?.requestFullscreen(); }
    catch { notify({ text: 'Fullscreen is not available in this browser window.', kind: 'info' }); }
  };
  const toggleSound = () => {
    if (settings.volume > 0) { previousVolume.current = settings.volume; updateSetting('volume', 0); }
    else { updateSetting('volume', previousVolume.current); engineRef.current?.audio.start(); }
  };
  const switchWorld = (next: WorldSave) => {
    engineRef.current?.dispose();
    engineRef.current = null;
    try { persistWorld(next); } catch { notify({ text: 'Storage is unavailable. Remember to export your world.', kind: 'error' }); }
    changeScreen('welcome'); setWaypoint(null); setWorld(next);
  };
  const createWorld = (e: React.FormEvent) => {
    e.preventDefault();
    const name = worldName.trim().slice(0, 35) || 'A new beginning';
    const seed = worldSeed.trim().slice(0, 60) || `WILD-${Math.floor(Math.random() * 999999)}`;
    switchWorld(newWorld(name, seed));
  };
  const exportWorld = () => {
    const saved = engineRef.current?.save(); if (!saved) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(saved)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `${saved.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.everwild.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify({ text: 'A little world, safely in your pocket. Exported!', kind: 'info' });
  };
  const importWorld = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error('That file is too large. World files must be smaller than 15 MB.');
      const data: unknown = JSON.parse(await file.text());
      if (!isWorldSave(data)) throw new Error('That does not look like an everwild world file.');
      data.id = crypto.randomUUID(); data.name = data.name.slice(0, 35); switchWorld(data);
      notify({ text: 'Your world has found its way home.', kind: 'achievement' });
    } catch (e) { notify({ text: e instanceof Error ? e.message : 'This world could not be imported.', kind: 'error' }); }
    if (importRef.current) importRef.current.value = '';
  };

  const isWelcome = screen === 'welcome';
  const playing = screen === 'playing';
  const modalOpen = !isWelcome && !playing;
  const clockHours = Math.floor(snapshot.time * 24);
  const clockMinutes = Math.floor((snapshot.time * 24 - clockHours) * 60);
  const clock = `${String(clockHours).padStart(2, '0')}:${String(clockMinutes).padStart(2, '0')}`;
  const night = snapshot.time < 0.25 || snapshot.time > 0.78;
  const quests = getQuests(snapshot.stats);
  const nextQuests = quests.filter(q => !snapshot.stats.completed.includes(q.id)).slice(0, 2);
  const recipe = RECIPES.find(r => r.id === recipeId) || RECIPES[0];
  const canCraft = !!engineRef.current?.canCraft(recipe);
  const allItems = Object.keys(BLOCKS).map(Number).filter(id => id !== 0 && id !== B.WATER && id !== B.BEDROCK && id !== B.TALL_GRASS && id !== B.FLOWER);
  const bagItems = (settings.mode === 'creative' ? allItems : Object.keys(snapshot.inventory).map(Number).filter(id => snapshot.inventory[id] > 0))
    .filter(id => bagCategory === 'Everything' || (bagCategory === 'Building' ? id < 100 : id >= 100));
  const heading = ((-snapshot.yaw * 180 / Math.PI) % 360 + 360) % 360;
  const compassNames = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const compassDirection = compassNames[Math.round(heading / 45) % 8];
  const waypointDistance = waypoint ? Math.round(Math.hypot(snapshot.position[0] - waypoint[0], snapshot.position[2] - waypoint[1])) : 0;
  const waypointAngle = waypoint ? Math.atan2(-(waypoint[0] - snapshot.position[0]), -(waypoint[1] - snapshot.position[2])) - snapshot.yaw : 0;
  const waypointRelative = Math.atan2(Math.sin(waypointAngle), Math.cos(waypointAngle));

  const modalHeader = (eyebrow: string, title: string, icon: React.ReactNode) => <div className="modal-header">
    <div><div className="eyebrow ink-muted">{icon}{eyebrow}</div><h2>{title}</h2></div>
    <button className="close-button" aria-label="Close dialog" title="Close (Esc)" onClick={closeModal} data-autofocus><X size={19} /></button>
  </div>;

  return <div className={`game-app ${isWelcome ? 'is-welcome' : ''} ${modalOpen ? 'has-modal' : ''} ${hideHud ? 'hud-hidden' : ''}`} ref={appRef}>
    <div className="world-viewport" ref={viewportRef} />
    <div className={`world-vignette ${night ? 'is-night' : ''}`} />
    {snapshot.inWater && playing && <div className="underwater-overlay" />}

    <div className="game-hud">
      <header className="topbar">
        <button className="brand-lockup" onClick={() => playing ? openScreen('paused') : modalOpen ? closeModal() : openScreen('worlds')} aria-label="everwild, open world menu">
          <WorldMark size={35} /><span className="brand-type">everwild<span className="brand-dot">.</span></span><span className="brand-divider" /><span className="brand-caption">A LITTLE WORLD.<br />ALL YOURS.</span>
        </button>
        <div className="location-hud">
          {playing ? <>
            <div className="compass"><span>{compassNames[(Math.round(heading / 45) + 7) % 8]}</span><i /><i className="minor" /><b>{compassDirection}</b><i className="minor" /><i /><span>{compassNames[(Math.round(heading / 45) + 1) % 8]}</span>
              {waypoint && <span className="waypoint-needle" style={{ left: `${50 - clamp(waypointRelative / Math.PI * 100, -45, 45)}%` }}>◆</span>}
            </div>
            <div className="location-label">{waypoint ? <><Navigation size={10} /> TRAIL MARKER · {waypointDistance} M</> : <><span className="tiny-dot" />{snapshot.biome}</>}</div>
          </> : <><div className="world-name"><Sprout size={15} />{world.name}</div><span className="location-label">YOUR OWN LITTLE CORNER</span></>}
        </div>
        <div className="topbar-right">
          <div className="day-status">
            {snapshot.weather === 'rain' ? <CloudRain size={26} strokeWidth={1.35} /> : night ? <Moon size={25} strokeWidth={1.35} /> : <Sun size={27} strokeWidth={1.35} />}
            <div><strong>Day {snapshot.day}</strong><span>{clock}<span className="status-dot">·</span>{snapshot.weather === 'rain' ? 'Soft rain' : night ? 'Quiet night' : 'Clear skies'}</span></div>
          </div>
          <span className="topbar-divider" />
          <button className="hud-icon sound-button" aria-label={settings.volume ? 'Mute sound' : 'Enable sound'} title={settings.volume ? 'Mute sound' : 'Enable sound'} onClick={toggleSound}>{settings.volume ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>
          <button className="hud-icon fullscreen-button" aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title="Fullscreen" onClick={toggleFullscreen}>{fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}</button>
          <button className="hud-icon menu-button" aria-label="Open pause menu" title="Pause (Esc)" onClick={() => openScreen('paused')}><Menu size={20} /></button>
        </div>
      </header>

      <section className={`welcome-content ${!isWelcome ? 'welcome-hidden' : ''}`} aria-hidden={!isWelcome}>
        <div className="welcome-eyebrow"><span /> A SMALL ESCAPE. A FRESH BEGINNING.</div>
        <h1>everwild<span>.</span><svg viewBox="0 0 45 45" className="title-spark" aria-hidden="true"><path d="M22 1c0 15-6 21-21 21 15 0 21 6 21 22 0-16 6-22 22-22C28 22 22 16 22 1Z" fill="currentColor" /></svg></h1>
        <h2>A little world. All yours.</h2>
        <p>Follow your curiosity. Find your own pace.<br />Build a place that feels like you.</p>
        <div className="welcome-actions">
          <button className="enter-button" id="enter-world" onClick={() => engineRef.current?.play()} disabled={!snapshot.ready || !!error} tabIndex={isWelcome ? 0 : -1}>
            <span>{snapshot.ready ? 'Enter your world' : 'Growing your world'}</span>{snapshot.ready ? <ArrowUpRight size={20} /> : <span className="loading-spinner" />}
          </button>
          <button className="how-to-button" onClick={() => { setGuideTab('How to play'); openScreen('guide'); }} tabIndex={isWelcome ? 0 : -1}>How to play <ArrowRight size={15} /></button>
        </div>
        <div className="welcome-footnote">{snapshot.ready ? <><span className="tiny-dot" /><span>No hurry. No limits. Just possibility.</span></> : <><span className="growth-track"><span style={{ width: `${Math.max(4, snapshot.loading * 100)}%` }} /></span><span>Planting the last few trees... {Math.round(snapshot.loading * 100)}%</span></>}</div>
      </section>

      {playing && <>
        <aside className="journey-hud">
          <div className="journey-eyebrow"><Feather size={13} /> A LITTLE DIRECTION <span>{snapshot.stats.completed.length}/6</span></div>
          <h3>{nextQuests[0]?.title || 'A world of your own'}</h3>
          {nextQuests.length ? nextQuests.map(q => <div className="mini-quest" key={q.id}><span className="quest-ring" /><span>{q.text}</span><small>{Math.min(q.current, q.goal)}/{q.goal}</small></div>) : <p className="journey-complete">Every trail leads somewhere new.<br />What will you make next?</p>}
          <button onClick={() => { setGuideTab('Your journey'); openScreen('guide'); }}>Open field guide <ArrowUpRight size={13} /></button>
        </aside>
        <div className={`crosshair ${snapshot.target ? 'has-target' : ''}`}><i /><i /><span /></div>
        {snapshot.target && <div className="target-hud"><span>{BLOCKS[snapshot.target.id]?.name}</span>{snapshot.mining > 0 && <div className="mining-track"><div style={{ width: `${Math.min(100, snapshot.mining * 100)}%` }} /></div>}</div>}
        {snapshot.flying && <div className="flight-hud"><Feather size={13} /> Free flight <Key>F</Key></div>}
        {snapshot.air < 9.9 && <div className="air-hud">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < Math.ceil(snapshot.air) ? 'filled' : ''} />)}</div>}
      </>}

      <div className={`bottom-hud ${modalOpen ? 'bottom-hud-dim' : ''}`}>
        <div className="quickbar-topline">
          <div className="health-hud" aria-label={`Health: ${Math.ceil(snapshot.health)} of 20`} title="Your hearts. Eat a wild apple with Q to heal.">
            {Array.from({ length: 10 }, (_, i) => <PixelHeart key={i} filled={Math.max(0, Math.min(1, (snapshot.health - i * 2) / 2))} />)}
          </div>
          <div className="selected-item-name">{BLOCKS[snapshot.hotbar[snapshot.selected]]?.name}</div>
          <div className="stamina-hud" title="Energy. Hold Shift to sprint."><Leaf size={13} /><div><span style={{ width: `${snapshot.stamina}%` }} /></div></div>
        </div>
        <div className="quickbar" role="toolbar" aria-label="Quick access inventory">
          {snapshot.hotbar.map((id, i) => <button key={i} className={`quick-slot ${snapshot.selected === i ? 'selected' : ''} ${!snapshot.inventory[id] && settings.mode !== 'creative' ? 'depleted' : ''}`} title={`${i + 1}: ${BLOCKS[id]?.name} (${settings.mode === 'creative' ? 'unlimited' : snapshot.inventory[id] || 0})`} aria-label={`Slot ${i + 1}: ${BLOCKS[id]?.name}`} aria-pressed={snapshot.selected === i} onClick={() => engineRef.current?.select(i)}>
            <span className="slot-number">{i + 1}</span><ItemIcon id={id} size={43} /><span className="slot-count">{settings.mode === 'creative' ? '∞' : snapshot.inventory[id] || 0}</span>
            {snapshot.selected === i && <span className="slot-indicator" />}
          </button>)}
          <button className="backpack-shortcut" aria-label="Open backpack and crafting" title="Backpack & crafting (E)" onClick={() => openScreen('inventory')}><Package size={22} strokeWidth={1.4} /><span>E</span></button>
        </div>
        <div className="quickbar-caption"><span className="caption-line" />{isWelcome ? 'A FEW THINGS TO GET YOU STARTED' : <><Key>1</Key><span>to</span><Key>9</Key><span> select</span><span className="caption-separator">·</span><span>scroll to switch</span></>}<span className="caption-line" /></div>
      </div>

      <footer className="game-footer">
        <div className="save-status"><span className="save-dot" /><span>{isWelcome ? 'Yours to explore. Yours to keep.' : snapshot.savedAt && Date.now() - snapshot.savedAt < 3000 ? 'World saved. A little peace of mind.' : 'Your world saves automatically.'}</span><span className="footer-seed">SEED {world.seed}</span></div>
        <div className="control-hints">
          {playing && <><span><MousePointer2 size={13} /> break / place</span><span><Key>SPACE</Key> jump</span></>}
          <button onClick={() => openScreen('inventory')}><Key>E</Key> backpack & crafting</button>
          <button onClick={() => { setGuideTab('How to play'); openScreen('guide'); }} aria-label="Open field guide"><CircleHelp size={16} /><span>field guide</span></button>
        </div>
      </footer>
    </div>

    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map(toast => <div className={`game-toast toast-${toast.kind}`} key={toast.id}>
        {toast.item ? <ItemIcon id={toast.item} size={29} /> : toast.kind === 'achievement' ? <Sparkles size={19} /> : toast.kind === 'error' ? <CircleHelp size={18} /> : <Leaf size={18} />}
        <span>{toast.text}</span>
      </div>)}
    </div>

    {playing && <div className="touch-controls">
      <div className="touch-dpad">{[['KeyW', ArrowUp, 'up'], ['KeyA', ArrowLeft, 'left'], ['KeyS', ArrowDown, 'down'], ['KeyD', ArrowRight, 'right']].map(([key, Icon, cls]) => {
        const TouchIcon = Icon as typeof ArrowUp;
        return <button key={key as string} className={`touch-${cls}`} aria-label={`Move ${cls}`} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); engineRef.current?.setKey(key as string, true); }} onPointerUp={() => engineRef.current?.setKey(key as string, false)} onPointerCancel={() => engineRef.current?.setKey(key as string, false)}><TouchIcon size={23} /></button>;
      })}</div>
      <button className="touch-interact" aria-label="Interact with the world" onClick={() => engineRef.current?.touchInteract()}><Sparkles size={18} /><span>Use</span></button>
      {settings.mode === 'creative' && <button className={`touch-flight ${snapshot.flying ? 'active' : ''}`} aria-label="Toggle free flight" onClick={() => engineRef.current?.toggleFlight()}><Feather size={18} /><span>Fly</span></button>}
      {snapshot.flying && <button className="touch-descend" aria-label="Fly down" onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); engineRef.current?.setKey('ShiftLeft', true); }} onPointerUp={() => engineRef.current?.setKey('ShiftLeft', false)} onPointerCancel={() => engineRef.current?.setKey('ShiftLeft', false)}><ArrowDown size={18} /><span>Down</span></button>}
      <div className="touch-actions"><button aria-label="Mine block" onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); engineRef.current?.setMining(true); }} onPointerUp={() => engineRef.current?.setMining(false)} onPointerCancel={() => engineRef.current?.setMining(false)}><Pickaxe size={22} /><span>Mine</span></button><button aria-label="Place block" onClick={() => engineRef.current?.touchPlace()}><Plus size={24} /><span>Place</span></button><button aria-label="Jump" onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); engineRef.current?.setKey('Space', true); }} onPointerUp={() => engineRef.current?.setKey('Space', false)} onPointerCancel={() => engineRef.current?.setKey('Space', false)}><ArrowUp size={23} /><span>Jump</span></button></div>
    </div>}

    {modalOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeModal(); }}>
      <div className={`modal-panel ${screen}-panel`} ref={modalRef} role="dialog" aria-modal="true" aria-label={screen === 'inventory' ? 'Backpack and crafting' : screen === 'guide' ? 'Field guide' : screen === 'settings' ? 'Preferences' : screen === 'worlds' ? 'Your worlds' : 'Game paused'}>

        {screen === 'paused' && <>
          <div className="pause-brand"><WorldMark size={34} /><span>everwild.</span></div>
          <div className="pause-heading"><div className="eyebrow ink-muted">A MOMENT TO YOURSELF</div><h2>Take your time.</h2><p>Your little world will be right here.</p></div>
          <button className="primary-button resume-button" onClick={() => engineRef.current?.play()} data-autofocus>Back to the wild <ArrowUpRight size={19} /></button>
          <div className="pause-links">
            <button onClick={() => openScreen('inventory')}><Package size={19} /><span>Backpack & crafting</span><Key>E</Key></button>
            <button onClick={() => openScreen('guide')}><BookOpen size={19} /><span>Field guide</span><Key>J</Key></button>
            <button onClick={() => openScreen('settings')}><Settings2 size={19} /><span>Make yourself comfortable</span><ChevronRight size={16} /></button>
            <button onClick={() => openScreen('worlds')}><FolderOpen size={19} /><span>Your worlds</span><ChevronRight size={16} /></button>
          </div>
          <div className="pause-secondary"><button onClick={() => { engineRef.current?.respawn(); engineRef.current?.play(); }}><RotateCcw size={14} />Return home</button><button onClick={exportWorld}><Download size={14} />Save & export</button></div>
          <div className="pause-save"><ShieldCheck size={14} /><span>Saved on this device. Safe and sound.</span></div>
        </>}

        {screen === 'inventory' && <>
          {modalHeader('THE THINGS YOU CARRY', 'A place for everything.', <Package size={14} />)}
          <div className="inventory-layout">
            <section className="backpack-section">
              <div className="section-heading"><h3>Your backpack</h3><span>{settings.mode === 'creative' ? 'A world of possibilities' : `${bagItems.length} things worth keeping`}</span></div>
              <div className="small-tabs bag-tabs">{['Everything', 'Building', 'Tools & more'].map(tab => <button key={tab} className={bagCategory === tab ? 'active' : ''} onClick={() => setBagCategory(tab)}>{tab}</button>)}</div>
              <div className="backpack-grid">
                {Array.from({ length: Math.max(30, Math.ceil(bagItems.length / 6) * 6) }, (_, i) => {
                  const id = bagItems[i];
                  return <button key={i} className={`bag-slot ${id === selectedItem ? 'selected' : ''} ${id ? '' : 'empty'}`} disabled={!id} title={id ? `${BLOCKS[id]?.name}: ${snapshot.inventory[id] || 'unlimited'}` : 'Empty slot'} aria-label={id ? `Equip ${BLOCKS[id]?.name}` : 'Empty backpack slot'} onClick={() => { setSelectedItem(id); engineRef.current?.assign(id); }}>
                    {id ? <><ItemIcon id={id} size={45} /><span>{settings.mode === 'creative' ? '∞' : snapshot.inventory[id]}</span>{snapshot.hotbar[snapshot.selected] === id && <i><Check size={10} /></i>}</> : <span className="empty-slot-dot" />}
                  </button>;
                })}
              </div>
              <div className="item-detail"><ItemIcon id={selectedItem} size={44} /><div><h4>{BLOCKS[selectedItem]?.name}</h4><p>{BLOCKS[selectedItem]?.description}</p></div></div>
              <div className="backpack-quick-label"><span>QUICK ACCESS</span><small>Click an item above to equip it in the selected slot.</small></div>
              <div className="mini-quickbar">{snapshot.hotbar.map((id, i) => <button key={i} title={`Select slot ${i + 1}`} aria-label={`Select quick slot ${i + 1}`} className={snapshot.selected === i ? 'selected' : ''} onClick={() => engineRef.current?.select(i)}><span>{i + 1}</span><ItemIcon id={id} size={31} /></button>)}</div>
            </section>
            <section className="crafting-section">
              <div className="section-heading"><h3><Hammer size={17} />Make something.</h3><span>{RECIPES.length} recipes</span></div>
              <div className="small-tabs recipe-tabs">{['All', 'Essentials', 'Tools', 'Building'].map(tab => <button key={tab} className={recipeCategory === tab ? 'active' : ''} onClick={() => setRecipeCategory(tab)}>{tab}</button>)}</div>
              <div className="recipe-grid">{RECIPES.filter(r => recipeCategory === 'All' || r.category === recipeCategory).map(r => <button className={`recipe-option ${recipe.id === r.id ? 'selected' : ''} ${engineRef.current?.canCraft(r) ? 'craftable' : ''}`} key={r.id} onClick={() => setRecipeId(r.id)} aria-pressed={recipe.id === r.id} title={r.description}>
                <ItemIcon id={r.output} size={34} /><span>{r.name}</span>{engineRef.current?.canCraft(r) && <i className="recipe-ready" />}
              </button>)}</div>
              <div className="recipe-detail">
                <div className="recipe-title"><ItemIcon id={recipe.output} size={46} /><div><h3>{recipe.name}<span>×{recipe.count}</span></h3><p>{recipe.description}</p></div></div>
                <div className="ingredient-label">A LITTLE OF THIS</div>
                <div className="ingredients">{recipe.ingredients.map(([id, n]) => <div className={`ingredient ${(snapshot.inventory[id] || 0) >= n || settings.mode === 'creative' ? 'enough' : 'missing'}`} key={id}><ItemIcon id={id} size={26} /><span>{BLOCKS[id].name}</span><strong>{snapshot.inventory[id] || 0}<small>/{n}</small></strong>{(snapshot.inventory[id] || 0) >= n ? <Check size={12} /> : null}</div>)}</div>
                <div className={`station-note ${recipe.station && !engineRef.current?.hasStation(recipe.station) ? 'station-missing' : ''}`}>{recipe.station ? <><Hammer size={13} />{engineRef.current?.hasStation(recipe.station) ? `${BLOCKS[recipe.station].name} ready` : `Needs a ${BLOCKS[recipe.station].name.toLowerCase()} nearby or in your bag`}</> : <><WandSparkles size={13} />Made with your own two hands</>}</div>
                <button className="primary-button craft-button" disabled={!canCraft} onClick={e => engineRef.current?.craft(recipe.id, e.shiftKey ? 5 : 1)}><Hammer size={17} /><span>{canCraft ? `Craft ${recipe.count > 1 ? `${recipe.count} ` : ''}${recipe.name.toLowerCase()}` : 'A few more things to gather'}</span><ArrowRight size={17} /></button>
                <div className="craft-hint">Made items are equipped automatically. Shift-click to craft up to 5 batches.</div>
              </div>
            </section>
          </div>
          <div className="modal-bottomline"><span><Leaf size={13} />Take only what you need. Make something you love.</span><button onClick={closeModal}>Back to your world <Key>E</Key></button></div>
        </>}

        {screen === 'guide' && <>
          {modalHeader('A COMPANION FOR THE CURIOUS', 'The field guide.', <BookOpen size={14} />)}
          <div className="guide-tabs">{[['Your journey', Feather], ['How to play', MousePointer2], ['The local atlas', Map]].map(([label, Icon]) => { const TabIcon = Icon as typeof Feather; return <button key={label as string} className={guideTab === label ? 'active' : ''} onClick={() => setGuideTab(label as string)}><TabIcon size={16} />{label as string}</button>; })}</div>
          {guideTab === 'Your journey' && <div className="journey-content"><div className="guide-intro"><h3>A little curiosity goes a long way.</h3><p>There is no right way to play. Here are a few small beginnings.</p></div><div className="quest-list">{quests.map((q, i) => {
            const complete = snapshot.stats.completed.includes(q.id);
            return <div className={`quest-entry ${complete ? 'complete' : ''}`} key={q.id}><div className="quest-index">{complete ? <Check size={20} /> : String(i + 1).padStart(2, '0')}</div><div className="quest-entry-body"><h4>{q.title}</h4><p>{q.text}</p><div className="quest-progress"><span style={{ width: `${Math.min(1, q.current / q.goal) * 100}%` }} /></div></div><div className="quest-entry-end"><strong>{complete ? 'WELL WANDERED' : `${Math.min(q.current, q.goal)} / ${q.goal}`}</strong><span>{q.reward}</span></div></div>;
          })}</div><div className="journey-summary"><span><Compass size={16} />{Math.floor(snapshot.stats.distance)} m wandered</span><span><Hammer size={16} />{snapshot.stats.placed} blocks placed</span><span><Sprout size={16} />{snapshot.stats.biomes.length} biomes discovered</span></div></div>}
          {guideTab === 'How to play' && <div className="howto-content"><div className="guide-intro"><h3>Start with a little wandering.</h3><p>Click into the world to look around. Press Esc whenever you need a moment.</p></div><div className="control-grid">
            <div><Move size={22} /><section><h4>Find your own path</h4><p><Key>W</Key><Key>A</Key><Key>S</Key><Key>D</Key> to wander, <Key>SPACE</Key> to jump.<br /><Key>SHIFT</Key> to sprint. Hold Space to swim up.</p></section></div>
            <div><MousePointer2 size={22} /><section><h4>Make a little room</h4><p>Hold <strong>left mouse</strong> to break and gather.<br /><strong>Right mouse</strong> to place the selected block.</p></section></div>
            <div><Package size={22} /><section><h4>Keep the good things</h4><p><Key>1</Key> to <Key>9</Key> or scroll to switch items.<br /><Key>E</Key> opens your backpack and recipes.</p></section></div>
            <div><Hammer size={22} /><section><h4>One thing leads to another</h4><p>Logs become planks. Planks become a workbench.<br />Carry a workbench to make better tools.</p></section></div>
            <div><Pickaxe size={22} /><section><h4>Follow a deeper curiosity</h4><p>A pickaxe makes stone and coal easier to gather.<br />Iron needs a stone pickaxe, then a furnace.</p></section></div>
            <div><Heart size={22} /><section><h4>Look after yourself</h4><p>Apples from leaves restore three hearts with <Key>Q</Key>.<br />Deep water and long falls can hurt. Take care.</p></section></div>
            <div><Flame size={22} /><section><h4>Make yourself at home</h4><p>Craft and place a campfire, then look at it and<br />press <Key>R</Key> to set your return point.</p></section></div>
            <div><Feather size={22} /><section><h4>A world without limits</h4><p>Switch to Creative in preferences for unlimited<br />blocks, no damage, and free flight with <Key>F</Key>.</p></section></div>
          </div><div className="gentle-note"><ShieldCheck size={18} /><p>Your world saves on this device every 15 seconds and whenever you pause.<br />Export it from the pause menu for a backup you can take anywhere.</p></div></div>}
          {guideTab === 'The local atlas' && <div className="atlas-content"><div className="atlas-map-wrap"><WorldMap engine={engineRef.current} position={snapshot.position} waypoint={waypoint} onWaypoint={point => { setWaypoint(point); notify({ text: 'Trail marker set. Follow the diamond on your compass.', kind: 'info' }); }} /><span>Click the map to leave a trail marker.</span></div><div className="atlas-copy"><div className="eyebrow ink-muted">A PLACE WORTH GETTING LOST IN</div><h3>{world.name}</h3><p>A winding river, a golden grove, a meadow with no particular plans. There is always a little more beyond the next hill.</p><div className="atlas-location"><Navigation size={16} /><div><strong>{snapshot.biome}</strong><span>X {Math.floor(snapshot.position[0])} &nbsp; Y {Math.floor(snapshot.position[1])} &nbsp; Z {Math.floor(snapshot.position[2])}</span></div></div><div className="biome-key"><span><i style={{ background: '#8ea474' }} />Meadow</span><span><i style={{ background: '#a9ad6d' }} />Golden grove</span><span><i style={{ background: '#658769' }} />Pine woods</span><span><i style={{ background: '#75afb0' }} />Riverlands</span><span><i style={{ background: '#a2ab93' }} />Highlands</span></div>{waypoint && <button className="text-button" onClick={() => setWaypoint(null)}><X size={13} />Clear trail marker · {waypointDistance} m away</button>}<span className="atlas-seed">WORLD SEED / {world.seed}</span></div></div>}
          <div className="modal-bottomline"><span><Sprout size={13} />Go slowly. Look closely.</span><button onClick={closeModal}>Back to the wild <ArrowUpRight size={14} /></button></div>
        </>}

        {screen === 'settings' && <>
          {modalHeader('YOUR WORLD, YOUR WAY', 'Get comfortable.', <Settings2 size={14} />)}
          <div className="settings-content"><div className="settings-group"><div className="setting-label"><h3>A way to wander</h3><p>Choose what feels right. Change it any time.</p></div><div className="mode-switch">{(['explorer', 'creative'] as const).map(mode => <button className={settings.mode === mode ? 'active' : ''} onClick={() => updateSetting('mode', mode)} key={mode}>{mode === 'explorer' ? <Compass size={16} /> : <WandSparkles size={16} />}{mode === 'explorer' ? 'Explorer' : 'Creative'}{settings.mode === mode && <Check size={14} />}</button>)}</div><p className="mode-description">{settings.mode === 'explorer' ? 'Gather resources, craft useful things, and look after your hearts. A gentle adventure.' : 'Unlimited materials, no damage, and room for every idea. Press F to fly.'}</p></div>
            <div className="settings-sliders">{[
              { key: 'volume' as const, label: 'Sounds of the wild', caption: 'Soft footsteps, birdsong, and the things you make.', min: 0, max: 100, value: `${settings.volume}%`, icon: Volume2 },
              { key: 'sensitivity' as const, label: 'Look sensitivity', caption: 'A little slower, or a little more responsive.', min: 5, max: 100, value: `${settings.sensitivity}%`, icon: MousePointer2 },
              { key: 'fov' as const, label: 'Your point of view', caption: 'How much of the world you take in.', min: 55, max: 100, value: `${settings.fov} degrees`, icon: Maximize },
              { key: 'renderDistance' as const, label: 'A view to the horizon', caption: 'A shorter view is kinder to slower devices.', min: 3, max: 7, value: `${settings.renderDistance} chunks`, icon: Compass },
            ].map(setting => <label className="slider-setting" key={setting.key}><setting.icon size={17} /><span><strong>{setting.label}</strong><small>{setting.caption}</small></span><div><output>{setting.value}</output><input type="range" min={setting.min} max={setting.max} value={settings[setting.key]} aria-label={setting.label} onChange={e => updateSetting(setting.key, Number(e.target.value))} style={{ '--range-progress': `${(settings[setting.key] - setting.min) / (setting.max - setting.min) * 100}%` } as React.CSSProperties} /></div></label>)}</div>
            <div className="toggle-settings">{[{ key: 'shadows' as const, title: 'A softer kind of light', text: 'Sunlight and shadows across the landscape.' }, { key: 'autoStep' as const, title: 'Take the little steps', text: 'Automatically step up single-block ledges.' }].map(toggle => <label key={toggle.key}><span><strong>{toggle.title}</strong><small>{toggle.text}</small></span><input type="checkbox" checked={settings[toggle.key]} onChange={e => updateSetting(toggle.key, e.target.checked)} /><i className="toggle-switch" /></label>)}</div>
            <div className="weather-setting"><span><strong>A change in the weather</strong><small>Every kind of day has a little beauty.</small></span><div className="segmented-control">{(['auto', 'clear', 'rain'] as const).map(weather => <button className={settings.weather === weather ? 'active' : ''} onClick={() => updateSetting('weather', weather)} key={weather}>{weather === 'auto' ? 'Natural' : weather === 'clear' ? <><Sun size={13} />Clear</> : <><CloudRain size={13} />Rain</>}</button>)}</div></div>
          </div><div className="modal-bottomline"><button onClick={() => setSettings({ ...DEFAULT_SETTINGS })}><RotateCcw size={12} />Reset preferences</button><button onClick={closeModal}>Just right <Check size={14} /></button></div>
        </>}

        {screen === 'worlds' && <>
          {modalHeader('ROOM FOR ANOTHER BEGINNING', 'Your little worlds.', <FolderOpen size={14} />)}
          <div className="worlds-content"><p className="worlds-intro">Every world is a fresh page. Pick up where you left off, or see what is out there.</p>
            <div className="world-list">{worldList.map((w, i) => <div className={`world-entry ${w.id === world.id ? 'current' : ''}`} key={w.id}>
              <div className={`world-thumbnail variant-${i % 3}`}><WorldMark size={36} /><span /><i /></div><div className="world-entry-copy"><h3>{w.name}{w.id === world.id && <span>HERE NOW</span>}</h3><p>Day {w.day} <span>·</span> {w.seed}</p><small>{w.edits.length} little changes · {new Date(w.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small></div>
              {w.id === world.id ? <Check size={18} className="current-check" /> : <><button className="world-open" title={`Enter ${w.name}`} aria-label={`Enter ${w.name}`} onClick={() => switchWorld(w)}><ArrowUpRight size={20} /></button><button className={`world-delete ${deleteId === w.id ? 'confirm-delete' : ''}`} aria-label={deleteId === w.id ? `Confirm delete ${w.name}` : `Delete ${w.name}`} title={deleteId === w.id ? 'Click again to delete permanently' : 'Delete world'} onClick={() => { if (deleteId === w.id) { deleteWorld(w.id); setWorldList(getWorlds()); setDeleteId(''); } else setDeleteId(w.id); }}>{deleteId === w.id ? <Check size={15} /> : <Trash2 size={15} />}</button></>}
            </div>)}</div>
            {creatingWorld ? <form className="new-world-form" onSubmit={createWorld}><div className="section-heading"><h3>A fresh beginning.</h3><button type="button" className="text-button" onClick={() => setCreatingWorld(false)} aria-label="Cancel new world"><X size={16} /></button></div><div className="world-form-fields"><label>A name for your world<input maxLength={35} value={worldName} onChange={e => setWorldName(e.target.value)} placeholder="Somewhere lovely" autoFocus required /></label><label>A seed of possibility <span>(optional)</span><input maxLength={60} value={worldSeed} onChange={e => setWorldSeed(e.target.value)} placeholder="Leave blank for a surprise" /></label></div><button className="primary-button" type="submit"><Sprout size={16} />Grow a new world<ArrowUpRight size={17} /></button></form> : <button className="new-world-button" onClick={() => { setCreatingWorld(true); setWorldSeed(''); }}><Plus size={20} /><span>Somewhere new to call your own</span><ArrowUpRight size={17} /></button>}
            <div className="world-file-actions"><button onClick={() => importRef.current?.click()}><Upload size={15} />Import a world</button><button onClick={exportWorld}><Download size={15} />Export this world</button></div>
          </div><div className="modal-bottomline"><span><ShieldCheck size={13} />Worlds are stored in this browser. Export to keep a backup.</span><button onClick={closeModal}>Back <ArrowLeft size={13} /></button></div>
        </>}
      </div>
    </div>}
    <input type="file" ref={importRef} accept=".json,application/json" className="sr-only" aria-label="Import world file" onChange={e => void importWorld(e.target.files?.[0])} />
    {hideHud && <button className="show-hud-button" onClick={() => setHideHud(false)}>Show interface <Key>F1</Key></button>}
    {error && <div className="engine-error"><WorldMark size={45} /><h2>A little help getting started.</h2><p>{error}</p><button className="primary-button" onClick={() => window.location.reload()}>Try again <RotateCcw size={16} /></button></div>}
  </div>;
}

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }