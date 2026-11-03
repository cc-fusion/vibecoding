import { CHUNK_VOL } from './constants.js';

export const ST_EMPTY = 0, ST_GENERATED = 1, ST_LIT = 2;

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_VOL);
    this.light = new Uint8Array(CHUNK_VOL);       // (sky << 4) | block
    this.height = new Uint8Array(256);            // highest light-blocking cell per column
    this.biomes = new Uint8Array(256);
    this.climate = new Uint8Array(512);           // temp, humidity bytes per column
    this.meta = new Map();                         // index -> small int (facing, torch side, ...)
    this.maxY = 0;
    this.state = ST_EMPTY;
    this.meshed = false;
    this.dirty = false;
    this.modified = false;                         // player changes -> must be saved
    this.meshSolid = null;
    this.meshTrans = null;
    this.dist = 0;
  }
}

// --- RLE (de)compression for persistence ----------------------------------------------------
export function rleEncode(arr) {
  const out = [];
  let i = 0;
  const n = arr.length;
  while (i < n) {
    const v = arr[i];
    let j = i + 1;
    while (j < n && arr[j] === v) j++;
    let len = j - i;
    out.push(v);
    while (len >= 128) { out.push((len & 127) | 128); len >>= 7; }
    out.push(len);
    i = j;
  }
  return new Uint8Array(out);
}

export function rleDecode(data, target) {
  let p = 0, o = 0;
  while (p < data.length && o < target.length) {
    const v = data[p++];
    let len = 0, shift = 0, b;
    do { b = data[p++]; len |= (b & 127) << shift; shift += 7; } while (b & 128);
    target.fill(v, o, o + len);
    o += len;
  }
  return target;
}
