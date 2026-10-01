import type { CSSProperties } from "react";
import { CARDS } from "../game/cards";

interface Props {
  id: string;
  selected?: boolean;
  dim?: boolean;
  isStatic?: boolean;
  clicky?: boolean;
  enter?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  cw?: string;
  title?: string;
}

export default function Card({ id, selected, dim, isStatic, clicky, enter, onClick, style, cw, title }: Props) {
  const c = CARDS[id];
  const cls = [
    "card",
    c.rarity === 2 ? "rare" : c.rarity === 3 ? "epic" : "",
    selected ? "selected" : "",
    dim ? "dim" : "",
    isStatic ? "static" : "",
    clicky ? "clicky" : "",
    enter ? "card-enter" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const st = { ["--hue" as string]: c.hue, ...(cw ? { ["--cw" as string]: cw } : {}), ...style } as CSSProperties;
  return (
    <div className={cls} style={st} onClick={onClick} title={title}>
      <div className="cost">{c.cost}</div>
      <div className="cname">{c.name}</div>
      <div className="art">
        {c.art}
        {c.keyword && (
          <span
            style={{
              position: "absolute",
              right: "0.2em",
              bottom: "0.1em",
              fontSize: "0.3em",
              background: "rgba(0,0,0,.65)",
              color: "#ffe9a8",
              padding: "0.1em 0.5em",
              borderRadius: "999px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {c.keyword}
          </span>
        )}
      </div>
      <div className="type">{c.kind === "unit" ? "Unit · terraforms" : "Terraform spell"}</div>
      <div className="ctext">{c.text}</div>
      {c.kind === "unit" && (
        <div className="cstats">
          <span className="a">⚔ {c.atk}</span>
          <span className="h">♥ {c.hp}</span>
        </div>
      )}
    </div>
  );
}
