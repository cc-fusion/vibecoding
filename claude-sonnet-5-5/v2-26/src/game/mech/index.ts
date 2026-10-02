import type { MechType } from "../types";
import { Mech, MechEnv } from "./base";
import { CipherMech } from "./cipher";
import { DialMech } from "./dial";
import { PinsMech } from "./pins";
import { RingsMech } from "./rings";
import { RunesMech } from "./runes";
import { SweepMech } from "./sweep";

export function createMech(type: MechType, env: MechEnv, level: number, rng: () => number): Mech {
  switch (type) {
    case "pins":
      return new PinsMech(env, level, rng);
    case "dial":
      return new DialMech(env, level, rng);
    case "rings":
      return new RingsMech(env, level, rng);
    case "sweep":
      return new SweepMech(env, level, rng);
    case "cipher":
      return new CipherMech(env, level, rng);
    case "runes":
      return new RunesMech(env, level, rng);
  }
}

export { Mech } from "./base";
export type { MechEnv, Inp } from "./base";
