import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { blockForItem, ITEM_DEFS, ITEM_ORDER, RECIPES, type ItemId } from "./game/blocks";
import { VoxelGame, type GameSnapshot } from "./game/engine";
import { DEFAULT_SEED, readSave } from "./game/storage";

const INITIAL_SNAPSHOT: GameSnapshot = {
  mode: "menu",
  seed: DEFAULT_SEED,
  biome: "Sunlit meadow",
  timeLabel: "9:00 AM",
  phase: "Morning",
  day: 1,
  weather: "clear",
  daylight: 0.82,
  inventory: {},
  hotbar: Array.from({ length: 9 }, () => null),
  selectedSlot: 0,
  selectedItem: null,
  selectedCount: 0,
  targetName: null,
  miningProgress: 0,
  saved: true,
  hasSave: false,
  soundEnabled: true,
  toast: null,
  position: { x: 0, y: 18, z: 0 },
};

interface AppError {
  title: string;
  message: string;
}

function Icon({ name }: { name: "sound" | "mute" | "sun" | "moon" | "rain" | "close" | "arrow" | "cube" }) {
  if (name === "sound") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /></svg>;
  }
  if (name === "mute") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4Z" /><path d="m17 9 4 6m0-6-4 6" /></svg>;
  }
  if (name === "sun") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>;
  }
  if (name === "moon") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 15.2A8.6 8.6 0 0 1 8.8 3.6a8.7 8.7 0 1 0 11.6 11.6Z" /><path d="M16.3 4.6v3.1m-1.55-1.55h3.1" /></svg>;
  }
  if (name === "rain") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 14.5a4.5 4.5 0 1 1 1.3-8.8A6 6 0 0 1 19 8a3.5 3.5 0 0 1-.5 6.9" /><path d="m8 17-1 2m6-2-1 2m6-2-1 2" /></svg>;
  }
  if (name === "close") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>;
  }
  if (name === "arrow") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.5 7.7 7.5 4.2 7.5-4.2M12 12v8.3m-4-15 8 4.5" /></svg>;
}

function ItemIcon({ item }: { item: ItemId }) {
  const isTool = ITEM_DEFS[item].kind === "tool";
  return (
    <span className={`item-art item-art-${item}${isTool ? " is-tool" : ""}`} aria-hidden="true">
      {isTool && <><i className="tool-handle" /><i className="tool-head" /></>}
    </span>
  );
}

function HoldButton({
  game,
  label,
  code,
  action = false,
  className = "",
}: {
  game: VoxelGame | null;
  label: string;
  code: string;
  action?: boolean;
  className?: string;
}) {
  const setHeld = (event: ReactPointerEvent<HTMLButtonElement>, down: boolean) => {
    event.preventDefault();
    if (action) game?.setTouchAction(code, down);
    else game?.setTouchControl(code, down);
  };

  return (
    <button
      className={`touch-button ${className}`}
      type="button"
      aria-label={label}
      onPointerDown={(event) => {
        setHeld(event, true);
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Pointer capture is optional. */ }
      }}
      onPointerUp={(event) => setHeld(event, false)}
      onPointerCancel={(event) => setHeld(event, false)}
      onLostPointerCapture={(event) => setHeld(event, false)}
    >
      {label}
    </button>
  );
}

