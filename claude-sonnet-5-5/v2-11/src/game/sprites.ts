export const BCOL = ["#ff3b5c", "#ffb43b", "#52e5ff", "#b78bff", "#ffd6f0", "#6bff9a"];
const SS = 2; // sprite supersample
const cache = new Map<string, HTMLCanvasElement>();

function mk(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.ceil(w * SS);
  c.height = Math.ceil(h * SS);
  const x = c.getContext("2d")!;
  x.scale(SS, SS);
  return { c, x };
}

export function orbSprite(ci: number, r: number): HTMLCanvasElement {
  const key = `o${ci}_${r}`;
  const s = cache.get(key);
  if (s) return s;
  const d = Math.ceil(r * 2 * 2.3);
  const { c, x } = mk(d, d);
  const cx = d / 2;
  const col = BCOL[ci % BCOL.length];
  const g = x.createRadialGradient(cx, cx, 0, cx, cx, d / 2);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.3, "rgba(255,255,255,0)");
  g.addColorStop(0.42, col + "aa");
  g.addColorStop(0.7, col + "33");
  g.addColorStop(1, col + "00");
  x.fillStyle = g;
  x.fillRect(0, 0, d, d);
  x.beginPath();
  x.arc(cx, cx, r * 1.02, 0, 7);
  x.fillStyle = col;
  x.fill();
  x.beginPath();
  x.arc(cx, cx, r * 0.68, 0, 7);
  x.fillStyle = "#fff";
  x.fill();
  cache.set(key, c);
  return c;
}

export function needleSprite(ci: number, r: number): HTMLCanvasElement {
  const key = `n${ci}_${r}`;
  const s = cache.get(key);
  if (s) return s;
  const L = r * 6 + 10, Wd = r * 2 + 12;
  const { c, x } = mk(L, Wd);
  const col = BCOL[ci % BCOL.length];
  x.translate(L / 2, Wd / 2);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, L / 2);
  g.addColorStop(0, col + "55");
  g.addColorStop(1, col + "00");
  x.fillStyle = g;
  x.fillRect(-L / 2, -Wd / 2, L, Wd);
  x.beginPath();
  x.moveTo(r * 3, 0);
  x.lineTo(-r * 2.6, -r * 0.95);
  x.lineTo(-r * 2.6, r * 0.95);
  x.closePath();
  x.fillStyle = col;
  x.fill();
  x.beginPath();
  x.moveTo(r * 2.4, 0);
  x.lineTo(-r * 1.8, -r * 0.45);
  x.lineTo(-r * 1.8, r * 0.45);
  x.closePath();
  x.fillStyle = "#fff";
  x.fill();
  cache.set(key, c);
  return c;
}

export function shardSprite(ci: number, r: number): HTMLCanvasElement {
  const key = `s${ci}_${r}`;
  const s = cache.get(key);
  if (s) return s;
  const L = r * 4 + 10, Wd = r * 3 + 10;
  const { c, x } = mk(L, Wd);
  const col = BCOL[ci % BCOL.length];
  x.translate(L / 2, Wd / 2);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, L / 2);
  g.addColorStop(0, col + "44");
  g.addColorStop(1, col + "00");
  x.fillStyle = g;
  x.fillRect(-L / 2, -Wd / 2, L, Wd);
  x.beginPath();
  x.moveTo(r * 2, 0);
  x.lineTo(0, -r * 1.2);
  x.lineTo(-r * 1.6, 0);
  x.lineTo(0, r * 1.2);
  x.closePath();
  x.fillStyle = col;
  x.fill();
  x.strokeStyle = "#fff";
  x.lineWidth = 1;
  x.stroke();
  cache.set(key, c);
  return c;
}

export function glowSprite(color: string, r: number): HTMLCanvasElement {
  const key = `g${color}_${r}`;
  const s = cache.get(key);
  if (s) return s;
  const d = r * 2;
  const { c, x } = mk(d, d);
  const g = x.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, color);
  g.addColorStop(1, color.slice(0, 7) + "00");
  x.fillStyle = g;
  x.fillRect(0, 0, d, d);
  cache.set(key, c);
  return c;
}

export const SPRITE_SCALE = 1 / SS;

const PALETTES = [
  ["#d9a441", "#3a6bd1", "#a8322e", "#2f8f6b"],
  ["#8d5bd6", "#2fb7c9", "#d654a6", "#4a63d6"],
  ["#d63a4a", "#c9bfe0", "#7a1d3f", "#e8893a"],
];

const WRAPS: [number, number][] = [[0, 0], [-600, 0], [0, -400], [-600, -400]];

function lozenge(x: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  x.beginPath();
  x.moveTo(cx, cy - r);
  x.lineTo(cx + r, cy);
  x.lineTo(cx, cy + r);
  x.lineTo(cx - r, cy);
  x.closePath();
}

export function makeBg(act: number): HTMLCanvasElement {
  const pal = PALETTES[(Math.max(1, act) - 1) % 3];
  const c = document.createElement("canvas");
  c.width = 600;
  c.height = 400;
  const x = c.getContext("2d")!;
  x.fillStyle = "#07040e";
  x.fillRect(0, 0, 600, 400);
  let seed = act * 97 + 13;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let gx = 0; gx < 6; gx++) {
    for (let gy = 0; gy < 4; gy++) {
      for (const off of [0, 50]) {
        const col = pal[Math.floor(rnd() * pal.length)];
        const a = 0.1 + rnd() * 0.16;
        for (const [wx, wy] of WRAPS) {
          const cx = gx * 100 + 50 + (off ? 50 : 0) + wx;
          const cy = gy * 100 + 50 + off + wy;
          x.globalAlpha = a;
          x.fillStyle = col;
          lozenge(x, cx, cy, 46);
          x.fill();
          x.globalAlpha = a * 0.8;
          x.fillStyle = "#fff";
          lozenge(x, cx, cy, 22);
          x.fill();
          x.globalAlpha = 0.5;
          x.strokeStyle = "#020104";
          x.lineWidth = 3;
          lozenge(x, cx, cy, 46);
          x.stroke();
          x.globalAlpha = 1;
        }
      }
    }
  }
  return c;
}
