import { ALIBIS, DECOYS, FACES, INJURIES, JOBS, NAMES, OBJECT_POOL, SIGS, THEMES, TIMES, TRAITS, TRAIT_INFO, TUTORIAL_THEME } from "./content";
import type { CaseDef, Clue, Deduction, Furn, ObjDef, Pillar, RoomDef, Statement, Suspect } from "./types";
import { PILLARS } from "./types";

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export const CASE_COUNT = 6;

export function generateCase(idx: number, seed: number, tutorial = false): CaseDef {
  const r = mulberry32(seed * 7919 + idx * 104729 + 13);
  const ri = (n: number) => Math.floor(r() * n);
  const shuffle = <T,>(a: T[]): T[] => {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = ri(i + 1);
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
  const theme = tutorial ? TUTORIAL_THEME : idx < CASE_COUNT ? THEMES[idx] : THEMES[ri(5)];
  const boss = !tutorial && idx === 5;
  const N = tutorial ? 3 : [4, 4, 5, 5, 6, 6][Math.min(idx, 5)];
  const sceneName = theme.rooms[theme.scene].name;
  const T = TIMES[ri(TIMES.length)];

  // ---- suspects
  const names = shuffle(NAMES).slice(0, N);
  const jobs = shuffle(JOBS);
  const faces = shuffle(FACES);
  const sigs = shuffle(SIGS);
  const injs = shuffle(INJURIES);
  const alibis = shuffle(ALIBIS);
  const culprit = ri(N);
  const suspects: Suspect[] = names.map((nm, i) => {
    const [first, last] = nm.split(" ");
    const trait = boss && i === culprit ? "stoic" : TRAITS[ri(TRAITS.length)];
    return {
      id: i,
      name: nm,
      first,
      emoji: faces[i],
      job: jobs[i],
      trait,
      sig: sigs[i],
      initials: `${first[0]}.${last[0]}.`,
      inj: injs[i],
      receipt: `Receipt #${100 + ri(800)}`,
      alibi: alibis[i],
      statements: [],
      patience: TRAIT_INFO[trait].patience,
      isCulprit: i === culprit,
    };
  });

  // ---- plans
  interface Plan { s: number; p: Pillar; value: boolean }
  const plans: Plan[] = [];
  const maxHeavy = tutorial ? 0 : idx >= 4 ? 2 : idx >= 2 ? 1 : 0;
  let heavy = 0;
  suspects.forEach((s) => {
    if (s.isCulprit) {
      PILLARS.forEach((p) => plans.push({ s: s.id, p, value: true }));
    } else {
      const ps = shuffle(PILLARS);
      let rt = tutorial ? 0 : 1;
      if (!tutorial && heavy < maxHeavy && r() < 0.65) {
        rt = 2;
        heavy++;
      }
      ps.slice(0, rt).forEach((p) => plans.push({ s: s.id, p, value: true }));
      plans.push({ s: s.id, p: ps[rt], value: false });
    }
  });

  // ---- clues + deductions
  const clues: Clue[] = [];
  const deds: Deduction[] = [];
  let cn = 0;
  const mk = (text: string, key: string, kind: Clue["kind"], suspect?: number): Clue => {
    const c: Clue = { id: `c${cn++}`, text, key, kind, suspect, room: -1, objId: "" };
    clues.push(c);
    return c;
  };
  let oppA: Clue | null = null;
  const altRoomOf = (): string => {
    const opts = theme.rooms.map((x) => x.name).filter((n) => n !== sceneName);
    return opts[ri(opts.length)];
  };
  const W = theme.weapon;
  const V = theme.victim;
  plans.forEach((pl) => {
    const s = suspects[pl.s];
    let a: Clue, b: Clue, text: string;
    if (pl.p === "means") {
      if (pl.value) {
        a = mk(`The ${W} was last handled by someone carrying a ${s.sig}.`, s.sig, "means", s.id);
        b = mk(`${s.name} is never seen without a ${s.sig}.`, s.sig, "means", s.id);
        text = `${s.name} had access to the ${W}.`;
      } else {
        a = mk(`The ${W} is awkward and heavy; a ${s.inj} would make it impossible to use.`, s.inj, "means", s.id);
        b = mk(`${s.name} has worn a ${s.inj} since the storm, says the physician's note.`, s.inj, "means", s.id);
        text = `${s.name} could not have used the ${W}: ${s.inj}.`;
      }
    } else if (pl.p === "motive") {
      if (pl.value) {
        const m = theme.motives[ri(theme.motives.length)];
        a = mk(`${m.doc}: "${m.line}", signed only '${s.initials}'.`, s.initials, "motive", s.id);
        b = mk(`${s.name} signs everything with the cipher '${s.initials}'.`, s.initials, "motive", s.id);
        text = `${s.name} had a motive against ${V}.`;
      } else {
        a = mk(`${V}'s ledger: "All debts to ${s.first} forgiven", ${s.receipt}.`, s.receipt, "motive", s.id);
        b = mk(`${s.name}'s pocketbook holds ${s.receipt}, stamped PAID.`, s.receipt, "motive", s.id);
        text = `${s.name} had no motive: the grievance was settled.`;
      }
    } else {
      if (pl.value) {
        if (!oppA) oppA = mk(`The ${theme.clock} in the ${sceneName} froze at ${T}.`, T, "opp");
        a = oppA;
        b = mk(`A servant saw ${s.name} entering the ${sceneName} at ${T}.`, T, "opp", s.id);
        text = `${s.name} was in the ${sceneName} at ${T}.`;
      } else {
        const alt = altRoomOf();
        a = mk(`At the hour of it all, someone punched ${s.alibi} at the ${alt} door.`, s.alibi, "opp", s.id);
        b = mk(`${s.name} keeps ${s.alibi} as proof of being at the ${alt}.`, s.alibi, "opp", s.id);
        text = `${s.name} has an alibi: they were at the ${alt}.`;
      }
    }
    deds.push({ id: `d${deds.length}`, a: a.id, b: b.id, suspect: s.id, pillar: pl.p, value: pl.value, text });
  });

  // ---- decoys
  const SLOTS_PER_ROOM = 7;
  const totalSlots = theme.rooms.length * SLOTS_PER_ROOM;
  const spare = totalSlots - clues.length;
  const pairs = Math.max(0, Math.min(tutorial ? 1 : 2, Math.floor(spare / 2)));
  shuffle(DECOYS).slice(0, pairs).forEach((d) => {
    mk(d.a, d.key, "decoy");
    mk(d.b, d.key, "decoy");
  });

  // ---- rooms and placement
  const bossRoom = boss ? 1 : -1;
  const slots: { room: number; k: number }[] = [];
  theme.rooms.forEach((_, ro) => {
    for (let k = 0; k < SLOTS_PER_ROOM; k++) slots.push({ room: ro, k });
  });
  let order = shuffle(slots);
  const assign: Record<string, string> = {};
  const toPlace = shuffle(clues);
  if (boss && oppA) {
    const sl = order.find((x) => x.room === bossRoom)!;
    order = order.filter((x) => x !== sl);
    assign[`${sl.room}:${sl.k}`] = (oppA as Clue).id;
    (oppA as Clue).sealed = true;
  }
  const placed = new Set(Object.values(assign));
  toPlace
    .filter((c) => !placed.has(c.id))
    .forEach((c) => {
      const sl = order.shift();
      if (sl) assign[`${sl.room}:${sl.k}`] = c.id;
    });

  const rooms: RoomDef[] = theme.rooms.map((rm, ro) => {
    const pool = shuffle(OBJECT_POOL[rm.kind]);
    const pts: { x: number; y: number }[] = [];
    let minD = 135;
    let tries = 0;
    while (pts.length < SLOTS_PER_ROOM && tries < 4000) {
      tries++;
      if (tries % 90 === 0) minD = Math.max(70, minD - 10);
      const x = 110 + r() * 740;
      const y = 120 + r() * 340;
      if (Math.hypot(x - 480, y - 570) < 150) continue;
      if (pts.every((p) => Math.hypot(p.x - x, p.y - y) >= minD)) pts.push({ x, y });
    }
    while (pts.length < SLOTS_PER_ROOM) pts.push({ x: 150 + pts.length * 110, y: 200 });
    const objects: ObjDef[] = pool.slice(0, SLOTS_PER_ROOM).map((o, k) => {
      const clueId = assign[`${ro}:${k}`];
      const od: ObjDef = { id: `r${ro}o${k}`, emoji: o.emoji, name: o.name, x: pts[k].x, y: pts[k].y, clueId };
      if (clueId) {
        const c = clues.find((q) => q.id === clueId)!;
        c.room = ro;
        c.objId = od.id;
      }
      return od;
    });
    const furn: Furn[] = [];
    for (let f = 0; f < 4; f++) {
      for (let t = 0; t < 40; t++) {
        const w = 60 + r() * 90;
        const h = 36 + r() * 36;
        const x = 70 + r() * (820 - w);
        const y = 90 + r() * 350;
        const nearObj = objects.some((o) => o.x > x - 60 && o.x < x + w + 60 && o.y > y - 60 && o.y < y + h + 60);
        const doorZone = x < 600 && x + w > 360 && y + h > 420;
        const overlap = furn.some((q) => x < q.x + q.w + 20 && x + w > q.x - 20 && y < q.y + q.h + 20 && y + h > q.y - 20);
        if (!nearObj && !doorZone && !overlap) {
          furn.push({ x, y, w, h });
          break;
        }
      }
    }
    return { name: rm.name, kind: rm.kind, hue: (ro * 47 + 210 + (idx % 6) * 31) % 360, objects, furn };
  });

  // ---- statements
  const lieSet = (s: Suspect): Set<Pillar> => {
    if (!s.isCulprit) return new Set();
    return new Set(boss ? PILLARS : shuffle(PILLARS).slice(0, 2));
  };
  suspects.forEach((s) => {
    const lies = lieSet(s);
    const alt = altRoomOf();
    s.statements = PILLARS.map((p): Statement => {
      const plan = plans.find((q) => q.s === s.id && q.p === p);
      const ded = deds.find((d) => d.suspect === s.id && d.pillar === p);
      const value = plan ? plan.value : null;
      const isLie = value === true && (s.isCulprit ? lies.has(p) : r() < 0.7);
      let text: string;
      if (p === "means") {
        text = isLie
          ? `I've never so much as touched a ${W}. I wouldn't know where to find one.`
          : value === true
          ? `Yes, I carry a ${s.sig} everywhere. And I did know where the ${W} was kept.`
          : value === false
          ? `Me, use a ${W}? With my ${s.inj}? Impossible.`
          : `The ${W}? I wouldn't know the first thing about it.`;
      } else if (p === "motive") {
        text = isLie
          ? `${V}? We barely knew each other. I held no grudge at all.`
          : value === true
          ? `Fine. ${V} wronged me. Everyone knew it. That doesn't make me a criminal.`
          : value === false
          ? `${V} and I settled everything long ago. I bore no ill will.`
          : `${V} was always civil with me. That's all I can say.`;
      } else {
        text = isLie
          ? `At the time? I was at the ${alt}, nowhere near the ${sceneName}.`
          : value === true
          ? `I passed through the ${sceneName} around ${T}, but saw nothing and left at once.`
          : value === false
          ? `I was at the ${alt} with plenty of witnesses when it happened.`
          : `I was wandering the grounds. Nobody was keeping track of me.`;
      }
      const contra = isLie && ded ? (p === "opp" ? [ded.b] : [ded.a, ded.b]) : [];
      const claim: boolean | null = isLie ? false : value;
      return { pillar: p, text, isLie, contra, claim };
    });
  });

  return {
    idx,
    seed,
    tutorial,
    boss,
    bossRoom,
    title: theme.title,
    crime: theme.crime,
    blurb: theme.blurb,
    victim: V,
    weapon: W,
    clock: theme.clock,
    scene: theme.scene,
    time: T,
    suspects,
    rooms,
    clues,
    deductions: deds,
    culprit,
  };
}
