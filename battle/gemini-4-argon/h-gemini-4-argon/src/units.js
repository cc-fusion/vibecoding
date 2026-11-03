import Decimal from 'decimal.js';
import { logger } from './logger.js';

// Seven SI base dimensions in canonical order:
// [m (length), kg (mass), s (time), A (current), K (temperature), mol (substance), cd (luminosity)]
export const SI_BASE_SYMBOLS = ['m', 'kg', 's', 'A', 'K', 'mol', 'cd'];

export const DEFAULT_UNITS = [
  // === Length [1, 0, 0, 0, 0, 0, 0] ===
  { symbol: 'pm', aliases: ['picometer', 'picometers'], coeff: '1e-12', exponents: [1, 0, 0, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'nm', aliases: ['nanometer', 'nanometers'], coeff: '1e-9', exponents: [1, 0, 0, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'um', aliases: ['µm', 'μm', 'micrometer', 'micrometers'], coeff: '1e-6', exponents: [1, 0, 0, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'mm', aliases: ['millimeter', 'millimeters'], coeff: '1e-3', exponents: [1, 0, 0, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'cm', aliases: ['centimeter', 'centimeters'], coeff: '1e-2', exponents: [1, 0, 0, 0, 0, 0, 0], system: 'metric', autoScale: false },
  { symbol: 'm', aliases: ['meter', 'meters', 'metre', 'metres'], coeff: '1', exponents: [1, 0, 0, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'km', aliases: ['kilometer', 'kilometers', 'kilometre', 'kilometres'], coeff: '1e3', exponents: [1, 0, 0, 0, 0, 0, 0], system: 'metric', autoScale: true },

  { symbol: 'in', aliases: ['inch', 'inches'], coeff: '0.0254', exponents: [1, 0, 0, 0, 0, 0, 0], system: 'imperial', autoScale: true },
  { symbol: 'ft', aliases: ['foot', 'feet'], coeff: '0.3048', exponents: [1, 0, 0, 0, 0, 0, 0], system: 'imperial', autoScale: true },
  { symbol: 'yd', aliases: ['yard', 'yards'], coeff: '0.9144', exponents: [1, 0, 0, 0, 0, 0, 0], system: 'imperial', autoScale: false },
  { symbol: 'mi', aliases: ['mile', 'miles'], coeff: '1609.344', exponents: [1, 0, 0, 0, 0, 0, 0], system: 'imperial', autoScale: true },
  { symbol: 'nmi', aliases: ['nauticalmile', 'nauticalmiles'], coeff: '1852', exponents: [1, 0, 0, 0, 0, 0, 0], system: 'imperial', autoScale: false },

  // === Mass [0, 1, 0, 0, 0, 0, 0] ===
  { symbol: 'pg', aliases: ['picogram', 'picograms'], coeff: '1e-15', exponents: [0, 1, 0, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'ng', aliases: ['nanogram', 'nanograms'], coeff: '1e-12', exponents: [0, 1, 0, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'ug', aliases: ['µg', 'μg', 'mcg', 'microgram', 'micrograms'], coeff: '1e-9', exponents: [0, 1, 0, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'mg', aliases: ['milligram', 'milligrams'], coeff: '1e-6', exponents: [0, 1, 0, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'g', aliases: ['gram', 'grams'], coeff: '1e-3', exponents: [0, 1, 0, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'kg', aliases: ['kilogram', 'kilograms', 'kgs'], coeff: '1', exponents: [0, 1, 0, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 't', aliases: ['tonne', 'tonnes', 'Mg'], coeff: '1e3', exponents: [0, 1, 0, 0, 0, 0, 0], system: 'metric', autoScale: false },

  { symbol: 'oz', aliases: ['ounce', 'ounces'], coeff: '0.028349523125', exponents: [0, 1, 0, 0, 0, 0, 0], system: 'imperial', autoScale: true },
  { symbol: 'lbs', aliases: ['lb', 'pound', 'pounds'], coeff: '0.45359237', exponents: [0, 1, 0, 0, 0, 0, 0], system: 'imperial', autoScale: true },
  { symbol: 'st', aliases: ['stone', 'stones'], coeff: '6.35029318', exponents: [0, 1, 0, 0, 0, 0, 0], system: 'imperial', autoScale: false },
  { symbol: 'ton', aliases: ['tons', 'shortton'], coeff: '907.18474', exponents: [0, 1, 0, 0, 0, 0, 0], system: 'imperial', autoScale: false },

  // === Time [0, 0, 1, 0, 0, 0, 0] ===
  { symbol: 'ps', aliases: ['picosecond', 'picoseconds'], coeff: '1e-12', exponents: [0, 0, 1, 0, 0, 0, 0], system: 'universal', autoScale: true },
  { symbol: 'ns', aliases: ['nanosecond', 'nanoseconds'], coeff: '1e-9', exponents: [0, 0, 1, 0, 0, 0, 0], system: 'universal', autoScale: true },
  { symbol: 'us', aliases: ['µs', 'μs', 'microsecond', 'microseconds'], coeff: '1e-6', exponents: [0, 0, 1, 0, 0, 0, 0], system: 'universal', autoScale: true },
  { symbol: 'ms', aliases: ['millisecond', 'milliseconds'], coeff: '1e-3', exponents: [0, 0, 1, 0, 0, 0, 0], system: 'universal', autoScale: true },
  { symbol: 's', aliases: ['sec', 'secs', 'second', 'seconds'], coeff: '1', exponents: [0, 0, 1, 0, 0, 0, 0], system: 'universal', autoScale: true },
  { symbol: 'min', aliases: ['mins', 'minute', 'minutes'], coeff: '60', exponents: [0, 0, 1, 0, 0, 0, 0], system: 'universal', autoScale: false },
  { symbol: 'h', aliases: ['hr', 'hrs', 'hour', 'hours'], coeff: '3600', exponents: [0, 0, 1, 0, 0, 0, 0], system: 'universal', autoScale: false },
  { symbol: 'day', aliases: ['days', 'd'], coeff: '86400', exponents: [0, 0, 1, 0, 0, 0, 0], system: 'universal', autoScale: false },
  { symbol: 'wk', aliases: ['week', 'weeks'], coeff: '604800', exponents: [0, 0, 1, 0, 0, 0, 0], system: 'universal', autoScale: false },
  { symbol: 'yr', aliases: ['year', 'years'], coeff: '31557600', exponents: [0, 0, 1, 0, 0, 0, 0], system: 'universal', autoScale: false },

  // === Electric Current, Temperature, Substance, Luminosity ===
  { symbol: 'uA', aliases: ['µA', 'μA'], coeff: '1e-6', exponents: [0, 0, 0, 1, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'mA', aliases: ['milliamp', 'milliamps'], coeff: '1e-3', exponents: [0, 0, 0, 1, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'A', aliases: ['amp', 'amps', 'ampere', 'amperes'], coeff: '1', exponents: [0, 0, 0, 1, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'K', aliases: ['kelvin', 'kelvins'], coeff: '1', exponents: [0, 0, 0, 0, 1, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'mmol', aliases: ['millimole', 'millimoles'], coeff: '1e-3', exponents: [0, 0, 0, 0, 0, 1, 0], system: 'metric', autoScale: true },
  { symbol: 'mol', aliases: ['mole', 'moles'], coeff: '1', exponents: [0, 0, 0, 0, 0, 1, 0], system: 'metric', autoScale: true },
  { symbol: 'cd', aliases: ['candela', 'candelas'], coeff: '1', exponents: [0, 0, 0, 0, 0, 0, 1], system: 'metric', autoScale: true },

  // === Energy / Work [2, 1, -2, 0, 0, 0, 0] ===
  { symbol: 'mJ', aliases: ['millijoule', 'millijoules'], coeff: '1e-3', exponents: [2, 1, -2, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'J', aliases: ['joule', 'joules'], coeff: '1', exponents: [2, 1, -2, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'kJ', aliases: ['kilojoule', 'kilojoules'], coeff: '1e3', exponents: [2, 1, -2, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'MJ', aliases: ['megajoule', 'megajoules'], coeff: '1e6', exponents: [2, 1, -2, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'GJ', aliases: ['gigajoule', 'gigajoules'], coeff: '1e9', exponents: [2, 1, -2, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'Wh', aliases: ['watthour', 'watthours'], coeff: '3600', exponents: [2, 1, -2, 0, 0, 0, 0], system: 'metric', autoScale: false },
  { symbol: 'kWh', aliases: ['kilowatthour', 'kilowatthours'], coeff: '3.6e6', exponents: [2, 1, -2, 0, 0, 0, 0], system: 'metric', autoScale: false },
  { symbol: 'cal', aliases: ['calorie', 'calories'], coeff: '4.184', exponents: [2, 1, -2, 0, 0, 0, 0], system: 'metric', autoScale: false },
  { symbol: 'kcal', aliases: ['kilocalorie', 'kilocalories'], coeff: '4184', exponents: [2, 1, -2, 0, 0, 0, 0], system: 'metric', autoScale: false },
  { symbol: 'eV', aliases: ['electronvolt', 'electronvolts'], coeff: '1.602176634e-19', exponents: [2, 1, -2, 0, 0, 0, 0], system: 'metric', autoScale: false },
  { symbol: 'ftlb', aliases: ['ftlbs'], coeff: '1.3558179483314004', exponents: [2, 1, -2, 0, 0, 0, 0], system: 'imperial', autoScale: true },
  { symbol: 'BTU', aliases: ['btu'], coeff: '1055.05585262', exponents: [2, 1, -2, 0, 0, 0, 0], system: 'imperial', autoScale: true },

  // === Force [1, 1, -2, 0, 0, 0, 0] ===
  { symbol: 'mN', aliases: ['millinewton', 'millinewtons'], coeff: '1e-3', exponents: [1, 1, -2, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'N', aliases: ['newton', 'newtons'], coeff: '1', exponents: [1, 1, -2, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'kN', aliases: ['kilonewton', 'kilonewtons'], coeff: '1e3', exponents: [1, 1, -2, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'MN', aliases: ['meganewton', 'meganewtons'], coeff: '1e6', exponents: [1, 1, -2, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'lbf', aliases: ['poundforce'], coeff: '4.4482216152605', exponents: [1, 1, -2, 0, 0, 0, 0], system: 'imperial', autoScale: true },

  // === Power [2, 1, -3, 0, 0, 0, 0] ===
  { symbol: 'mW', aliases: ['milliwatt', 'milliwatts'], coeff: '1e-3', exponents: [2, 1, -3, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'W', aliases: ['watt', 'watts'], coeff: '1', exponents: [2, 1, -3, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'kW', aliases: ['kilowatt', 'kilowatts'], coeff: '1e3', exponents: [2, 1, -3, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'MW', aliases: ['megawatt', 'megawatts'], coeff: '1e6', exponents: [2, 1, -3, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'GW', aliases: ['gigawatt', 'gigawatts'], coeff: '1e9', exponents: [2, 1, -3, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'hp', aliases: ['horsepower'], coeff: '745.6998715822702', exponents: [2, 1, -3, 0, 0, 0, 0], system: 'imperial', autoScale: true },

  // === Pressure [-1, 1, -2, 0, 0, 0, 0] ===
  { symbol: 'Pa', aliases: ['pascal', 'pascals'], coeff: '1', exponents: [-1, 1, -2, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'kPa', aliases: ['kilopascal', 'kilopascals'], coeff: '1e3', exponents: [-1, 1, -2, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'MPa', aliases: ['megapascal', 'megapascals'], coeff: '1e6', exponents: [-1, 1, -2, 0, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'bar', aliases: ['bars'], coeff: '1e5', exponents: [-1, 1, -2, 0, 0, 0, 0], system: 'metric', autoScale: false },
  { symbol: 'atm', aliases: ['atmosphere', 'atmospheres'], coeff: '101325', exponents: [-1, 1, -2, 0, 0, 0, 0], system: 'metric', autoScale: false },
  { symbol: 'psi', aliases: ['PSI'], coeff: '6894.757293168', exponents: [-1, 1, -2, 0, 0, 0, 0], system: 'imperial', autoScale: true },

  // === Frequency [0, 0, -1, 0, 0, 0, 0] ===
  { symbol: 'Hz', aliases: ['hertz'], coeff: '1', exponents: [0, 0, -1, 0, 0, 0, 0], system: 'universal', autoScale: true },
  { symbol: 'kHz', aliases: ['kilohertz'], coeff: '1e3', exponents: [0, 0, -1, 0, 0, 0, 0], system: 'universal', autoScale: true },
  { symbol: 'MHz', aliases: ['megahertz'], coeff: '1e6', exponents: [0, 0, -1, 0, 0, 0, 0], system: 'universal', autoScale: true },
  { symbol: 'GHz', aliases: ['gigahertz'], coeff: '1e9', exponents: [0, 0, -1, 0, 0, 0, 0], system: 'universal', autoScale: true },

  // === Area [2, 0, 0, 0, 0, 0, 0] & Volume [3, 0, 0, 0, 0, 0, 0] ===
  { symbol: 'ha', aliases: ['hectare', 'hectares'], coeff: '1e4', exponents: [2, 0, 0, 0, 0, 0, 0], system: 'metric', autoScale: false },
  { symbol: 'sqin', aliases: [], coeff: '0.00064516', exponents: [2, 0, 0, 0, 0, 0, 0], system: 'imperial', autoScale: false },
  { symbol: 'sqft', aliases: [], coeff: '0.09290304', exponents: [2, 0, 0, 0, 0, 0, 0], system: 'imperial', autoScale: false },
  { symbol: 'acre', aliases: ['acres'], coeff: '4046.8564224', exponents: [2, 0, 0, 0, 0, 0, 0], system: 'imperial', autoScale: false },

  { symbol: 'mL', aliases: ['ml', 'milliliter', 'milliliters'], coeff: '1e-6', exponents: [3, 0, 0, 0, 0, 0, 0], system: 'metric', autoScale: false, volumetric: true },
  { symbol: 'L', aliases: ['l', 'liter', 'liters', 'litre', 'litres'], coeff: '1e-3', exponents: [3, 0, 0, 0, 0, 0, 0], system: 'metric', autoScale: false, volumetric: true },
  { symbol: 'tsp', aliases: ['teaspoon', 'teaspoons'], coeff: '4.92892159375e-6', exponents: [3, 0, 0, 0, 0, 0, 0], system: 'imperial', autoScale: false, volumetric: true },
  { symbol: 'tbsp', aliases: ['tablespoon', 'tablespoons'], coeff: '1.478676478125e-5', exponents: [3, 0, 0, 0, 0, 0, 0], system: 'imperial', autoScale: false, volumetric: true },
  { symbol: 'floz', aliases: ['fluidounce', 'fluidounces'], coeff: '2.95735295625e-5', exponents: [3, 0, 0, 0, 0, 0, 0], system: 'imperial', autoScale: false, volumetric: true },
  { symbol: 'cup', aliases: ['cups'], coeff: '2.365882365e-4', exponents: [3, 0, 0, 0, 0, 0, 0], system: 'imperial', autoScale: false, volumetric: true },
  { symbol: 'pt', aliases: ['pint', 'pints'], coeff: '4.73176473e-4', exponents: [3, 0, 0, 0, 0, 0, 0], system: 'imperial', autoScale: false, volumetric: true },
  { symbol: 'qt', aliases: ['quart', 'quarts'], coeff: '9.46352946e-4', exponents: [3, 0, 0, 0, 0, 0, 0], system: 'imperial', autoScale: false, volumetric: true },
  { symbol: 'gal', aliases: ['gallon', 'gallons'], coeff: '0.003785411784', exponents: [3, 0, 0, 0, 0, 0, 0], system: 'imperial', autoScale: false, volumetric: true },

  // === Speed [1, 0, -1, 0, 0, 0, 0] ===
  { symbol: 'kph', aliases: ['kmh'], coeff: '0.27777777777777777778', exponents: [1, 0, -1, 0, 0, 0, 0], system: 'metric', autoScale: false },
  { symbol: 'mph', aliases: ['MPH'], coeff: '0.44704', exponents: [1, 0, -1, 0, 0, 0, 0], system: 'imperial', autoScale: true },
  { symbol: 'kn', aliases: ['kt', 'knot', 'knots'], coeff: '0.51444444444444444444', exponents: [1, 0, -1, 0, 0, 0, 0], system: 'imperial', autoScale: false },

  // === Electricity ===
  { symbol: 'uC', aliases: ['µC', 'μC'], coeff: '1e-6', exponents: [0, 0, 1, 1, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'mC', aliases: ['millicoulomb'], coeff: '1e-3', exponents: [0, 0, 1, 1, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'C', aliases: ['coulomb', 'coulombs'], coeff: '1', exponents: [0, 0, 1, 1, 0, 0, 0], system: 'metric', autoScale: true },

  { symbol: 'mV', aliases: ['millivolt', 'millivolts'], coeff: '1e-3', exponents: [2, 1, -3, -1, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'V', aliases: ['volt', 'volts'], coeff: '1', exponents: [2, 1, -3, -1, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'kV', aliases: ['kilovolt', 'kilovolts'], coeff: '1e3', exponents: [2, 1, -3, -1, 0, 0, 0], system: 'metric', autoScale: true },

  { symbol: 'Ohm', aliases: ['ohm', 'ohms', 'Ω'], coeff: '1', exponents: [2, 1, -3, -2, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'kOhm', aliases: ['kohm', 'kΩ'], coeff: '1e3', exponents: [2, 1, -3, -2, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'MOhm', aliases: ['Mohm', 'MΩ'], coeff: '1e6', exponents: [2, 1, -3, -2, 0, 0, 0], system: 'metric', autoScale: true },

  { symbol: 'pF', aliases: ['picofarad'], coeff: '1e-12', exponents: [-2, -1, 4, 2, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'nF', aliases: ['nanofarad'], coeff: '1e-9', exponents: [-2, -1, 4, 2, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'uF', aliases: ['µF', 'μF', 'microfarad'], coeff: '1e-6', exponents: [-2, -1, 4, 2, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'mF', aliases: ['millifarad'], coeff: '1e-3', exponents: [-2, -1, 4, 2, 0, 0, 0], system: 'metric', autoScale: true },
  { symbol: 'F', aliases: ['farad', 'farads'], coeff: '1', exponents: [-2, -1, 4, 2, 0, 0, 0], system: 'metric', autoScale: true },

  // === Angles (Dimensionless with angle tag) ===
  { symbol: 'rad', aliases: ['radian', 'radians'], coeff: '1', exponents: [0, 0, 0, 0, 0, 0, 0], system: 'universal', autoScale: true, isAngle: true, angleUnit: 'rad' },
  { symbol: 'deg', aliases: ['degree', 'degrees', '°'], coeff: 'pi/180', exponents: [0, 0, 0, 0, 0, 0, 0], system: 'universal', autoScale: true, isAngle: true, angleUnit: 'deg' },
];

export function zeroDims() {
  return [0, 0, 0, 0, 0, 0, 0];
}

export function isDimensionless(dims) {
  for (let i = 0; i < 7; i++) {
    if (dims[i] !== 0) return false;
  }
  return true;
}

export function dimsEqual(a, b) {
  for (let i = 0; i < 7; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function dimsKey(dims) {
  return dims.join(',');
}

export function addDims(a, b) {
  const out = new Array(7);
  for (let i = 0; i < 7; i++) out[i] = a[i] + b[i];
  return out;
}

export function subDims(a, b) {
  const out = new Array(7);
  for (let i = 0; i < 7; i++) out[i] = a[i] - b[i];
  return out;
}

export function scaleDims(a, factor) {
  const out = new Array(7);
  for (let i = 0; i < 7; i++) out[i] = a[i] * factor;
  return out;
}

function normalizeExponentsInput(exp) {
  if (Array.isArray(exp) && exp.length === 7) {
    return exp.map((n) => Number(n) || 0);
  }
  if (exp && typeof exp === 'object') {
    return SI_BASE_SYMBOLS.map((sym) => Number(exp[sym]) || 0);
  }
  throw new Error('Unit exponents must be an array of 7 numbers [m, kg, s, A, K, mol, cd]');
}

const SUPERSCRIPT_DIGITS = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻',
};

function toSuperscript(num) {
  return String(num)
    .split('')
    .map((ch) => SUPERSCRIPT_DIGITS[ch] || ch)
    .join('');
}

export function formatExpSuffix(power, expStyle = '**') {
  if (power === 1) return '';
  if (expStyle === 'inline') return String(power);
  if (expStyle === '^') return `^${power}`;
  if (expStyle === 'super') return toSuperscript(power);
  return `**${power}`;
}

export class UnitEngine {
  constructor(initialUnits = DEFAULT_UNITS) {
    this.units = [];
    this.exactMap = new Map();
    this.lowerMap = new Map();
    this.loadUnits(initialUnits);
  }

  loadUnits(unitArray) {
    if (!Array.isArray(unitArray) || unitArray.length === 0) {
      throw new Error('Units JSON must be a non-empty array of unit definitions.');
    }

    const validated = [];
    for (const raw of unitArray) {
      if (!raw || typeof raw.symbol !== 'string' || !raw.symbol.trim()) {
        throw new Error('Every unit must have a non-empty string "symbol".');
      }
      const coeffStr = String(raw.coeff ?? '1').trim();
      if (coeffStr !== 'pi/180' && coeffStr !== '180/pi') {
        // Validate Decimal parseability
        const d = new Decimal(coeffStr);
        if (!d.isFinite() || d.lte(0)) {
          throw new Error(`Invalid positive coefficient "${coeffStr}" on unit "${raw.symbol}".`);
        }
      }
      const exponents = normalizeExponentsInput(raw.exponents);
      validated.push({
        symbol: raw.symbol.trim(),
        aliases: Array.isArray(raw.aliases) ? raw.aliases.map((s) => String(s).trim()).filter(Boolean) : [],
        coeff: coeffStr,
        exponents,
        system: raw.system || 'metric',
        autoScale: raw.autoScale !== false,
        volumetric: Boolean(raw.volumetric),
        isAngle: Boolean(raw.isAngle),
        angleUnit: raw.angleUnit || null,
      });
    }

    this.units = validated;
    this.exactMap.clear();
    this.lowerMap.clear();

    for (const u of this.units) {
      this.exactMap.set(u.symbol, u);
      for (const alias of u.aliases) {
        if (!this.exactMap.has(alias)) {
          this.exactMap.set(alias, u);
        }
      }
    }

    // Case-insensitive fallback ONLY for multi-letter unambiguous names (>2 chars or safe pairs like kg, km, mi, lb, oz, ft, yd, in, hr)
    const caseSensitiveCollisions = new Set(['mm', 'mg', 'ms', 'mj', 'mw', 'mn', 'mv', 'mc', 'mf', 'ma', 'pm', 'ps', 'pf', 'nm', 'ns', 'nf', 'um', 'ug', 'us', 'ua', 'uc', 'uf']);
    for (const u of this.units) {
      for (const token of [u.symbol, ...u.aliases]) {
        const low = token.toLowerCase();
        if (token.length >= 2 && !caseSensitiveCollisions.has(low) && !this.lowerMap.has(low)) {
          this.lowerMap.set(low, u);
        }
      }
    }

    logger.log('units', `Loaded ${this.units.length} unit definitions.`);
  }

  toJSON() {
    return JSON.stringify(
      this.units.map((u) => {
        const obj = {
          symbol: u.symbol,
          aliases: u.aliases,
          coeff: u.coeff,
          exponents: u.exponents,
          system: u.system,
          autoScale: u.autoScale,
        };
        if (u.volumetric) obj.volumetric = true;
        if (u.isAngle) {
          obj.isAngle = true;
          obj.angleUnit = u.angleUnit;
        }
        return obj;
      }),
      null,
      2
    );
  }

  lookup(name) {
    if (!name) return null;
    if (this.exactMap.has(name)) return this.exactMap.get(name);
    const low = name.toLowerCase();
    if (this.lowerMap.has(low)) return this.lowerMap.get(low);
    return null;
  }

  getUnitCoeff(unitDef, D, getPiFn) {
    if (unitDef.coeff === 'pi/180') {
      return getPiFn().div(180);
    }
    if (unitDef.coeff === '180/pi') {
      return new D(180).div(getPiFn());
    }
    return new D(unitDef.coeff);
  }

  getCompatibleUnits(dims, isAngle = false) {
    if (isAngle) {
      return this.units.filter((u) => u.isAngle);
    }
    if (isDimensionless(dims)) return [];
    return this.units.filter((u) => !u.isAngle && dimsEqual(u.exponents, dims));
  }

  pickBestLadderUnit(siValue, candidates, D, getPiFn) {
    if (!candidates || candidates.length === 0) return null;
    const sorted = candidates
      .map((u) => ({ unit: u, coeff: this.getUnitCoeff(u, D, getPiFn) }))
      .sort((a, b) => a.coeff.cmp(b.coeff));

    const absSI = siValue.abs();
    if (absSI.isZero()) {
      // Prefer base coeff === 1 if present (e.g. m, kg, s, J), else middle
      const one = sorted.find((s) => s.coeff.eq(1));
      return one ? one.unit : sorted[0].unit;
    }

    // Pick largest unit where |siValue / coeff| >= 1, or smallest unit if smaller than all
    let chosen = sorted[0].unit;
    for (const item of sorted) {
      const scaled = absSI.div(item.coeff);
      if (scaled.gte(1)) {
        chosen = item.unit;
      } else {
        break;
      }
    }
    return chosen;
  }

  /**
   * Builds readable unit representations (primary & optional cross-system alternative)
   * for a physical quantity with SI value `siValue` and 7-base `dims`.
   */
  resolveDisplayUnits({
    siValue,
    dims,
    isAngle = false,
    preferredSystem = 'metric',
    expStyle = '**',
    hadUnitSpace = false,
    usedVolumetric = false,
    hintUnit = null,
    D,
    getPiFn,
  }) {
    if (isAngle) {
      const radU = this.lookup('rad');
      const degU = this.lookup('deg');
      const list = [];
      if (radU) list.push({ unit: radU, value: siValue, symbol: 'rad', sep: '', system: 'universal' });
      if (degU) list.push({ unit: degU, value: siValue.div(this.getUnitCoeff(degU, D, getPiFn)), symbol: 'deg', sep: '', system: 'universal' });
      return list;
    }

    const compatible = this.getCompatibleUnits(dims, false);

    // Special volumetric handling: if user used L, mL, gal, cup, etc., auto-scale volumetric units
    if (usedVolumetric && dimsEqual(dims, [3, 0, 0, 0, 0, 0, 0])) {
      const metricVol = compatible.filter((u) => u.volumetric && u.system === 'metric');
      const impVol = compatible.filter((u) => u.volumetric && u.system === 'imperial');
      const mPick = this.pickBestLadderUnit(siValue, metricVol, D, getPiFn);
      const iPick = this.pickBestLadderUnit(siValue, impVol, D, getPiFn);
      return this.orderSystemPair(siValue, mPick, iPick, preferredSystem, D, getPiFn);
    }

    const metricAuto = compatible.filter((u) => u.autoScale && (u.system === 'metric' || u.system === 'universal'));
    const imperialAuto = compatible.filter((u) => u.autoScale && u.system === 'imperial');

    if (metricAuto.length > 0 || imperialAuto.length > 0) {
      const mPick = this.pickBestLadderUnit(siValue, metricAuto, D, getPiFn);
      const iPick = this.pickBestLadderUnit(siValue, imperialAuto, D, getPiFn);

      // If only imperial had autoScale (e.g. speed [1,0,-1] where mph is named imperial, m/s is compound metric)
      if (!mPick && iPick) {
        const mCompound = this.buildCompoundRepresentation(siValue, dims, 'metric', expStyle, hadUnitSpace, hintUnit, D, getPiFn);
        const iRep = {
          unit: iPick,
          value: siValue.div(this.getUnitCoeff(iPick, D, getPiFn)),
          symbol: iPick.symbol,
          sep: '',
          system: 'imperial',
        };
        return preferredSystem === 'imperial' ? [iRep, mCompound] : [mCompound, iRep];
      }

      return this.orderSystemPair(siValue, mPick, iPick, preferredSystem, D, getPiFn);
    }

    // Otherwise, unnamed derived or power unit (e.g. m**2, kg3, kg·m/s)
    const mCompound = this.buildCompoundRepresentation(siValue, dims, 'metric', expStyle, hadUnitSpace, hintUnit, D, getPiFn);
    const iCompound = this.buildCompoundRepresentation(siValue, dims, 'imperial', expStyle, hadUnitSpace, null, D, getPiFn);

    if (iCompound && iCompound.symbol !== mCompound.symbol) {
      return preferredSystem === 'imperial' ? [iCompound, mCompound] : [mCompound, iCompound];
    }
    return [mCompound];
  }

  orderSystemPair(siValue, mUnit, iUnit, preferredSystem, D, getPiFn) {
    const out = [];
    const makeRep = (u, sys) => ({
      unit: u,
      value: siValue.div(this.getUnitCoeff(u, D, getPiFn)),
      symbol: u.symbol,
      sep: '',
      system: sys,
    });

    if (preferredSystem === 'imperial') {
      if (iUnit) out.push(makeRep(iUnit, 'imperial'));
      if (mUnit && (!iUnit || mUnit.symbol !== iUnit.symbol)) out.push(makeRep(mUnit, 'metric'));
    } else {
      if (mUnit) out.push(makeRep(mUnit, 'metric'));
      if (iUnit && (!mUnit || iUnit.symbol !== mUnit.symbol)) out.push(makeRep(iUnit, 'imperial'));
    }
    return out;
  }

  buildCompoundRepresentation(siValue, dims, system, expStyle, hadUnitSpace, hintUnit, D, getPiFn) {
    const nonZero = [];
    for (let i = 0; i < 7; i++) {
      if (dims[i] !== 0) nonZero.push({ idx: i, power: dims[i] });
    }
    if (nonZero.length === 0) return null;

    // Single base dimension raised to power p (e.g., m**2, kg3, ft**2, lbs3)
    if (nonZero.length === 1) {
      const { idx, power } = nonZero[0];
      let baseUnit = null;

      if (system === 'imperial') {
        if (idx === 0) baseUnit = this.lookup('ft');
        else if (idx === 1) baseUnit = this.lookup('lbs');
        else return null;
      } else {
        // Respect hint unit if same single base dimension (e.g., km**2 or m**2 or kg3)
        if (hintUnit && !hintUnit.isAngle) {
          const hNonZero = hintUnit.exponents.filter((e) => e !== 0);
          if (hNonZero.length === 1 && hintUnit.exponents[idx] === 1 && hintUnit.system === 'metric') {
            baseUnit = hintUnit;
          }
        }
        if (!baseUnit) {
          baseUnit = this.lookup(SI_BASE_SYMBOLS[idx]);
        }
      }
      if (!baseUnit) return null;

      const coeff = this.getUnitCoeff(baseUnit, D, getPiFn).pow(power);
      const val = siValue.div(coeff);
      const suffix = `${baseUnit.symbol}${formatExpSuffix(power, expStyle)}`;
      const sep = expStyle === 'inline' ? ' ' : hadUnitSpace ? ' ' : '';

      return {
        unit: null,
        value: val,
        symbol: suffix,
        sep,
        system,
      };
    }

    if (system === 'imperial') return null;

    // Clean ratio like m/s when one positive +1 and one negative -1
    const pos = nonZero.filter((d) => d.power > 0);
    const neg = nonZero.filter((d) => d.power < 0);

    if (expStyle !== 'inline' && pos.length === 1 && neg.length === 1) {
      const numStr = `${SI_BASE_SYMBOLS[pos[0].idx]}${formatExpSuffix(pos[0].power, expStyle)}`;
      const denStr = `${SI_BASE_SYMBOLS[neg[0].idx]}${formatExpSuffix(-neg[0].power, expStyle)}`;
      return {
        unit: null,
        value: siValue,
        symbol: `${numStr}/${denStr}`,
        sep: hadUnitSpace ? ' ' : '',
        system: 'metric',
      };
    }

    // General product of SI base powers
    const parts = nonZero.map(({ idx, power }) => `${SI_BASE_SYMBOLS[idx]}${formatExpSuffix(power, expStyle)}`);
    const joiner = expStyle === 'inline' ? ' ' : '·';
    return {
      unit: null,
      value: siValue,
      symbol: parts.join(joiner),
      sep: expStyle === 'inline' || hadUnitSpace ? ' ' : '',
      system: 'metric',
    };
  }
}
