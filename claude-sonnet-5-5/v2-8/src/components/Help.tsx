import type { ReactNode } from "react";
import { Key } from "./ui";

const Row = ({ k, d }: { k: ReactNode; d: string }) => (
  <div className="flex items-center gap-3 py-1 border-b border-white/5"><div className="w-44 flex gap-1 flex-wrap">{k}</div><div className="text-sm text-sky-50/90">{d}</div></div>
);

export default function Help() {
  return (
    <div className="space-y-5 text-sm text-sky-50/90">
      <section>
        <h3 className="font-display text-xl text-amber-300 mb-1">THE EXPEDITION</h3>
        <p>
          You lead a caravan of snow vehicles across six legs of a drifting ice sheet to <b>Polaris Station</b>. Drive the lead tractor, read the cracks,
          keep fuel, food and crew spirits up, trade at stations, and outrun the collapsing shelf in the final leg. Lose the tractor, or your whole crew, and it's over.
        </p>
      </section>
      <section>
        <h3 className="font-display text-xl text-amber-300 mb-1">CONTROLS</h3>
        <Row k={<><Key>W</Key><Key>↑</Key></>} d="Throttle. Hold to accelerate." />
        <Row k={<><Key>S</Key><Key>↓</Key></>} d="Brake. Slow down before crevasses to reduce fall damage." />
        <Row k={<><Key>A</Key><Key>D</Key><Key>←</Key><Key>→</Key></>} d="Steer. Grip falls on thin ice and in wind." />
        <Row k={<Key>SPACE</Key>} d="Leap! The whole caravan jumps the same spot. Needs speed; heavy loads shorten the jump." />
        <Row k={<Key>E</Key>} d="Lay a plank bridge over the nearest crevasse ahead (costs planks by width)." />
        <Row k={<Key>C</Key>} d="Make / break camp (must be stopped). Crew recover, vehicles repair, time flows faster." />
        <Row k={<Key>R</Key>} d="Fire a flare to scare off raiders." />
        <Row k={<Key>J</Key>} d="Burn one cargo unit (or plank) for +3 fuel. Also sheds weight." />
        <Row k={<><Key>Tab</Key><Key>G</Key></>} d="Crew panel (pauses the game)." />
        <Row k={<><Key>Esc</Key><Key>P</Key></>} d="Pause menu." />
        <Row k={<Key>Gamepad</Key>} d="Left stick steer · RT throttle · LT brake · A jump · X bridge · Y camp · B flare · LB burn · Start pause." />
        <Row k={<Key>Touch</Key>} d="On-screen buttons appear on touch devices (or enable in Settings)." />
      </section>
      <section className="grid sm:grid-cols-2 gap-3">
        {[
          ["🧊 Ice & crevasses", "Crevasses breathe wider and narrower. Jump narrow gaps at their narrowest, bridge wide ones. Hidden snow-bridged cracks collapse under you until your scout or radar spots them. The first vehicle to fall leaves a rubble ramp for the rest."],
          ["⚖️ Weight", "Cargo, fuel and modules add weight: more fuel burn, lower top speed, shorter jumps, faster bridge wear, and thin ice cracks sooner under heavy loads."],
          ["🌬️ Weather & cold", "Blizzards push you sideways, limit sight and burn extra fuel. Cold makes quakes more frequent and drains crew warmth unless heaters keep up. Aurora nights lift spirits."],
          ["👥 Crew", "Every crew member has a role, a trait and bonds with the others. Friends lift each other's morale; feuds drag it down. Low morale weakens their role bonus — and at rock bottom they desert. Choices in events shape these bonds."],
          ["💰 Trade", "Buy goods cheap at one station, sell dear at another. Accept contracts for bonus scrip. Refuel, restock planks and flares, repair, and refit modules and wagons at every station."],
          ["🏴‍☠️ Raiders & hazards", "Raiders board your vehicles and steal. Turrets shoot them, flares scatter them, armor blunts them. Watch for seracs, thin ice, avalanche waves (jump them!), ice quakes, and the Maw."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-xl bg-black/25 border border-white/10 p-3">
            <div className="font-display text-lg text-sky-200">{t}</div>
            <div className="text-[13px] text-white/75">{d}</div>
          </div>
        ))}
      </section>
      <section>
        <h3 className="font-display text-xl text-amber-300 mb-1">PROGRESSION</h3>
        <p>
          Every expedition earns <b>Renown</b>, scaled by difficulty and modifiers. Spend it in the <b>Expedition Archive</b> on permanent perks and to unlock
          new modules and wagons. Progress is saved in your browser.
        </p>
      </section>
    </div>
  );
}
