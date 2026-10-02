import { Kbd } from "./ui";

export function HelpContent() {
  return (
    <div className="space-y-4 text-[15px] leading-snug">
      <section>
        <h3 className="font-title font-bold text-lg mb-1">🎯 Your Goal</h3>
        <p>
          The land is blank, and something is erasing it. Find and claim <b>3 Sigil Altars 🔱</b> (each guarded), then reach the <b>Lament Spire 🌀</b> at the far corner of the world
          and defeat <b>The Unwritten</b>. The <b>Unwriting</b> creeps out from where you began, so never linger. Your compass needle always points to the Spire.
        </p>
      </section>
      <section>
        <h3 className="font-title font-bold text-lg mb-1">🪶 Drawing the Map</h3>
        <ul className="list-disc ml-5 space-y-1">
          <li><b>Unknown</b> tiles are blank. As you walk, tiles inside your sight radius become <b>glimpsed</b> (pale, dashed). They show terrain only, and may be stale.</li>
          <li>Use the <b>Quill</b> to spend ink and <b>chart</b> glimpsed tiles. Charted tiles reveal their landmarks, lairs, hazards and events, and become <b>stable</b>.</li>
          <li><b>Mapped ground is safer:</b> −1 supply cost on rough terrain, no extra sanity drain, ~65% fewer ambushes, hazards mostly avoided, and lairs let you strike first.</li>
          <li><b>Unmapped land shifts at dawn.</b> Glimpsed tiles shimmer purple when the land beneath them changed. Walking onto a stale tile costs sanity.</li>
          <li>Ink Flare damage scales with how much of the world you have charted.</li>
        </ul>
      </section>
      <section>
        <h3 className="font-title font-bold text-lg mb-1">🧠 Sanity &amp; Hallucination</h3>
        <p>
          Unmapped steps, night, ruins and the Unwriting drain sanity. Below ~65%, your map starts to <b>lie</b>: terrain and icons flicker on unpinned tiles.
          <b> Pinned notes 📌 always show the truth</b> and are marked with a gold dashed border. At 0 sanity you are lost to the Lament.
        </p>
      </section>
      <section>
        <h3 className="font-title font-bold text-lg mb-1">⚖️ Supplies, Factions &amp; Landmarks</h3>
        <ul className="list-disc ml-5 space-y-1">
          <li>Every step costs supplies and time. Twelve time units make a day; the last four are night (narrow sight, bolder ambushes). Starving hurts vigor and sanity.</li>
          <li>Four factions react to your deeds. Reputation changes prices, ambushes, rewards and the final fight. The Wardens oppose the Choir; the Concord and Hollow Folk distrust each other.</li>
          <li>Landmarks offer rest, trade, lore, relics and rumors. Press <Kbd>F</Kbd> while standing on one.</li>
        </ul>
      </section>
      <section>
        <h3 className="font-title font-bold text-lg mb-1">⚔️ Encounters</h3>
        <p>
          Combat is turn-based. Enemies telegraph their next move. <b>Strike</b> for damage, <b>Ink Flare</b> (ink) ignores armor and stuns, <b>Brace</b> softens the next blow and steadies your mind,
          <b> Parley</b> may end a fight peacefully, <b>Flee</b> returns you to your last tile. The final boss censors one of your actions each turn.
        </p>
      </section>
      <section>
        <h3 className="font-title font-bold text-lg mb-1">⌨️ Controls</h3>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
          <div><Kbd>Click</Kbd> Travel to a tile / use current tool</div>
          <div><Kbd>Q</Kbd><Kbd>E</Kbd><Kbd>A</Kbd><Kbd>D</Kbd><Kbd>Z</Kbd><Kbd>C</Kbd> Step in six directions</div>
          <div><Kbd>1</Kbd> Walk · <Kbd>2</Kbd> Quill · <Kbd>3</Kbd> Pin</div>
          <div><Kbd>Drag</Kbd> with Quill to chart · otherwise pan</div>
          <div><Kbd>Right-click</Kbd> Cycle a note on any known tile</div>
          <div><Kbd>S</Kbd> Quick survey (chart adjacent tiles)</div>
          <div><Kbd>R</Kbd> Make camp · <Kbd>F</Kbd> Enter landmark</div>
          <div><Kbd>H</Kbd> Tonic · <Kbd>G</Kbd> Laudanum</div>
          <div><Kbd>J</Kbd> Journal · <Kbd>Esc</Kbd> Pause</div>
          <div><Kbd>Wheel</Kbd> / <Kbd>+</Kbd><Kbd>-</Kbd> Zoom · Arrows pan · <Kbd>Space</Kbd> recentre</div>
          <div><Kbd>M</Kbd> Mute</div>
          <div>In fights/menus: <Kbd>1</Kbd>-<Kbd>5</Kbd> choose an option</div>
          <div className="sm:col-span-2">Touch: tap to travel, drag to pan or chart, use the bottom toolbar for tools.</div>
        </div>
      </section>
    </div>
  );
}
