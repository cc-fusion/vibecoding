import { useEffect, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Backpack, Check,
  ChevronDown, CircleHelp, CloudRain, Compass, Expand, Hammer, Heart, Keyboard,
  MapPin, Menu, Moon, MousePointer2, Move, RotateCcw, Save, Sparkles, Sun, Volume2,
  VolumeX, X,
} from 'lucide-react'
import { Game, countItem, recipeAvailable, type GameState } from './game/Game'
import { ITEMS, RECIPES, type ItemId, type Slot } from './game/blocks'

type Overlay = 'inventory' | 'menu' | null

function BrandMark() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className="brand-mark">
      <path d="M20 2 36 10.5v18L20 38 4 28.5v-18Z" fill="#f2e9c8" />
      <path d="m20 5 12.7 6.7L20 18.5 7.3 11.7Z" fill="#a8c780" />
      <path d="M7.3 14.3 18.6 20.5v13.8L7.3 27.7Z" fill="#b98958" />
      <path d="m21.4 20.5 11.3-6.2v13.4l-11.3 6.6Z" fill="#d4a873" />
      <path d="M9 10.8h4V9h4v2h4v2h4v2h-6v2h-4v-2h-4v-2H9Z" fill="#d2df9e" opacity=".7" />
    </svg>
  )
}

