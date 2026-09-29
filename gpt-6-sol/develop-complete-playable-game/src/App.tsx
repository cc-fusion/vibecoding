import { useCallback, useEffect, useRef, useState } from "react";

type Point = [number, number];
type Phase = "start" | "playing" | "paused" | "cleared" | "lost" | "won";
type Tile = { mask: number; solution: number; kind: "wire" | "source" | "beacon"; path: boolean };
type Level = { name: string; subtitle: string; size: number; paths: Point[][]; allowance: number };
type Game = { phase: Phase; level: number; tiles: Tile[]; energy: number; initialEnergy: number; moves: number; score: number; baseScore: number };

const N = 1, E = 2, S = 4, W = 8;
const DIRECTIONS = [N, E, S, W];
const OFFSETS: Point[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

const LEVELS: Level[] = [
  { name: "First contact", subtitle: "One line. One light.", size: 5, allowance: 12,
    paths: [[[0, 2], [1, 2], [1, 1], [2, 1], [3, 1], [3, 2], [4, 2]]] },
  { name: "The split", subtitle: "Make the current branch.", size: 6, allowance: 10,
    paths: [
      [[0, 3], [1, 3], [2, 3], [2, 2], [3, 2], [4, 2], [4, 1], [5, 1]],
      [[0, 3], [1, 3], [2, 3], [2, 2], [3, 2], [3, 3], [3, 4], [4, 4], [5, 4]],
    ] },
  { name: "Cross currents", subtitle: "Three lights in the dark.", size: 6, allowance: 9,
    paths: [
      [[0, 4], [1, 4], [1, 3], [2, 3], [2, 2], [3, 2], [3, 1], [4, 1], [5, 1]],
      [[0, 4], [1, 4], [1, 3], [2, 3], [2, 2], [3, 2], [4, 2], [4, 3], [5, 3]],
      [[0, 4], [1, 4], [1, 3], [2, 3], [2, 4], [3, 4], [3, 5], [4, 5], [5, 5]],
    ] },
  { name: "The old quarter", subtitle: "Find a way through the noise.", size: 7, allowance: 8,
    paths: [
      [[0, 3], [1, 3], [1, 2], [2, 2], [3, 2], [3, 1], [4, 1], [4, 0], [5, 0], [6, 0]],
      [[0, 3], [1, 3], [1, 2], [2, 2], [3, 2], [4, 2], [4, 3], [5, 3], [6, 3]],
      [[0, 3], [1, 3], [1, 4], [2, 4], [2, 5], [3, 5], [4, 5], [4, 6], [5, 6], [6, 6]],
    ] },
  { name: "Last light", subtitle: "Bring the whole city online.", size: 7, allowance: 7,
    paths: [
      [[0, 5], [1, 5], [1, 4], [2, 4], [2, 3], [3, 3], [3, 2], [4, 2], [4, 1], [5, 1], [5, 0], [6, 0]],
      [[0, 5], [1, 5], [1, 4], [2, 4], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3]],
      [[0, 5], [1, 5], [1, 4], [2, 4], [2, 5], [3, 5], [3, 6], [4, 6], [5, 6], [6, 6]],
    ] },
];

function rotate(mask: number, clockwise = true) {
  return clockwise ? ((mask << 1) & 15) | (mask >> 3) : (mask >> 1) | ((mask & 1) << 3);
}
function indexOf([x, y]: Point, size: number) { return y * size + x; }

function poweredTiles(tiles: Tile[], size: number) {
  const source = tiles.findIndex(tile => tile.kind === "source");
  const powered = new Set<number>([source]);
  const queue = [source];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    const x = current % size, y = Math.floor(current / size);
    DIRECTIONS.forEach((direction, d) => {
      const nx = x + OFFSETS[d][0], ny = y + OFFSETS[d][1];
      if (nx < 0 || ny < 0 || nx >= size || ny >= size || !(tiles[current].mask & direction)) return;
      const next = ny * size + nx;
      if ((tiles[next].mask & DIRECTIONS[(d + 2) % 4]) && !powered.has(next)) {
        powered.add(next);
        queue.push(next);
      }
    });
  }
  return powered;
}
function allBeaconsLit(tiles: Tile[], powered: Set<number>) {
  return tiles.every((tile, index) => tile.kind !== "beacon" || powered.has(index));
}

