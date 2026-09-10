/**
 * Owns the World instance, the fixed-timestep simulation loop and the render
 * loop. React state only holds UI-level settings; the world itself is mutable
 * and panels re-read it on a throttled timer.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Renderer, type RenderOptions } from '../render/renderer';
import type { Ant, FoodSource, Nest } from '../sim/ant';
import { MAX_STEPS_PER_FRAME, PH_COUNT, SIM_DT } from '../sim/constants';
import { buildDefaultScenario, World } from '../sim/world';

export type Tool =
  | 'select' | 'addFood' | 'removeFood' | 'addNest' | 'removeNest'
  | 'addAnts' | 'removeAnts' | 'wall' | 'erase';

export interface SimHandle {
  world: World;
  renderer: Renderer;
  running: boolean;
  setRunning: (v: boolean) => void;
  speed: number;
  setSpeed: (v: number) => void;
  tool: Tool;
  setTool: (t: Tool) => void;
  activeColonyId: number;
  setActiveColonyId: (id: number) => void;
  selectedAnt: Ant | null;
  setSelectedAnt: (a: Ant | null) => void;
  selectedFood: FoodSource | null;
  setSelectedFood: (f: FoodSource | null) => void;
  selectedNest: Nest | null;
  setSelectedNest: (n: Nest | null) => void;
  showPheromones: boolean;
  setShowPheromones: (v: boolean) => void;
  channels: boolean[];
  setChannels: (c: boolean[]) => void;
  pheromoneOpacity: number;
  setPheromoneOpacity: (v: number) => void;
  showSensors: boolean;
  setShowSensors: (v: boolean) => void;
  uiTick: number;
  refresh: () => void;
  reset: (seed?: number) => void;
  fps: number;
  simRate: number; // simulated seconds per real second
  renderOptsRef: React.MutableRefObject<RenderOptions>;
  brushRef: React.MutableRefObject<RenderOptions['brush']>;
}

export function useSimulation(): SimHandle {
  const world = useMemo(() => {
    const w = new World(1337);
    buildDefaultScenario(w);
    return w;
  }, []);
  const renderer = useMemo(() => new Renderer(), []);

  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [tool, setTool] = useState<Tool>('select');
  const [activeColonyId, setActiveColonyId] = useState(world.colonies[0]?.id ?? 1);
  const [selectedAnt, setSelectedAnt] = useState<Ant | null>(null);
  const [selectedFood, setSelectedFood] = useState<FoodSource | null>(null);
  const [selectedNest, setSelectedNest] = useState<Nest | null>(null);
  const [showPheromones, setShowPheromones] = useState(true);
  const [channels, setChannels] = useState<boolean[]>(() => {
    const c = new Array(PH_COUNT).fill(false);
    c[0] = true; // food trail by default
    return c;
  });
  const [pheromoneOpacity, setPheromoneOpacity] = useState(0.75);
  const [showSensors, setShowSensors] = useState(true);
  const [uiTick, refresh] = useReducer((x: number) => x + 1, 0);
  const [fps, setFps] = useState(0);
  const [simRate, setSimRate] = useState(0);

  const brushRef = useRef<RenderOptions['brush']>(null);
  const renderOptsRef = useRef<RenderOptions>({
    showPheromones, channels, pheromoneOpacity, showSensors, selectedAnt, selectedFood, selectedNest, brush: null,
  });
  renderOptsRef.current = { showPheromones, channels, pheromoneOpacity, showSensors, selectedAnt, selectedFood, selectedNest, brush: brushRef.current };

  const runningRef = useRef(running);
  runningRef.current = running;
  const speedRef = useRef(speed);
  speedRef.current = speed;

  // Simulation loop (fixed timestep with capped catch-up) — rendering is
  // performed by WorldCanvas on its own rAF; this loop only advances the world.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let frames = 0, simSeconds = 0, fpsTimer = 0;
    const loop = (now: number) => {
      const real = Math.min(0.1, (now - last) / 1000);
      last = now;
      frames++;
      fpsTimer += real;
      if (runningRef.current) {
        acc += real * speedRef.current;
        let steps = 0;
        while (acc >= SIM_DT && steps < MAX_STEPS_PER_FRAME) {
          world.step(SIM_DT);
          acc -= SIM_DT;
          steps++;
          simSeconds += SIM_DT;
        }
        if (steps >= MAX_STEPS_PER_FRAME) acc = 0; // drop backlog rather than spiral
      } else {
        acc = 0;
      }
      if (fpsTimer >= 1) {
        setFps(Math.round(frames / fpsTimer));
        setSimRate(Math.round((simSeconds / fpsTimer) * 10) / 10);
        frames = 0; simSeconds = 0; fpsTimer = 0;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [world]);

  // Throttled UI refresh for panels
  useEffect(() => {
    const id = setInterval(() => refresh(), 250);
    return () => clearInterval(id);
  }, []);

  // Drop selections that no longer exist
  useEffect(() => {
    if (selectedAnt && !selectedAnt.alive) setSelectedAnt(null);
    if (selectedFood && !world.foods.includes(selectedFood)) setSelectedFood(null);
    if (selectedNest && !world.nests.includes(selectedNest)) setSelectedNest(null);
    if (!world.colonyById(activeColonyId) && world.colonies.length) setActiveColonyId(world.colonies[0].id);
  }, [uiTick, selectedAnt, selectedFood, selectedNest, activeColonyId, world]);

  const reset = useCallback((seed?: number) => {
    world.resetRuntime(seed ?? world.seed);
    setSelectedAnt(null);
    refresh();
  }, [world]);

  return {
    world, renderer, running, setRunning, speed, setSpeed, tool, setTool, activeColonyId, setActiveColonyId,
    selectedAnt, setSelectedAnt, selectedFood, setSelectedFood, selectedNest, setSelectedNest,
    showPheromones, setShowPheromones, channels, setChannels, pheromoneOpacity, setPheromoneOpacity,
    showSensors, setShowSensors, uiTick, refresh, reset, fps, simRate, renderOptsRef, brushRef,
  };
}
