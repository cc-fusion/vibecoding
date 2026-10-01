import { CARDS, PERKS, TERRAIN_INFO, Terrain } from "../game/cards";
import Card from "./Card";

export function RulesModal({ onClose }: { onClose: () => void }) {
  const terr = Object.keys(TERRAIN_INFO) as Terrain[];
  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel p-5 max-w-2xl w-full max-h-[92vh] overflow-y-auto scroll-thin" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--gold)" }}>
          How to Rule a Micro-Kingdom
        </h2>
        <ul className="space-y-2 text-sm leading-relaxed list-disc pl-5">
          <li>
            <b>Goal:</b> Destroy the enemy Keep (top) before yours (bottom) falls. Win five battles to claim the realm.
          </li>
          <li>
            <b>Your turn:</b> Spend energy to play cards. Energy refills each turn and grows by 1 each round (max 6). Click a card, then a
            highlighted tile. Hover tiles to preview the terraform (dashed chips) and any casualties (💀). Then press <b>End Turn</b>.
          </li>
          <li>
            <b>Every card reshapes the land.</b> Units terraform their own tile and neighbours the moment they arrive; spells reshape tiles,
            slide whole rows and columns, or flatten everything.
          </li>
          <li>
            <b>Combat:</b> At the end of your turn each awake unit (no <i>zz</i>) attacks along its column in the direction of its arrow:
            your units strike <b>up</b>, enemy units strike <b>down</b>. A unit hits the nearest enemy unit in that lane. If the lane
            is clear, it hits the Keep. <b>Pierce</b> hits every enemy in the lane. Units you place this turn sleep until your next turn.
            There is no retaliation, so position and terrain decide fights. Hover any unit to see what it will hit.
          </li>
          <li>
            <b>Reactions (end of each round):</b> Lava beside Water cools into <b>Mountain</b>. Forest beside Lava burns to <b>Plains</b>.
          </li>
          <li>
            <b>Dusk:</b> From round 10, both Keeps take growing damage each round, so stalemates can't last.
          </li>
          <li>
            <b>Between battles:</b> Add a card to your deck. After battles 2 and 4 you also pick a Royal Decree perk.
          </li>
        </ul>
        <h3 className="font-bold mt-4 mb-2" style={{ color: "var(--gold)" }}>
          Terrain
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          {terr.map((t) => (
            <div key={t} className="flex gap-2 items-start rounded-lg p-2" style={{ background: "rgba(255,255,255,0.06)" }}>
              <span className="text-xl">{TERRAIN_INFO[t].icon}</span>
              <span>
                <b>{TERRAIN_INFO[t].name}.</b> {TERRAIN_INFO[t].desc}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs opacity-70 mt-3">
          Keys: 1–7 select a card · Enter/Space end turn (or cast an untargeted card) · Esc cancel.
        </p>
        <div className="text-right mt-3">
          <button className="btn" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeckModal({ deck, perks, onClose }: { deck: string[]; perks: string[]; onClose: () => void }) {
  const counts = new Map<string, number>();
  deck.forEach((d) => counts.set(d, (counts.get(d) || 0) + 1));
  const ids = Array.from(counts.keys()).sort((a, b) => CARDS[a].cost - CARDS[b].cost || CARDS[a].name.localeCompare(CARDS[b].name));
  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel p-5 max-w-4xl w-full max-h-[92vh] overflow-y-auto scroll-thin" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-xl font-bold" style={{ color: "var(--gold)" }}>
            Your Deck ({deck.length} cards)
          </h2>
          <button className="btn btn-ghost" onClick={onClose}>
            Close ✕
          </button>
        </div>
        {perks.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {perks.map((p) => {
              const pk = PERKS.find((x) => x.id === p)!;
              return (
                <span key={p} className="text-xs rounded-full px-3 py-1" style={{ background: "rgba(243,201,105,.15)", border: "1px solid rgba(243,201,105,.4)" }} title={pk.text}>
                  {pk.icon} {pk.name}
                </span>
              );
            })}
          </div>
        )}
        <div className="flex flex-wrap gap-4 justify-center pt-3">
          {ids.map((id) => (
            <div key={id} className="relative">
              <Card id={id} isStatic cw="112px" />
              {counts.get(id)! > 1 && (
                <span
                  className="absolute -top-2 -right-2 rounded-full px-2 text-sm font-bold"
                  style={{ background: "#c93a4c", border: "2px solid #1b1008" }}
                >
                  ×{counts.get(id)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