function makeBoard(levelIndex: number) {
  const level = LEVELS[levelIndex], size = level.size;
  const source = indexOf(level.paths[0][0], size);
  const beacons = new Set(level.paths.map(path => indexOf(path[path.length - 1], size)));
  const solution = Array(size * size).fill(0) as number[];

  // Author each solved network first, then scramble its rotatable pieces.
  level.paths.forEach(path => path.slice(0, -1).forEach((point, step) => {
    const next = path[step + 1];
    const x = next[0] - point[0], y = next[1] - point[1];
    const direction = x === 1 ? E : x === -1 ? W : y === 1 ? S : N;
    const opposite = x === 1 ? W : x === -1 ? E : y === 1 ? N : S;
    solution[indexOf(point, size)] |= direction;
    solution[indexOf(next, size)] |= opposite;
  }));

  let tiles: Tile[] = [], minimumMoves = 0;
  for (let attempt = 0; attempt < 30; attempt++) {
    minimumMoves = 0;
    tiles = solution.map((solved, index) => {
      const kind = index === source ? "source" : beacons.has(index) ? "beacon" : "wire";
      if (!solved) {
        const shapes = [N | S, N | E, N | E | S];
        const base = shapes[Math.floor(Math.random() * shapes.length)];
        let mask = base;
        for (let i = 0; i < Math.floor(Math.random() * 4); i++) mask = rotate(mask);
        return { mask, solution: 0, kind, path: false };
      }
      let mask = solved;
      if (kind === "wire") {
        const turns = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < turns; i++) mask = rotate(mask);
        if (mask === solved) mask = rotate(mask);
        minimumMoves += rotate(mask) === solved || rotate(mask, false) === solved ? 1 : 2;
      }
      return { mask, solution: solved, kind, path: true };
    });
    if (!allBeaconsLit(tiles, poweredTiles(tiles, size))) break;
  }
  return { tiles, energy: minimumMoves + level.allowance };
}
function initialGame(): Game {
  const board = makeBoard(0);
  return { phase: "start", level: 0, ...board, initialEnergy: board.energy, moves: 0, score: 0, baseScore: 0 };
}

function WireIcon({ mask, powered, kind }: { mask: number; powered: boolean; kind: Tile["kind"] }) {
  return <svg className={`wire-svg ${powered ? "is-powered" : ""}`} viewBox="0 0 100 100" aria-hidden="true">
    <g className="wire-lines">
      {mask & N ? <line x1="50" y1="50" x2="50" y2="0" /> : null}
      {mask & E ? <line x1="50" y1="50" x2="100" y2="50" /> : null}
      {mask & S ? <line x1="50" y1="50" x2="50" y2="100" /> : null}
      {mask & W ? <line x1="50" y1="50" x2="0" y2="50" /> : null}
    </g>
    {kind === "source" ? <><circle className="node-outer" cx="50" cy="50" r="23" /><circle className="node-inner" cx="50" cy="50" r="12" /><path className="node-symbol" d="M54 34 44 52h10l-8 15" /></>
      : kind === "beacon" ? <><circle className="node-outer" cx="50" cy="50" r="23" /><circle className="beacon-core" cx="50" cy="50" r="11" /><circle className="beacon-dot" cx="50" cy="50" r="4" /></>
      : <circle className="junction" cx="50" cy="50" r="5" />}
  </svg>;
}

