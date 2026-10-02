import type { Role, VType, WeatherType, ModuleId } from "./data";

export interface Bridge { u: number; half: number; hp: number; maxhp: number; built: number; rubble: boolean; }
export interface Crev {
  id: number; x: number; y: number; ang: number; ca: number; sa: number; L: number; w0: number; w: number;
  grow: number; fracture: number; phase: number; period: number; amp: number; hidden: boolean; revealed: boolean;
  jag: number[]; bridges: Bridge[]; chasm: boolean;
}
export interface Serac { x: number; y: number; r: number; cd: number; seed: number; }
export interface Thin { x: number; y: number; rx: number; ry: number; warn: number; }
export interface Crate { x: number; y: number; kind: "fuel" | "food" | "planks" | "goods" | "scrip"; taken: boolean; bob: number; }
export interface Aval { y: number; h: number; dir: number; t: number; armed: boolean; hit: number[]; done: boolean; }
export interface Raider {
  x: number; y: number; hp: number; maxhp: number; att: number; steal: number; flee: number; taken: number; ang: number; tutor: boolean;
}
export interface Bullet { x1: number; y1: number; x2: number; y2: number; life: number; }
export interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: number; }
export interface Floater { x: number; y: number; text: string; color: string; life: number; max: number; size: number; }
export interface TrailPt { x: number; y: number; air: number; s: number; }
export interface Flake { x: number; y: number; z: number; }

export interface HudCrew { id: number; name: string; icon: string; role: Role; morale: number; warmth: number; health: number; alive: boolean; }
export interface HudVehicle { id: number; type: VType; hull: number; max: number; stuck: number; mods: (ModuleId | null)[]; }
export interface HudLog { id: number; text: string; color: string; age: number; }
export interface Hud {
  speed: number; top: number; fuel: number; fuelCap: number; food: number; planks: number; plankCap: number; flares: number;
  cargo: number; cargoCap: number; credits: number; temp: number; teff: number; weather: WeatherType;
  forecast: { type: WeatherType; inS: number } | null; progress: number; legName: string; leg: number; day: number;
  night: number; drift: number; wind: number; crew: HudCrew[]; vehicles: HudVehicle[]; camping: boolean;
  quake: number; raiders: number; mawGap: number | null; jumpCd: number; tutorial: string | null; tutorialStep: number;
  log: HudLog[]; alerts: string[]; weight: number; contract: string | null; foodDays: number; fuelRange: number;
}
export interface EventView { icon: string; title: string; text: string; options: { label: string; hint: string }[]; }
export interface GameCallbacks {
  onHud: (h: Hud) => void;
  onArrive: (station: number) => void;
  onEvent: (e: EventView) => void;
  onEnd: (win: boolean, reason: string) => void;
  onTutorialDone: () => void;
  onPauseKey: () => void;
  onCrewKey: () => void;
}
