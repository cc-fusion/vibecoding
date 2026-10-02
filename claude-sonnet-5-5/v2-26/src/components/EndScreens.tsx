import { useEffect } from "react";
import { audio } from "../game/audio";
import { rankName } from "../game/campaign";
import type { Campaign } from "../game/types";
import { fmtGold, fmtTime } from "../game/util";

function StatGrid({ c }: { c: Campaign }) {
  const s = c.stats;
  const rows: [string, string][] = [
    ["Days survived", String(c.day)],
    ["Final rank", rankName(c.renown)],
    ["Renown", String(c.renown)],
    ["Jobs completed", String(s.jobsDone)],
    ["Jobs failed", String(s.jobsFailed)],
    ["Locks opened", String(s.stagesCracked)],
    ["Flawless jobs (3★)", String(s.perfect)],
    ["Gold earned", `${fmtGold(s.goldEarned)}g`],
    ["Best payout", `${fmtGold(s.bestPay)}g`],
    ["Picks snapped", String(s.picksBroken)],
    ["Alarms raised", String(s.alarms)],
    ["Guards dodged", `${s.patrolsDodged} (caught ${s.patrolsCaught})`],
    ["Loot fenced", String(s.lootSold)],
    ["Time at the locks", fmtTime(s.playTime)],
  ];
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-black/30 p-3 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <div className="text-[#9d9484]">{k}</div>
          <div className="text-right font-semibold tabular-nums text-[#f3d88d]">{v}</div>
        </div>
      ))}
    </div>
  );
}

export function GameOver({ kind, campaign, onRetry, onTitle }: { kind: "arrested" | "bankrupt"; campaign: Campaign; onRetry: () => void; onTitle: () => void }) {
  useEffect(() => {
    audio.lose();
  }, []);
  const arrested = kind === "arrested";
  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_50%_20%,#3a1414_0%,#160a0c_60%,#050304_100%)] p-4">
      <div className="panel anim-pop w-full max-w-lg p-6">
        <div className="text-center">
          <div className="mb-1 text-5xl">{arrested ? "⛓️" : "📉"}</div>
          <h2 className="font-display text-3xl font-black text-red-400">{arrested ? "ARRESTED" : "BANKRUPT"}</h2>
          <p className="mb-4 mt-1 text-sm text-[#bfb496]">
            {arrested
              ? `The watch kicks in the door. House ${campaign.house} ends in irons — Heat reached 100.`
              : `The creditors seize the workshop. House ${campaign.house} drowned in debt.`}
          </p>
        </div>
        <StatGrid c={campaign} />
        <div className="mt-4 flex gap-2">
          <button className="btn flex-1" onClick={() => { audio.back(); onTitle(); }}>Title</button>
          <button className="btn btn-primary flex-[2]" onClick={() => { audio.ui(); onRetry(); }}>Found a New Dynasty</button>
        </div>
      </div>
    </div>
  );
}

export function Victory({ campaign, onContinue, onNextGen, onTitle }: { campaign: Campaign; onContinue: () => void; onNextGen: () => void; onTitle: () => void }) {
  useEffect(() => {
    audio.win();
  }, []);
  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_50%_20%,#4a3a14_0%,#1c1408_60%,#070502_100%)] p-4">
      <div className="panel anim-pop w-full max-w-lg p-6" style={{ borderColor: "#f3d88d" }}>
        <div className="text-center">
          <div className="anim-float mb-1 text-6xl">🏛️</div>
          <h2 className="font-display title-shimmer text-3xl font-black">DYNASTY ASCENDANT</h2>
          <p className="mb-4 mt-1 text-sm text-[#d8d0bc]">
            The Sovereign's Vault swings wide. The name <b className="text-[#f3d88d]">House {campaign.house}</b> will be whispered in every locksmith's guild for a hundred years.
          </p>
        </div>
        <StatGrid c={campaign} />
        <p className="mt-3 text-center text-xs text-[#bfb496]">
          Pass the legacy to your heir: Generation {campaign.generation + 2} starts with +100g more, spring-steel picks, and steadier hands (+4% tolerance each generation).
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button className="btn btn-primary" onClick={() => { audio.ui(); onNextGen(); }}>⚜ Begin the Next Generation</button>
          <button className="btn" onClick={() => { audio.ui(); onContinue(); }}>Continue This Dynasty</button>
          <button className="btn btn-sm" onClick={() => { audio.back(); onTitle(); }}>Return to Title</button>
        </div>
      </div>
    </div>
  );
}
