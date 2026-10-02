import type { Sim } from "../game/sim";

export interface TutStep {
  title: string;
  text: string;
  /** null = manual "Next" step */
  check: ((sim: Sim, mem: Record<string, number>) => boolean) | null;
  init?: (sim: Sim, mem: Record<string, number>) => void;
}

const avgTgt = (s: Sim) => s.rods.reduce((a, r) => a + r.tgt, 0) / 4;

export const TUTORIAL: TutStep[] = [
  {
    title: "Welcome to the control room",
    text: "Left: reactor controls and alarms. Centre: live plant schematic and trend chart. Right: Systems, Safety and Maintenance tabs. Top bar: grid demand vs your output, cash, compliance. This training shift can't hurt you.",
    check: null,
  },
  {
    title: "1 · Withdraw the control rods",
    text: "Drag the Master Rods slider LEFT (or hold W) to withdraw rods ~5%. Lower insertion = more reactivity. Watch the core glow and power rise.",
    init: (s, m) => { m.rods = avgTgt(s); },
    check: (s, m) => avgTgt(s) < m.rods - 0.04,
  },
  {
    title: "2 · Feedback keeps you honest",
    text: "Hotter coolant and fuel add negative reactivity, so power drifts back toward whatever the turbine is pulling. Steam demand — not just rods — sets power. The auto-governor opens the turbine valve to meet grid demand (yellow dashed line).",
    check: null,
  },
  {
    title: "3 · Engage Rod Autopilot",
    text: "Click AUTOPILOT (or press T). It walks the rods to hold coolant average temperature on a load program, so you don't have to chase xenon by hand.",
    check: (s) => s.rodAuto,
  },
  {
    title: "4 · Raise Coolant Pump B",
    text: "Open the SYSTEMS tab and push Pump B to 100%. More flow carries more heat but wears the pump faster (wear ∝ speed²).",
    check: (s) => s.pumps.B.cmd >= 0.95,
  },
  {
    title: "5 · Take manual control of pressure",
    text: "In SYSTEMS → Pressurizer, raise the Spray slider above 40%. This drops RCS pressure; auto-control disengages while you're in manual.",
    check: (s) => !s.pressAuto && s.spray > 0.4,
  },
  {
    title: "6 · Hand pressure back to Auto",
    text: "Press the AUTO button on the pressurizer so heaters and spray hold 155 bar again.",
    check: (s) => s.pressAuto,
  },
  {
    title: "7 · A fault! Acknowledge alarms",
    text: "Pump A just started to degrade. Alarm tiles flash until acknowledged — press A or click ACK in the alarm panel.",
    init: (s, m) => { s.tutorialInject(); m.t0 = s.t; },
    check: (s, m) => s.t - m.t0 > 1.2 && s.alarms.length > 0 && s.alarms.every((a) => !a.active || a.acked),
  },
  {
    title: "8 · Dispatch a repair crew",
    text: "Open the MAINT tab and press REPAIR on Coolant Pump A. The part is tagged out while the crew works, then restored to 100%. Wait for it to finish.",
    check: (s) => !!s.tutorialFlags.repaired,
  },
  {
    title: "9 · Xenon in one minute",
    text: "When power falls, iodine-135 keeps decaying into xenon-135, which soaks up neutrons for minutes. Cut power deeply and you dig a 'xenon pit' that is hard to climb out of. Plan big ramps ahead using the forecast on the chart.",
    check: null,
  },
  {
    title: "10 · SCRAM!",
    text: "Press SPACE or the big red SCRAM button. All rods drop, the reactor trips — but decay heat (~6%) remains, so cooling must continue.",
    check: (s) => s.scrammed,
  },
  {
    title: "11 · Reset the trip",
    text: "Once things look calm, press RESET TRIP (or R). Rods stay inserted; you must withdraw them to restart.",
    check: (s) => !s.scrammed,
  },
  {
    title: "Training complete",
    text: "You know the basics: rods, steam, pumps, pressure, alarms, repairs, SCRAM. Real shifts add faults, xenon, leaks and blackouts. Press Finish to collect your certificate.",
    check: null,
  },
];