export default function App() {
  const canvasHost = useRef<HTMLDivElement>(null);
  const gameRef = useRef<VoxelGame | null>(null);
  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT);
  const [error, setError] = useState<AppError | null>(null);

  useEffect(() => {
    const host = canvasHost.current;
    if (!host) return;
    let game: VoxelGame | null = null;
    try {
      game = new VoxelGame(host, readSave(), setSnapshot);
      gameRef.current = game;
      setError(null);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The world could not be created.";
      setError({ title: "The world is waiting", message });
    }
    return () => {
      game?.dispose();
      gameRef.current = null;
    };
  }, []);

  const isMenu = snapshot.mode === "menu" || snapshot.mode === "paused";
  const inventoryItems = useMemo(() => ITEM_ORDER.filter((item) => (snapshot.inventory[item] ?? 0) > 0), [snapshot.inventory]);
  const inventoryCells = useMemo(() => [
    ...inventoryItems,
    ...Array.from({ length: Math.max(0, 27 - inventoryItems.length) }, () => null),
  ], [inventoryItems]);

  const enterWorld = () => {
    if (snapshot.mode === "paused") gameRef.current?.resumeWorld();
    else gameRef.current?.startWorld();
  };

  const startNewWorld = () => {
    if (snapshot.hasSave && !window.confirm("Start a new world? Your current world will be replaced on this device.")) return;
    gameRef.current?.newWorld();
  };

  return (
    <main className={`world-app mode-${snapshot.mode}`}>
      <div className="scene-host" ref={canvasHost} />
      <div className="scene-vignette" aria-hidden="true" />

      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-symbol"><Icon name="cube" /></span>
          <span className="brand-name">WILDS</span>
          <span className="brand-divider" />
          <span className="brand-caption">A VOXEL SANDBOX</span>
        </div>
        <div className="world-id"><span className="status-dot" /> WORLD <span>{snapshot.seed}</span></div>
        <div className="topbar-actions">
          <button
            className="utility-button sound-button"
            type="button"
            onClick={() => gameRef.current?.toggleSound()}
            aria-label={snapshot.soundEnabled ? "Mute sounds" : "Enable sounds"}
            title={snapshot.soundEnabled ? "Mute sounds" : "Enable sounds"}
          >
            <Icon name={snapshot.soundEnabled ? "sound" : "mute"} />
          </button>
        </div>
      </header>

      {isMenu && (
        <section className={`landing-screen ${snapshot.mode === "paused" ? "is-paused" : ""}`}>
          <div className="landing-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> A WORLD THAT GROWS WITH YOU</div>
            <h1>WILDS<span className="title-period">.</span></h1>
            <p className="landing-description">
              {snapshot.mode === "paused"
                ? "Your trail is still here. Pick up where the light left off."
                : "A living block-built landscape. Find your first tree, make a place of your own, and see where the trail leads."}
            </p>
            <div className="landing-actions">
              <button className="primary-button" type="button" onClick={enterWorld}>
                <span>{snapshot.mode === "paused" ? "Return to the wild" : "Enter the world"}</span>
                <Icon name="arrow" />
              </button>
              <button
                className="quiet-button"
                type="button"
                onClick={() => snapshot.mode === "paused" ? gameRef.current?.pauseToMenu() : startNewWorld()}
              >
                <span className="quiet-plus">{snapshot.mode === "paused" ? "-" : "+"}</span>
                {snapshot.mode === "paused" ? "Save & return" : "New world"}
              </button>
            </div>
            <div className="landing-controls">
              <span><kbd>W A S D</kbd> move</span>
              <span><kbd>SPACE</kbd> jump</span>
              <span><kbd>E</kbd> pack & craft</span>
            </div>
            <div className="landing-save-note">
              <span className="save-indicator" />
              {snapshot.hasSave ? "Your world is saved on this device" : "Your world saves automatically on this device"}
            </div>
          </div>
          <div className="landing-side-note" aria-hidden="true">
            <span className="side-note-rule" />
            <span>MAKE A LITTLE<br />ROOM FOR WONDER</span>
          </div>
        </section>
      )}

      {snapshot.mode === "playing" && (
        <>
          <div className="world-hud">
            <div className="location-readout">
              <span className="readout-label">YOU ARE IN</span>
              <span className="biome-name">{snapshot.biome}</span>
            </div>
            <div className="time-readout">
              <span className="weather-icon"><Icon name={snapshot.weather === "rain" ? "rain" : snapshot.daylight > 0.16 ? "sun" : "moon"} /></span>
              <span className="time-copy"><strong>{snapshot.timeLabel}</strong><small>{snapshot.phase} <i /> Day {snapshot.day}</small></span>
              <span className={`weather-label ${snapshot.weather === "rain" ? "is-raining" : ""}`}>
                {snapshot.weather === "rain" ? "Passing rain" : "Clear skies"}
              </span>
            </div>
          </div>

          <div className="reticle-wrap" aria-hidden="true">
            <div className={`reticle ${snapshot.miningProgress > 0 ? "is-mining" : ""}`}>
              <span /><span /><span /><span />
            </div>
            {snapshot.targetName && (
              <div className="target-readout">
                <span>{snapshot.targetName}</span>
                <div className="target-progress"><i style={{ width: `${Math.max(0, Math.min(100, snapshot.miningProgress * 100))}%` }} /></div>
              </div>
            )}
          </div>

          <div className="game-bottom">
            {snapshot.toast && <div className="world-toast" role="status">{snapshot.toast}</div>}
            <div className="hotbar-area">
              <div className="selected-readout">
                <span>{snapshot.selectedItem ? ITEM_DEFS[snapshot.selectedItem].name : "Empty hand"}</span>
                {snapshot.selectedItem && snapshot.selectedCount > 0 && <i>{snapshot.selectedCount} in pack</i>}
              </div>
              <div className="hotbar" role="toolbar" aria-label="Hotbar">
                {snapshot.hotbar.map((item, index) => (
                  <button
                    className={`hotbar-slot ${snapshot.selectedSlot === index ? "is-selected" : ""}`}
                    type="button"
                    key={index}
                    aria-label={`Slot ${index + 1}${item ? `, ${ITEM_DEFS[item].name}` : ", empty"}`}
                    aria-pressed={snapshot.selectedSlot === index}
                    onClick={() => gameRef.current?.selectSlot(index)}
                  >
                    <span className="slot-number">{index + 1}</span>
                    {item && <ItemIcon item={item} />}
                    {item && (snapshot.inventory[item] ?? 0) > 0 && <span className="slot-count">{snapshot.inventory[item]}</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-hint"><span>WASD</span> move <i /> <span>SHIFT</span> sprint <i /> <span>LEFT CLICK</span> mine <i /> <span>RIGHT CLICK</span> place <i /> <span>E</span> pack <i /> <span>ESC</span> pause</div>
          </div>

          <div className="touch-controls" aria-label="Touch controls">
            <div className="touch-dpad">
              <HoldButton game={gameRef.current} label="^" code="KeyW" className="touch-up" />
              <HoldButton game={gameRef.current} label="<" code="KeyA" className="touch-left" />
              <HoldButton game={gameRef.current} label="v" code="KeyS" className="touch-down" />
              <HoldButton game={gameRef.current} label=">" code="KeyD" className="touch-right" />
            </div>
            <div className="touch-actions">
              <HoldButton game={gameRef.current} label="MINE" code="mine" action className="touch-mine" />
              <HoldButton game={gameRef.current} label="PLACE" code="place" action className="touch-place" />
              <button className="touch-button touch-pack" type="button" onClick={() => gameRef.current?.openInventory()}>PACK</button>
              <HoldButton game={gameRef.current} label="JUMP" code="Space" className="touch-jump" />
            </div>
          </div>
        </>
      )}

      {snapshot.mode === "inventory" && (
        <section className="inventory-screen" role="dialog" aria-modal="true" aria-labelledby="inventory-title">
          <div className="inventory-panel">
            <header className="inventory-header">
              <div>
                <div className="eyebrow inventory-eyebrow"><span className="eyebrow-line" /> FIELD KIT</div>
                <h2 id="inventory-title">Pack & craft</h2>
                <p>Gathered from the world, shaped by hand.</p>
              </div>
              <button className="inventory-close" type="button" onClick={() => gameRef.current?.closeInventory(true)} aria-label="Close inventory">
                <Icon name="close" />
              </button>
            </header>

            <div className="inventory-layout">
              <section className="pack-section">
                <div className="section-heading">
                  <div><span className="section-index">01</span><h3>YOUR PACK</h3></div>
                  <span className="section-aside">{inventoryItems.length} types carried</span>
                </div>
                <p className="inventory-instruction">Choose a hotbar slot, then choose an item to place in it.</p>
                <div className="inventory-grid" aria-label="Inventory items">
                  {inventoryCells.map((item, index) => (
                    <button
                      className={`inventory-cell ${item ? "has-item" : ""}`}
                      key={item ?? `empty-${index}`}
                      type="button"
                      disabled={!item}
                      onClick={() => item && gameRef.current?.assignToSelectedSlot(item)}
                      aria-label={item ? `${ITEM_DEFS[item].name}, ${snapshot.inventory[item]} in pack. Assign to slot ${snapshot.selectedSlot + 1}.` : "Empty inventory space"}
                      title={item ? `Assign ${ITEM_DEFS[item].name} to slot ${snapshot.selectedSlot + 1}` : undefined}
                    >
                      {item && <><ItemIcon item={item} /><span className="inventory-count">{snapshot.inventory[item]}</span><span className="inventory-item-name">{ITEM_DEFS[item].name}</span></>}
                    </button>
                  ))}
                </div>
                <div className="pack-hotbar-label">HOTBAR <span>CLICK A SLOT TO SELECT</span></div>
                <div className="inventory-hotbar">
                  {snapshot.hotbar.map((item, index) => (
                    <button
                      className={`inventory-hotbar-slot ${snapshot.selectedSlot === index ? "is-selected" : ""}`}
                      type="button"
                      key={index}
                      aria-label={`Select hotbar slot ${index + 1}`}
                      onClick={() => gameRef.current?.selectSlot(index)}
                    >
                      <small>{index + 1}</small>{item && <ItemIcon item={item} />}
                    </button>
                  ))}
                </div>
              </section>

              <section className="craft-section">
                <div className="section-heading">
                  <div><span className="section-index">02</span><h3>WORKBENCH</h3></div>
                  <span className="section-aside">{RECIPES.length} recipes</span>
                </div>
                <p className="inventory-instruction">Turn what you find into something useful.</p>
                <div className="recipe-list">
                  {RECIPES.map((recipe) => {
                    const available = Object.entries(recipe.ingredients).every(([ingredient, count]) =>
                      (snapshot.inventory[ingredient as ItemId] ?? 0) >= (count ?? 0),
                    );
                    const ingredients = Object.entries(recipe.ingredients)
                      .map(([ingredient, count]) => `${count} ${ITEM_DEFS[ingredient as ItemId].name.toLowerCase()}`)
                      .join("  /  ");
                    const placeable = blockForItem(recipe.id) !== null;
                    return (
                      <button
                        className={`recipe-row ${available ? "is-available" : ""}`}
                        type="button"
                        key={recipe.id}
                        disabled={!available}
                        onClick={() => gameRef.current?.craft(recipe.id)}
                        aria-label={`Craft ${ITEM_DEFS[recipe.id].name}. Requires ${ingredients}.`}
                      >
                        <span className="recipe-output-art"><ItemIcon item={recipe.id} /></span>
                        <span className="recipe-copy"><strong>{ITEM_DEFS[recipe.id].name}</strong><small>{ingredients}</small></span>
                        <span className="recipe-result">{recipe.output > 1 ? `x${recipe.output}` : placeable ? "MAKE" : "CRAFT"}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="craft-note"><span className="craft-note-mark">TIP</span> No station needed. Make something wherever you are.</div>
              </section>
            </div>
            <footer className="inventory-footer"><span>WILDS FIELD NOTES <i /> THE LAND PROVIDES</span><button type="button" onClick={() => gameRef.current?.closeInventory(true)}>BACK TO THE WORLD <Icon name="arrow" /></button></footer>
          </div>
        </section>
      )}

      {error && (
        <div className="error-screen" role="alert">
          <div className="error-mark"><Icon name="cube" /></div>
          <p className="eyebrow"><span className="eyebrow-line" /> WORLD INITIALIZATION</p>
          <h2>{error.title}</h2>
          <p>{error.message}</p>
          <button className="primary-button" type="button" onClick={() => window.location.reload()}><span>Reload the world</span><Icon name="arrow" /></button>
        </div>
      )}
    </main>
  );
}