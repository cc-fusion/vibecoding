// Application controller: owns the World, Editor, Renderer, the single rAF loop with a fixed-timestep accumulator,
// autosave to localStorage, and device gravity. React only renders chrome around it.
import { World } from '../sim/world';
import { Editor } from '../editor/editor';
import { Renderer } from '../render/renderer';
import { DeviceGravity } from '../input/deviceGravity';
import { defaultScene, type SceneData } from '../sim/schema';
import { loadFromLocal, saveToLocal, clearLocal, exportSceneJson, downloadJson, pickJsonFile } from '../sim/persistence';
import { parseSceneJson, validateScene } from '../sim/validate';

export type RunState = 'stopped' | 'running' | 'paused';
const FIXED_DT = 1 / 60;
const MAX_FRAME = 0.1;
const MAX_STEPS = 3;

export class Sandbox {
  world: World;
  editor: Editor;
  renderer: Renderer;
  motion = new DeviceGravity();
  runState: RunState = 'stopped';
  onStateChange: (() => void) | null = null;
  onMessage: ((msg: string, kind?: 'info' | 'error') => void) | null = null;
  fps = 0;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private saveTimer = 0;
  private frameCount = 0; private fpsTime = 0;
  private visibilityHandler = () => { if (document.visibilityState === 'hidden') this.autosaveNow(); };
  private resizeObserver: ResizeObserver | null = null;

  constructor(public canvas: HTMLCanvasElement) {
    const stored = loadFromLocal();
    const scene: SceneData = stored && stored.ok && stored.scene ? stored.scene : defaultScene();
    this.world = new World(scene);
    this.renderer = new Renderer(canvas);
    this.editor = new Editor(this.world, canvas);
    this.editor.isRunning = () => this.runState === 'running';
    this.editor.onAfterEdit = () => this.scheduleAutosave();
    this.world.onChange = () => { this.scheduleAutosave(); this.onStateChange?.(); };
    this.motion.options = { ...this.world.ui.deviceGravity };
    this.motion.onGravity = g => { this.world.gravityOverride = g; };
    this.motion.onStatus = s => { if (s !== 'active' && s !== 'requesting') this.world.gravityOverride = null; this.onStateChange?.(); };
  }

  start() {
    this.editor.attach();
    this.renderer.resize(this.world.settings.width, this.world.settings.height);
    this.resizeObserver = new ResizeObserver(() => this.renderer.resize(this.world.settings.width, this.world.settings.height));
    this.resizeObserver.observe(this.canvas);
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  dispose() {
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.editor.detach();
    this.resizeObserver?.disconnect(); this.resizeObserver = null;
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.motion.disable();
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.autosaveNow(); }
  }

  private loop = (ts: number) => {
    const dt = Math.min(MAX_FRAME, Math.max(0, (ts - this.last) / 1000));
    this.last = ts;
    if (this.runState === 'running') {
      this.acc += dt * this.world.settings.timeScale;
      let steps = 0;
      while (this.acc >= FIXED_DT && steps < MAX_STEPS) { this.world.step(FIXED_DT); this.acc -= FIXED_DT; steps++; }
      if (steps === MAX_STEPS && this.acc > FIXED_DT) this.acc = 0; // drop backlog rather than spiral
    }
    this.renderer.render(this.world, this.editor);
    this.frameCount++; this.fpsTime += dt;
    if (this.fpsTime >= 0.5) { this.fps = this.frameCount / this.fpsTime; this.frameCount = 0; this.fpsTime = 0; }
    this.raf = requestAnimationFrame(this.loop);
  };

  // ---------- simulation controls ----------
  play() { this.runState = 'running'; this.acc = 0; this.last = performance.now(); this.onStateChange?.(); }
  pause() { if (this.runState === 'running') { this.runState = 'paused'; this.editor.cancelInteraction(); this.onStateChange?.(); } }
  stop() { this.runState = 'stopped'; this.acc = 0; this.editor.cancelInteraction(); this.onStateChange?.(); }
  step() { if (this.runState === 'running') this.runState = 'paused'; this.editor.cancelInteraction(); this.world.step(FIXED_DT); this.onStateChange?.(); }
  reset() { this.editor.cancelInteraction(); this.world.reset(); this.editor.pruneSelection(); this.runState = 'stopped'; this.acc = 0; this.onStateChange?.(); }
  clearScene() { this.editor.cancelInteraction(); this.world.clear(); this.editor.pruneSelection(); this.runState = 'stopped'; this.onStateChange?.(); }

  // ---------- persistence ----------
  private scheduleAutosave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => { this.saveTimer = 0; this.autosaveNow(); }, 600);
  }
  autosaveNow() { saveToLocal(this.world.snapshot()); }

  save() { const ok = saveToLocal(this.world.snapshot()); this.onMessage?.(ok ? 'Scene saved to browser storage' : 'Save failed (storage unavailable)', ok ? 'info' : 'error'); }

  load() {
    const res = loadFromLocal();
    if (!res) { this.onMessage?.('No saved scene found', 'error'); return; }
    this.applyValidated(res, 'Loaded saved scene');
  }

  exportJson() { downloadJson(exportSceneJson(this.world.snapshot()), `physics-scene-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`); }

  async importJson() {
    const text = await pickJsonFile();
    if (text == null) return;
    this.importJsonText(text);
  }

  importJsonText(text: string): boolean {
    const res = parseSceneJson(text);
    return this.applyValidated(res, 'Scene imported');
  }

  private applyValidated(res: ReturnType<typeof validateScene>, okMsg: string): boolean {
    if (!res.ok || !res.scene) { this.onMessage?.(`Import rejected: ${res.errors.join('; ') || 'invalid scene'} — current scene kept`, 'error'); return false; }
    // Build in a scratch world first so a scene that fails reconstruction never replaces the live one.
    try { const probe = new World(res.scene); void probe; } catch (e) { this.onMessage?.(`Import rejected: ${(e as Error).message}`, 'error'); return false; }
    this.editor.cancelInteraction();
    this.world.loadScene(res.scene);
    this.editor.pruneSelection();
    this.editor.selection.clear();
    this.motion.options = { ...this.world.ui.deviceGravity };
    this.runState = 'stopped';
    this.onMessage?.(res.warnings.length ? `${okMsg} (${res.warnings.length} item(s) skipped)` : okMsg, 'info');
    this.onStateChange?.();
    return true;
  }

  clearSavedData() { clearLocal(); this.onMessage?.('Saved browser data cleared', 'info'); }

  restoreDefaults() {
    this.editor.cancelInteraction();
    this.world.loadScene(defaultScene());
    this.editor.selection.clear();
    this.motion.options = { ...this.world.ui.deviceGravity };
    this.runState = 'stopped';
    this.autosaveNow();
    this.onMessage?.('Default scene restored', 'info');
    this.onStateChange?.();
  }

  // ---------- device gravity ----------
  async toggleMotion() {
    if (this.motion.enabled) { this.motion.disable(); this.world.gravityOverride = null; }
    else {
      const s = await this.motion.enable();
      if (s === 'denied') this.onMessage?.('Motion permission denied — using manual gravity', 'error');
      else if (s === 'unavailable') this.onMessage?.('Device motion not available on this device/browser', 'error');
    }
    this.onStateChange?.();
  }
}
