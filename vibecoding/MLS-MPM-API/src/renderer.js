const DEFAULT_OPTIONS = {
    particleSize: 2.2,
    colorMode: 'material',
    showGrid: false,
    gridDivisions: 24,
    background: '#08131b',
    domainColor: '#0a151e',
    boundaryColor: 'rgba(139, 180, 202, 0.3)',
    colors: { fluid: '#28a9ff', elastic: '#ffad42', snow: '#72e69b' },
    maxSpeed: 3.5,
    padding: 24,
};
function validateOptions(options) {
    if (!Number.isFinite(options.particleSize) || options.particleSize <= 0) {
        throw new Error('renderer.particleSize must be greater than zero.');
    }
    if (!Number.isFinite(options.maxSpeed) || options.maxSpeed <= 0) {
        throw new Error('renderer.maxSpeed must be greater than zero.');
    }
    if (!Number.isFinite(options.padding) || options.padding < 0) {
        throw new Error('renderer.padding cannot be negative.');
    }
}
const SPEED_COLORS = Array.from({ length: 16 }, (_, index) => {
    const t = index / 15;
    return `hsl(${215 - 215 * t} 90% ${58 + 8 * Math.sin(t * Math.PI)}%)`;
});
/** HiDPI Canvas 2D renderer. It has no asset or network dependencies. */
export class Renderer {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.width = 1;
        this.height = 1;
        this.dpr = 1;
        this.side = 1;
        this.originX = 0;
        this.originY = 0;
        const context = canvas.getContext('2d', { alpha: false });
        if (!context)
            throw new Error('Canvas 2D is not supported by this browser.');
        this.context = context;
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options,
            colors: { ...DEFAULT_OPTIONS.colors, ...options.colors },
        };
        validateOptions(this.options);
        this.resize();
    }
    setOptions(options) {
        const next = {
            ...this.options,
            ...options,
            colors: { ...this.options.colors, ...options.colors },
        };
        validateOptions(next);
        this.options = next;
        this.resize();
    }
    resize() {
        const bounds = this.canvas.getBoundingClientRect();
        this.width = Math.max(1, bounds.width);
        this.height = Math.max(1, bounds.height);
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = Math.round(this.width * this.dpr);
        this.canvas.height = Math.round(this.height * this.dpr);
        this.side = Math.max(1, Math.min(this.width, this.height) - 2 * this.options.padding);
        this.originX = (this.width - this.side) / 2;
        this.originY = (this.height - this.side) / 2;
    }
    screenToDomain(clientX, clientY) {
        const bounds = this.canvas.getBoundingClientRect();
        return {
            x: (clientX - bounds.left - this.originX) / this.side,
            y: 1 - (clientY - bounds.top - this.originY) / this.side,
        };
    }
    render(world, pointer = null) {
        const ctx = this.context;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.fillStyle = this.options.background;
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.fillStyle = this.options.domainColor;
        ctx.fillRect(this.originX, this.originY, this.side, this.side);
        if (this.options.showGrid)
            this.drawGrid();
        this.drawBoundary();
        ctx.save();
        ctx.beginPath();
        ctx.rect(this.originX, this.originY, this.side, this.side);
        ctx.clip();
        if (this.options.colorMode === 'speed')
            this.drawSpeedParticles(world);
        else
            this.drawMaterialParticles(world);
        ctx.restore();
        if (pointer)
            this.drawPointer(pointer);
    }
    drawGrid() {
        const ctx = this.context;
        const divisions = Math.max(1, Math.round(this.options.gridDivisions));
        ctx.save();
        ctx.strokeStyle = 'rgba(128, 166, 187, 0.09)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 1; i < divisions; i++) {
            const offset = (i / divisions) * this.side;
            const x = Math.round(this.originX + offset) + 0.5;
            const y = Math.round(this.originY + offset) + 0.5;
            ctx.moveTo(x, this.originY);
            ctx.lineTo(x, this.originY + this.side);
            ctx.moveTo(this.originX, y);
            ctx.lineTo(this.originX + this.side, y);
        }
        ctx.stroke();
        ctx.restore();
    }
    drawBoundary() {
        const ctx = this.context;
        ctx.save();
        ctx.strokeStyle = this.options.boundaryColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(this.originX) + 0.5, Math.round(this.originY) + 0.5, Math.round(this.side), Math.round(this.side));
        ctx.restore();
    }
    drawMaterialParticles(world) {
        const paths = [new Path2D(), new Path2D(), new Path2D()];
        this.buildPaths(world, (p) => paths[world.materials[p]]);
        const colors = [this.options.colors.fluid, this.options.colors.elastic, this.options.colors.snow];
        this.context.globalAlpha = 0.95;
        for (let material = 0; material < 3; material++) {
            this.context.fillStyle = colors[material];
            this.context.fill(paths[material]);
        }
        this.context.globalAlpha = 1;
    }
    drawSpeedParticles(world) {
        const paths = SPEED_COLORS.map(() => new Path2D());
        this.buildPaths(world, (p) => {
            const speed = Math.hypot(world.velocities[p * 2], world.velocities[p * 2 + 1]);
            const bin = Math.min(15, Math.max(0, Math.floor((speed / this.options.maxSpeed) * 16)));
            return paths[bin];
        });
        this.context.globalAlpha = 0.95;
        for (let i = 0; i < paths.length; i++) {
            this.context.fillStyle = SPEED_COLORS[i];
            this.context.fill(paths[i]);
        }
        this.context.globalAlpha = 1;
    }
    buildPaths(world, select) {
        const radius = this.options.particleSize;
        for (let p = 0; p < world.count; p++) {
            const x = this.originX + world.positions[p * 2] * this.side;
            const y = this.originY + (1 - world.positions[p * 2 + 1]) * this.side;
            const path = select(p);
            path.moveTo(x + radius, y);
            path.arc(x, y, radius, 0, Math.PI * 2);
        }
    }
    drawPointer(pointer) {
        if (pointer.x < 0 || pointer.x > 1 || pointer.y < 0 || pointer.y > 1)
            return;
        const ctx = this.context;
        const x = this.originX + pointer.x * this.side;
        const y = this.originY + (1 - pointer.y) * this.side;
        ctx.save();
        ctx.strokeStyle = pointer.dragging
            ? 'rgba(122, 219, 255, 0.85)'
            : 'rgba(122, 219, 255, 0.35)';
        ctx.fillStyle = pointer.dragging ? 'rgba(63, 184, 235, 0.07)' : 'transparent';
        ctx.lineWidth = pointer.dragging ? 1.5 : 1;
        ctx.setLineDash(pointer.dragging ? [] : [4, 5]);
        ctx.beginPath();
        ctx.arc(x, y, pointer.radius * this.side, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}
