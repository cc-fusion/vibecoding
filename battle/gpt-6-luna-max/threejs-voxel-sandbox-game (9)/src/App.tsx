import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
  ITEMS,
  ITEM_IDS,
  RECIPES,
  type ItemId,
} from "./game/data";
import { VoxelGame, type GameSnapshot } from "./game/engine";

function LeafMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <path d="M34.9 8.2C22.7 7.6 12.4 11.6 9.2 21.1c-2 6.1 1.4 12.6 7.8 13.6 9.4 1.5 17.7-9.7 17.9-26.5Z" fill="currentColor" />
      <path d="M9.8 35.2c5.9-8.9 12.2-14.6 21.1-20.4" stroke="#f2e4c6" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SunIcon({ raining = false }: { raining?: boolean }) {
  return raining ? (
    <svg viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M6 12.8h9.7a3.1 3.1 0 0 0 .1-6.2 4.9 4.9 0 0 0-9.4 1.1A2.6 2.6 0 0 0 6 12.8Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="m7.5 15.1-.8 2m4.7-2-.8 2m4.8-2-.8 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="3.3" stroke="currentColor" strokeWidth="1.35" />
      <path d="M11 2.4v2.1m0 13v2.1m8.6-8.6h-2.1m-13 0H2.4m14.7-6.1-1.5 1.5M6.4 15.6l-1.5 1.5m12.2 0-1.5-1.5M6.4 6.4 4.9 4.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M4.1 8.2h13.8l1 10.1H3.1l1-10.1Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M8 8.3V6.1a3 3 0 0 1 6 0v2.2" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M4 3.5h12.3l2.2 2.2v12.8H3.5V4a.5.5 0 0 1 .5-.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M7 3.8v5h8v-5M7 18.2v-6h8v6" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BlockGlyph({ item, large = false }: { item: ItemId; large?: boolean }) {
  const definition = ITEMS[item];
  return (
    <span
      className={`block-glyph ${large ? "block-glyph-large" : ""} glyph-${item}`}
      style={{ "--block-tone": definition.color } as CSSProperties}
      aria-hidden="true"
    >
      <span />
    </span>
  );
}

function StartScreen({
  seed,
  touchMode,
  onStart,
}: {
  seed: string;
  touchMode: boolean;
  onStart: () => void;
}) {
  return (
    <div className="start-screen">
      <div className="start-copy">
        <div className="start-brand-line">
          <LeafMark className="brand-mark" />
          <span>AN OPEN WORLD, MADE ONE BLOCK AT A TIME</span>
        </div>
        <h1 className="wordmark">
          MOSS <span>&amp;</span>
          <br />
          MICA
        </h1>
        <p className="start-description">Find your footing. Follow the pines. Make a place of your own.</p>
        <button className="start-button" onClick={onStart}>
          <span>Step into the wild</span>
          <ArrowIcon />
        </button>
        <div className="start-controls">
          {touchMode ? "Drag to look | Touch to gather | Use the field controls to move" : "WASD move | Mouse look | Left click gather | Right click build"}
        </div>
      </div>
      <div className="start-footer">
        <span>YOUR WORLD, SAVED AS YOU GO</span>
        <span>FIELD NOTE 01 <i /> {seed}</span>
      </div>
      <div className="start-grain" aria-hidden="true" />
    </div>
  );
}

function PauseScreen({
  onResume,
  onInventory,
  onSave,
  onReset,
}: {
  onResume: () => void;
  onInventory: () => void;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="pause-screen">
      <div className="pause-mark"><LeafMark /></div>
      <p className="eyebrow">THE MEADOW CAN WAIT</p>
      <h2>Take a breath.</h2>
      <p className="pause-description">Your little corner of the world is right where you left it.</p>
      <button className="start-button pause-resume" onClick={onResume}>
        <span>Back to the wild</span>
        <ArrowIcon />
      </button>
      <div className="pause-actions">
        <button onClick={onInventory}><BagIcon /> Field kit <span>E</span></button>
        <button onClick={onSave}><SaveIcon /> Save world</button>
        <button className="reset-link" onClick={onReset}>Start a new world</button>
      </div>
    </div>
  );
}

function WorldHud({
  snapshot,
  locked,
  toast,
  onOpenInventory,
  onPause,
  onSelectSlot,
}: {
  snapshot: GameSnapshot;
  locked: boolean;
  toast: string;
  onOpenInventory: () => void;
  onPause: () => void;
  onSelectSlot: (slot: number) => void;
}) {
  const selectedItem = snapshot.hotbar[snapshot.selected];
  const selectedDefinition = ITEMS[selectedItem];

  return (
    <div className={`game-hud ${locked ? "is-locked" : ""}`}>
      <header className="hud-top">
        <div className="hud-brand">
          <LeafMark className="hud-mark" />
          <div>
            <strong>MOSS <span>&amp;</span> MICA</strong>
            <small>THE LIVING BLOCK WORLD</small>
          </div>
        </div>

        <div className="world-clock" aria-label={`Day ${snapshot.day}, ${snapshot.clock}`}>
          <span className="clock-icon"><SunIcon raining={snapshot.weather === "rain"} /></span>
          <span>DAY {String(snapshot.day).padStart(2, "0")}</span>
          <i />
          <span>{snapshot.clock}</span>
          <em>{snapshot.weather === "rain" ? "RAIN" : "CLEAR"}</em>
        </div>

        <div className="hud-seed">WORLD <span>{snapshot.seed}</span></div>
      </header>

      <div className="location-readout">
        <span className="location-rule" />
        <div>
          <strong>{snapshot.biome.toUpperCase()}</strong>
          <span>{String(snapshot.x).padStart(2, "0")} / {String(snapshot.z).padStart(2, "0")} &nbsp;|&nbsp; ELEV. {snapshot.y}</span>
        </div>
      </div>

      {locked && (
        <div className={`reticle-wrap ${snapshot.miningProgress > 0 ? "is-mining" : ""}`}>
          <div className="reticle-progress" style={{ "--mine-progress": `${snapshot.miningProgress * 360}deg` } as CSSProperties} />
          <div className="reticle"><i /><i /><i /><i /></div>
          {snapshot.targetName && <div className="target-name">{snapshot.targetName}</div>}
        </div>
      )}

      <div className="hud-bottom">
        {toast && <div className="toast-message" key={toast}>{toast}</div>}

        <div className="active-item-note">
          <span>ACTIVE</span>
          <strong>{selectedDefinition.name}</strong>
          <small>{snapshot.inventory[selectedItem] ?? 0} IN PACK</small>
        </div>

        <div className="hotbar" aria-label="Quick inventory">
          {snapshot.hotbar.map((itemId, index) => {
            const item = ITEMS[itemId];
            const amount = snapshot.inventory[itemId] ?? 0;
            return (
              <button
                className={`hotbar-slot ${snapshot.selected === index ? "selected" : ""}`}
                key={`${index}-${itemId}`}
                title={`${index + 1}: ${item.name}`}
                aria-label={`Select slot ${index + 1}, ${item.name}`}
                onClick={() => onSelectSlot(index)}
              >
                <span className="slot-number">{index + 1}</span>
                <BlockGlyph item={itemId} />
                <span className={`slot-count ${amount === 0 ? "empty" : ""}`}>{amount > 0 ? amount : "-"}</span>
              </button>
            );
          })}
        </div>

        <div className="control-hint">
          <span><b>W A S D</b> MOVE</span>
          <span><b>SPACE</b> JUMP</span>
          <span><b>SHIFT</b> SPRINT</span>
          <span><b>LMB</b> GATHER</span>
          <span><b>RMB</b> BUILD</span>
          <span><b>E</b> FIELD KIT</span>
        </div>

        {snapshot.touchMode && locked && (
          <>
            <button className="touch-kit-button" onClick={onOpenInventory} aria-label="Open field kit">
              <BagIcon />
            </button>
            <button className="touch-pause-button" onClick={onPause} aria-label="Pause world">II</button>
          </>
        )}
      </div>
    </div>
  );
}

function InventoryPanel({
  snapshot,
  onEquip,
  onCraft,
  onClose,
  onSave,
}: {
  snapshot: GameSnapshot;
  onEquip: (id: ItemId) => void;
  onCraft: (id: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const selectedItem = snapshot.hotbar[snapshot.selected];
  const selectedDefinition = ITEMS[selectedItem];
  const totalCount = ITEM_IDS.reduce((total, id) => total + (snapshot.inventory[id] ?? 0), 0);

  return (
    <div className="inventory-scrim" onMouseDown={(event) => event.stopPropagation()}>
      <section className="inventory-panel" aria-label="Field kit and crafting">
        <header className="inventory-header">
          <div className="inventory-title-lockup">
            <span className="panel-overline">MOSS &amp; MICA <i /> FIELD KIT</span>
            <h2>Make yourself at home.</h2>
          </div>
          <div className="inventory-header-actions">
            <span className="pack-total">{totalCount} <small>ITEMS</small></span>
            <button className="icon-button save-button" onClick={onSave} aria-label="Save world" title="Save world"><SaveIcon /></button>
            <button className="icon-button close-button" onClick={onClose} aria-label="Close field kit" title="Close (E)"><CloseIcon /></button>
          </div>
        </header>

        <div className="inventory-body">
          <section className="pack-section">
            <div className="section-heading">
              <div>
                <span className="panel-overline">YOUR PACK</span>
                <h3>Collected things</h3>
              </div>
              <span className="assign-hint">CHOOSE SLOT {String(snapshot.selected + 1).padStart(2, "0")}</span>
            </div>
            <div className="inventory-grid">
              {ITEM_IDS.map((id) => {
                const item = ITEMS[id];
                const count = snapshot.inventory[id] ?? 0;
                const isEquipped = selectedItem === id;
                return (
                  <button
                    key={id}
                    className={`inventory-item ${isEquipped ? "equipped" : ""} ${count === 0 ? "not-owned" : ""}`}
                    onClick={() => onEquip(id)}
                    aria-label={`Equip ${item.name}, ${count} in pack`}
                    title={`${item.description} Click to assign to active slot.`}
                  >
                    <span className="inventory-item-glyph"><BlockGlyph item={id} large /></span>
                    <span className="inventory-item-copy">
                      <strong>{item.shortName}</strong>
                      <small>{count > 0 ? `x ${count}` : "EMPTY"}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="equipped-summary">
              <BlockGlyph item={selectedItem} large />
              <div>
                <span>ACTIVE SLOT {String(snapshot.selected + 1).padStart(2, "0")}</span>
                <strong>{selectedDefinition.name}</strong>
                <small>{selectedDefinition.description}</small>
              </div>
            </div>
          </section>

          <section className="craft-section">
            <div className="section-heading craft-heading">
              <div>
                <span className="panel-overline">A LITTLE MAKING</span>
                <h3>Crafting table</h3>
              </div>
              <span className={`station-status ${snapshot.hasWorkbench ? "nearby" : ""}`}>
                <i /> {snapshot.hasWorkbench ? "TABLE NEARBY" : "HAND CRAFTING"}
              </span>
            </div>
            <div className="recipe-list">
              {RECIPES.map((recipe) => {
                const output = Object.entries(recipe.output)[0] as [ItemId, number];
                const affordable = Object.entries(recipe.ingredients).every(([id, amount]) =>
                  (snapshot.inventory[id as ItemId] ?? 0) >= (amount ?? 0),
                );
                const needsTable = Boolean(recipe.requiresWorkbench && !snapshot.hasWorkbench);
                const isAvailable = affordable && !needsTable;
                return (
                  <div className={`recipe-row ${isAvailable ? "can-craft" : ""}`} key={recipe.id}>
                    <span className="recipe-glyph"><BlockGlyph item={output[0]} large /></span>
                    <div className="recipe-copy">
                      <strong>{recipe.name}</strong>
                      <p>{recipe.description}</p>
                      <div className="recipe-ingredients">
                        {Object.entries(recipe.ingredients).map(([id, amount]) => (
                          <span key={id} className={(snapshot.inventory[id as ItemId] ?? 0) >= (amount ?? 0) ? "ingredient-owned" : ""}>
                            {amount} {ITEMS[id as ItemId].shortName}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      className="craft-button"
                      onClick={() => onCraft(recipe.id)}
                      disabled={!isAvailable}
                      aria-label={`Craft ${recipe.name}`}
                      title={needsTable ? "Place a worktable nearby first" : affordable ? "Craft this recipe" : "Gather the listed materials"}
                    >
                      <span>{needsTable ? "TABLE" : affordable ? "MAKE" : "NEED"}</span>
                      {!needsTable && affordable && <small>+{output[1]}</small>}
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="craft-footnote">
              {snapshot.hasWorkbench
                ? "Your worktable is close enough for stronger recipes."
                : "Make a worktable, equip it, then right-click to place it nearby."}
            </p>
          </section>
        </div>

        <footer className="inventory-footer">
          <span><kbd>E</kbd> or <kbd>ESC</kbd> CLOSE</span>
          <span>CLICK AN ITEM TO PLACE IT IN YOUR ACTIVE SLOT</span>
          <span>AUTOSAVES ON THIS DEVICE</span>
        </footer>
      </section>
    </div>
  );
}

function TouchControls({ game }: { game: VoxelGame | null }) {
  const stickRef = useRef<HTMLDivElement | null>(null);
  const [stickOffset, setStickOffset] = useState({ x: 0, y: 0 });
  const updateStick = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!stickRef.current) return;
    const bounds = stickRef.current.getBoundingClientRect();
    const radius = bounds.width * 0.35;
    const rawX = (event.clientX - (bounds.left + bounds.width / 2)) / radius;
    const rawY = (event.clientY - (bounds.top + bounds.height / 2)) / radius;
    const length = Math.hypot(rawX, rawY);
    const scale = length > 1 ? 1 / length : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    setStickOffset({ x, y });
    game?.setTouchMovement(-y, x);
  };
  const releaseStick = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setStickOffset({ x: 0, y: 0 });
    game?.setTouchMovement(0, 0);
  };

  const pressMine = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    game?.setTouchMining(true);
  };
  const releaseMine = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    game?.setTouchMining(false);
  };

  return (
    <div className="touch-controls" aria-label="Touch game controls">
      <div
        className="touch-stick"
        ref={stickRef}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          updateStick(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) updateStick(event);
        }}
        onPointerUp={releaseStick}
        onPointerCancel={releaseStick}
        aria-label="Move"
      >
        <span className="stick-ring" />
        <span className="stick-thumb" style={{ transform: `translate(${stickOffset.x * 25}px, ${stickOffset.y * 25}px)` }} />
        <span className="stick-label">MOVE</span>
      </div>
      <div className="touch-action-stack">
        <button
          className="touch-action touch-jump"
          onPointerDown={(event) => {
            event.preventDefault();
            game?.touchJump();
          }}
          aria-label="Jump"
        >
          <span>UP</span><small>JUMP</small>
        </button>
        <div className="touch-action-row">
          <button
            className="touch-action touch-mine"
            onPointerDown={pressMine}
            onPointerUp={releaseMine}
            onPointerCancel={releaseMine}
            onLostPointerCapture={() => game?.setTouchMining(false)}
            aria-label="Gather block"
          >
            <span>GATHER</span><small>HOLD</small>
          </button>
          <button
            className="touch-action touch-place"
            onPointerDown={(event) => {
              event.preventDefault();
              game?.touchPlace();
            }}
            aria-label="Place block"
          >
            <span>PLACE</span><small>TAP</small>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<VoxelGame | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [locked, setLocked] = useState(false);
  const [started, setStarted] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [resetConfirm, setResetConfirm] = useState(false);
  const [graphicsError, setGraphicsError] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    try {
      const game = new VoxelGame(host, {
        onSnapshot: setSnapshot,
        onLockChange: setLocked,
        onInventoryToggle: setInventoryOpen,
        onToast: (message) => {
          setToast(message);
          if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
          toastTimerRef.current = window.setTimeout(() => setToast(""), 2100);
        },
      });
      gameRef.current = game;
      return () => {
        game.dispose();
        gameRef.current = null;
        if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
      };
    } catch (error) {
      console.error("Unable to create the voxel world", error);
      setGraphicsError(true);
    }
  }, []);

  const game = gameRef.current;
  const enterWorld = () => {
    setStarted(true);
    gameRef.current?.enterWorld();
  };

  return (
    <main className="game-shell">
      <div className="world-host" ref={hostRef} />
      <div className={`scene-vignette ${started ? "in-game" : ""}`} aria-hidden="true" />

      {snapshot && started && (
        <WorldHud
          snapshot={snapshot}
          locked={locked}
          toast={toast}
          onOpenInventory={() => gameRef.current?.openInventory()}
          onPause={() => gameRef.current?.pauseWorld()}
          onSelectSlot={(slot) => gameRef.current?.selectSlot(slot)}
        />
      )}

      {!started && snapshot && !graphicsError && (
        <StartScreen seed={snapshot.seed} touchMode={snapshot.touchMode} onStart={enterWorld} />
      )}

      {started && !locked && !inventoryOpen && !graphicsError && (
        <PauseScreen
          onResume={enterWorld}
          onInventory={() => gameRef.current?.openInventory()}
          onSave={() => gameRef.current?.save(true)}
          onReset={() => setResetConfirm(true)}
        />
      )}

      {snapshot && inventoryOpen && (
        <InventoryPanel
          snapshot={snapshot}
          onEquip={(id) => gameRef.current?.equipItem(id)}
          onCraft={(id) => gameRef.current?.craft(id)}
          onClose={() => gameRef.current?.closeInventory()}
          onSave={() => gameRef.current?.save(true)}
        />
      )}

      {snapshot?.touchMode && started && locked && !inventoryOpen && <TouchControls game={game} />}

      {resetConfirm && (
        <div className="confirm-scrim">
          <section className="confirm-panel" role="dialog" aria-modal="true" aria-labelledby="reset-title">
            <span className="panel-overline">A FRESH PATCH OF EARTH</span>
            <h2 id="reset-title">Start over?</h2>
            <p>This will replace your saved seed, inventory, and every block you have changed.</p>
            <div className="confirm-actions">
              <button className="quiet-button" onClick={() => setResetConfirm(false)}>Keep this world</button>
              <button className="danger-button" onClick={() => gameRef.current?.resetWorld()}>Grow a new world</button>
            </div>
          </section>
        </div>
      )}

      {graphicsError && (
        <div className="graphics-error">
          <LeafMark className="brand-mark" />
          <p className="eyebrow">A LITTLE PAUSE IN THE WILDS</p>
          <h1>3D graphics could not start.</h1>
          <p>Try a current browser with WebGL enabled. Your saved world is kept on this device.</p>
        </div>
      )}
    </main>
  );
}