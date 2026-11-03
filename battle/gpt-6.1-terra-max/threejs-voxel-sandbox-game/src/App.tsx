import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, Check, CloudRain, CloudSun, Heart, Leaf, Mouse, Pause, Play, RotateCcw, Settings2, Sparkles, Sun, Volume2, VolumeX, X } from 'lucide-react';
import { INITIAL_INVENTORY, ITEMS, RECIPES } from './game/blocks';
import { VoxelGame, createNewWorld } from './game/engine';
import { canCraft, countItem } from './game/inventory';
import type { GameSnapshot, ItemStack } from './game/types';

type Panel = 'inventory' | 'guide' | 'settings' | null;
type TouchAction = 'forward' | 'back' | 'left' | 'right' | 'jump' | 'mine' | 'place';

const EMPTY_SNAPSHOT: GameSnapshot = {
  inventory: INITIAL_INVENTORY, selected: 0, health: 10, day: 1, time: '09:21', biome: 'Meadow', weather: 'Clear',
  coordinates: [0, 15, 7], target: '', breaking: 0, stats: { mined: 0, logs: 0, placed: 0, crafted: 0 }, sound: true, saved: true,
};

function Brand() {
  return <div className="brand" aria-label="Wilds, a voxel sandbox">
    <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
    <span className="brand-copy"><strong>WILDS<span>.</span></strong><small>A VOXEL SANDBOX</small></span>
  </div>;
}

function ItemImage({ id, icons, className = '' }: { id: string; icons: Record<string, string>; className?: string }) {
  return icons[id] ? <img className={className} src={icons[id]} alt="" draggable={false} /> : <span className="item-fallback" style={{ background: ITEMS[id]?.color }} />;
}

function Hotbar({ snapshot, icons, onSelect, onInventory }: { snapshot: GameSnapshot; icons: Record<string, string>; onSelect: (index: number) => void; onInventory: () => void }) {
  return <div className="hotbar-wrap">
    <div className="hotbar-caption"><span>YOUR HOTBAR <em>/ 1-9</em></span><button onClick={onInventory}><span className="tiny-key">E</span> OPEN PACK</button></div>
    <div className="hotbar" aria-label="Hotbar">
      {snapshot.inventory.slice(0, 9).map((stack, index) => <button
        key={index}
        className={`hotbar-slot ${snapshot.selected === index ? 'selected' : ''}`}
        aria-label={`Slot ${index + 1}${stack ? `: ${ITEMS[stack.id]?.name}, ${stack.count}` : ': empty'}`}
        title={stack ? ITEMS[stack.id]?.name : 'Empty slot'}
        onClick={() => onSelect(index)}
      >
        <span className="slot-index">{index + 1}</span>
        {stack && <><ItemImage id={stack.id} icons={icons} /><span className="stack-count">{stack.count > 1 ? stack.count : ''}</span></>}
      </button>)}
    </div>
  </div>;
}

function InventorySlot({ index, stack, icons, picked, onClick }: { index: number; stack: ItemStack | null; icons: Record<string, string>; picked: boolean; onClick: () => void }) {
  return <button className={`pack-slot ${picked ? 'picked' : ''}`} onClick={onClick} title={stack ? ITEMS[stack.id]?.name : 'Empty slot'} aria-label={`Slot ${index + 1}${stack ? `: ${ITEMS[stack.id]?.name}, ${stack.count}` : ': empty'}`}>
    {index < 9 && <span className="pack-slot-number">{index + 1}</span>}
    {stack && <><ItemImage id={stack.id} icons={icons} /><span className="pack-count">{stack.count > 1 ? stack.count : ''}</span></>}
  </button>;
}

