/**
 * Default unit database. Dimensions are exponents of the seven SI base units
 * (kg, m, s, A, K, mol, cd) plus an internal angle slot (rad) so that explicit
 * angle units can be told apart from plain numbers.
 *
 * Factors are strings so they can be parsed with arbitrary precision. They may
 * be decimals, fractions ("5/9") or multiples of π ("pi/180").
 */
export interface UnitDefJSON {
  symbol: string;
  dim: Record<string, number>;
  factor: string;
  offset?: string;
  system?: "metric" | "imperial" | "any";
  prefixable?: boolean;
  aliases?: string[];
  plural?: string;
}

export interface LadderJSON {
  name: string;
  dim: Record<string, number>;
  metric?: string[];
  imperial?: string[];
  any?: string[];
}

export interface UnitsJSON {
  prefixes: Record<string, string>;
  units: UnitDefJSON[];
  ladders: LadderJSON[];
}

export const DEFAULT_UNITS: UnitsJSON = {
  prefixes: {
    y: "1e-24", z: "1e-21", a: "1e-18", f: "1e-15", p: "1e-12", n: "1e-9",
    "µ": "1e-6", "μ": "1e-6", u: "1e-6", m: "1e-3", c: "1e-2", d: "1e-1",
    da: "1e1", h: "1e2", k: "1e3", M: "1e6", G: "1e9", T: "1e12", P: "1e15",
    E: "1e18", Z: "1e21", Y: "1e24",
  },
  units: [
    // length
    { symbol: "m", dim: { m: 1 }, factor: "1", system: "metric", prefixable: true, aliases: ["meter", "meters", "metre", "metres"] },
    { symbol: "in", dim: { m: 1 }, factor: "0.0254", system: "imperial", aliases: ["inch", "inches"] },
    { symbol: "ft", dim: { m: 1 }, factor: "0.3048", system: "imperial", aliases: ["foot", "feet"] },
    { symbol: "yd", dim: { m: 1 }, factor: "0.9144", system: "imperial", aliases: ["yard", "yards"] },
    { symbol: "mi", dim: { m: 1 }, factor: "1609.344", system: "imperial", aliases: ["mile", "miles"] },
    { symbol: "nmi", dim: { m: 1 }, factor: "1852", system: "any", aliases: ["nauticalmile"] },
    { symbol: "au", dim: { m: 1 }, factor: "149597870700", system: "any", aliases: ["AU"] },
    { symbol: "ly", dim: { m: 1 }, factor: "9460730472580800", system: "any", aliases: ["lightyear", "lightyears"] },
    { symbol: "Å", dim: { m: 1 }, factor: "1e-10", system: "metric", aliases: ["angstrom"] },
    // mass
    { symbol: "g", dim: { kg: 1 }, factor: "0.001", system: "metric", prefixable: true, aliases: ["gram", "grams", "gramme", "grammes"] },
    { symbol: "t", dim: { kg: 1 }, factor: "1000", system: "metric", aliases: ["tonne", "tonnes"] },
    { symbol: "lb", plural: "lbs", dim: { kg: 1 }, factor: "0.45359237", system: "imperial", aliases: ["lbs", "pound", "pounds"] },
    { symbol: "oz", dim: { kg: 1 }, factor: "0.028349523125", system: "imperial", aliases: ["ounce", "ounces"] },
    { symbol: "st", dim: { kg: 1 }, factor: "6.35029318", system: "imperial", aliases: ["stone", "stones"] },
    { symbol: "ton", dim: { kg: 1 }, factor: "907.18474", system: "imperial", aliases: ["tons"] },
    // time
    { symbol: "s", dim: { s: 1 }, factor: "1", system: "any", prefixable: true, aliases: ["sec", "secs", "second", "seconds"] },
    { symbol: "min", dim: { s: 1 }, factor: "60", system: "any", aliases: ["mins", "minute", "minutes"] },
    { symbol: "h", dim: { s: 1 }, factor: "3600", system: "any", aliases: ["hr", "hrs", "hour", "hours"] },
    { symbol: "d", dim: { s: 1 }, factor: "86400", system: "any", aliases: ["day", "days"] },
    { symbol: "wk", dim: { s: 1 }, factor: "604800", system: "any", aliases: ["week", "weeks"] },
    { symbol: "yr", dim: { s: 1 }, factor: "31557600", system: "any", aliases: ["year", "years"] },
    // current, temperature, amount, luminous intensity
    { symbol: "A", dim: { A: 1 }, factor: "1", system: "any", prefixable: true, aliases: ["amp", "amps", "ampere", "amperes"] },
    { symbol: "K", dim: { K: 1 }, factor: "1", system: "any", prefixable: true, aliases: ["kelvin"] },
    { symbol: "°C", dim: { K: 1 }, factor: "1", offset: "273.15", system: "metric", aliases: ["degC", "celsius", "Celsius", "ºC"] },
    { symbol: "°F", dim: { K: 1 }, factor: "5/9", offset: "45967/180", system: "imperial", aliases: ["degF", "fahrenheit", "Fahrenheit", "ºF"] },
    { symbol: "mol", dim: { mol: 1 }, factor: "1", system: "any", prefixable: true, aliases: ["mole", "moles"] },
    { symbol: "cd", dim: { cd: 1 }, factor: "1", system: "any", prefixable: true, aliases: ["candela"] },
    // angle
    { symbol: "rad", dim: { rad: 1 }, factor: "1", system: "any", prefixable: true, aliases: ["radian", "radians"] },
    { symbol: "deg", dim: { rad: 1 }, factor: "pi/180", system: "any", aliases: ["°", "degree", "degrees"] },
    { symbol: "grad", dim: { rad: 1 }, factor: "pi/200", system: "any", aliases: ["gon", "gradian"] },
    { symbol: "turn", dim: { rad: 1 }, factor: "2*pi", system: "any", aliases: ["rev", "turns", "revolution", "revolutions"] },
    // area & volume
    { symbol: "ha", dim: { m: 2 }, factor: "10000", system: "metric", aliases: ["hectare", "hectares"] },
    { symbol: "acre", dim: { m: 2 }, factor: "4046.8564224", system: "imperial", aliases: ["acres"] },
    { symbol: "L", dim: { m: 3 }, factor: "0.001", system: "metric", prefixable: true, aliases: ["l", "liter", "liters", "litre", "litres"] },
    { symbol: "cc", dim: { m: 3 }, factor: "1e-6", system: "metric" },
    { symbol: "gal", dim: { m: 3 }, factor: "0.003785411784", system: "imperial", aliases: ["gallon", "gallons"] },
    { symbol: "qt", dim: { m: 3 }, factor: "0.000946352946", system: "imperial", aliases: ["quart", "quarts"] },
    { symbol: "pt", dim: { m: 3 }, factor: "0.000473176473", system: "imperial", aliases: ["pint", "pints"] },
    { symbol: "cup", dim: { m: 3 }, factor: "0.0002365882365", system: "imperial", aliases: ["cups"] },
    { symbol: "floz", dim: { m: 3 }, factor: "0.0000295735295625", system: "imperial", aliases: ["fl.oz"] },
    { symbol: "tbsp", dim: { m: 3 }, factor: "0.00001478676478125", system: "imperial", aliases: ["tablespoon", "tablespoons"] },
    { symbol: "tsp", dim: { m: 3 }, factor: "0.00000492892159375", system: "imperial", aliases: ["teaspoon", "teaspoons"] },
    // speed
    { symbol: "m/s", dim: { m: 1, s: -1 }, factor: "1", system: "metric" },
    { symbol: "km/h", dim: { m: 1, s: -1 }, factor: "1000/3600", system: "metric", aliases: ["kph", "kmh", "kmph"] },
    { symbol: "mph", dim: { m: 1, s: -1 }, factor: "0.44704", system: "imperial" },
    { symbol: "ft/s", dim: { m: 1, s: -1 }, factor: "0.3048", system: "imperial", aliases: ["fps"] },
    { symbol: "kn", dim: { m: 1, s: -1 }, factor: "1852/3600", system: "any", aliases: ["knot", "knots", "kt"] },
    // force, energy, power, pressure
    { symbol: "N", dim: { kg: 1, m: 1, s: -2 }, factor: "1", system: "metric", prefixable: true, aliases: ["newton", "newtons"] },
    { symbol: "lbf", dim: { kg: 1, m: 1, s: -2 }, factor: "4.4482216152605", system: "imperial" },
    { symbol: "kgf", dim: { kg: 1, m: 1, s: -2 }, factor: "9.80665", system: "metric", aliases: ["kp"] },
    { symbol: "J", dim: { kg: 1, m: 2, s: -2 }, factor: "1", system: "metric", prefixable: true, aliases: ["joule", "joules"] },
    { symbol: "cal", dim: { kg: 1, m: 2, s: -2 }, factor: "4.184", system: "metric", prefixable: true, aliases: ["calorie", "calories"] },
    { symbol: "Wh", dim: { kg: 1, m: 2, s: -2 }, factor: "3600", system: "metric", prefixable: true, aliases: ["watthour", "watthours"] },
    { symbol: "eV", dim: { kg: 1, m: 2, s: -2 }, factor: "1.602176634e-19", system: "metric", prefixable: true, aliases: ["electronvolt"] },
    { symbol: "BTU", dim: { kg: 1, m: 2, s: -2 }, factor: "1055.05585262", system: "imperial", aliases: ["btu", "Btu"] },
    { symbol: "ft·lbf", dim: { kg: 1, m: 2, s: -2 }, factor: "1.3558179483314004", system: "imperial", aliases: ["ftlbf", "ftlb"] },
    { symbol: "W", dim: { kg: 1, m: 2, s: -3 }, factor: "1", system: "metric", prefixable: true, aliases: ["watt", "watts"] },
    { symbol: "hp", dim: { kg: 1, m: 2, s: -3 }, factor: "745.69987158227022", system: "imperial", aliases: ["horsepower"] },
    { symbol: "Pa", dim: { kg: 1, m: -1, s: -2 }, factor: "1", system: "metric", prefixable: true, aliases: ["pascal", "pascals"] },
    { symbol: "bar", dim: { kg: 1, m: -1, s: -2 }, factor: "100000", system: "metric", prefixable: true, aliases: ["bars"] },
    { symbol: "atm", dim: { kg: 1, m: -1, s: -2 }, factor: "101325", system: "any", aliases: ["atmosphere", "atmospheres"] },
    { symbol: "psi", dim: { kg: 1, m: -1, s: -2 }, factor: "6894.757293168", system: "imperial" },
    { symbol: "mmHg", dim: { kg: 1, m: -1, s: -2 }, factor: "133.322387415", system: "any" },
    { symbol: "Torr", dim: { kg: 1, m: -1, s: -2 }, factor: "101325/760", system: "any", aliases: ["torr"] },
    // frequency, electricity, magnetism
    { symbol: "Hz", dim: { s: -1 }, factor: "1", system: "any", prefixable: true, aliases: ["hertz"] },
    { symbol: "rpm", dim: { s: -1 }, factor: "1/60", system: "any", aliases: ["RPM"] },
    { symbol: "C", dim: { A: 1, s: 1 }, factor: "1", system: "any", prefixable: true, aliases: ["coulomb", "coulombs"] },
    { symbol: "Ah", dim: { A: 1, s: 1 }, factor: "3600", system: "any", prefixable: true, aliases: ["amphour", "amphours"] },
    { symbol: "V", dim: { kg: 1, m: 2, s: -3, A: -1 }, factor: "1", system: "any", prefixable: true, aliases: ["volt", "volts"] },
    { symbol: "Ω", dim: { kg: 1, m: 2, s: -3, A: -2 }, factor: "1", system: "any", prefixable: true, aliases: ["ohm", "ohms", "Ohm", "Ohms"] },
    { symbol: "S", dim: { kg: -1, m: -2, s: 3, A: 2 }, factor: "1", system: "any", prefixable: true, aliases: ["siemens"] },
    { symbol: "F", dim: { kg: -1, m: -2, s: 4, A: 2 }, factor: "1", system: "any", prefixable: true, aliases: ["farad", "farads"] },
    { symbol: "H", dim: { kg: 1, m: 2, s: -2, A: -2 }, factor: "1", system: "any", prefixable: true, aliases: ["henry", "henries"] },
    { symbol: "Wb", dim: { kg: 1, m: 2, s: -2, A: -1 }, factor: "1", system: "any", prefixable: true, aliases: ["weber"] },
    { symbol: "T", dim: { kg: 1, s: -2, A: -1 }, factor: "1", system: "any", prefixable: true, aliases: ["tesla"] },
    // dimensionless helpers
    { symbol: "percent", dim: {}, factor: "0.01", system: "any", aliases: ["pct"] },
    { symbol: "ppm", dim: {}, factor: "1e-6", system: "any" },
    { symbol: "dozen", dim: {}, factor: "12", system: "any", aliases: ["dozens"] },
  ],
  ladders: [
    { name: "mass", dim: { kg: 1 }, metric: ["µg", "mg", "g", "kg"], imperial: ["oz", "lb"] },
    { name: "length", dim: { m: 1 }, metric: ["nm", "µm", "mm", "cm", "m", "km"], imperial: ["in", "ft", "mi"] },
    { name: "time", dim: { s: 1 }, any: ["ns", "µs", "ms", "s"] },
    { name: "area", dim: { m: 2 }, metric: ["mm^2", "cm^2", "m^2", "ha", "km^2"], imperial: ["in^2", "ft^2", "acre", "mi^2"] },
    { name: "volume", dim: { m: 3 }, metric: ["mL", "L", "m^3"], imperial: ["floz", "cup", "pt", "qt", "gal"] },
    { name: "speed", dim: { m: 1, s: -1 }, metric: ["m/s"], imperial: ["mph"] },
    { name: "force", dim: { kg: 1, m: 1, s: -2 }, metric: ["mN", "N", "kN", "MN"], imperial: ["lbf"] },
    { name: "energy", dim: { kg: 1, m: 2, s: -2 }, metric: ["mJ", "J", "kJ", "MJ", "GJ"], imperial: ["BTU"] },
    { name: "power", dim: { kg: 1, m: 2, s: -3 }, metric: ["mW", "W", "kW", "MW", "GW"], imperial: ["hp"] },
    { name: "pressure", dim: { kg: 1, m: -1, s: -2 }, metric: ["Pa", "kPa", "MPa", "GPa"], imperial: ["psi"] },
    { name: "frequency", dim: { s: -1 }, any: ["Hz", "kHz", "MHz", "GHz", "THz"] },
    { name: "current", dim: { A: 1 }, any: ["µA", "mA", "A", "kA"] },
    { name: "voltage", dim: { kg: 1, m: 2, s: -3, A: -1 }, any: ["mV", "V", "kV"] },
    { name: "resistance", dim: { kg: 1, m: 2, s: -3, A: -2 }, any: ["mΩ", "Ω", "kΩ", "MΩ"] },
    { name: "capacitance", dim: { kg: -1, m: -2, s: 4, A: 2 }, any: ["pF", "nF", "µF", "mF", "F"] },
  ],
};