function ItemIcon({ id, className = '' }: { id: ItemId; className?: string }) {
  const item = ITEMS[id]
  if (item.tool) {
    const head = item.tool === 'axe'
      ? 'M10 7h15v5h-3v5h-5v5h-6v-5H7v-6h3z'
      : 'M5 11h5V7h20v4h6v5h-7v-4H18v4h-6v4H7v-4H5z'
    return (
      <svg viewBox="0 0 42 42" className={`item-icon ${className}`} aria-hidden="true" shapeRendering="crispEdges">
        <path d="M28 16h5v5h-4v5h-4v5h-4v5h-6v-5h4v-5h4v-5h5z" fill="#6d492e" />
        <path d="M29 17h3v4h-4v5h-4v5h-4v4h-3v-4h4v-5h4v-5h4z" fill="#b88855" />
        <path d={head} fill={item.tool === 'axe' ? '#735235' : '#6c6957'} stroke="#514d3e" strokeWidth="1" />
        <path d={head} fill={item.color} transform="translate(-1 -1)" />
        <path d={item.tool === 'axe' ? 'M11 8h12v3H11z' : 'M10 8h19v3H10z'} fill="#e2c398" opacity=".75" />
      </svg>
    )
  }
  if (id === 'flower') {
    return (
      <svg viewBox="0 0 42 42" className={`item-icon ${className}`} aria-hidden="true" shapeRendering="crispEdges">
        <path d="M20 17h4v20h-4zM13 25h8v4h-8zM24 28h7v4h-7z" fill="#5a9a51" />
        <path d="M16 5h10v5h5v9h-5v5H16v-5h-5v-9h5z" fill="#fff8df" />
        <path d="M18 11h7v7h-7z" fill="#e5bd53" />
      </svg>
    )
  }
  if (id === 'stick' || id === 'coal' || id === 'iron_ingot') {
    return (
      <svg viewBox="0 0 42 42" className={`item-icon ${className}`} aria-hidden="true" shapeRendering="crispEdges">
        {id === 'stick' ? <path d="M27 5h6v7h-4v6h-4v6h-4v6h-4v7h-7v-7h4v-6h4v-6h4v-6h5z" fill="#a9794e" stroke="#6d4c32" strokeWidth="2" /> : id === 'coal' ? <path d="M12 9h16l6 7v13l-8 6H13l-6-7V17z" fill="#3c4741" stroke="#29332f" strokeWidth="2" /> : <><path d="m10 16 7-7h17l-5 7-3 13H7z" fill="#aebdb4" stroke="#74867d" strokeWidth="2" /><path d="m10 16 7-7h17l-6 7z" fill="#e1e9df" /></>}
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 48 48" className={`item-icon ${className}`} aria-hidden="true" shapeRendering="crispEdges">
      <path d="M24 4 42 13.5v20L24 44 6 33.5v-20Z" fill="#252d27" opacity=".3" transform="translate(0 2)" />
      <path d="M24 3 42 12.5 24 22 6 12.5Z" fill={item.top || item.color} />
      <path d="M6 12.5 24 22v21L6 33.5Z" fill={item.side || item.color} />
      <path d="M24 22 42 12.5v21L24 43Z" fill={item.color} />
      <path d="m9 15 5 3v3l-5-3zm8 5 4 2v3l-4-2zm-8 6 5 3v3l-5-3zm9 4 4 2v3l-4-2z" fill="#fff" opacity=".12" />
      <path d="m28 23 5-3v3l-5 3zm8-5 4-2v3l-4 2zm-8 14 4-2v3l-4 2zm7-5 5-3v3l-5 3z" fill="#29251e" opacity=".12" />
      <path d="m14 11 6-3 5 3-6 3zm13 3 5-3 5 3-5 3z" fill="#fff" opacity=".14" />
      {id === 'log' && <path d="m15 12 9-5 9 5-9 5z" fill="none" stroke="#92724d" strokeWidth="1.5" />}
      {id === 'planks' && <path d="m6 20 18 9 18-9M6 27l18 9 18-9" fill="none" stroke="#755538" strokeWidth="1" opacity=".5" />}
      {id === 'crafting_table' && <path d="m15 11 18 9M33 11l-18 9" stroke="#795638" strokeWidth="2" />}
      {id === 'furnace' && <path d="m9 21 11 6v7L9 28z" fill="#394941" />}
    </svg>
  )
}

function HotbarSlot({ slot, index, selected, onClick }: { slot: Slot | null; index: number; selected: boolean; onClick: () => void }) {
  return (
    <button className={`hotbar-slot ${selected ? 'selected' : ''}`} onClick={onClick} aria-label={`Slot ${index + 1}${slot ? `: ${ITEMS[slot.id].name}, ${slot.count}` : ': empty'}`} title={slot ? ITEMS[slot.id].name : 'Empty slot'}>
      <span className="slot-number">{index + 1}</span>
      {slot && <ItemIcon id={slot.id} />}
      {slot && slot.count > 1 && <span className="slot-count">{slot.count}</span>}
    </button>
  )
}

function Guide({ state, open, onToggle }: { state: GameState; open: boolean; onToggle: () => void }) {
  const firstChapterComplete = state.progress.walked && state.progress.logs >= 3 && state.progress.crafted
  const firstSteps = [
    { done: state.progress.walked, title: 'Find your footing', detail: 'Move around with W, A, S, D' },
    { done: state.progress.logs >= 3, title: 'Gather some wood', detail: `Hold left click on a tree  /  ${Math.min(state.progress.logs, 3)}/3` },
    { done: state.progress.crafted, title: 'Make something', detail: 'Press E to open crafting' },
  ]
  const nextSteps = [
    { done: state.progress.tablePlaced, title: 'Set up a workshop', detail: 'Craft and place a crafting table' },
    { done: state.progress.stoneCrafted, title: 'A sturdier pickaxe', detail: 'Craft a stone pickaxe at your table' },
    { done: state.progress.ironSmelted, title: 'Smelt your first iron', detail: 'Use iron ore and coal at a furnace' },
  ]
  const steps = firstChapterComplete ? nextSteps : firstSteps
  const completed = steps.filter((step) => step.done).length
  return (
    <aside className={`guide ${open ? '' : 'guide-collapsed'}`}>
      <button className="guide-heading" onClick={onToggle} aria-expanded={open}>
        <span><Compass size={15} strokeWidth={1.8} /> FIELD GUIDE <span className="guide-edition">/ {firstChapterComplete ? '02' : '01'}</span></span>
        <ChevronDown size={15} className="guide-chevron" />
      </button>
      {open && <div className="guide-content">
        <div className="guide-kicker">{firstChapterComplete ? 'KEEP THE ADVENTURE GOING' : 'A GOOD PLACE TO START'}</div>
        <h2>{firstChapterComplete ? 'Make it yours' : 'Your first day'}<span>.</span></h2>
        <p>{firstChapterComplete ? 'There is always more to make and discover.' : 'A little guidance for your big adventure.'}</p>
        <div className="guide-steps">
          {steps.map((step, index) => <div className={`guide-step ${step.done ? 'complete' : ''}`} key={step.title}>
            <span className="step-number">{step.done ? <Check size={13} strokeWidth={2.5} /> : `0${index + 1}`}</span>
            <span className="step-copy"><strong>{step.title}</strong><small>{step.detail}</small></span>
          </div>)}
        </div>
        <div className="guide-progress"><span>YOUR PROGRESS</span><span>{completed} / 3</span></div>
        <div className="progress-track"><span style={{ width: `${completed / 3 * 100}%` }} /></div>
      </div>}
    </aside>
  )
}

function Inventory({ state, game, onClose }: { state: GameState; game: Game; onClose: () => void }) {
  const selectedSlot = state.inventory[state.selected]
  const onDragStart = (event: DragEvent<HTMLButtonElement>, index: number) => {
    event.dataTransfer.setData('text/plain', String(index))
    event.dataTransfer.effectAllowed = 'move'
  }
  const onDrop = (event: DragEvent<HTMLButtonElement>, index: number) => {
    event.preventDefault()
    const from = Number(event.dataTransfer.getData('text/plain'))
    if (Number.isInteger(from)) game.swapSlots(from, index)
  }
  const renderSlot = (slot: Slot | null, index: number) => (
    <button
      className={`inventory-slot ${index === state.selected ? 'inventory-slot-selected' : ''}`}
      key={index}
      draggable={!!slot}
      onDragStart={(event) => onDragStart(event, index)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => onDrop(event, index)}
      onClick={() => index < 9 ? game.select(index) : game.swapSlots(index, state.selected)}
      aria-label={`${index < 9 ? `Hotbar slot ${index + 1}` : `Backpack slot ${index - 8}`}: ${slot ? `${ITEMS[slot.id].name}, ${slot.count}` : 'empty'}`}
      title={slot ? ITEMS[slot.id].name : 'Empty slot'}
    >
      {index < 9 && <span className="inventory-slot-number">{index + 1}</span>}
      {slot && <ItemIcon id={slot.id} />}
      {slot && slot.count > 1 && <span className="slot-count">{slot.count}</span>}
    </button>
  )
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="inventory-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-title">
        <div className="modal-header">
          <div><div className="modal-eyebrow"><Backpack size={15} /> YOUR ADVENTURE KIT</div><h2 id="inventory-title">Pack &amp; craft<span>.</span></h2></div>
          <button className="modal-close" onClick={onClose} aria-label="Close inventory"><X size={19} /></button>
        </div>
        <div className="inventory-layout">
          <div className="inventory-main">
            <div className="section-label"><span>YOUR HOTBAR</span><span>1 - 9</span></div>
            <div className="inventory-grid">{state.inventory.slice(0, 9).map((slot, i) => renderSlot(slot, i))}</div>
            <div className="section-label backpack-label"><span>YOUR BACKPACK</span><span>18 SLOTS</span></div>
            <div className="inventory-grid">{state.inventory.slice(9, 27).map((slot, i) => renderSlot(slot, i + 9))}</div>
            <div className="inventory-tip"><Move size={15} /><span>Drag items to rearrange, or select a hotbar slot and tap a backpack item to swap.</span></div>
            <div className="selected-detail">
              <div className="selected-detail-icon">{selectedSlot ? <ItemIcon id={selectedSlot.id} /> : <span>+</span>}</div>
              <div><small>SELECTED IN HOTBAR</small><strong>{selectedSlot ? ITEMS[selectedSlot.id].name : 'Empty slot'}</strong><p>{selectedSlot ? (ITEMS[selectedSlot.id].tool ? 'Ready for your next expedition.' : ITEMS[selectedSlot.id].block ? 'Select and right click to place.' : 'A useful crafting ingredient.') : 'Choose something to take along.'}</p></div>
            </div>
          </div>
          <div className="crafting-main">
            <div className="crafting-heading"><div><div className="section-label">CRAFTING &amp; SMELTING</div><h3>Make something good.</h3></div><Hammer size={19} /></div>
            <p className="crafting-intro">Make the basics anywhere. Workstations unlock more.</p>
            <div className="workstation-status"><span className={state.workstations.table || state.workstations.furnace ? 'active' : ''} />{state.workstations.table && state.workstations.furnace ? 'TABLE & FURNACE NEARBY' : state.workstations.table ? 'CRAFTING TABLE NEARBY' : state.workstations.furnace ? 'FURNACE NEARBY' : 'PLACE A TABLE TO UNLOCK TOOLS'}</div>
            <div className="recipe-list">
              {RECIPES.map((recipe) => {
                const available = recipeAvailable(state.inventory, recipe.id, state.workstations)
                const missingStation = recipe.requires && !state.workstations[recipe.requires]
                return <div className="recipe-row" key={recipe.id}>
                  <div className="recipe-icon"><ItemIcon id={recipe.output.id} /></div>
                  <div className="recipe-copy"><strong>{ITEMS[recipe.output.id].name} <span>x{recipe.output.count}</span></strong><small>{recipe.ingredients.map((ingredient) => `${ingredient.count} ${ITEMS[ingredient.id].name}${ingredient.count > 1 && ingredient.id !== 'planks' ? 's' : ''}`).join(' + ')}</small>{missingStation && <em>Needs {recipe.requires === 'table' ? 'a crafting table' : 'a furnace'} nearby</em>}</div>
                  <button className="craft-button" disabled={!available} onClick={() => game.craft(recipe.id)} title={available ? recipe.description : missingStation ? `Requires a nearby ${recipe.requires === 'table' ? 'crafting table' : 'furnace'}` : 'Not enough materials'}>{recipe.requires === 'furnace' ? 'Smelt' : 'Craft'}</button>
                </div>
              })}
            </div>
            <div className="crafting-footnote"><Sparkles size={14} /> {state.workstations.table ? 'Use coal and iron ore at a furnace to smelt.' : `You have ${countItem(state.inventory, 'log')} oak logs to work with.`}</div>
          </div>
        </div>
        <div className="modal-footer"><span>Everything you need for a good beginning.</span><span><kbd>E</kbd> or <kbd>ESC</kbd> to close</span></div>
      </section>
    </div>
  )
}

