import { quadraticWeights, svd2 } from './math2d.js';
import { DEFAULT_WORLD_PARAMETERS, Material, } from './types.js';
function finite(value, name) {
    if (!Number.isFinite(value))
        throw new Error(`${name} must be finite.`);
    return value;
}
function positive(value, name) {
    finite(value, name);
    if (value <= 0)
        throw new Error(`${name} must be greater than zero.`);
    return value;
}
function materialId(material) {
    if (material === Material.Fluid || material === 'fluid')
        return Material.Fluid;
    if (material === Material.Elastic || material === 'elastic')
        return Material.Elastic;
    if (material === Material.Snow || material === 'snow')
        return Material.Snow;
    throw new Error(`Unknown material "${String(material)}". Use fluid, elastic, or snow.`);
}
function copyParameters(parameters) {
    return {
        ...parameters,
        gravity: { ...parameters.gravity },
        fluid: { ...parameters.fluid },
        elastic: { ...parameters.elastic },
        snow: { ...parameters.snow },
    };
}
/**
 * Asset-independent 2D MLS-MPM world. All coordinates use the unit domain
 * [0, 1] with +Y pointing upward. Public typed arrays have maxParticles
 * capacity; only the first count particles are active.
 */
export class World {
    constructor(options = {}) {
        this.simulationTime = 0;
        this.totalSteps = 0;
        this.lastGridMass = 0;
        this.particleCount = 0;
        this.settings = copyParameters(DEFAULT_WORLD_PARAMETERS);
        this.elasticMu0 = 0;
        this.elasticLambda0 = 0;
        this.snowMu0 = 0;
        this.snowLambda0 = 0;
        this.weightsX = new Float64Array(3);
        this.weightsY = new Float64Array(3);
        this.svd = new Float64Array(10);
        this.gridSize = options.gridSize ?? 96;
        if (!Number.isInteger(this.gridSize) || this.gridSize < 8 || this.gridSize > 512) {
            throw new Error('gridSize must be an integer between 8 and 512.');
        }
        this.dx = 1 / this.gridSize;
        this.invDx = this.gridSize;
        this.maxParticles = options.maxParticles ?? 50000;
        if (!Number.isInteger(this.maxParticles) || this.maxParticles < 1) {
            throw new Error('maxParticles must be a positive integer.');
        }
        this.defaultParticleVolume = positive(options.particleVolume ?? (0.5 / this.gridSize) ** 2, 'particleVolume');
        this.positions = new Float64Array(this.maxParticles * 2);
        this.velocities = new Float64Array(this.maxParticles * 2);
        this.C = new Float64Array(this.maxParticles * 4);
        this.F = new Float64Array(this.maxParticles * 4);
        this.Jp = new Float64Array(this.maxParticles);
        this.Jf = new Float64Array(this.maxParticles);
        this.volumes = new Float64Array(this.maxParticles);
        this.materials = new Uint8Array(this.maxParticles);
        const gridLength = this.gridSize * this.gridSize;
        this.gridMomentumX = new Float64Array(gridLength);
        this.gridMomentumY = new Float64Array(gridLength);
        this.gridMass = new Float64Array(gridLength);
        this.diffusionX = new Float64Array(gridLength);
        this.diffusionY = new Float64Array(gridLength);
        this.configure(options);
    }
    get count() {
        return this.particleCount;
    }
    get timeStep() {
        return this.settings.timeStep;
    }
    getParameters() {
        return copyParameters(this.settings);
    }
    /** Merge runtime parameters. gridSize/maxParticles/particleVolume are constructor options. */
    configure(input) {
        const next = {
            ...this.settings,
            ...input,
            gravity: { ...this.settings.gravity, ...input.gravity },
            fluid: { ...this.settings.fluid, ...input.fluid },
            elastic: { ...this.settings.elastic, ...input.elastic },
            snow: { ...this.settings.snow, ...input.snow },
        };
        positive(next.timeStep, 'timeStep');
        positive(next.density, 'density');
        finite(next.gravity.x, 'gravity.x');
        finite(next.gravity.y, 'gravity.y');
        finite(next.viscosity, 'viscosity');
        if (next.viscosity < 0)
            throw new Error('viscosity cannot be negative.');
        if (!Number.isInteger(next.boundaryWidth) ||
            next.boundaryWidth < 0 ||
            next.boundaryWidth >= this.gridSize / 2) {
            throw new Error('boundaryWidth must be an integer in [0, gridSize / 2).');
        }
        positive(next.fluid.bulkModulus, 'fluid.bulkModulus');
        this.validateElastic(next.elastic.youngsModulus, next.elastic.poissonRatio, 'elastic');
        this.validateElastic(next.snow.youngsModulus, next.snow.poissonRatio, 'snow');
        finite(next.snow.hardening, 'snow.hardening');
        positive(next.snow.minStretch, 'snow.minStretch');
        positive(next.snow.maxStretch, 'snow.maxStretch');
        if (next.snow.maxStretch < next.snow.minStretch) {
            throw new Error('snow.maxStretch must be greater than or equal to snow.minStretch.');
        }
        this.settings = next;
        this.elasticMu0 = next.elastic.youngsModulus / (2 * (1 + next.elastic.poissonRatio));
        this.elasticLambda0 =
            (next.elastic.youngsModulus * next.elastic.poissonRatio) /
                ((1 + next.elastic.poissonRatio) * (1 - 2 * next.elastic.poissonRatio));
        this.snowMu0 = next.snow.youngsModulus / (2 * (1 + next.snow.poissonRatio));
        this.snowLambda0 =
            (next.snow.youngsModulus * next.snow.poissonRatio) /
                ((1 + next.snow.poissonRatio) * (1 - 2 * next.snow.poissonRatio));
    }
    validateElastic(youngsModulus, poissonRatio, name) {
        positive(youngsModulus, `${name}.youngsModulus`);
        finite(poissonRatio, `${name}.poissonRatio`);
        if (poissonRatio <= -1 || poissonRatio >= 0.5) {
            throw new Error(`${name}.poissonRatio must be between -1 and 0.5.`);
        }
    }
    clear() {
        this.particleCount = 0;
        this.simulationTime = 0;
        this.totalSteps = 0;
        this.lastGridMass = 0;
    }
    addParticle(options) {
        if (this.particleCount >= this.maxParticles) {
            throw new Error(`Particle capacity (${this.maxParticles}) exceeded.`);
        }
        finite(options.x, 'particle.x');
        finite(options.y, 'particle.y');
        if (options.x < 0 || options.x > 1 || options.y < 0 || options.y > 1) {
            throw new Error('Initial particle coordinates must be inside [0, 1].');
        }
        const vx = finite(options.vx ?? 0, 'particle.vx');
        const vy = finite(options.vy ?? 0, 'particle.vy');
        const volume = positive(options.volume ?? this.defaultParticleVolume, 'particle.volume');
        const p = this.particleCount++;
        const positionIndex = p * 2;
        const matrixIndex = p * 4;
        this.positions[positionIndex] = options.x;
        this.positions[positionIndex + 1] = options.y;
        this.velocities[positionIndex] = vx;
        this.velocities[positionIndex + 1] = vy;
        this.C.fill(0, matrixIndex, matrixIndex + 4);
        this.F[matrixIndex] = 1;
        this.F[matrixIndex + 1] = 0;
        this.F[matrixIndex + 2] = 0;
        this.F[matrixIndex + 3] = 1;
        this.Jp[p] = 1;
        this.Jf[p] = 1;
        this.volumes[p] = volume;
        this.materials[p] = materialId(options.material);
        return p;
    }
    addParticles(options) {
        if (options.positions.length % 2 !== 0) {
            throw new Error('positions must contain an even number of values.');
        }
        if (options.velocities && options.velocities.length !== options.positions.length) {
            throw new Error('velocities must have the same length as positions.');
        }
        const count = options.positions.length / 2;
        if (this.particleCount + count > this.maxParticles) {
            throw new Error(`Adding ${count} particles would exceed capacity (${this.maxParticles}).`);
        }
        const material = materialId(options.material);
        for (let p = 0; p < count; p++) {
            this.addParticle({
                x: options.positions[p * 2],
                y: options.positions[p * 2 + 1],
                vx: options.velocities?.[p * 2] ?? 0,
                vy: options.velocities?.[p * 2 + 1] ?? 0,
                volume: options.volume,
                material,
            });
        }
        return count;
    }
    addRectangle(options) {
        positive(options.width, 'rectangle.width');
        positive(options.height, 'rectangle.height');
        const spacing = positive(options.spacing ?? Math.sqrt(this.defaultParticleVolume), 'rectangle.spacing');
        const columns = Math.max(1, Math.round(options.width / spacing));
        const rows = Math.max(1, Math.round(options.height / spacing));
        const volume = options.volume ?? spacing * spacing;
        const material = materialId(options.material);
        let added = 0;
        for (let row = 0; row < rows; row++) {
            for (let column = 0; column < columns; column++) {
                this.addParticle({
                    x: options.x + ((column + 0.5) / columns) * options.width,
                    y: options.y + ((row + 0.5) / rows) * options.height,
                    vx: options.vx,
                    vy: options.vy,
                    volume,
                    material,
                });
                added++;
            }
        }
        return added;
    }
    addEllipse(options) {
        positive(options.radiusX, 'ellipse.radiusX');
        const radiusY = positive(options.radiusY ?? options.radiusX, 'ellipse.radiusY');
        const spacing = positive(options.spacing ?? Math.sqrt(this.defaultParticleVolume), 'ellipse.spacing');
        const columns = Math.max(1, Math.round((2 * options.radiusX) / spacing));
        const rows = Math.max(1, Math.round((2 * radiusY) / spacing));
        const volume = options.volume ?? spacing * spacing;
        const material = materialId(options.material);
        let added = 0;
        for (let row = 0; row < rows; row++) {
            const y = options.y - radiusY + ((row + 0.5) / rows) * (2 * radiusY);
            for (let column = 0; column < columns; column++) {
                const x = options.x - options.radiusX + ((column + 0.5) / columns) * (2 * options.radiusX);
                const normalized = ((x - options.x) / options.radiusX) ** 2 + ((y - options.y) / radiusY) ** 2;
                if (normalized > 1)
                    continue;
                this.addParticle({ x, y, vx: options.vx, vy: options.vy, volume, material });
                added++;
            }
        }
        return added;
    }
    addCircle(options) {
        return this.addEllipse({ ...options, radiusY: options.radiusX });
    }
    get materialCounts() {
        const counts = [0, 0, 0];
        for (let p = 0; p < this.particleCount; p++)
            counts[this.materials[p]]++;
        return counts;
    }
    getState() {
        const count = this.particleCount;
        return {
            count,
            positions: this.positions.slice(0, count * 2),
            velocities: this.velocities.slice(0, count * 2),
            C: this.C.slice(0, count * 4),
            F: this.F.slice(0, count * 4),
            Jp: this.Jp.slice(0, count),
            Jf: this.Jf.slice(0, count),
            volumes: this.volumes.slice(0, count),
            materials: this.materials.slice(0, count),
            simulationTime: this.simulationTime,
            totalSteps: this.totalSteps,
        };
    }
    restore(state) {
        if (!Number.isInteger(state.count) || state.count < 0 || state.count > this.maxParticles) {
            throw new Error('State particle count is invalid or exceeds world capacity.');
        }
        this.positions.set(state.positions.subarray(0, state.count * 2));
        this.velocities.set(state.velocities.subarray(0, state.count * 2));
        this.C.set(state.C.subarray(0, state.count * 4));
        this.F.set(state.F.subarray(0, state.count * 4));
        this.Jp.set(state.Jp.subarray(0, state.count));
        this.Jf.set(state.Jf.subarray(0, state.count));
        this.volumes.set(state.volumes.subarray(0, state.count));
        this.materials.set(state.materials.subarray(0, state.count));
        this.particleCount = state.count;
        this.simulationTime = state.simulationTime;
        this.totalSteps = state.totalSteps;
    }
    applyImpulse(impulse) {
        positive(impulse.radius, 'impulse.radius');
        finite(impulse.x, 'impulse.x');
        finite(impulse.y, 'impulse.y');
        finite(impulse.vx, 'impulse.vx');
        finite(impulse.vy, 'impulse.vy');
        const radiusSquared = impulse.radius * impulse.radius;
        for (let p = 0; p < this.particleCount; p++) {
            const index = p * 2;
            const dx = this.positions[index] - impulse.x;
            const dy = this.positions[index + 1] - impulse.y;
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared >= radiusSquared)
                continue;
            const falloff = 1 - distanceSquared / radiusSquared;
            const weight = falloff * falloff;
            this.velocities[index] += impulse.vx * weight;
            this.velocities[index + 1] += impulse.vy * weight;
        }
    }
    step() {
        const count = this.particleCount;
        const gridSize = this.gridSize;
        const dx = this.dx;
        const invDx = this.invDx;
        const parameters = this.settings;
        const dt = parameters.timeStep;
        const positions = this.positions;
        const velocities = this.velocities;
        const C = this.C;
        const F = this.F;
        const Jp = this.Jp;
        const Jf = this.Jf;
        const materials = this.materials;
        const volumes = this.volumes;
        const gridMomentumX = this.gridMomentumX;
        const gridMomentumY = this.gridMomentumY;
        const gridMass = this.gridMass;
        const weightsX = this.weightsX;
        const weightsY = this.weightsY;
        const svd = this.svd;
        const boundary = parameters.boundaryWidth;
        gridMomentumX.fill(0);
        gridMomentumY.fill(0);
        gridMass.fill(0);
        this.lastGridMass = 0;
        // Particle to grid (P2G)
        for (let p = 0; p < count; p++) {
            const positionIndex = p * 2;
            const matrixIndex = p * 4;
            const px = positions[positionIndex];
            const py = positions[positionIndex + 1];
            const gridX = px * invDx;
            const gridY = py * invDx;
            const baseX = Math.floor(gridX - 0.5);
            const baseY = Math.floor(gridY - 0.5);
            const fx = gridX - baseX;
            const fy = gridY - baseY;
            quadraticWeights(fx, weightsX);
            quadraticWeights(fy, weightsY);
            const c00 = C[matrixIndex];
            const c01 = C[matrixIndex + 1];
            const c10 = C[matrixIndex + 2];
            const c11 = C[matrixIndex + 3];
            const a00 = 1 + dt * c00;
            const a01 = dt * c01;
            const a10 = dt * c10;
            const a11 = 1 + dt * c11;
            const oldF00 = F[matrixIndex];
            const oldF01 = F[matrixIndex + 1];
            const oldF10 = F[matrixIndex + 2];
            const oldF11 = F[matrixIndex + 3];
            let f00 = a00 * oldF00 + a01 * oldF10;
            let f01 = a00 * oldF01 + a01 * oldF11;
            let f10 = a10 * oldF00 + a11 * oldF10;
            let f11 = a10 * oldF01 + a11 * oldF11;
            F[matrixIndex] = f00;
            F[matrixIndex + 1] = f01;
            F[matrixIndex + 2] = f10;
            F[matrixIndex + 3] = f11;
            const particleVolume = volumes[p];
            const particleMass = particleVolume * parameters.density;
            const stressScale = -dt * 4 * particleVolume * invDx * invDx;
            const material = materials[p];
            let affine00;
            let affine01;
            let affine10;
            let affine11;
            if (material === Material.Fluid) {
                const stress = -dt *
                    4 *
                    parameters.fluid.bulkModulus *
                    particleVolume *
                    (Jf[p] - 1) *
                    invDx *
                    invDx;
                affine00 = stress + particleMass * c00;
                affine01 = particleMass * c01;
                affine10 = particleMass * c10;
                affine11 = stress + particleMass * c11;
            }
            else {
                svd2(f00, f01, f10, f11, svd);
                const u00 = svd[0];
                const u01 = svd[1];
                const u10 = svd[2];
                const u11 = svd[3];
                const oldS0 = svd[4];
                const oldS1 = svd[5];
                const v00 = svd[6];
                const v01 = svd[7];
                const v10 = svd[8];
                const v11 = svd[9];
                let newS0 = oldS0;
                let newS1 = oldS1;
                const isSnow = material === Material.Snow;
                const hardening = isSnow ? Math.exp(parameters.snow.hardening * (1 - Jp[p])) : 1;
                const mu = (isSnow ? this.snowMu0 : this.elasticMu0) * hardening;
                const lambda = (isSnow ? this.snowLambda0 : this.elasticLambda0) * hardening;
                if (isSnow) {
                    newS0 = Math.min(Math.max(oldS0, parameters.snow.minStretch), parameters.snow.maxStretch);
                    newS1 = Math.min(Math.max(oldS1, parameters.snow.minStretch), parameters.snow.maxStretch);
                    Jp[p] *= (oldS0 / newS0) * (oldS1 / newS1);
                    f00 = u00 * newS0 * v00 + u01 * newS1 * v01;
                    f01 = u00 * newS0 * v10 + u01 * newS1 * v11;
                    f10 = u10 * newS0 * v00 + u11 * newS1 * v01;
                    f11 = u10 * newS0 * v10 + u11 * newS1 * v11;
                    F[matrixIndex] = f00;
                    F[matrixIndex + 1] = f01;
                    F[matrixIndex + 2] = f10;
                    F[matrixIndex + 3] = f11;
                }
                const r00 = u00 * v00 + u01 * v01;
                const r01 = u00 * v10 + u01 * v11;
                const r10 = u10 * v00 + u11 * v01;
                const r11 = u10 * v10 + u11 * v11;
                const J = newS0 * newS1;
                const volumeTerm = lambda * J * (J - 1);
                const twoMu = 2 * mu;
                const d00 = f00 - r00;
                const d01 = f01 - r01;
                const d10 = f10 - r10;
                const d11 = f11 - r11;
                const stress00 = twoMu * (d00 * f00 + d01 * f01) + volumeTerm;
                const stress01 = twoMu * (d00 * f10 + d01 * f11);
                const stress10 = twoMu * (d10 * f00 + d11 * f01);
                const stress11 = twoMu * (d10 * f10 + d11 * f11) + volumeTerm;
                affine00 = stressScale * stress00 + particleMass * c00;
                affine01 = stressScale * stress01 + particleMass * c01;
                affine10 = stressScale * stress10 + particleMass * c10;
                affine11 = stressScale * stress11 + particleMass * c11;
            }
            const momentumX = particleMass * velocities[positionIndex];
            const momentumY = particleMass * velocities[positionIndex + 1];
            for (let j = 0; j < 3; j++) {
                const nodeY = baseY + j;
                if (nodeY < 0 || nodeY >= gridSize)
                    continue;
                const dposY = (j - fy) * dx;
                for (let i = 0; i < 3; i++) {
                    const nodeX = baseX + i;
                    if (nodeX < 0 || nodeX >= gridSize)
                        continue;
                    const weight = weightsX[i] * weightsY[j];
                    const dposX = (i - fx) * dx;
                    const node = nodeX + nodeY * gridSize;
                    const weightedMass = weight * particleMass;
                    gridMomentumX[node] += weight * (momentumX + affine00 * dposX + affine01 * dposY);
                    gridMomentumY[node] += weight * (momentumY + affine10 * dposX + affine11 * dposY);
                    gridMass[node] += weightedMass;
                    this.lastGridMass += weightedMass;
                }
            }
        }
        // Grid velocity, gravity, and boundary conditions
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                const node = x + y * gridSize;
                const mass = gridMass[node];
                if (mass <= 0)
                    continue;
                let vx = gridMomentumX[node] / mass + dt * parameters.gravity.x;
                let vy = gridMomentumY[node] / mass + dt * parameters.gravity.y;
                if ((x < boundary && vx < 0) || (x > gridSize - boundary && vx > 0))
                    vx = 0;
                if ((y < boundary && vy < 0) || (y > gridSize - boundary && vy > 0))
                    vy = 0;
                gridMomentumX[node] = vx;
                gridMomentumY[node] = vy;
            }
        }
        // Optional local numerical viscosity. Zero disables this pass.
        const viscosity = Math.min(0.45, parameters.viscosity);
        if (viscosity > 0) {
            this.diffusionX.set(gridMomentumX);
            this.diffusionY.set(gridMomentumY);
            for (let y = 0; y < gridSize; y++) {
                for (let x = 0; x < gridSize; x++) {
                    const node = x + y * gridSize;
                    if (gridMass[node] <= 0)
                        continue;
                    let sumX = 0;
                    let sumY = 0;
                    let neighbors = 0;
                    if (x > 0 && gridMass[node - 1] > 0) {
                        sumX += this.diffusionX[node - 1];
                        sumY += this.diffusionY[node - 1];
                        neighbors++;
                    }
                    if (x + 1 < gridSize && gridMass[node + 1] > 0) {
                        sumX += this.diffusionX[node + 1];
                        sumY += this.diffusionY[node + 1];
                        neighbors++;
                    }
                    if (y > 0 && gridMass[node - gridSize] > 0) {
                        sumX += this.diffusionX[node - gridSize];
                        sumY += this.diffusionY[node - gridSize];
                        neighbors++;
                    }
                    if (y + 1 < gridSize && gridMass[node + gridSize] > 0) {
                        sumX += this.diffusionX[node + gridSize];
                        sumY += this.diffusionY[node + gridSize];
                        neighbors++;
                    }
                    if (neighbors === 0)
                        continue;
                    let vx = this.diffusionX[node] + viscosity * (sumX / neighbors - this.diffusionX[node]);
                    let vy = this.diffusionY[node] + viscosity * (sumY / neighbors - this.diffusionY[node]);
                    if ((x < boundary && vx < 0) || (x > gridSize - boundary && vx > 0))
                        vx = 0;
                    if ((y < boundary && vy < 0) || (y > gridSize - boundary && vy > 0))
                        vy = 0;
                    gridMomentumX[node] = vx;
                    gridMomentumY[node] = vy;
                }
            }
        }
        // Grid to particle (G2P)
        for (let p = 0; p < count; p++) {
            const positionIndex = p * 2;
            const matrixIndex = p * 4;
            const px = positions[positionIndex];
            const py = positions[positionIndex + 1];
            const gridX = px * invDx;
            const gridY = py * invDx;
            const baseX = Math.floor(gridX - 0.5);
            const baseY = Math.floor(gridY - 0.5);
            const fx = gridX - baseX;
            const fy = gridY - baseY;
            quadraticWeights(fx, weightsX);
            quadraticWeights(fy, weightsY);
            let vx = 0;
            let vy = 0;
            let c00 = 0;
            let c01 = 0;
            let c10 = 0;
            let c11 = 0;
            for (let j = 0; j < 3; j++) {
                const nodeY = baseY + j;
                if (nodeY < 0 || nodeY >= gridSize)
                    continue;
                const dposY = j - fy;
                for (let i = 0; i < 3; i++) {
                    const nodeX = baseX + i;
                    if (nodeX < 0 || nodeX >= gridSize)
                        continue;
                    const node = nodeX + nodeY * gridSize;
                    const weight = weightsX[i] * weightsY[j];
                    const gridVx = gridMomentumX[node];
                    const gridVy = gridMomentumY[node];
                    const dposX = i - fx;
                    vx += weight * gridVx;
                    vy += weight * gridVy;
                    const cScale = 4 * invDx * weight;
                    c00 += cScale * gridVx * dposX;
                    c01 += cScale * gridVx * dposY;
                    c10 += cScale * gridVy * dposX;
                    c11 += cScale * gridVy * dposY;
                }
            }
            velocities[positionIndex] = vx;
            velocities[positionIndex + 1] = vy;
            C[matrixIndex] = c00;
            C[matrixIndex + 1] = c01;
            C[matrixIndex + 2] = c10;
            C[matrixIndex + 3] = c11;
            Jf[p] *= 1 + dt * (c00 + c11);
            const nextX = px + dt * vx;
            const nextY = py + dt * vy;
            if (!Number.isFinite(nextX + nextY + vx + vy + Jf[p] + Jp[p])) {
                throw new Error(`Simulation became non-finite at particle ${p}.`);
            }
            positions[positionIndex] = nextX;
            positions[positionIndex + 1] = nextY;
        }
        this.simulationTime += dt;
        this.totalSteps++;
    }
}