function InventoryPanel({ snapshot, icons, onClose, onSwap, onCraft, onDiscard }: { snapshot: GameSnapshot; icons: Record<string, string>; onClose: () => void; onSwap: (a: number, b: number) => void; onCraft: (id: string) => void; onDiscard: (index: number) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const choose = (index: number) => {
    if (picked === null) setPicked(index);
    else { if (picked !== index) onSwap(picked, index); setPicked(null); }
  };
  return <div className="dialog inventory-dialog" role="dialog" aria-modal="true" aria-labelledby="inventory-title">
    <div className="dialog-topline"><span><Leaf size={14} /> THE THINGS YOU CARRY</span><button className="close-button" onClick={onClose} aria-label="Close inventory"><X size={19} /></button></div>
    <div className="dialog-heading"><div><h2 id="inventory-title">Your pack<span>.</span></h2><p>A little space for everything you find along the way.</p></div><span className="dialog-number">01 / 02</span></div>
    <div className="inventory-columns">
      <div className="pack-column">
        <div className="section-heading"><span>YOUR PACK</span><small>18 SLOTS</small></div>
        <div className="pack-grid">{snapshot.inventory.slice(9).map((stack, i) => <InventorySlot key={i + 9} index={i + 9} stack={stack} icons={icons} picked={picked === i + 9} onClick={() => choose(i + 9)} />)}</div>
        <div className="section-heading hotbar-section"><span>YOUR HOTBAR</span><small>KEYS 1-9</small></div>
        <div className="pack-grid">{snapshot.inventory.slice(0, 9).map((stack, i) => <InventorySlot key={i} index={i} stack={stack} icons={icons} picked={picked === i} onClick={() => choose(i)} />)}</div>
        <div className="pack-instruction"><span className="instruction-dot" /><span>{picked === null ? 'Select two slots to move or swap items.' : 'Now choose another slot to move your item.'}</span><button disabled={picked === null || !snapshot.inventory[picked]} onClick={() => { if (picked !== null && window.confirm('Discard this entire stack?')) { onDiscard(picked); setPicked(null); } }}>DISCARD</button></div>
        <div className="pack-note"><Sparkles size={17} /><p><strong>Good things start small.</strong><br />Gather resources, make something useful, and see where the day takes you.</p></div>
      </div>
      <div className="craft-column">
        <div className="section-heading"><span>CRAFTING</span><small>MAKE ANYWHERE</small></div>
        <p className="craft-intro">Make something with what you have.</p>
        <div className="recipe-list">
          {RECIPES.map(recipe => {
            const available = canCraft(snapshot.inventory, recipe.id);
            return <div className="recipe" key={recipe.id}>
              <span className="recipe-icon"><ItemImage id={recipe.output} icons={icons} /></span>
              <span className="recipe-copy"><strong>{ITEMS[recipe.output].name}</strong><small>{recipe.ingredients.map(ingredient => `${ingredient.count} ${ITEMS[ingredient.id].name.toLowerCase()}`).join(' + ')}</small></span>
              <button className="craft-button" disabled={!available} onClick={() => onCraft(recipe.id)} aria-label={`Craft ${recipe.count} ${ITEMS[recipe.output].name}`}>CRAFT <span>+{recipe.count}</span></button>
            </div>;
          })}
        </div>
        <p className="craft-footnote">Recipes use items from anywhere in your pack.</p>
      </div>
    </div>
    <div className="dialog-footer"><span><span className="status-dot" /> YOUR WORLD SAVES AUTOMATICALLY</span><button onClick={onClose}>BACK TO WORLD <ArrowRight size={14} /></button></div>
  </div>;
}

function GuidePanel({ onClose, touchMode }: { onClose: () => void; touchMode: boolean }) {
  const controls = touchMode ? [
    ['MOVE', 'Use the arrows'], ['LOOK AROUND', 'Drag the world'], ['JUMP / SWIM', 'Tap jump'],
    ['GATHER', 'Hold mine'], ['PLACE A BLOCK', 'Tap place'], ['YOUR PACK', 'Tap the pack button'],
  ] : [
    ['MOVE', 'W  A  S  D'], ['LOOK AROUND', 'Move mouse'], ['JUMP / SWIM', 'Space'],
    ['GATHER BLOCKS', 'Hold left click'], ['PLACE A BLOCK', 'Right click'], ['PACK & CRAFTING', 'E'],
    ['CHANGE HOTBAR', '1 - 9 / Scroll'], ['PAUSE', 'Esc / P'],
  ];
  return <div className="dialog guide-dialog" role="dialog" aria-modal="true" aria-labelledby="guide-title">
    <div className="dialog-topline"><span><BookOpen size={14} /> A LITTLE FIELD GUIDE</span><button className="close-button" onClick={onClose} aria-label="Close guide"><X size={19} /></button></div>
    <div className="dialog-heading"><div><h2 id="guide-title">Find your way<span>.</span></h2><p>Everything you need to feel at home out here.</p></div><span className="dialog-number">THE BASICS</span></div>
    <div className="guide-columns">
      <div><div className="section-heading"><span>GETTING AROUND</span><small>CONTROLS</small></div><div className="controls-list">{controls.map(([label, key]) => <div key={label}><span>{label}</span><strong>{key}</strong></div>)}</div></div>
      <div className="guide-notes"><div className="section-heading"><span>GOOD TO KNOW</span><small>FIELD NOTES</small></div>
        <article><span>01</span><div><h3>Gather a little.</h3><p>Hold to break blocks and collect what you find. A pickaxe makes quick work of stone.</p></div></article>
        <article><span>02</span><div><h3>Make it yours.</h3><p>Open your pack to craft, then choose a block from your hotbar and place it in the world.</p></div></article>
        <article><span>03</span><div><h3>Stay a while.</h3><p>Days pass, weather changes, and your world is saved on this device as you explore.</p></div></article>
      </div>
    </div>
    <div className="dialog-footer"><span><span className="status-dot" /> THERE IS NO WRONG WAY TO EXPLORE</span><button onClick={onClose}>GOT IT <ArrowRight size={14} /></button></div>
  </div>;
}

function SettingsPanel({ snapshot, onClose, onSound, onWeather, onSave, onReset }: { snapshot: GameSnapshot; onClose: () => void; onSound: () => void; onWeather: () => void; onSave: () => void; onReset: () => void }) {
  return <div className="dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <div className="dialog-topline"><span><Settings2 size={14} /> MAKE YOURSELF COMFORTABLE</span><button className="close-button" onClick={onClose} aria-label="Close settings"><X size={19} /></button></div>
    <div className="dialog-heading"><div><h2 id="settings-title">The little things<span>.</span></h2><p>A few ways to make this world feel like yours.</p></div></div>
    <div className="settings-list">
      <div className="settings-row"><div><strong>Sound effects</strong><p>Little sounds for your adventures.</p></div><button className="setting-action" onClick={onSound}>{snapshot.sound ? <Volume2 size={16} /> : <VolumeX size={16} />}{snapshot.sound ? 'ON' : 'OFF'}</button></div>
      <div className="settings-row"><div><strong>Weather</strong><p>Bring a little change to the skies.</p></div><button className="setting-action" onClick={onWeather}>{snapshot.weather === 'Clear' ? <Sun size={16} /> : <CloudRain size={16} />}{snapshot.weather.toUpperCase()}</button></div>
      <div className="settings-row"><div><strong>Save this world</strong><p>Your progress also saves automatically.</p></div><button className="setting-action" onClick={onSave}><Check size={16} /> SAVE NOW</button></div>
      <div className="settings-row danger-row"><div><strong>Start a new world</strong><p>This will replace the world on this device.</p></div><button className="setting-action" onClick={onReset}><RotateCcw size={15} /> NEW WORLD</button></div>
    </div>
    <div className="dialog-footer"><span><span className="status-dot" /> SAVED LOCALLY ON THIS DEVICE</span><button onClick={onClose}>ALL DONE <ArrowRight size={14} /></button></div>
  </div>;
}

function TouchButton({ action, children, onControl, className = '' }: { action: TouchAction; children: ReactNode; onControl: (action: TouchAction, down: boolean) => void; className?: string }) {
  const down = (event: ReactPointerEvent<HTMLButtonElement>) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onControl(action, true); };
  const up = (event: ReactPointerEvent<HTMLButtonElement>) => { event.preventDefault(); onControl(action, false); };
  return <button className={className} onPointerDown={down} onPointerUp={up} onPointerCancel={up} aria-label={action}>{children}</button>;
}

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<VoxelGame | null>(null);
  const panelRef = useRef<Panel>(null);
  const lockedRef = useRef(false);
  const resumeAfterPanel = useRef(false);
  const toastTimer = useRef<number | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot>(EMPTY_SNAPSHOT);
  const [icons, setIcons] = useState<Record<string, string>>({});
  const [locked, setLocked] = useState(false);
  const [entered, setEntered] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [ready, setReady] = useState(false);
  const [touchMode, setTouchMode] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ title: string; detail: string; id: number } | null>(null);
  const [hadSave] = useState(() => { try { return !localStorage.getItem('wilds-next-seed') && !!localStorage.getItem('wilds-sandbox-world-v1'); } catch { return false; } });

  const showToast = (title: string, detail: string) => {
    setToast({ title, detail, id: Date.now() });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  };

  useEffect(() => {
    if (!hostRef.current) return;
    let game: VoxelGame | null = null;
    try {
      game = new VoxelGame(hostRef.current, {
        onSnapshot: setSnapshot,
        onLockChange: isLocked => {
          lockedRef.current = isLocked; setLocked(isLocked);
          if (isLocked) { setEntered(true); panelRef.current = null; setPanel(null); }
        },
        onInventory: () => {
          if (panelRef.current === 'inventory') {
            panelRef.current = null; setPanel(null);
            if (resumeAfterPanel.current) gameRef.current?.lock();
          } else if (!panelRef.current) {
            resumeAfterPanel.current = lockedRef.current;
            panelRef.current = 'inventory'; setPanel('inventory'); gameRef.current?.unlock();
          }
        },
        onToast: showToast,
        onReady: () => setReady(true),
      });
      gameRef.current = game; setIcons(game.icons); setTouchMode(game.touchMode);
    } catch (cause) {
      console.error(cause); setError('This browser could not start the 3D world. Please enable WebGL and try again.'); setReady(true);
    }
    return () => {
      game?.dispose(); gameRef.current = null;
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && panelRef.current) {
        panelRef.current = null; setPanel(null); resumeAfterPanel.current = false;
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, []);

  const openPanel = (next: Exclude<Panel, null>) => {
    resumeAfterPanel.current = lockedRef.current;
    panelRef.current = next; setPanel(next); gameRef.current?.unlock();
  };
  const closePanel = () => {
    const resume = resumeAfterPanel.current;
    panelRef.current = null; setPanel(null); resumeAfterPanel.current = false;
    if (resume) gameRef.current?.lock();
  };
  const selectedItem = snapshot.inventory[snapshot.selected];
  const objective = snapshot.stats.logs === 0
    ? ['A GOOD PLACE TO START', 'Gather your first log', 'Find a tree and hold to gather wood.']
    : snapshot.stats.crafted === 0
      ? ['A LITTLE INSPIRATION', 'Make something useful', 'Open your pack and craft some planks.']
      : snapshot.stats.placed < 5
        ? ['MAKE YOUR MARK', 'Place a few blocks', 'Choose a block and start building.']
        : ['THE WORLD IS YOURS', 'See where the day takes you', 'There is always something new to find.'];
  const weatherIcon = snapshot.weather === 'Rain' ? <CloudRain size={20} strokeWidth={1.5} /> : <Sun size={21} strokeWidth={1.5} />;
  const playTitle = entered ? <>Take a little<br /><em>breather.</em></> : hadSave ? <>Welcome back<br /><em>to the wild.</em></> : <>Welcome to<br /><em>WILDS.</em></>;

  return <main className={`game-shell ${locked ? 'is-playing' : 'is-paused'}`}>
    <div className="world-host" ref={hostRef} />
    <div className="screen-shade" />
    <div className="screen-grain" />
    <header className="hud-header">
      <Brand />
      <div className="world-location"><span className="location-diamond" /><span>WORLD 01</span><i /><strong>THE {snapshot.biome.toUpperCase()}</strong></div>
      <div className="header-actions">
        <div className="day-display">{weatherIcon}<span><strong>DAY {String(snapshot.day).padStart(2, '0')}</strong><small>{snapshot.time} <b>/</b> {snapshot.weather.toUpperCase()}</small></span></div>
        <span className="header-rule" />
        <button className="header-button" onClick={() => openPanel('guide')} aria-label="Open field guide" title="Field guide"><BookOpen size={18} strokeWidth={1.6} /></button>
        <button className="header-button sound-button" onClick={() => gameRef.current?.toggleSound()} aria-label={snapshot.sound ? 'Mute sound' : 'Enable sound'} title="Toggle sound">{snapshot.sound ? <Volume2 size={18} strokeWidth={1.6} /> : <VolumeX size={18} strokeWidth={1.6} />}</button>
        <button className="header-button" onClick={() => openPanel('settings')} aria-label="Open settings" title="Settings"><Settings2 size={18} strokeWidth={1.6} /></button>
        {touchMode && locked && <button className="header-button" onClick={() => gameRef.current?.unlock()} aria-label="Pause game"><Pause size={18} /></button>}
      </div>
    </header>

    {!locked && !panel && !error && <section className="welcome" key={entered ? 'paused' : 'welcome'}>
      <div className="welcome-eyebrow"><span className="eyebrow-line" /> {entered ? 'TAKE YOUR TIME' : 'A LITTLE WORLD OF YOUR OWN'} <span className="eyebrow-number">/ 01</span></div>
      <h1>{playTitle}</h1>
      <p>{entered ? 'Your little world is right where you left it.' : 'A little world to explore, create, and make entirely your own.'}</p>
      <div className="welcome-actions"><button className="play-button" onClick={() => gameRef.current?.lock()} disabled={!ready}><span className="play-icon"><Play size={12} fill="currentColor" /></span>{entered || hadSave ? 'CONTINUE EXPLORING' : 'ENTER THE WORLD'}<ArrowRight className="play-arrow" size={17} /></button></div>
      <div className="save-note"><span className="status-dot" /> YOUR WORLD SAVES AUTOMATICALLY <span className="save-note-line" /></div>
    </section>}

    {locked && !panel && <>
      <div className="objective"><div className="objective-kicker"><span className="objective-icon"><Leaf size={14} /></span> FIELD NOTES <span>/ 01</span></div><div className="objective-rule" /><small>{objective[0]}</small><strong>{objective[1]}</strong><p>{objective[2]}</p></div>
      <div className="crosshair" aria-hidden="true"><span /><i />{snapshot.breaking > 0 && <b style={{ '--progress': `${Math.min(100, snapshot.breaking * 100)}%` } as CSSProperties} />}</div>
      {snapshot.target && <div className="target-name">{snapshot.target}</div>}
      <div className="player-info"><div className="health" aria-label={`${snapshot.health} of 10 health`}>{Array.from({ length: 5 }, (_, i) => <Heart key={i} size={16} fill={snapshot.health > i * 2 ? 'currentColor' : 'transparent'} className={snapshot.health > i * 2 ? '' : 'empty-heart'} />)}</div><span>{snapshot.coordinates.join(' / ')}</span></div>
    </>}

    {!panel && <>
      <div className="bottom-left"><span className="bottom-left-line" /><div><small>{locked ? 'IN YOUR HAND' : 'A WORLD OF YOUR OWN'}</small><strong>{locked ? selectedItem ? ITEMS[selectedItem.id]?.name : 'Empty hand' : 'Made for wandering.'}</strong></div></div>
      <Hotbar snapshot={snapshot} icons={icons} onSelect={index => gameRef.current?.select(index)} onInventory={() => openPanel('inventory')} />
      <div className="bottom-right"><span className="control-title">A FEW LITTLE CONTROLS</span>{touchMode ? <span>DRAG TO LOOK <i /> USE BUTTONS TO MOVE</span> : <><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> MOVE <i /> <kbd>SPACE</kbd> JUMP</span><span><Mouse size={13} /> HOLD TO GATHER <i /> RIGHT CLICK TO PLACE</span></>}</div>
      {locked && !touchMode && <div className="escape-hint"><kbd>ESC</kbd> / <kbd>P</kbd> TO PAUSE</div>}
    </>}

    {locked && touchMode && !panel && <div className="touch-controls">
      <div className="touch-dpad"><TouchButton action="forward" onControl={(a, d) => gameRef.current?.touchControl(a, d)}><ArrowUp /></TouchButton><TouchButton action="left" onControl={(a, d) => gameRef.current?.touchControl(a, d)}><ArrowLeft /></TouchButton><TouchButton action="back" onControl={(a, d) => gameRef.current?.touchControl(a, d)}><ArrowDown /></TouchButton><TouchButton action="right" onControl={(a, d) => gameRef.current?.touchControl(a, d)}><ArrowRight /></TouchButton></div>
      <div className="touch-actions"><TouchButton action="jump" onControl={(a, d) => gameRef.current?.touchControl(a, d)}>JUMP</TouchButton><TouchButton action="mine" onControl={(a, d) => gameRef.current?.touchControl(a, d)}>MINE</TouchButton><TouchButton action="place" onControl={(a, d) => gameRef.current?.touchControl(a, d)}>PLACE</TouchButton></div>
    </div>}

    {toast && !panel && <div className="toast" key={toast.id}><span className="toast-icon"><Sparkles size={18} /></span><div><small>FIELD NOTE</small><strong>{toast.title}</strong><p>{toast.detail}</p></div></div>}

    {panel && <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closePanel(); }}>
      {panel === 'inventory' && <InventoryPanel snapshot={snapshot} icons={icons} onClose={closePanel} onSwap={(a, b) => gameRef.current?.swapSlots(a, b)} onCraft={id => gameRef.current?.craft(id)} onDiscard={index => gameRef.current?.discardSlot(index)} />}
      {panel === 'guide' && <GuidePanel onClose={closePanel} touchMode={touchMode} />}
      {panel === 'settings' && <SettingsPanel snapshot={snapshot} onClose={closePanel} onSound={() => gameRef.current?.toggleSound()} onWeather={() => gameRef.current?.toggleWeather()} onSave={() => { gameRef.current?.save(); showToast('All tucked away', 'Your world has been saved on this device.'); }} onReset={() => { if (window.confirm('Start a new world? Your current world on this device will be replaced.')) createNewWorld(); }} />}
    </div>}

    {!ready && !error && <div className="loading-screen"><Brand /><div><span>MAKING A LITTLE WORLD FOR YOU</span><strong>Growing the wilds<span>.</span></strong><div className="loading-line"><i /></div></div></div>}
    {error && <div className="error-screen"><CloudSun size={32} /><h2>A little trouble in the wild.</h2><p>{error}</p><button onClick={() => window.location.reload()}>TRY AGAIN <ArrowRight size={16} /></button></div>}
    <span className="sr-only">{countItem(snapshot.inventory, 'log')} logs in your pack</span>
  </main>;
}