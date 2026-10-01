import type { CSSProperties } from "react";
import { CARDS, TERRAIN_INFO, Terrain } from "../game/cards";
import { effAtk, Preview, State } from "../game/engine";

export interface FloatItem {
  id: number;
  target: number | "kp" | "ke";
  text: string;
  kind: "dmg" | "heal" | "info";
}
export interface GhostItem {
  id: number;
  idx: number;
  art: string;
}

interface Props {
  state: State;
  valid: Set<number>;
  preview: Preview | null;
  hover: number | null;
  hitTiles: number[];
  onTile: (i: number) => void;
  onHover: (i: number | null) => void;
  floats: FloatItem[];
  lunge: { idx: number; dir: number } | null;
  ghosts: GhostItem[];
  flashes: Record<number, number>;
}

const TERRAINS: Terrain[] = ["plains", "forest", "mountain", "water", "lava"];

const DECOR: Record<Terrain, [string, number, number, number][]> = {
  plains: [["🌾", 6, 8, 0.2], ["🌼", 74, 12, 0.16], ["🌾", 70, 62, 0.2], ["🌿", 8, 58, 0.17]],
  forest: [["🌲", 4, 6, 0.3], ["🌳", 68, 8, 0.3], ["🌲", 70, 58, 0.26], ["🌲", 2, 56, 0.24]],
  mountain: [["⛰️", 2, 4, 0.34], ["🏔️", 62, 10, 0.3], ["🪨", 70, 62, 0.2], ["🪨", 6, 62, 0.2]],
  water: [["🐟", 10, 12, 0.18], ["〰️", 66, 14, 0.2], ["〰️", 12, 62, 0.2], ["🫧", 72, 64, 0.16]],
  lava: [["🌋", 4, 6, 0.26], ["🔥", 70, 10, 0.2], ["🔥", 8, 62, 0.2], ["💨", 70, 62, 0.18]],
};

export default function Board({ state, valid, preview, hover, hitTiles, onTile, onHover, floats, lunge, ghosts, flashes }: Props) {
  return (
    <div className="board-grid">
      {state.tiles.map((tile, i) => {
        const info = TERRAIN_INFO[tile.terrain];
        const u = tile.unit;
        const isValid = valid.has(i);
        const pv = preview;
        const changed = pv && pv.changed.includes(i);
        const dies = pv && pv.dies.includes(i);
        const lunging = lunge && lunge.idx === i;
        const style = { ["--lift" as string]: info.lift } as CSSProperties;
        const cls = [
          "tile",
          isValid ? "valid clickable" : "",
          hitTiles.includes(i) ? "target-hit" : "",
          hover === i ? "hovered" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const eff = u ? effAtk(state, u, tile.terrain) : 0;
        return (
          <button
            key={i}
            className={cls}
            style={style}
            onClick={() => onTile(i)}
            onMouseEnter={() => onHover(i)}
            onMouseLeave={() => onHover(null)}
            title={`${info.name}: ${info.desc}`}
            aria-label={`Tile ${i + 1}, ${info.name}${u ? ", " + CARDS[u.cardId].name : ""}`}
          >
            <div className="slab" />
            <div className="face">
              {TERRAINS.map((t) => (
                <div key={t} className={`terr terr-${t} ${t === tile.terrain ? "on" : ""}`}>
                  {DECOR[t].map(([e, x, y, s], k) => (
                    <span key={k} className="decor" style={{ left: `${x}%`, top: `${y}%`, fontSize: `calc(var(--t) * ${s})` }}>
                      {e}
                    </span>
                  ))}
                </div>
              ))}
              <div className="tile-name">{info.name}</div>
              {flashes[i] ? <div key={flashes[i]} className="flash" /> : null}
            </div>

            {u && (
              <div
                key={u.uid}
                className={`unit ${u.owner === "p" ? "mine" : "foe"} ${u.ready ? "" : "asleep"}`}
                style={lunging ? { transform: `translateY(${lunge!.dir * 16}px) scale(1.18)` } : undefined}
              >
                <div className="unit-body">{CARDS[u.cardId].art}</div>
                <span className="face-arrow" style={u.owner === "p" ? { top: -8 } : { bottom: -8 }}>
                  {u.owner === "p" ? "▲" : "▼"}
                </span>
                {!u.ready && <span className="zz">zz</span>}
                {u.keyword && <span className="kw">{u.keyword === "pierce" ? "➶" : "🔥"}</span>}
                <div className="unit-stats">
                  <span className={`stat atk ${eff > u.atk ? "up" : eff < u.atk ? "down" : ""}`}>{eff}</span>
                  <span className={`stat hp ${u.hp < u.maxHp ? "down" : ""}`}>{u.hp}</span>
                </div>
              </div>
            )}

            {ghosts
              .filter((g) => g.idx === i)
              .map((g) => (
                <div key={g.id} className="ghost">
                  {g.art}
                </div>
              ))}

            {changed && pv && (
              <div className="preview-chip">→ {TERRAIN_INFO[pv.terrain[i]].icon}</div>
            )}
            {dies && <div className="preview-skull">💀</div>}

            {floats
              .filter((f) => f.target === i)
              .map((f) => (
                <div key={f.id} className={`float ${f.kind}`}>
                  {f.text}
                </div>
              ))}
          </button>
        );
      })}
    </div>
  );
}
