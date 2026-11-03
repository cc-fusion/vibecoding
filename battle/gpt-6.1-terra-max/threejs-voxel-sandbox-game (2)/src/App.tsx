import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  CloudRain,
  Compass,
  Heart,
  Leaf,
  MapPin,
  Maximize,
  Moon,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { BLOCK, ITEMS, RECIPES, type Slot } from './game/catalog';
import { GameEngine, initialSnapshot, type GameSnapshot } from './game/GameEngine';

type Panel = 'inventory' | 'help' | 'settings' | 'reset' | null;

function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand-mark ${small ? 'brand-mark-small' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none" shapeRendering="crispEdges">
        <path fill="currentColor" d="M14 5h5v4h4v4h4v5h-4v4h-5v5h-5v-5H8v-4H5v-5h4V9h5V5Z" />
        <path fill="#668754" d="M14 12h4v11h-4zM10 15h4v3h-4zM18 12h4v3h-4z" />
      </svg>
    </span>
  );
}

function BlockIcon({ id, className = '' }: { id: number; className?: string }) {
  const info = ITEMS[id];
  if (!info) return null;
  if (info.kind === 'tool') {
    return (
      <svg className={className} viewBox="0 0 48 48" fill="none" shapeRendering="crispEdges" aria-hidden="true">
        <g transform="rotate(38 24 24)">
          <path d="M22 13h5v29h-5z" fill="#8f643c" />
          <path d="M24 16h3v24h-3z" fill="#bd8b50" />
          <path d="M21 38h6v4h-6z" fill="#68482f" />
          {id === BLOCK.AXE ? (
            <>
              <path d="M13 7h15v5H13zM10 10h16v8H10zM8 13h5v6H8z" fill="#bc9160" />
              <path d="M9 10h5v8H9zM14 7h8v4h-8z" fill="#e0bb83" />
            </>
          ) : (
            <>
              <path d="M9 8h30v5H9zM6 12h6v6H6zM36 12h6v6h-6z" fill="#bc9160" />
              <path d="M10 7h25v4H10zM6 12h4v5H6z" fill="#e0bb83" />
            </>
          )}
        </g>
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" shapeRendering="crispEdges" aria-hidden="true">
      <path d="M24 4 42 13 24 22 6 13 24 4Z" fill={info.top} />
      <path d="M6 13 24 22v21L6 33V13Z" fill={info.left} />
      <path d="M42 13 24 22v21l18-10V13Z" fill={info.right} />
      {id === BLOCK.GRASS && <><path d="m6 13 18 9v5L6 18v-5Z" fill="#6e9f4e" /><path d="m42 13-18 9v5l18-9v-5Z" fill="#85b75b" /><path d="M14 10h3v2h-3zm13 2h3v2h-3z" fill="#b0d584" /></>}
      {id === BLOCK.LOG && <><path d="m11 17 2 1v17l-2-1zm7 4 2 1v17l-2-1zm12 2 2-1v17l-2 1zm7-4 2-1v16l-2 1z" fill="#74502f" opacity=".55" /><path d="m17 12 7-3 7 3-7 4-7-4Z" stroke="#9d764b" strokeWidth="1.5" /></>}
      {(id === BLOCK.PLANKS || id === BLOCK.BRICKS || id === BLOCK.SANDSTONE) && <><path d="m6 20 18 9 18-9M6 27l18 9 18-9" stroke="#6c5b46" strokeWidth="1.5" opacity=".38" /><path d="m16 20 0 5m18-5v5M13 30v5m19-4v5" stroke="#6c5b46" strokeWidth="1.2" opacity=".3" /></>}
      {(id === BLOCK.STONE || id === BLOCK.COBBLE || id === BLOCK.DIRT || id === BLOCK.SAND || id === BLOCK.WOOL || id === BLOCK.LEAVES || id === BLOCK.PINE_LEAVES) && <><path d="m10 20 3 1v2l-3-1zm8 8 3 1v2l-3-1zm-6 2 2 1v2l-2-1zm16-4 3-2v2l-3 2zm7 3 3-2v2l-3 2z" fill="#fff" opacity=".18" /><path d="m12 11 3-1 3 1-3 2zm16-1 3 1-3 2-3-1z" fill="#fff" opacity=".22" /></>}
    </svg>
  );
}

function ItemSlot({ slot, index, selected, onClick, inventory = false, moving = false }: {
  slot: Slot | null;
  index: number;
  selected?: boolean;
  onClick: () => void;
  inventory?: boolean;
  moving?: boolean;
}) {
  return (
    <button
      type="button"
      className={`item-slot ${selected ? 'is-selected' : ''} ${inventory ? 'inventory-slot' : ''} ${moving ? 'is-moving' : ''}`}
      onClick={onClick}
      aria-label={`${slot ? ITEMS[slot.id]?.name : 'Empty slot'}${index < 9 ? `, slot ${index + 1}` : ''}`}
      title={slot ? ITEMS[slot.id]?.name : 'Empty slot'}
    >
      {index < 9 && <span className="slot-number">{index + 1}</span>}
      {slot && <BlockIcon id={slot.id} className="slot-icon" />}
      {slot && ITEMS[slot.id]?.kind !== 'tool' && <span className="slot-count">{slot.count}</span>}
    </button>
  );
}

function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const panelRef = useRef<Panel>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot>(initialSnapshot);
  const [panel, setPanel] = useState<Panel>(null);
  const [movingSlot, setMovingSlot] = useState<number | null>(null);
  const [notesOpen, setNotesOpen] = useState(true);
  const [mobileNotesOpen, setMobileNotesOpen] = useState(false);
  const [fatalError, setFatalError] = useState(false);

  const closePanel = useCallback(() => {
    panelRef.current = null;
    setPanel(null);
    setMovingSlot(null);
    engineRef.current?.setUiOpen(false);
  }, []);

  const openPanel = useCallback((next: Exclude<Panel, null>) => {
    if (panelRef.current === next) {
      closePanel();
      return;
    }
    panelRef.current = next;
    setPanel(next);
    setMovingSlot(null);
    engineRef.current?.setUiOpen(true);
  }, [closePanel]);

  useEffect(() => {
    if (!mountRef.current) return;
    let engine: GameEngine;
    try {
      engine = new GameEngine(mountRef.current, setSnapshot, (requested) => openPanel(requested));
      engineRef.current = engine;
    } catch (error) {
      console.error('Could not start the voxel world:', error);
      setFatalError(true);
      return;
    }
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [openPanel]);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && panelRef.current) {
        event.preventDefault();
        closePanel();
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [closePanel]);

  const startFromPanel = () => {
    const wasStarted = snapshot.started;
    closePanel();
    if (!wasStarted) engineRef.current?.start();
  };

  const moveItem = (index: number) => {
    if (movingSlot === null) setMovingSlot(index);
    else {
      if (movingSlot !== index) engineRef.current?.swapSlots(movingSlot, index);
      setMovingSlot(null);
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };

  const touchKey = (key: string, down: boolean) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (down) event.currentTarget.setPointerCapture(event.pointerId);
    engineRef.current?.setTouchKey(key, down);
  };

  const touchMine = (down: boolean) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (down) event.currentTarget.setPointerCapture(event.pointerId);
    engineRef.current?.setTouchMining(down);
  };

  const selectedSlot = snapshot.inventory[snapshot.selected];
  const selectedName = selectedSlot ? ITEMS[selectedSlot.id]?.name : 'Empty hand';
  const objectives = [
    { title: 'Gather wood', detail: 'Find a tree and hold to collect', value: snapshot.quest.wood, max: 5 },
    { title: 'Craft oak planks', detail: 'Turn logs into something useful', value: snapshot.quest.crafted, max: 4 },
    { title: 'Place a block', detail: 'Start making your mark', value: snapshot.quest.placed, max: 1 },
  ];
  const completeCount = objectives.filter((objective) => objective.value >= objective.max).length;

  return (
    <main className="game-shell">
      <div className="world-mount" ref={mountRef} />
      <div className={`world-shade ${snapshot.playing ? 'is-playing' : ''}`} aria-hidden="true" />
      {snapshot.underwater && <div className="underwater-tint" aria-hidden="true" />}

      <div className="hud">
        <header className="topbar">
          <div className="brand" aria-label="Loam, a little world of your own">
            <BrandMark />
            <div className="brand-copy">
              <div className="brand-name">LOAM<span>.</span></div>
              <div className="brand-subtitle">A LITTLE WORLD OF YOUR OWN</div>
            </div>
          </div>

          <div className="world-status" aria-label={`Day ${snapshot.day}, ${snapshot.time}, ${snapshot.weather}`}>
            <span className="status-sun">{snapshot.weather === 'Rain' ? <CloudRain size={17} /> : snapshot.isNight ? <Moon size={17} /> : <Sun size={17} />}</span>
            <span className="status-day">DAY {String(snapshot.day).padStart(2, '0')}</span>
            <span className="status-divider" />
            <span className="status-time">{snapshot.time}</span>
            <span className="status-weather"><span className="status-dot" />{snapshot.weather === 'Rain' ? 'Light rain' : 'Clear skies'}</span>
          </div>

          <div className="top-actions">
            <button className="icon-button inventory-shortcut" aria-label="Open inventory" title="Inventory (E)" onClick={() => openPanel('inventory')}><BookOpen size={17} /></button>
            <button className="icon-button" aria-label={snapshot.sound ? 'Mute sound' : 'Turn sound on'} title={snapshot.sound ? 'Mute sound' : 'Turn sound on'} onClick={() => engineRef.current?.toggleSound()}>{snapshot.sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
            <button className="icon-button" aria-label="How to play" title="How to play (H)" onClick={() => openPanel('help')}><CircleHelp size={17} /></button>
            <button className="icon-button" aria-label="Settings" title="Settings" onClick={() => openPanel('settings')}><Settings2 size={17} /></button>
            {snapshot.playing && <button className="icon-button pause-button" aria-label="Pause game" title="Pause" onClick={() => engineRef.current?.pause()}><Pause size={16} fill="currentColor" /></button>}
          </div>
        </header>

        {!snapshot.started && !panel && (
          <section className="welcome-copy">
            <div className="eyebrow"><span /> YOUR WORLD IS WAITING</div>
            <h1>Welcome to<br /><em>LOAM.</em></h1>
            <p>A little world to wander, gather,<br className="desktop-break" /> and make your own.</p>
            <div className="welcome-actions">
              <button className="primary-button" disabled={!snapshot.ready} onClick={() => engineRef.current?.start()}>
                <span>{snapshot.ready ? 'Enter world' : 'Growing your world'}</span><ArrowRight size={17} />
              </button>
              <button className="text-button" onClick={() => openPanel('help')}><span className="play-outline"><Play size={10} fill="currentColor" /></span> How to play</button>
            </div>
            <div className="welcome-save"><span className="tiny-sparkle"><Sparkles size={13} /></span> Your world saves as you go</div>
          </section>
        )}

        {snapshot.started && !snapshot.playing && !panel && (
          <section className="welcome-copy pause-copy">
            <div className="eyebrow"><span /> TAKE YOUR TIME</div>
            <h1>World<br /><em>paused.</em></h1>
            <p>Your little world will be right here<br className="desktop-break" /> whenever you're ready.</p>
            <div className="welcome-actions">
              <button className="primary-button" onClick={() => engineRef.current?.start()}><span>Keep exploring</span><ArrowRight size={17} /></button>
              <button className="text-button" onClick={() => openPanel('inventory')}><BookOpen size={15} /> Open inventory</button>
            </div>
            <div className="welcome-save"><span className="tiny-sparkle"><Sparkles size={13} /></span> Your world is saved</div>
          </section>
        )}

        <button className="mobile-notes-button" aria-expanded={mobileNotesOpen} onClick={() => setMobileNotesOpen(!mobileNotesOpen)}><BookOpen size={14} /> FIELD NOTES <span>{completeCount}/3</span></button>
        <aside className={`field-notes ${notesOpen ? '' : 'is-collapsed'} ${mobileNotesOpen ? 'show-mobile' : ''}`}>
          <div className="notes-heading">
            <div className="notes-icon"><BookOpen size={18} /></div>
            <div className="notes-heading-copy"><span>FIELD NOTES</span><small>YOUR FIRST DAY</small></div>
            <button className="notes-toggle" onClick={() => setNotesOpen(!notesOpen)} aria-label={notesOpen ? 'Collapse field notes' : 'Expand field notes'}>{notesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
          </div>
          {notesOpen && <div className="notes-body">
            <div className="notes-title-row"><h2>A good place to begin.</h2><span>{completeCount}/3</span></div>
            <p>Every great adventure starts small.</p>
            <div className="objectives">
              {objectives.map((objective) => {
                const complete = objective.value >= objective.max;
                return <div className={`objective ${complete ? 'objective-complete' : ''}`} key={objective.title}>
                  <span className="objective-check">{complete && <Check size={12} strokeWidth={3} />}</span>
                  <div className="objective-copy"><strong>{objective.title}</strong><small>{objective.detail}</small></div>
                  <span className="objective-count">{objective.value}<i> / </i>{objective.max}</span>
                </div>;
              })}
            </div>
            <button className="notes-link" onClick={() => openPanel('inventory')}><span>OPEN INVENTORY</span><span className="keycap">E</span><ArrowUpRight size={14} /></button>
          </div>}
        </aside>

        {snapshot.playing && <div className="crosshair" aria-hidden="true"><span /><span />{snapshot.breakProgress > 0 && <svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" style={{ strokeDasharray: `${snapshot.breakProgress * 100.53} 100.53` }} /></svg>}</div>}
        {snapshot.playing && snapshot.target && <div className="target-label">{snapshot.target}{snapshot.target === 'Friendly sheep' && <span>CLICK TO GATHER WOOL</span>}</div>}
        {snapshot.toast && <div key={snapshot.toastId} className="game-toast"><Sparkles size={15} />{snapshot.toast}</div>}

        <div className="location-hud">
          <div className="location-title"><span className="location-icon"><MapPin size={14} /></span><span>{snapshot.biome}</span></div>
          <div className="location-coords"><span>YOUR COORDINATES</span><b>{snapshot.coordinates.join('  /  ')}</b></div>
          <div className="health-row" aria-label={`${snapshot.health} out of 10 health`}>
            {Array.from({ length: 5 }, (_, index) => <Heart key={index} size={15} className={snapshot.health > index * 2 ? 'heart-filled' : 'heart-empty'} fill="currentColor" strokeWidth={1.5} />)}
            <span>HEALTH</span>
          </div>
        </div>

        <div className="hotbar-wrap">
          <div className="hotbar-heading"><div><span className="hotbar-kicker">IN YOUR HAND</span><strong>{selectedName}</strong></div><span className="hotbar-scroll">SCROLL TO SWITCH</span></div>
          <div className="hotbar" aria-label="Hotbar">
            {snapshot.inventory.slice(0, 9).map((slot, index) => <ItemSlot key={index} slot={slot} index={index} selected={snapshot.selected === index} onClick={() => engineRef.current?.selectSlot(index)} />)}
          </div>
          <div className="hotbar-hints"><span><b>1</b> - <b>9</b> SELECT</span><span><MousePointer2 size={12} /> HOLD TO BREAK</span><span><MousePointer2 size={12} className="right-mouse" /> RIGHT CLICK TO PLACE</span><span><b>E</b> INVENTORY</span></div>
        </div>

        <div className="corner-note"><span className="corner-note-icon"><Leaf size={15} /></span><span>Made for wandering.<br /><b>And whatever comes next.</b></span></div>

        {snapshot.touch && snapshot.playing && <div className="touch-controls">
          <div className="touch-dpad">
            <button className="touch-up" aria-label="Move forward" onPointerDown={touchKey('KeyW', true)} onPointerUp={touchKey('KeyW', false)} onPointerCancel={touchKey('KeyW', false)}><ArrowUp /></button>
            <button className="touch-left" aria-label="Move left" onPointerDown={touchKey('KeyA', true)} onPointerUp={touchKey('KeyA', false)} onPointerCancel={touchKey('KeyA', false)}><ArrowLeft /></button>
            <button className="touch-down" aria-label="Move backward" onPointerDown={touchKey('KeyS', true)} onPointerUp={touchKey('KeyS', false)} onPointerCancel={touchKey('KeyS', false)}><ArrowDown /></button>
            <button className="touch-right" aria-label="Move right" onPointerDown={touchKey('KeyD', true)} onPointerUp={touchKey('KeyD', false)} onPointerCancel={touchKey('KeyD', false)}><ArrowRight /></button>
          </div>
          <div className="touch-actions">
            <button onPointerDown={touchKey('Space', true)} onPointerUp={touchKey('Space', false)} onPointerCancel={touchKey('Space', false)}>JUMP</button>
            <button onPointerDown={touchMine(true)} onPointerUp={touchMine(false)} onPointerCancel={touchMine(false)}>BREAK</button>
            <button onClick={() => engineRef.current?.touchPlace()}>PLACE</button>
          </div>
        </div>}
      </div>

      {!snapshot.ready && !fatalError && <div className="loading-indicator"><span className="loading-line" /><span>GROWING YOUR WORLD</span></div>}

      {panel && <div className="modal-backdrop" role="presentation">
        <section className={`game-modal ${panel === 'inventory' ? 'inventory-modal' : ''}`} role="dialog" aria-modal="true" aria-label={panel === 'inventory' ? 'Inventory and crafting' : panel === 'help' ? 'How to play' : panel === 'reset' ? 'Start a new world' : 'Settings'}>
          <div className="modal-topline"><div className="modal-brand"><BrandMark small /><span>LOAM <i>/</i> {panel === 'inventory' ? 'YOUR INVENTORY' : panel === 'help' ? 'A LITTLE GUIDANCE' : panel === 'reset' ? 'A FRESH START' : 'SETTINGS'}</span></div><button className="modal-close" onClick={closePanel} aria-label="Close"><X size={19} /></button></div>

          {panel === 'inventory' && <div className="inventory-content">
            <div className="inventory-main">
              <div className="modal-eyebrow">THE THINGS YOU'VE FOUND</div>
              <h2>Your belongings<span>.</span></h2>
              <p>A little bit of this, a little bit of that.</p>
              <div className="inventory-section-label"><span>YOUR HOTBAR</span><small>1 - 9</small></div>
              <div className="inventory-grid">
                {snapshot.inventory.slice(0, 9).map((slot, index) => <ItemSlot key={index} slot={slot} index={index} inventory moving={movingSlot === index} onClick={() => moveItem(index)} />)}
              </div>
              <div className="inventory-section-label bag-label"><span>YOUR BACKPACK</span><small>18 SLOTS</small></div>
              <div className="inventory-grid">
                {snapshot.inventory.slice(9).map((slot, index) => <ItemSlot key={index + 9} slot={slot} index={index + 9} inventory moving={movingSlot === index + 9} onClick={() => moveItem(index + 9)} />)}
              </div>
              <div className="inventory-tip"><Sparkles size={14} /><span>{movingSlot === null ? 'Click two slots to swap their contents.' : 'Now choose a slot to swap with.'}</span></div>
            </div>
            <div className="crafting-panel">
              <div className="crafting-icon"><Sparkles size={19} /></div>
              <div className="modal-eyebrow">MAKE SOMETHING NEW</div>
              <h3>Let's craft.</h3>
              <p>Good things start with what you have.</p>
              <div className="recipe-list">
                {RECIPES.map((recipe) => {
                  const available = recipe.ingredients.every((ingredient) => snapshot.inventory.reduce((total, slot) => total + (slot?.id === ingredient.id ? slot.count : 0), 0) >= ingredient.count);
                  return <div className="recipe" key={recipe.id}>
                    <span className="recipe-icon"><BlockIcon id={recipe.output} /></span>
                    <div className="recipe-copy"><strong>{ITEMS[recipe.output].name} <span>x{recipe.amount}</span></strong><small>{recipe.ingredients.map((ingredient) => `${ingredient.count} ${ITEMS[ingredient.id].name.toLowerCase()}`).join(' + ')}</small></div>
                    <button disabled={!available} onClick={() => engineRef.current?.craft(recipe.id)}>Craft</button>
                  </div>;
                })}
              </div>
              <div className="crafting-footnote"><Leaf size={14} /> Made by you, for your world.</div>
            </div>
          </div>}

          {panel === 'help' && <div className="simple-modal-content help-content">
            <div className="modal-eyebrow">A LITTLE GUIDANCE</div>
            <h2>Find your feet<span>.</span></h2>
            <p>There's no wrong way to play. Here are the little things to get you started.</p>
            <div className="controls-grid">
              {snapshot.touch ? <>
                <div><span className="control-key">DRAG WORLD</span><strong>Look around</strong></div>
                <div><span className="control-key">ARROW BUTTONS</span><strong>Move around</strong></div>
                <div><span className="control-key">HOLD BREAK</span><strong>Gather a block</strong></div>
                <div><span className="control-key">TAP PLACE</span><strong>Place a block</strong></div>
                <div><span className="control-key">JUMP</span><strong>Jump or swim</strong></div>
                <div><span className="control-key">HOTBAR</span><strong>Switch items</strong></div>
                <div><span className="control-key">BOOK BUTTON</span><strong>Inventory + crafting</strong></div>
                <div><span className="control-key">PAUSE BUTTON</span><strong>Pause your world</strong></div>
              </> : <>
                <div><span className="control-key">W A S D</span><strong>Move around</strong></div>
                <div><span className="control-key">MOUSE</span><strong>Look around</strong></div>
                <div><span className="control-key">HOLD LEFT CLICK</span><strong>Gather a block</strong></div>
                <div><span className="control-key">RIGHT CLICK</span><strong>Place a block</strong></div>
                <div><span className="control-key">SPACE / SHIFT</span><strong>Jump / run</strong></div>
                <div><span className="control-key">1 - 9 / SCROLL</span><strong>Switch items</strong></div>
                <div><span className="control-key">E</span><strong>Inventory + crafting</strong></div>
                <div><span className="control-key">ESC</span><strong>Pause your world</strong></div>
              </>}
            </div>
            <div className="help-note"><Compass size={19} /><span>Try gathering wood, crafting planks, and building a little place of your own. Friendly sheep have wool to share, too.</span></div>
            <button className="primary-button modal-primary" onClick={startFromPanel}>{snapshot.started ? 'Back to exploring' : 'Enter world'} <ArrowRight size={17} /></button>
          </div>}

          {panel === 'settings' && <div className="simple-modal-content settings-content">
            <div className="modal-eyebrow">MAKE YOURSELF COMFORTABLE</div>
            <h2>Your world<span>,</span> your way<span>.</span></h2>
            <p>A few little things you can change along the way.</p>
            <div className="setting-list">
              <div className="setting-row"><span className="setting-icon">{snapshot.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</span><span><strong>Sound effects</strong><small>The little sounds of your world</small></span><button className={`switch ${snapshot.sound ? 'switch-on' : ''}`} onClick={() => engineRef.current?.toggleSound()} aria-label="Toggle sound effects" aria-pressed={snapshot.sound}><i /></button></div>
              <div className="setting-row"><span className="setting-icon">{snapshot.weather === 'Rain' ? <CloudRain size={18} /> : <Sun size={18} />}</span><span><strong>Weather</strong><small>Set the mood outside</small></span><button className="setting-choice" onClick={() => engineRef.current?.toggleWeather()}>{snapshot.weather === 'Rain' ? 'Light rain' : 'Clear skies'} <ChevronDown size={14} /></button></div>
              <div className="setting-row"><span className="setting-icon"><Maximize size={18} /></span><span><strong>Fullscreen</strong><small>A little more room to wander</small></span><button className="setting-choice" onClick={toggleFullscreen}>Toggle <ArrowUpRight size={14} /></button></div>
            </div>
            <div className="settings-bottom"><span><Check size={15} /> Your world saves automatically on this device.</span><button onClick={() => { panelRef.current = 'reset'; setPanel('reset'); }}><RotateCcw size={14} /> New world</button></div>
          </div>}

          {panel === 'reset' && <div className="simple-modal-content reset-content">
            <div className="modal-eyebrow">A FRESH START</div>
            <h2>Begin again<span>?</span></h2>
            <p>This will replace your saved world with a newly generated one. Your current blocks, inventory, and progress will be lost.</p>
            <div className="reset-actions"><button className="primary-button" onClick={() => engineRef.current?.newWorld()}>Create new world <ArrowRight size={17} /></button><button className="secondary-button" onClick={() => { panelRef.current = 'settings'; setPanel('settings'); }}>Keep this world</button></div>
          </div>}
        </section>
      </div>}

      {fatalError && <div className="fatal-screen"><BrandMark /><h1>We couldn't grow your world.</h1><p>Loam needs a browser with WebGL enabled. Try updating your browser or enabling hardware acceleration.</p><button className="primary-button" onClick={() => window.location.reload()}>Try again <ArrowRight size={17} /></button></div>}
    </main>
  );
}

export default App;