function PauseMenu({ state, game, onClose, onResume }: { state: GameState; game: Game; onClose: () => void; onResume: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="pause-modal" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <button className="modal-close pause-close" onClick={onClose} aria-label="Close menu"><X size={19} /></button>
        <div className="modal-eyebrow"><Compass size={15} /> TAKE YOUR TIME</div>
        <h2 id="pause-title">A little breather<span>.</span></h2>
        <p>Your world will be right here when you're ready.</p>
        <button className="resume-button" onClick={onResume}>Back to the world <ArrowUpRight size={17} /></button>
        <div className="pause-controls-title"><Keyboard size={15} /> THE CONTROLS</div>
        <div className="pause-controls">
          <div><span>Move / sprint</span><b>W A S D / SHIFT</b></div>
          <div><span>Look around</span><b>MOUSE</b></div>
          <div><span>Break / place</span><b>LEFT / RIGHT CLICK</b></div>
          <div><span>Use table or furnace</span><b>RIGHT CLICK</b></div>
          <div><span>Place against a workstation</span><b>SHIFT + RIGHT CLICK</b></div>
          <div><span>Gather wool from sheep</span><b>AXE + LEFT CLICK</b></div>
          <div><span>Jump / swim up</span><b>SPACE</b></div>
          <div><span>Inventory / hotbar</span><b>E / 1 - 9</b></div>
        </div>
        <div className="pause-actions">
          <button onClick={() => game.saveWithNotice()}><Save size={16} /> Save world</button>
          <button onClick={() => { if (window.confirm('Start a new world? This will replace the world saved on this device.')) game.newWorld() }}><RotateCcw size={16} /> New world</button>
        </div>
        <div className="pause-seed">WORLD SEED {state.seed} <span>/</span> {state.saveAvailable ? 'SAVED ON THIS DEVICE' : 'SAVING UNAVAILABLE'}</div>
      </section>
    </div>
  )
}

