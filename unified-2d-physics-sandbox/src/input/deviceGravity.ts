// Device-motion gravity. Permission is only requested from an explicit user gesture (enable()).
// Sensor axes are mapped through the current screen orientation so the world "down" follows the physical device.
import type { Vec2 } from '../sim/schema';

export interface DeviceGravityOptions { sensitivity: number; smoothing: number; invertX: boolean; invertY: boolean }
export type DeviceGravityStatus = 'off' | 'requesting' | 'active' | 'unavailable' | 'denied' | 'no-data';

const G = 981;

export class DeviceGravity {
  status: DeviceGravityStatus = 'off';
  options: DeviceGravityOptions = { sensitivity: 1, smoothing: 0.15, invertX: false, invertY: false };
  onGravity: ((g: Vec2) => void) | null = null;
  onStatus: ((s: DeviceGravityStatus) => void) | null = null;
  private smoothed: Vec2 = { x: 0, y: 1 };
  private raw: Vec2 = { x: 0, y: 1 };
  private calibrationAngle = 0;
  private listener: ((e: DeviceMotionEvent) => void) | null = null;
  private watchdog = 0;
  private isIOS = false;

  get enabled() { return this.listener !== null; }

  static supported(): boolean { return typeof window !== 'undefined' && 'DeviceMotionEvent' in window; }

  async enable(): Promise<DeviceGravityStatus> {
    if (this.listener) return this.status;
    if (!DeviceGravity.supported()) { this.setStatus('unavailable'); return this.status; }
    const DME = (window as any).DeviceMotionEvent;
    this.isIOS = typeof DME.requestPermission === 'function';
    this.setStatus('requesting');
    if (this.isIOS) {
      try {
        const res = await DME.requestPermission();
        if (res !== 'granted') { this.setStatus('denied'); return this.status; }
      } catch { this.setStatus('denied'); return this.status; }
    }
    let gotData = false;
    this.listener = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null) return;
      if (!gotData) { gotData = true; this.setStatus('active'); }
      // Normalise to the W3C convention (device at rest reports the reaction, +9.81 pointing up). iOS reports the sign inverted.
      const sign = this.isIOS ? -1 : 1;
      const ax = a.x * sign, ay = a.y * sign;
      // gravity in device frame (x right, y up): g = -a. Screen frame at orientation 0 (y-down): (gx, -gy) = (-ax, ay)
      let sx = -ax, sy = ay;
      const angle = ((screen.orientation?.angle ?? (window as any).orientation ?? 0) * Math.PI) / 180;
      const c = Math.cos(angle), s = Math.sin(angle);
      const rx = sx * c - sy * s, ry = sx * s + sy * c;
      sx = rx; sy = ry;
      const mag = Math.hypot(sx, sy);
      if (mag < 0.5) return; // device roughly flat: keep previous direction
      this.raw = { x: sx / mag, y: sy / mag };
      this.emit();
    };
    window.addEventListener('devicemotion', this.listener);
    this.watchdog = window.setTimeout(() => { if (!gotData) { this.disable(); this.setStatus('no-data'); } }, 2500);
    return this.status;
  }

  disable() {
    if (this.listener) { window.removeEventListener('devicemotion', this.listener); this.listener = null; }
    if (this.watchdog) { clearTimeout(this.watchdog); this.watchdog = 0; }
    this.setStatus('off');
  }

  /** Treat the current device attitude as "straight down". */
  calibrate() {
    const cur = Math.atan2(this.raw.x, this.raw.y);
    this.calibrationAngle = -cur;
  }

  private emit() {
    const o = this.options;
    const c = Math.cos(this.calibrationAngle), s = Math.sin(this.calibrationAngle);
    let x = this.raw.x * c - this.raw.y * s, y = this.raw.x * s + this.raw.y * c;
    if (o.invertX) x = -x;
    if (o.invertY) y = -y;
    const k = 1 - Math.min(Math.max(o.smoothing, 0), 0.99);
    this.smoothed.x += (x - this.smoothed.x) * k;
    this.smoothed.y += (y - this.smoothed.y) * k;
    this.onGravity?.({ x: this.smoothed.x * G * o.sensitivity, y: this.smoothed.y * G * o.sensitivity });
  }

  private setStatus(s: DeviceGravityStatus) { this.status = s; this.onStatus?.(s); }
}
