export const Material = {
    Fluid: 0,
    Elastic: 1,
    Snow: 2,
};
export const DEFAULT_WORLD_PARAMETERS = {
    timeStep: 1e-4,
    gravity: { x: 0, y: -9.8 },
    density: 1,
    viscosity: 0.3,
    boundaryWidth: 3,
    fluid: { bulkModulus: 400 },
    elastic: { youngsModulus: 5000, poissonRatio: 0.2 },
    snow: {
        youngsModulus: 5000,
        poissonRatio: 0.2,
        hardening: 10,
        minStretch: 0.975,
        maxStretch: 1.0045,
    },
};