function Glyph({ name, size = 18 }: { name: "sound" | "mute" | "pause" | "play" | "restart" | "arrow" | "bolt"; size?: number }) {
  const paths = {
    sound: <><path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="M17 9a5 5 0 0 1 0 6M19.5 6a9 9 0 0 1 0 12" /></>,
    mute: <><path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="m17 9 5 6m0-6-5 6" /></>,
    pause: <><path d="M8 5v14M16 5v14" /></>, play: <path d="m8 5 11 7-11 7V5Z" />,
    restart: <><path d="M20 11a8 8 0 1 1-2.4-5.6" /><path d="M20 4v6h-6" /></>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6" /></>, bolt: <path d="m13 2-9 12h7l-1 8 10-12h-7l0-8Z" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export default function App() {
  const [game, setGame] = useState<Game>(initialGame);
  const [selected, setSelected] = useState(0);
  const [reverseMode, setReverseMode] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [best, setBest] = useState(0);
  const audioRef = useRef<AudioContext | null>(null);
  const phaseRef = useRef<Phase>("start");

  const sound = useCallback((type: "turn" | "light" | "win" | "lose") => {
    if (!soundOn) return;
    try {
      const context = audioRef.current ?? new AudioContext();
      audioRef.current = context;
      if (context.state === "suspended") void context.resume();
      const tones = type === "win" ? [392, 523, 659, 784] : type === "light" ? [440, 659] : type === "lose" ? [210, 155] : [260];
      tones.forEach((frequency, index) => {
        const oscillator = context.createOscillator(), gain = context.createGain();
        const start = context.currentTime + index * (type === "turn" ? 0 : 0.085);
        oscillator.type = type === "turn" ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(type === "turn" ? 0.035 : 0.07, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(start); oscillator.stop(start + 0.16);
      });
    } catch { /* Audio is optional if the browser blocks Web Audio. */ }
  }, [soundOn]);

  useEffect(() => {
    document.title = "Afterlight | A circuit puzzle";
    try { setBest(Number(localStorage.getItem("afterlight-best") || 0)); } catch { /* Storage is optional. */ }
  }, []);
  useEffect(() => {
    if (phaseRef.current !== game.phase) {
      if (game.phase === "cleared") sound("light");
      if (game.phase === "won") {
        sound("win");
        setBest(previous => {
          const next = Math.max(previous, game.score);
          try { localStorage.setItem("afterlight-best", String(next)); } catch { /* Keep session score. */ }
          return next;
        });
      }
      if (game.phase === "lost") sound("lose");
      phaseRef.current = game.phase;
    }
  }, [game.phase, game.score, sound]);

  const size = LEVELS[game.level].size;
  const powered = poweredTiles(game.tiles, size);
  const beacons = game.tiles.map((tile, index) => tile.kind === "beacon" ? index : -1).filter(index => index !== -1);
  const lit = beacons.filter(index => powered.has(index)).length;

  const loadLevel = useCallback((level: number, score: number, phase: Phase = "playing") => {
    const board = makeBoard(level);
    setGame({ phase, level, ...board, initialEnergy: board.energy, moves: 0, score, baseScore: score });
    setSelected(Math.floor(LEVELS[level].size * LEVELS[level].size / 2));
  }, []);

  const turnTile = useCallback((index: number, clockwise = true) => {
    if (game.phase !== "playing" || game.tiles[index]?.kind !== "wire") return;
    sound("turn");
    setGame(previous => {
      if (previous.phase !== "playing" || previous.tiles[index]?.kind !== "wire") return previous;
      const tiles = previous.tiles.slice();
      tiles[index] = { ...tiles[index], mask: rotate(tiles[index].mask, clockwise) };
      const energy = previous.energy - 1;
      const complete = allBeaconsLit(tiles, poweredTiles(tiles, LEVELS[previous.level].size));
      const score = complete ? previous.score + (previous.level + 1) * 100 + energy * 10 : previous.score;
      return { ...previous, tiles, energy, moves: previous.moves + 1, score,
        phase: complete ? (previous.level === LEVELS.length - 1 ? "won" : "cleared") : energy <= 0 ? "lost" : "playing" };
    });
  }, [game.phase, game.tiles, sound]);

  const useHint = useCallback(() => {
    if (game.phase !== "playing" || game.energy < 3) return;
    const index = game.tiles.findIndex(tile => tile.path && tile.kind === "wire" && tile.mask !== tile.solution);
    if (index < 0) return;
    sound("turn"); setSelected(index);
    setGame(previous => {
      if (previous.phase !== "playing" || previous.energy < 3) return previous;
      const target = previous.tiles[index];
      const clockwise = rotate(target.mask) === target.solution || rotate(target.mask, false) !== target.solution;
      const tiles = previous.tiles.slice();
      tiles[index] = { ...target, mask: rotate(target.mask, clockwise) };
      const energy = previous.energy - 3;
      const complete = allBeaconsLit(tiles, poweredTiles(tiles, LEVELS[previous.level].size));
      const score = complete ? previous.score + (previous.level + 1) * 100 + energy * 10 : previous.score;
      return { ...previous, tiles, energy, moves: previous.moves + 1, score,
        phase: complete ? (previous.level === LEVELS.length - 1 ? "won" : "cleared") : energy <= 0 ? "lost" : "playing" };
    });
  }, [game, sound]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
      if (key === "p" || key === "escape") {
        setGame(previous => ({ ...previous, phase: previous.phase === "playing" ? "paused" : previous.phase === "paused" ? "playing" : previous.phase }));
        return;
      }
      if (game.phase === "playing") {
        if (key.startsWith("arrow")) {
          setSelected(previous => {
            const x = previous % size, y = Math.floor(previous / size);
            return key === "arrowleft" ? y * size + Math.max(0, x - 1) : key === "arrowright" ? y * size + Math.min(size - 1, x + 1) : key === "arrowup" ? Math.max(0, y - 1) * size + x : Math.min(size - 1, y + 1) * size + x;
          });
        } else if (key === " " || key === "enter") turnTile(selected, event.shiftKey ? reverseMode : !reverseMode);
        else if (key === "h") useHint();
      } else if (key === "enter") {
        if (game.phase === "start" || game.phase === "won") loadLevel(0, 0);
        else if (game.phase === "cleared") loadLevel(game.level + 1, game.score);
        else if (game.phase === "lost") loadLevel(game.level, game.baseScore);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [game.phase, game.level, game.score, game.baseScore, selected, size, reverseMode, turnTile, useHint, loadLevel]);

  const currentLevel = LEVELS[game.level];
  return <>
    <style>{styles}</style>
    <div className="app-shell">
      <header className="site-header">
        <div className="brand"><span className="brand-mark"><span /></span><span>AFTERLIGHT<span className="brand-period">.</span></span></div>
        <div className="header-center"><span className="live-dot" /> A CIRCUIT PUZZLE GAME</div>
        <div className="header-actions">
          <button className="icon-button" type="button" aria-label={soundOn ? "Mute sound" : "Enable sound"} title={soundOn ? "Mute sound" : "Enable sound"} onClick={() => setSoundOn(value => !value)}><Glyph name={soundOn ? "sound" : "mute"} /></button>
          <button className="header-pause" type="button" disabled={game.phase !== "playing" && game.phase !== "paused"} onClick={() => setGame(previous => ({ ...previous, phase: previous.phase === "playing" ? "paused" : "playing" }))}><Glyph name={game.phase === "paused" ? "play" : "pause"} size={15} /> {game.phase === "paused" ? "RESUME" : "PAUSE"}</button>
        </div>
      </header>
      <main className="game-layout">
        <aside className="story-panel">
          <div><div className="eyebrow"><span className="eyebrow-line" /> THE MISSION</div><h1>Bring the<br /><em>light</em> back.</h1><p className="story-copy">The grid has gone quiet. Turn the circuits, connect the current, and wake the city one light at a time.</p></div>
          <div className="chapter-list"><div className="section-caption">THE JOURNEY <span>0{LEVELS.length} CHAPTERS</span></div>
            {LEVELS.map((level, index) => <div className={`chapter ${index === game.level ? "chapter-active" : ""} ${index < game.level ? "chapter-done" : ""}`} key={level.name}><span className="chapter-number">0{index + 1}</span><span className="chapter-name">{level.name}</span><span className="chapter-indicator">{index < game.level ? "OK" : index === game.level ? "ON" : ""}</span></div>)}
          </div>
          <div className="story-footnote"><span className="tiny-spark">*</span> Every connection matters.</div>
        </aside>
        <section className="play-section" aria-label="Circuit puzzle">
          <div className="board-heading"><div><span className="board-overline">CHAPTER 0{game.level + 1} / 0{LEVELS.length}</span><h2>{currentLevel.name}</h2></div><span className="board-state"><span className="state-dot" /> {game.phase === "playing" ? "GRID ACTIVE" : game.phase === "paused" ? "ON HOLD" : "GRID STANDBY"}</span></div>
          <div className="board-frame">
            <div className="board-grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }} role="grid" aria-label={`Level ${game.level + 1} circuit board`}>
              {game.tiles.map((tile, index) => {
                const active = powered.has(index), x = index % size, y = Math.floor(index / size);
                return <button type="button" role="gridcell" key={`${game.level}-${index}`}
                  className={`tile ${active ? "tile-powered" : ""} ${tile.kind === "source" ? "tile-source" : ""} ${tile.kind === "beacon" ? "tile-beacon" : ""} ${selected === index && game.phase === "playing" ? "tile-selected" : ""}`}
                  disabled={game.phase !== "playing" || tile.kind !== "wire"}
                  aria-label={`${tile.kind === "source" ? "Power source" : tile.kind === "beacon" ? "Beacon" : "Rotatable wire"}, column ${x + 1}, row ${y + 1}${active ? ", powered" : ""}`}
                  onClick={() => { setSelected(index); turnTile(index, !reverseMode); }}
                  onContextMenu={event => { event.preventDefault(); setSelected(index); turnTile(index, false); }}
                ><WireIcon mask={tile.mask} powered={active} kind={tile.kind} /></button>;
              })}
            </div>
            {game.phase !== "playing" && <div className="game-overlay" role="dialog" aria-modal="true" aria-label={game.phase === "start" ? "Start game" : game.phase === "paused" ? "Game paused" : "Game result"}>
              <div className="overlay-orbit"><div className="orbit-center"><Glyph name={game.phase === "lost" ? "restart" : "bolt"} size={27} /></div></div>
              <div className="overlay-kicker">{game.phase === "start" ? "WELCOME TO THE GRID" : game.phase === "paused" ? "TAKE A BREATH" : game.phase === "cleared" ? "CONNECTION RESTORED" : game.phase === "lost" ? "SIGNAL LOST" : "THE CITY IS AWAKE"}</div>
              <h3>{game.phase === "start" ? <>A little spark<br />goes a long way.</> : game.phase === "paused" ? <>Time stands<br />still here.</> : game.phase === "cleared" ? <>The lights<br />are coming on.</> : game.phase === "lost" ? <>Out of<br />energy.</> : <>You brought<br />back the light.</>}</h3>
              <p>{game.phase === "start" ? "Rotate the wires to carry power from the source to every beacon. Five chapters await." : game.phase === "paused" ? "Your circuits will be right where you left them." : game.phase === "cleared" ? `Chapter 0${game.level + 1} complete. ${game.energy} energy left in reserve.` : game.phase === "lost" ? "The grid needs another try. Find the route before your energy runs out." : `All five chapters complete. Final score: ${game.score.toLocaleString()}.`}</p>
              <button className="primary-button" type="button" onClick={() => {
                if (game.phase === "start" || game.phase === "won") loadLevel(0, 0);
                else if (game.phase === "paused") setGame(previous => ({ ...previous, phase: "playing" }));
                else if (game.phase === "cleared") loadLevel(game.level + 1, game.score);
                else loadLevel(game.level, game.baseScore);
              }}>{game.phase === "start" ? "POWER UP" : game.phase === "paused" ? "RESUME GAME" : game.phase === "cleared" ? "NEXT CHAPTER" : game.phase === "lost" ? "TRY AGAIN" : "PLAY AGAIN"}<Glyph name="arrow" size={18} /></button>
              {game.phase === "paused" && <button className="overlay-secondary" type="button" onClick={() => loadLevel(game.level, game.baseScore)}>RESTART CHAPTER</button>}
              {game.phase === "start" && <span className="overlay-hint">CLICK TO ROTATE / CONNECT ALL LIGHTS</span>}
            </div>}
          </div>
          <div className="board-bottom"><span><span className="source-mini" /> SOURCE</span><span><span className="beacon-mini" /> BEACON</span><button className={`direction-button ${reverseMode ? "direction-reverse" : ""}`} type="button" aria-label={`Rotation direction: ${reverseMode ? "counterclockwise" : "clockwise"}. Change direction`} onClick={() => setReverseMode(value => !value)}><span>{reverseMode ? "CCW / TURN LEFT" : "CW / TURN RIGHT"}</span></button><span className="board-bottom-right">{currentLevel.subtitle}</span></div>
        </section>
        <aside className="status-panel">
          <div className="status-top"><div className="section-caption">CURRENT STATUS <span>LIVE FEED</span></div><div className="score-label">TOTAL SCORE</div><div className="score-value">{game.score.toLocaleString().padStart(4, "0")}</div>{best > 0 && <div className="best-score">PERSONAL BEST / {best.toLocaleString()}</div>}</div>
          <div className="status-divider" />
          <div className="energy-block"><div className="status-label"><Glyph name="bolt" size={16} /> ENERGY REMAINING</div><div className="energy-value">{String(game.energy).padStart(2, "0")}<span> / {String(game.initialEnergy).padStart(2, "0")}</span></div><div className="energy-track"><div style={{ width: `${Math.max(0, game.energy / game.initialEnergy * 100)}%` }} /></div><p>Every turn costs one energy. Make each move count.</p></div>
          <div className="status-divider" />
          <div className="beacons-block"><div className="status-label">BEACONS ONLINE <span>{lit} / {beacons.length}</span></div><div className="beacon-list">{beacons.map((index, order) => <div className={`beacon-row ${powered.has(index) ? "beacon-row-lit" : ""}`} key={index}><span className="beacon-status-light" /><span>Light 0{order + 1}</span><span>{powered.has(index) ? "ONLINE" : "OFFLINE"}</span></div>)}</div></div>
          <div className="status-divider" />
          <div className="control-block"><div className="status-label">HOW TO PLAY</div><p><strong>Click</strong> a wire to rotate.<br /><strong>Switch direction</strong> below the grid.</p><p><strong>Arrow keys</strong> to navigate.<br /><strong>Space</strong> to rotate / <strong>P</strong> to pause.</p><button type="button" className="hint-button" onClick={useHint} disabled={game.phase !== "playing" || game.energy < 3}><span>NEED A SPARK? USE HINT</span><span>-3 <Glyph name="bolt" size={12} /></span></button></div>
        </aside>
      </main>
      <footer className="site-footer"><span>AFTERLIGHT / BUILT FOR THE BRIGHT SIDE</span><span>TURN THE TIDE. LIGHT THE WAY.</span></footer>
    </div>
  </>;
}

const styles = `
  * { box-sizing: border-box; }
  :root { font-family: Arial, Helvetica, sans-serif; color: #e8e9dd; background: #101b1d; font-synthesis: none; }
  body { margin: 0; min-width: 320px; }
  button { font: inherit; }
  button:focus-visible { outline: 2px solid #e8b879; outline-offset: 3px; }
  .app-shell { min-height: 100vh; background: radial-gradient(ellipse at 47% 35%, #193036 0%, #101b1d 52%, #0b1517 100%); overflow: hidden; position: relative; }
  .app-shell:before { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .2; background-image: linear-gradient(#b6d2ca0b 1px, transparent 1px), linear-gradient(90deg, #b6d2ca0b 1px, transparent 1px); background-size: 76px 76px; }
  .site-header, .game-layout, .site-footer { position: relative; max-width: 1510px; margin: auto; }
  .site-header { min-height: 96px; padding: 0 52px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #ffffff19; }
  .brand { display: flex; align-items: center; gap: 14px; font-size: 20px; font-weight: 800; letter-spacing: .15em; white-space: nowrap; }
  .brand-period { color: #f0bc77; }
  .brand-mark { width: 34px; height: 34px; border: 2px solid #e9b778; border-radius: 50%; display: grid; place-items: center; transform: rotate(-35deg); }
  .brand-mark:after { content: ''; display: block; width: 14px; height: 14px; border: 2px solid #e9b778; border-radius: 50%; }
  .brand-mark span { position: absolute; width: 42px; height: 2px; background: #e9b778; }
  .header-center, .header-pause, .eyebrow, .section-caption, .board-overline, .board-state, .status-label, .score-label, .best-score, .overlay-kicker, .overlay-hint, .board-bottom, .site-footer, .hint-button, .overlay-secondary { font-size: 10px; font-weight: 700; letter-spacing: .17em; }
  .header-center { color: #7e9a99; display: flex; align-items: center; gap: 10px; margin-left: -80px; }
  .live-dot, .state-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #b5dec7; box-shadow: 0 0 13px #a9eac4; animation: breathe 2.7s ease-in-out infinite; }
  .header-actions { display: flex; align-items: center; gap: 23px; }
  .icon-button, .header-pause { background: none; border: 0; color: #ced8d1; cursor: pointer; }
  .icon-button { display: grid; place-items: center; padding: 8px; }
  .header-pause { display: flex; align-items: center; gap: 10px; padding: 10px 0; }
  .header-pause:disabled { opacity: .35; cursor: not-allowed; }
  .icon-button:hover, .header-pause:not(:disabled):hover { color: #f2be7a; }
  .game-layout { padding: 58px 52px 60px; display: grid; grid-template-columns: minmax(205px, 1fr) minmax(420px, 620px) minmax(205px, 1fr); gap: clamp(28px, 4vw, 72px); align-items: start; }
  .story-panel, .status-panel { min-height: 660px; display: flex; flex-direction: column; }
  .story-panel { padding-top: 17px; }
  .eyebrow { color: #edb978; display: flex; align-items: center; gap: 11px; }
  .eyebrow-line { width: 22px; height: 1px; background: #edb978; }
  h1 { font-family: Georgia, 'Times New Roman', serif; font-weight: 400; font-size: clamp(48px, 4vw, 69px); line-height: 1.035; letter-spacing: -.055em; margin: 30px 0 22px; white-space: nowrap; }
  h1 em { color: #f1bd7d; font-weight: 400; }
  .story-copy { max-width: 270px; color: #94aaa7; line-height: 1.8; font-size: 14px; margin: 0; }
  .chapter-list { margin-top: 85px; }
  .section-caption { color: #809895; display: flex; justify-content: space-between; gap: 6px; white-space: nowrap; }
  .section-caption span { color: #556e6b; }
  .chapter { display: flex; align-items: center; gap: 15px; height: 47px; border-bottom: 1px solid #ffffff12; color: #647c7a; font-size: 12px; }
  .chapter:first-of-type { margin-top: 13px; }
  .chapter-number { font-size: 10px; letter-spacing: .1em; color: #607977; }
  .chapter-name { flex: 1; white-space: nowrap; }
  .chapter-indicator { font-size: 10px; }
  .chapter-active { color: #f2bd7b; }
  .chapter-active .chapter-number, .chapter-done .chapter-number { color: #f2bd7b; }
  .chapter-done { color: #a7c6b6; }
  .story-footnote { margin-top: auto; color: #647e7b; font-family: Georgia, serif; font-style: italic; font-size: 14px; display: flex; align-items: center; gap: 12px; }
  .tiny-spark { color: #eebb7a; font-size: 22px; font-style: normal; }
  .play-section { min-width: 0; }
  .board-heading { min-height: 91px; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  .board-overline { color: #e9b97c; }
  h2 { margin: 8px 0 0; font-family: Georgia, serif; font-size: 31px; font-weight: 400; letter-spacing: -.035em; }
  .board-state { color: #a5bdaf; padding-top: 22px; white-space: nowrap; display: flex; gap: 9px; align-items: center; }
  .state-dot { width: 5px; height: 5px; }
  .board-frame { position: relative; padding: 12px; border: 1px solid #66817a68; background: #142326; box-shadow: 0 22px 70px #0005, inset 0 0 0 5px #ffffff05; }
  .board-frame:before, .board-frame:after { content: ''; position: absolute; width: 10px; height: 10px; border: 1px solid #dbaa72; z-index: 2; pointer-events: none; }
  .board-frame:before { top: -4px; left: -4px; border-right: 0; border-bottom: 0; }
  .board-frame:after { bottom: -4px; right: -4px; border-left: 0; border-top: 0; }
  .board-grid { width: 100%; aspect-ratio: 1; display: grid; gap: 4px; background: #1a2c2f; }
  .tile { min-width: 0; min-height: 0; padding: 0; position: relative; background: #213338; color: #668c8d; border: 1px solid #ffffff07; cursor: pointer; overflow: hidden; transition: background .2s, transform .18s, border-color .2s; }
  .tile:after { content: ''; position: absolute; inset: 5px; border: 1px solid #ffffff07; pointer-events: none; }
  .tile:not(:disabled):hover { background: #2b4548; border-color: #f1bc7b78; z-index: 1; transform: scale(.96); }
  .tile:disabled { cursor: default; }
  .tile-selected:not(:disabled) { border-color: #d8aa7190; }
  .tile-powered { background: #2b3e3b; color: #f4bc7b; }
  .tile-powered:not(:disabled):hover { background: #364b44; }
  .tile-source { background: #614b36; color: #ffd29a; }
  .tile-source.tile-powered { background: #6a5137; }
  .tile-beacon { color: #829897; }
  .tile-beacon.tile-powered { background: #455642; color: #f4d894; animation: beacon-bloom .65s ease-out; }
  .wire-svg { width: 100%; height: 100%; display: block; overflow: visible; }
  .wire-lines { stroke: currentColor; stroke-width: 14; stroke-linecap: butt; fill: none; transition: stroke .3s; }
  .is-powered .wire-lines { filter: drop-shadow(0 0 7px #ffca7c9c); }
  .junction { fill: currentColor; }
  .node-outer { fill: #182b2d; stroke: currentColor; stroke-width: 6; }
  .node-inner { fill: currentColor; }
  .node-symbol { fill: none; stroke: #654830; stroke-width: 4; stroke-linejoin: round; stroke-linecap: round; }
  .beacon-core { fill: none; stroke: currentColor; stroke-width: 4; }
  .beacon-dot { fill: currentColor; }
  .tile-beacon.tile-powered .beacon-dot { filter: drop-shadow(0 0 9px #ffe7ac); }
  .board-bottom { display: flex; align-items: center; gap: 22px; margin-top: 21px; color: #89a29b; }
  .board-bottom > span { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
  .direction-button { border: 0; padding: 2px 0; background: none; color: #eaba7b; cursor: pointer; white-space: nowrap; font-size: 19px; line-height: 1; display: flex; align-items: center; gap: 5px; }
  .direction-button span { font-size: 9px; font-weight: 700; letter-spacing: .1em; }
  .direction-button:hover, .direction-reverse { color: #ffe0a1; }
  .source-mini, .beacon-mini { width: 9px; height: 9px; border: 2px solid #e4ad71; border-radius: 50%; }
  .source-mini { background: #e4ad71; box-shadow: 0 0 9px #e4ad7170; }
  .beacon-mini { border-color: #94a6a0; }
  .board-bottom .board-bottom-right { margin-left: auto; color: #627e7a; letter-spacing: .05em; text-transform: none; font-weight: 400; font-family: Georgia, serif; font-size: 13px; font-style: italic; }
  .game-overlay { position: absolute; inset: 12px; z-index: 4; background: #0d1d20e8; backdrop-filter: blur(6px); display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 25px; animation: overlay-in .35s ease-out; }
  .overlay-orbit { width: 105px; height: 105px; border: 1px solid #d7ab7261; border-radius: 50%; display: grid; place-items: center; position: relative; margin-bottom: 30px; animation: orbit-pulse 4s ease-in-out infinite; }
  .overlay-orbit:before, .overlay-orbit:after { content: ''; position: absolute; border-radius: 50%; }
  .overlay-orbit:before { inset: 12px; border: 1px dashed #b58c6170; animation: spin 25s linear infinite; }
  .overlay-orbit:after { width: 5px; height: 5px; background: #f2c080; top: 8px; right: 16px; box-shadow: 0 0 12px #e9b46e; }
  .orbit-center { width: 50px; height: 50px; border-radius: 50%; background: #eaba7a; color: #21302d; display: grid; place-items: center; box-shadow: 0 0 32px #eeba794a; }
  .overlay-kicker { color: #e7b678; }
  .game-overlay h3 { font-family: Georgia, serif; font-weight: 400; font-size: clamp(36px, 3.5vw, 52px); line-height: 1.08; letter-spacing: -.04em; margin: 17px 0 15px; }
  .game-overlay p { color: #a4b9b1; font-size: 13px; line-height: 1.7; max-width: 290px; margin: 0 0 28px; }
  .primary-button { border: 0; background: #f1bd7e; color: #1b2928; min-width: 200px; min-height: 49px; padding: 0 19px; display: flex; justify-content: space-between; align-items: center; gap: 25px; cursor: pointer; font-size: 11px; font-weight: 800; letter-spacing: .13em; transition: background .2s, transform .2s, box-shadow .2s; }
  .primary-button:hover { background: #ffcf90; transform: translateY(-3px); box-shadow: 0 12px 25px #0005; }
  .overlay-hint { color: #698481; margin-top: 24px; font-size: 9px; }
  .overlay-secondary { background: none; color: #90aaa2; border: 0; cursor: pointer; margin-top: 22px; }
  .overlay-secondary:hover { color: #eabc80; }
  .status-panel { padding-top: 17px; }
  .score-label { color: #8da9a1; margin-top: 40px; }
  .score-value { font-family: Georgia, serif; font-size: 59px; line-height: 1.15; letter-spacing: -.07em; margin: 4px 0; font-variant-numeric: tabular-nums; }
  .best-score { color: #7c9790; margin-top: 7px; font-size: 9px; }
  .status-divider { width: 100%; height: 1px; background: #ffffff18; margin: 32px 0; }
  .status-label { display: flex; justify-content: space-between; align-items: center; gap: 7px; color: #aec2b8; white-space: nowrap; }
  .energy-block .status-label { justify-content: flex-start; color: #efbd80; }
  .energy-value { font-family: Georgia, serif; color: #efbd80; font-size: 55px; letter-spacing: -.04em; margin: 15px 0 14px; line-height: 1; font-variant-numeric: tabular-nums; }
  .energy-value span { font-family: Arial, sans-serif; color: #68827d; font-size: 16px; letter-spacing: 0; }
  .energy-track { height: 4px; background: #38504b; width: 100%; }
  .energy-track div { height: 100%; background: #efbd80; transition: width .35s ease; box-shadow: 0 0 12px #f5bd7b8a; }
  .energy-block p, .control-block p { color: #829c95; font-size: 12px; line-height: 1.7; margin: 13px 0 0; }
  .beacons-block .status-label span { color: #e9b879; }
  .beacon-list { margin-top: 15px; }
  .beacon-row { display: flex; align-items: center; gap: 10px; color: #899d98; height: 32px; font-size: 11px; }
  .beacon-row span:nth-child(2) { flex: 1; }
  .beacon-row span:last-child { color: #647b75; font-size: 9px; letter-spacing: .1em; }
  .beacon-status-light { width: 8px; height: 8px; border: 1px solid #68817a; border-radius: 50%; }
  .beacon-row-lit .beacon-status-light { background: #e9bb7e; border-color: #e9bb7e; box-shadow: 0 0 11px #f3c485; }
  .beacon-row-lit span:last-child { color: #e9bb7e; }
  .control-block p { margin-top: 16px; }
  .control-block strong { color: #cfddd1; font-weight: 600; }
  .hint-button { width: 100%; margin-top: 25px; padding: 13px 0; background: none; color: #eaba7b; border: 0; border-top: 1px solid #eaba7b69; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 5px; text-align: left; font-size: 9px; }
  .hint-button span:last-child { display: flex; align-items: center; gap: 2px; white-space: nowrap; }
  .hint-button:hover:not(:disabled) { color: #ffe1aa; }
  .hint-button:disabled { color: #60726d; border-color: #ffffff1a; cursor: not-allowed; }
  .site-footer { min-height: 50px; padding: 0 52px 20px; color: #54706b; display: flex; justify-content: space-between; align-items: end; font-size: 9px; border-top: 1px solid #ffffff0e; }
  @keyframes breathe { 50% { opacity: .35; box-shadow: 0 0 4px #a9eac4; } }
  @keyframes overlay-in { from { opacity: 0; transform: scale(.98); } to { opacity: 1; transform: scale(1); } }
  @keyframes orbit-pulse { 50% { box-shadow: 0 0 30px #e9b46e23; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes beacon-bloom { from { box-shadow: inset 0 0 35px #f3d18a80; } to { box-shadow: inset 0 0 0 #f3d18a00; } }
  @media (max-width: 1180px) { .site-header { padding: 0 30px; } .game-layout { padding: 40px 30px 60px; grid-template-columns: minmax(165px, .8fr) minmax(370px, 1.8fr) minmax(175px, .8fr); gap: 24px; } h1 { font-size: 48px; } .chapter-list { margin-top: 60px; } .site-footer { padding-left: 30px; padding-right: 30px; } .section-caption { font-size: 9px; } .status-panel, .story-panel { min-height: 580px; } }
  @media (max-width: 900px) { .header-center { display: none; } .game-layout { max-width: 700px; grid-template-columns: 1fr 220px; padding-top: 32px; } .story-panel { grid-column: 1 / -1; min-height: 0; padding: 0; display: block; } .story-panel h1 { margin: 15px 0 8px; font-size: 48px; } .story-copy { max-width: 590px; } .chapter-list, .story-footnote { display: none; } .play-section { grid-column: 1; } .status-panel { grid-column: 2; min-height: 0; } .board-heading { min-height: 75px; } .status-divider { margin: 24px 0; } .score-value { font-size: 50px; } }
  @media (max-width: 650px) { .site-header { min-height: 70px; padding: 0 19px; } .brand { font-size: 15px; gap: 10px; } .brand-mark { width: 27px; height: 27px; } .brand-mark:after { width: 10px; height: 10px; } .brand-mark span { width: 33px; } .header-actions { gap: 9px; } .header-pause { font-size: 0; } .header-pause svg { width: 18px; height: 18px; } .game-layout { display: flex; flex-direction: column; gap: 29px; padding: 28px 18px 35px; } .story-panel, .play-section, .status-panel { width: 100%; } .story-panel h1 { font-size: 44px; } .story-copy { font-size: 13px; line-height: 1.6; } .board-heading { min-height: 72px; } h2 { font-size: 27px; } .board-state { font-size: 8px; padding-top: 18px; } .board-frame { padding: 7px; } .board-grid { gap: 3px; } .game-overlay { inset: 7px; } .overlay-orbit { width: 75px; height: 75px; margin-bottom: 17px; } .overlay-orbit:before { inset: 8px; } .orbit-center { width: 39px; height: 39px; } .game-overlay h3 { font-size: clamp(30px, 9vw, 44px); margin: 10px 0; } .game-overlay p { font-size: 11px; margin-bottom: 17px; max-width: 260px; } .primary-button { min-height: 42px; min-width: 178px; } .overlay-hint { margin-top: 13px; font-size: 8px; } .board-bottom { margin-top: 15px; gap: 12px; font-size: 9px; } .board-bottom .board-bottom-right { display: none; } .direction-button { margin-left: auto; } .status-panel { display: grid; grid-template-columns: 1fr 1fr; column-gap: 24px; row-gap: 20px; padding-top: 6px; } .status-panel .status-divider { display: none; } .status-top { grid-column: 1 / -1; } .score-label { margin-top: 22px; } .score-value { font-size: 44px; } .energy-value { font-size: 46px; } .beacons-block { grid-column: 2; } .control-block { grid-column: 1 / -1; border-top: 1px solid #ffffff18; padding-top: 20px; } .control-block p { display: inline-block; margin-right: 22px; } .hint-button { max-width: 290px; } .site-footer { padding: 15px 18px 25px; gap: 20px; font-size: 8px; } }
  @media (max-width: 390px) { .board-bottom .board-bottom-right { display: none; } .board-state { display: none; } .game-overlay p { line-height: 1.4; } .overlay-orbit { margin-bottom: 10px; } .overlay-hint { display: none; } }
  @media (prefers-reduced-motion: reduce) { *, *:before, *:after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
`;