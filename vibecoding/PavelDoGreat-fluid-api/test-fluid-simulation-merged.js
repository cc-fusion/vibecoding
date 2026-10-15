'use strict';

// Dependency-free Node smoke checks. These do not replace a real WebGL/browser test.
const assert = require('node:assert/strict');
const FluidSimulation = require('./fluid-simulation-merged.js');

assert.equal(FluidSimulation.version, '2.1.0');
assert.equal(typeof FluidSimulation.create, 'function');
assert.equal(typeof FluidSimulation.createIfSupported, 'function');
assert.equal(typeof FluidSimulation.isSupported, 'function');
assert.equal(typeof FluidSimulation.autoInit, 'function');
assert.equal(typeof FluidSimulation.destroyAll, 'function');

for (const preset of ['classic', 'default', 'calm', 'vivid', 'neon', 'smoke', 'ink', 'fire', 'water', 'ocean']) {
  assert.ok(FluidSimulation.presets[preset], `missing preset ${preset}`);
}
for (const quality of ['low', 'performance', 'medium', 'high', 'ultra']) {
  assert.ok(FluidSimulation.qualityPresets[quality], `missing quality preset ${quality}`);
}

const defaultsA = FluidSimulation.defaultConfig();
const defaultsB = FluidSimulation.defaultConfig();
assert.ok('PALETTE' in defaultsA && 'CHECKERBOARD' in defaultsA);
defaultsA.BACK_COLOR.r = 255;
assert.notEqual(defaultsB.BACK_COLOR.r, 255, 'default config should be detached');

// Exercise alias normalization, palette cloning, and palette color generation without WebGL.
const mock = Object.create(FluidSimulation.prototype);
mock.destroyed = false;
mock.config = FluidSimulation.defaultConfig();
mock._handlers = {};
mock._colorGenerator = () => ({ r: 0.2, g: 0.3, b: 0.4 });
assert.equal(mock.setConfig({ curl: 24, palette: ['#ff0000', '#00ff00'] }), mock, 'setConfig should be chainable');
assert.equal(mock.setConfig({
  timeScale: 0.75,
  maxDeltaTime: 0.02,
  advectionStrength: 1.25,
  splatSharpness: 1.4,
  randomSplatForce: 900,
  randomSplatColorScale: 8,
  shadingStrength: 1.1,
  shadingBase: 0.65,
  ditheringStrength: 0.8,
  sunraysDensity: 0.4,
  sunraysDecay: 0.9,
  sunraysExposure: 0.6,
  sunraysIterations: 12
}), mock, 'advanced settings should be chainable');
assert.equal(mock.config.TIME_SCALE, 0.75);
assert.equal(mock.config.MAX_DELTA_TIME, 0.02);
assert.equal(mock.config.ADVECTION_STRENGTH, 1.25);
assert.equal(mock.config.SPLAT_SHARPNESS, 1.4);
assert.equal(mock.config.RANDOM_SPLAT_FORCE, 900);
assert.equal(mock.config.RANDOM_SPLAT_COLOR_SCALE, 8);
assert.equal(mock.config.SHADING_STRENGTH, 1.1);
assert.equal(mock.config.SHADING_BASE, 0.65);
assert.equal(mock.config.DITHERING_STRENGTH, 0.8);
assert.equal(mock.config.SUNRAYS_DENSITY, 0.4);
assert.equal(mock.config.SUNRAYS_DECAY, 0.9);
assert.equal(mock.config.SUNRAYS_EXPOSURE, 0.6);
assert.equal(mock.config.SUNRAYS_ITERATIONS, 12);

// The timing settings cap elapsed time before applying the time scale.
const timingMock = Object.create(FluidSimulation.prototype);
timingMock._contextLost = false;
timingMock.config = { MAX_DELTA_TIME: 0.02, TIME_SCALE: 2, PAUSED: false };
timingMock._updateColors = dt => { timingMock.lastColorDt = dt; };
timingMock._applyInputs = () => {};
timingMock.step = dt => { timingMock.lastStepDt = dt; };
timingMock._render = () => {};
timingMock._emit = () => {};
timingMock._advance(0.08);
assert.equal(timingMock.lastStepDt, 0.04, 'elapsed time should be capped before time scaling');
timingMock.config.TIME_SCALE = 0;
delete timingMock.lastStepDt;
timingMock._advance(0.02);
assert.equal(timingMock.lastColorDt, 0, 'zero time scale should freeze simulation time');
assert.equal('lastStepDt' in timingMock, false, 'zero time scale should skip the solver step');

// Invalid advanced values should be ignored rather than corrupting state.
const originalWarn = console.warn;
console.warn = () => {};
try {
  mock.setConfig({ timeScale: 5, maxDeltaTime: 0.0001, splatSharpness: 0, sunraysIterations: 17 });
} finally {
  console.warn = originalWarn;
}
assert.equal(mock.config.TIME_SCALE, 0.75);
assert.equal(mock.config.MAX_DELTA_TIME, 0.02);
assert.equal(mock.config.SPLAT_SHARPNESS, 1.4);
assert.equal(mock.config.SUNRAYS_ITERATIONS, 12);

assert.equal(mock.config.CURL, 24);
const paletteColor = mock.randomColor();
assert.ok(
  (paletteColor.r === 1 && paletteColor.g === 0 && paletteColor.b === 0) ||
  (paletteColor.r === 0 && paletteColor.g === 1 && paletteColor.b === 0),
  'palette should return one of the configured colors'
);
const configSnapshot = mock.getConfig();
configSnapshot.PALETTE.push('#0000ff');
assert.equal(mock.config.PALETTE.length, 2, 'getConfig should deep-clone palettes');
mock.setPalette(['#0000ff']);
assert.deepEqual(mock.randomColor(), { r: 0, g: 0, b: 1 });


// Hover mode initializes on the first move, then registers movement for the next frame.
const hoverMock = Object.create(FluidSimulation.prototype);
hoverMock.destroyed = false;
hoverMock.options = { hover: true, color: null };
hoverMock.config = { COLORFUL: true, PALETTE: null, SPLAT_FORCE: 6000 };
hoverMock._colorGenerator = () => ({ r: 0.15, g: 0.2, b: 0.3 });
hoverMock._pointersById = {};
hoverMock._activeIds = [];
hoverMock.pointers = [];
hoverMock.canvas = {
  width: 100, height: 100, clientWidth: 100, clientHeight: 100,
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
};
hoverMock._pointerMoveWithClient(-1, 20, 20);
assert.equal(hoverMock._pointersById[-1].moved, false, 'first hover position should establish a baseline');
hoverMock._pointerMoveWithClient(-1, 35, 30);
assert.equal(hoverMock._pointersById[-1].moved, true, 'subsequent hover movement should inject a splat');

// In a Node-only environment creation should fail deterministically and honor throwOnError.
let errorCount = 0;
const skipped = FluidSimulation.create({
  canvas: '#not-found',
  throwOnError: false,
  onError(error) { errorCount++; assert.equal(error.code, 'NO_CANVAS'); }
});
assert.equal(skipped, null);
assert.equal(errorCount, 1);

let supportErrorCount = 0;
const unsupported = FluidSimulation.createIfSupported({
  onError(error) { supportErrorCount++; assert.equal(error.code, 'NO_WEBGL'); }
});
assert.equal(unsupported, null);
assert.equal(supportErrorCount, 1);

console.log('FluidSimulation merged API smoke checks passed.');
