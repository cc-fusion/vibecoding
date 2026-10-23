import { Renderer } from './renderer.js';
import { World } from './world.js';
const DEFAULT_INTERACTION = {
    enabled: true,
    radius: 0.11,
    strength: 0.32,
};
/** Canvas, animation-loop, and pointer-interaction convenience wrapper. */
export class Simulation {
    constructor(options) {
        this.animationFrame = 0;
        this.active = false;
        this.initialState = null;
        this.pointer = null;
        this.pointerPrevious = null;
        this.frame = () => {
            if (!this.active)
                return;
            try {
                const start = performance.now();
                for (let i = 0; i < this.substepsPerFrame; i++)
                    this.world.step();
                this.renderer.render(this.world, this.pointer);
                this.emitFrame(this.substepsPerFrame, performance.now() - start);
            }
            catch (reason) {
                this.stop();
                const error = reason instanceof Error ? reason : new Error(String(reason));
                if (this.onError)
                    this.onError(error);
                else
                    console.error('[MLSMPM]', error);
                return;
            }
            if (this.active)
                this.animationFrame = requestAnimationFrame(this.frame);
        };
        this.pointerDown = (event) => {
            const point = this.renderer.screenToDomain(event.clientX, event.clientY);
            this.pointer = { ...point, radius: this.interaction.radius, dragging: true };
            this.pointerPrevious = { ...point, time: performance.now() };
            this.canvas.setPointerCapture(event.pointerId);
        };
        this.pointerMove = (event) => {
            const point = this.renderer.screenToDomain(event.clientX, event.clientY);
            const dragging = this.pointer?.dragging ?? false;
            this.pointer = { ...point, radius: this.interaction.radius, dragging };
            if (dragging && this.pointerPrevious) {
                const now = performance.now();
                const elapsed = Math.min(0.05, Math.max(0.008, (now - this.pointerPrevious.time) / 1000));
                const dx = point.x - this.pointerPrevious.x;
                const dy = point.y - this.pointerPrevious.y;
                if (Math.abs(dx) + Math.abs(dy) > 1e-6) {
                    const gain = this.interaction.strength / elapsed;
                    const clamp = (value) => Math.max(-3.5, Math.min(3.5, value));
                    this.world.applyImpulse({
                        x: point.x,
                        y: point.y,
                        vx: clamp(dx * gain),
                        vy: clamp(dy * gain),
                        radius: this.interaction.radius,
                    });
                    this.pointerPrevious = { ...point, time: now };
                }
            }
            if (!this.active)
                this.renderer.render(this.world, this.pointer);
        };
        this.pointerUp = (event) => {
            if (this.pointer)
                this.pointer.dragging = false;
            this.pointerPrevious = null;
            if (this.canvas.hasPointerCapture(event.pointerId)) {
                this.canvas.releasePointerCapture(event.pointerId);
            }
            if (!this.active)
                this.renderer.render(this.world, this.pointer);
        };
        this.pointerLeave = () => {
            if (!this.pointer?.dragging) {
                this.pointer = null;
                if (!this.active)
                    this.renderer.render(this.world);
            }
        };
        const canvas = typeof options.canvas === 'string'
            ? document.querySelector(options.canvas)
            : options.canvas;
        if (!(canvas instanceof HTMLCanvasElement)) {
            throw new Error('Simulation canvas must be a canvas element or a valid canvas selector.');
        }
        this.canvas = canvas;
        this.world = new World(options);
        this.renderer = new Renderer(canvas, options.renderer);
        this.substepsPerFrame = options.substepsPerFrame ?? 30;
        this.validateSubsteps(this.substepsPerFrame);
        this.interaction = { ...DEFAULT_INTERACTION, ...options.interaction };
        if (!Number.isFinite(this.interaction.radius) ||
            !Number.isFinite(this.interaction.strength) ||
            this.interaction.radius <= 0 ||
            this.interaction.strength < 0) {
            throw new Error('interaction.radius must be positive and strength cannot be negative.');
        }
        this.onFrame = options.onFrame;
        this.onError = options.onError;
        this.previousTouchAction = canvas.style.touchAction;
        if (this.interaction.enabled) {
            canvas.style.touchAction = 'none';
            this.attachPointerEvents();
        }
        this.resizeObserver = new ResizeObserver(() => {
            this.renderer.resize();
            this.renderer.render(this.world, this.pointer);
        });
        this.resizeObserver.observe(canvas);
        this.renderer.render(this.world);
    }
    get running() {
        return this.active;
    }
    addParticle(options) {
        return this.world.addParticle(options);
    }
    addParticles(options) {
        return this.world.addParticles(options);
    }
    addRectangle(options) {
        return this.world.addRectangle(options);
    }
    addEllipse(options) {
        return this.world.addEllipse(options);
    }
    addCircle(options) {
        return this.world.addCircle(options);
    }
    /** Merge runtime physics/material parameters. */
    setParameters(parameters) {
        this.world.configure(parameters);
    }
    setRendererOptions(options) {
        this.renderer.setOptions(options);
        this.renderer.render(this.world, this.pointer);
    }
    setSubstepsPerFrame(substeps) {
        this.validateSubsteps(substeps);
        this.substepsPerFrame = substeps;
    }
    /** Capture the state used by reset(). Calling start() also captures it if needed. */
    captureInitialState() {
        this.initialState = this.world.getState();
    }
    start() {
        if (this.active)
            return;
        if (!this.initialState)
            this.captureInitialState();
        this.active = true;
        this.animationFrame = requestAnimationFrame(this.frame);
    }
    stop() {
        this.active = false;
        cancelAnimationFrame(this.animationFrame);
    }
    /** Advance manually. Usually called while stopped. */
    step(substeps = 1) {
        this.validateSubsteps(substeps);
        if (!this.initialState)
            this.captureInitialState();
        const start = performance.now();
        for (let i = 0; i < substeps; i++)
            this.world.step();
        this.renderer.render(this.world, this.pointer);
        this.emitFrame(substeps, performance.now() - start);
    }
    /** Restore the last captured initial state. Playback continues if it was running. */
    reset() {
        if (!this.initialState)
            this.captureInitialState();
        else
            this.world.restore(this.initialState);
        this.renderer.render(this.world, this.pointer);
    }
    clear() {
        this.world.clear();
        this.initialState = null;
        this.renderer.render(this.world, this.pointer);
    }
    destroy() {
        this.stop();
        this.resizeObserver.disconnect();
        this.detachPointerEvents();
        this.canvas.style.touchAction = this.previousTouchAction;
    }
    validateSubsteps(substeps) {
        if (!Number.isInteger(substeps) || substeps < 1 || substeps > 10000) {
            throw new Error('substeps must be an integer between 1 and 10,000.');
        }
    }
    emitFrame(substeps, frameMilliseconds) {
        this.onFrame?.({
            simulationTime: this.world.simulationTime,
            totalSteps: this.world.totalSteps,
            substeps,
            frameMilliseconds,
        });
    }
    attachPointerEvents() {
        this.canvas.addEventListener('pointerdown', this.pointerDown);
        this.canvas.addEventListener('pointermove', this.pointerMove);
        this.canvas.addEventListener('pointerup', this.pointerUp);
        this.canvas.addEventListener('pointercancel', this.pointerUp);
        this.canvas.addEventListener('pointerleave', this.pointerLeave);
    }
    detachPointerEvents() {
        this.canvas.removeEventListener('pointerdown', this.pointerDown);
        this.canvas.removeEventListener('pointermove', this.pointerMove);
        this.canvas.removeEventListener('pointerup', this.pointerUp);
        this.canvas.removeEventListener('pointercancel', this.pointerUp);
        this.canvas.removeEventListener('pointerleave', this.pointerLeave);
    }
}
