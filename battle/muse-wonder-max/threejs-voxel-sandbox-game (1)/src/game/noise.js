// Deterministic seeded noise utilities
export function hash2(seed, x, z) {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function hash3(seed, x, y, z) {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 2246822519) ^ Math.imul(z, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function smooth(t){ return t*t*(3-2*t); }
export function valueNoise(seed, x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x-xi, zf = z-zi;
  const a=hash2(seed,xi,zi), b=hash2(seed,xi+1,zi), c=hash2(seed,xi,zi+1), d=hash2(seed,xi+1,zi+1);
  const u=smooth(xf), v=smooth(zf);
  return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v; // 0..1
}
export function fbm(seed, x, z, oct=4) {
  let amp=1, freq=1, sum=0, norm=0;
  for(let i=0;i<oct;i++){ sum+=amp*valueNoise(seed+i*101, x*freq, z*freq); norm+=amp; amp*=0.5; freq*=2.03; }
  return sum/norm;
}
export function mulberry(seed){
  let a = seed>>>0;
  return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
}
export function stringSeed(str){
  let h=2166136261; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0;
}
