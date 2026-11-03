/**
 * Colormaps shared by the GPU display shader (uploaded as a 256x1 LUT texture)
 * and the CSS legend (rendered as a canvas gradient) so both always agree.
 */

export type RGB = [number, number, number];

export interface ColorMap {
  id: string;
  name: string;
  stops: RGB[];
  diverging?: boolean;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function sampleStops(stops: RGB[], t: number): RGB {
  const x = Math.min(0.999999, Math.max(0, t)) * (stops.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = stops[i];
  const b = stops[Math.min(stops.length - 1, i + 1)];
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
}

export const COLORMAPS: ColorMap[] = [
  {
    id: "inferno",
    name: "Inferno",
    stops: [
      [0, 0, 4],
      [22, 11, 57],
      [66, 10, 104],
      [111, 23, 122],
      [155, 43, 112],
      [199, 66, 82],
      [234, 101, 41],
      [251, 149, 20],
      [252, 205, 79],
      [252, 255, 164],
    ],
  },
  {
    id: "viridis",
    name: "Viridis",
    stops: [
      [68, 1, 84],
      [71, 44, 122],
      [59, 81, 139],
      [44, 113, 142],
      [33, 144, 141],
      [39, 173, 129],
      [92, 200, 99],
      [170, 220, 50],
      [253, 231, 37],
    ],
  },
  {
    id: "blueprint",
    name: "Blueprint",
    stops: [
      [6, 12, 24],
      [12, 32, 62],
      [18, 68, 110],
      [26, 116, 152],
      [64, 176, 190],
      [140, 224, 222],
      [214, 246, 248],
      [255, 255, 255],
    ],
  },
  {
    id: "thermal",
    name: "Thermal Ink",
    stops: [
      [10, 8, 20],
      [40, 18, 74],
      [104, 22, 110],
      [176, 40, 92],
      [226, 92, 60],
      [250, 158, 66],
      [252, 214, 140],
      [255, 250, 232],
    ],
  },
  {
    id: "iceflow",
    name: "Ice Flow",
    stops: [
      [8, 10, 18],
      [16, 34, 66],
      [24, 78, 116],
      [46, 138, 156],
      [112, 196, 178],
      [196, 236, 196],
      [250, 252, 226],
    ],
  },
];

/** Diverging map used for signed quantities (vorticity, pressure, divergence). */
export const DIVERGING: RGB[] = [
  [18, 60, 150],
  [46, 122, 214],
  [126, 190, 244],
  [214, 232, 246],
  [14, 16, 22],
  [248, 224, 190],
  [244, 168, 88],
  [226, 96, 54],
  [158, 26, 62],
];

export function buildLUT(stops: RGB[], size = 256): Uint8Array {
  const data = new Uint8Array(size * 4);
  for (let i = 0; i < size; i++) {
    const c = sampleStops(stops, i / (size - 1));
    data[i * 4 + 0] = Math.round(c[0]);
    data[i * 4 + 1] = Math.round(c[1]);
    data[i * 4 + 2] = Math.round(c[2]);
    data[i * 4 + 3] = 255;
  }
  return data;
}

export function cssGradient(stops: RGB[], angle = "90deg"): string {
  const parts = stops.map((c, i) => {
    const p = (i / (stops.length - 1)) * 100;
    return `rgb(${c[0]},${c[1]},${c[2]}) ${p.toFixed(1)}%`;
  });
  return `linear-gradient(${angle}, ${parts.join(", ")})`;
}

/** Hue-wheel used for dye seeding / pointer injection. */
export function hueRGB(h: number, s = 0.85, l = 0.58): RGB {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(Math.min(k - 3, 9 - k), 1));
  };
  return [f(0), f(8), f(4)];
}