function TouchButton({ label, children, onDown, onUp, className = '' }: { label: string; children: ReactNode; onDown: () => void; onUp?: () => void; className?: string }) {
  return <button className={`touch-button ${className}`} aria-label={label} onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onDown() }} onPointerUp={(event) => { event.preventDefault(); onUp?.() }} onPointerCancel={() => onUp?.()}>{children}</button>
}

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Game | null>(null)
  const touchRef = useRef<{ x: number; y: number } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [state, setState] = useState<GameState | null>(null)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [guideOpen, setGuideOpen] = useState(true)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!mountRef.current) return
    try {
      const game = new Game(mountRef.current, {
        onState: setState,
        onInventory: () => setOverlay((current) => current === 'inventory' ? null : 'inventory'),
        onPause: () => setOverlay('menu'),
        onCloseOverlay: () => setOverlay(null),
        onToast: (message) => {
          setToast(message)
          if (toastTimer.current) clearTimeout(toastTimer.current)
          toastTimer.current = setTimeout(() => setToast(''), 3200)
        },
      })
      gameRef.current = game
      return () => {
        game.dispose()
        gameRef.current = null
        if (toastTimer.current) clearTimeout(toastTimer.current)
      }
    } catch (caught) {
      console.error(caught)
      setError('Your browser could not start the 3D world. Please enable WebGL and try again.')
    }
  }, [])

  useEffect(() => { gameRef.current?.setUiOpen(overlay !== null) }, [overlay])

  const game = gameRef.current
  const play = () => gameRef.current?.requestPlay()
  const openInventory = () => setOverlay('inventory')
  const resume = () => {
    gameRef.current?.setUiOpen(false)
    setOverlay(null)
    gameRef.current?.requestPlay()
  }
  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.()
  }
  const onWorldPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' && state?.touch && !overlay) {
      touchRef.current = { x: event.clientX, y: event.clientY }
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }
  const onWorldPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' && touchRef.current) {
      gameRef.current?.touchLook(event.clientX - touchRef.current.x, event.clientY - touchRef.current.y)
      touchRef.current = { x: event.clientX, y: event.clientY }
    }
  }

  return (
    <main className="game-shell">
      <div className="world-mount" ref={mountRef} onClick={() => { if (!overlay && state && !state.locked && !state.touch) play() }} onPointerDown={onWorldPointerDown} onPointerMove={onWorldPointerMove} onPointerUp={() => { touchRef.current = null }} onPointerCancel={() => { touchRef.current = null }} />
      <div className="world-vignette" />
      {!state && !error && <div className="loading-screen"><BrandMark /><span>BLOCKHAVEN</span><small>GROWING YOUR WORLD...</small><div className="loading-line"><i /></div></div>}
      {error && <div className="error-screen"><BrandMark /><h1>Couldn't open your world.</h1><p>{error}</p><button onClick={() => window.location.reload()}>Try again</button></div>}
      {state && <>
        <header className="topbar">
          <div className="brand"><BrandMark /><div><strong>BLOCKHAVEN</strong><small>A LITTLE WORLD, ALL YOURS</small></div></div>
          <div className="day-status">{state.weather === 'Rain' ? <CloudRain size={16} /> : state.timeOfDay === 'Night' ? <Moon size={16} /> : <Sun size={17} />}<strong>DAY {String(state.day).padStart(2, '0')}</strong><i /> <span>{state.weather === 'Rain' ? 'Rainy' : state.timeOfDay}</span></div>
          <div className="top-actions">
            <button onClick={() => game?.toggleSound()} aria-label={state.sound ? 'Mute sound' : 'Enable sound'} title={state.sound ? 'Mute sound' : 'Enable sound'}>{state.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
            <button onClick={fullscreen} aria-label="Toggle fullscreen" title="Toggle fullscreen"><Expand size={18} /></button>
            <button className="menu-button" onClick={() => setOverlay('menu')} aria-label="Open game menu" title="Game menu"><Menu size={19} /><span>MENU</span></button>
          </div>
        </header>

        {!state.started && !overlay && <section className="welcome">
          <div className="welcome-eyebrow"><span /> YOUR ADVENTURE AWAITS</div>
          <h1>Welcome to<br /><em>Blockhaven.</em></h1>
          <p>A little world with a lot to discover.<br />Make yourself at home.</p>
          <button className="play-button" onClick={play}><MousePointer2 size={17} fill="currentColor" /> <span>{window.matchMedia('(pointer: coarse)').matches ? 'Tap to explore' : 'Click to explore'}</span><ArrowUpRight size={18} /></button>
          <div className="welcome-save"><span className="save-dot" /> {state.saveAvailable ? 'YOUR WORLD SAVES AUTOMATICALLY' : 'SAVING IS UNAVAILABLE IN THIS BROWSER'}</div>
        </section>}

        {state.started && !state.locked && !state.touch && !overlay && <button className="resume-prompt" onClick={play}><MousePointer2 size={16} /> Click to return to your world <ArrowUpRight size={15} /></button>}

        {!overlay && <>
          <div className="crosshair" aria-hidden="true"><span className="crosshair-h" /><span className="crosshair-v" /><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" pathLength="100" style={{ strokeDasharray: `${state.mining * 100} 100` }} /></svg></div>
          {state.target && (state.locked || state.touch) && <div className="target-name">{state.target}</div>}
          <Guide state={state} open={guideOpen} onToggle={() => setGuideOpen(!guideOpen)} />
        </>}

        <div className="bottom-hud">
          <div className="world-details">
            <div className="hud-eyebrow">YOUR LITTLE WORLD <span>*</span></div>
            <div className="biome-name"><MapPin size={16} /> {state.biome}</div>
            <div className="coordinates">X {state.position[0]} <span>/</span> Y {state.position[1]} <span>/</span> Z {state.position[2]}</div>
            <div className="health-row" aria-label={`Health ${state.health} out of 10`}>
              {Array.from({ length: 5 }, (_, i) => {
                const remaining = Math.max(0, Math.min(2, state.health - i * 2))
                return <span className="heart-unit" key={i}><Heart size={16} className="heart-outline" /><Heart size={16} fill="currentColor" className="heart-fill" style={{ clipPath: `inset(0 ${remaining === 2 ? 0 : remaining === 1 ? 50 : 100}% 0 0)` }} /></span>
              })}<span>HEALTH</span>
            </div>
          </div>
          <div className="hotbar-wrap">
            <div className="selected-label"><span /> {state.inventory[state.selected] ? ITEMS[state.inventory[state.selected]!.id].name : 'Empty hand'} <span /></div>
            <div className="hotbar">{state.inventory.slice(0, 9).map((slot, i) => <HotbarSlot key={i} slot={slot} index={i} selected={i === state.selected} onClick={() => game?.select(i)} />)}</div>
            <div className="control-hints"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> MOVE</span><i /><span><b>MOUSE</b> LOOK</span><i /><span><b>LEFT</b> BREAK</span><i /><span><b>RIGHT</b> PLACE</span></div>
          </div>
          <div className="inventory-shortcut"><button onClick={openInventory}><span className="shortcut-icon"><Backpack size={20} /></span><span><strong>INVENTORY</strong><small>Everything you're carrying</small></span><kbd>E</kbd></button><div><span className="save-dot" /> {state.saveAvailable ? 'AUTO-SAVE ON' : 'SAVE UNAVAILABLE'}</div></div>
        </div>

        {toast && <div className="toast" key={toast}><Sparkles size={15} /> {toast}</div>}

        {state.touch && !overlay && game && <div className="touch-controls">
          <div className="touch-dpad">
            <TouchButton label="Move forward" className="touch-up" onDown={() => game.setTouchKey('KeyW', true)} onUp={() => game.setTouchKey('KeyW', false)}><ArrowUp size={20} /></TouchButton>
            <TouchButton label="Move left" className="touch-left" onDown={() => game.setTouchKey('KeyA', true)} onUp={() => game.setTouchKey('KeyA', false)}><ArrowLeft size={20} /></TouchButton>
            <TouchButton label="Move backward" className="touch-down" onDown={() => game.setTouchKey('KeyS', true)} onUp={() => game.setTouchKey('KeyS', false)}><ArrowDown size={20} /></TouchButton>
            <TouchButton label="Move right" className="touch-right" onDown={() => game.setTouchKey('KeyD', true)} onUp={() => game.setTouchKey('KeyD', false)}><ArrowRight size={20} /></TouchButton>
          </div>
          <div className="touch-actions"><TouchButton label="Jump" onDown={() => game.setTouchKey('Space', true)} onUp={() => game.setTouchKey('Space', false)}><ArrowUp size={19} /></TouchButton><TouchButton label="Hold to break" onDown={() => game.touchMine(true)} onUp={() => game.touchMine(false)}><Hammer size={19} /></TouchButton><TouchButton label="Place block" onDown={() => game.placeBlock()}><span>+</span></TouchButton></div>
        </div>}

        {overlay === 'inventory' && game && <Inventory state={state} game={game} onClose={() => setOverlay(null)} />}
        {overlay === 'menu' && game && <PauseMenu state={state} game={game} onClose={() => setOverlay(null)} onResume={resume} />}
        <button className="mobile-help" onClick={() => setOverlay('menu')} aria-label="Open controls"><CircleHelp size={18} /></button>
      </>}
    </main>
  )
}