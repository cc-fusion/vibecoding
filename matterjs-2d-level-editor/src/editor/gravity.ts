import type { GravitySettings, SensorDiagnostics, SensorStatus, Vec2 } from "./types";
import { clamp } from "./geometry";

type PermissionCapableEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

export interface SensorCapabilities {
  supported: boolean;
  needsPermission: boolean;
  secureContext: boolean;
}

export function detectSensorCapabilities(): SensorCapabilities {
  const supported = typeof window !== "undefined" && "DeviceOrientationEvent" in window;
  let needsPermission = false;
  if (supported) {
    try {
      needsPermission = typeof (window.DeviceOrientationEvent as PermissionCapableEvent).requestPermission === "function";
    } catch {
      needsPermission = false;
    }
  }
  return { supported, needsPermission, secureContext: typeof window !== "undefined" ? window.isSecureContext : false };
}

const NO_DATA_TIMEOUT = 2500;

/**
 * Converts device orientation into a smoothed gravity vector. Never throws out of public
 * methods; failures degrade to the "error"/"unsupported" status so the editor keeps working.
 */
export class SensorGravity {
  readonly caps = detectSensorCapabilities();
  private status: SensorStatus = "idle";
  private message = "";
  private raw: SensorDiagnostics["raw"] = { alpha: null, beta: null, gamma: null };
  private smoothed: Vec2 = { x: 0, y: 0 };
  private processed: Vec2 = { x: 0, y: 0 };
  private lastEventAt: number | null = null;
  private eventTimes: number[] = [];
  private listener: ((e: DeviceOrientationEvent) => void) | null = null;
  private noDataTimer: number | null = null;
  private settings: GravitySettings;
  private onChange: () => void;

  constructor(settings: GravitySettings, onChange: () => void) {
    this.settings = settings;
    this.onChange = onChange;
    if (!this.caps.supported) {
      this.status = "unsupported";
      this.message = "Device orientation is not available in this browser";
    } else if (this.caps.needsPermission) {
      this.status = "needs-permission";
      this.message = "Tap “Enable motion” to grant access";
    }
  }

  updateSettings(settings: GravitySettings) {
    this.settings = settings;
  }

  get isActive() {
    return this.status === "active" || this.status === "no-data";
  }

  /** True when processed sensor gravity should drive the engine. */
  get isProviding() {
    return this.status === "active";
  }

  get diagnostics(): SensorDiagnostics {
    const now = performance.now();
    const recent = this.eventTimes.filter((t) => now - t < 1000);
    return {
      status: this.status,
      message: this.message,
      raw: { ...this.raw },
      screenAngle: getScreenAngle(),
      processed: { ...this.processed },
      eventsPerSecond: recent.length,
      lastEventAt: this.lastEventAt,
    };
  }

  /** Attempts to start. Safe to call without a user gesture when no permission is needed. */
  async enable(fromUserGesture: boolean): Promise<boolean> {
    if (!this.caps.supported) {
      this.setStatus("unsupported", "Device orientation is not available in this browser");
      return false;
    }
    if (this.listener) return this.isProviding;
    if (this.caps.needsPermission) {
      if (!fromUserGesture) {
        this.setStatus("needs-permission", "Motion access must be enabled with a tap");
        return false;
      }
      this.setStatus("requesting", "Waiting for permission…");
      try {
        const fn = (window.DeviceOrientationEvent as PermissionCapableEvent).requestPermission!;
        const result = await fn.call(window.DeviceOrientationEvent);
        if (result !== "granted") {
          this.setStatus("denied", "Motion permission denied — using manual gravity");
          return false;
        }
      } catch (err) {
        this.setStatus("error", `Permission request failed: ${(err as Error).message ?? "unknown error"}`);
        return false;
      }
    }
    try {
      this.listener = (e) => this.handleEvent(e);
      window.addEventListener("deviceorientation", this.listener, { passive: true });
      this.setStatus("no-data", "Listening for orientation events…");
      this.armNoDataTimer();
      return true;
    } catch (err) {
      this.listener = null;
      this.setStatus("error", `Could not start sensors: ${(err as Error).message ?? "unknown error"}`);
      return false;
    }
  }

  disable() {
    if (this.listener) {
      window.removeEventListener("deviceorientation", this.listener);
      this.listener = null;
    }
    this.clearNoDataTimer();
    if (this.status === "active" || this.status === "no-data" || this.status === "requesting") {
      this.setStatus(this.caps.needsPermission ? "needs-permission" : "idle", "Sensor gravity off");
    }
  }

  /** Stores the current raw tilt as the neutral (zero gravity offset) orientation. */
  calibrationFromCurrent(): { beta: number; gamma: number } | null {
    if (this.raw.beta === null || this.raw.gamma === null) return null;
    return { beta: this.raw.beta, gamma: this.raw.gamma };
  }

  destroy() {
    this.disable();
  }

  private setStatus(status: SensorStatus, message: string) {
    this.status = status;
    this.message = message;
    this.onChange();
  }

  private armNoDataTimer() {
    this.clearNoDataTimer();
    this.noDataTimer = window.setTimeout(() => {
      if (this.status === "no-data") {
        this.setStatus("no-data", "No orientation data received — device may lack sensors. Manual gravity in use.");
      }
    }, NO_DATA_TIMEOUT);
  }

  private clearNoDataTimer() {
    if (this.noDataTimer !== null) {
      window.clearTimeout(this.noDataTimer);
      this.noDataTimer = null;
    }
  }

  private handleEvent(e: DeviceOrientationEvent) {
    try {
      if (e.beta === null || e.gamma === null) {
        if (this.status !== "no-data") this.setStatus("no-data", "Orientation events carry no tilt data on this device");
        return;
      }
      this.raw = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
      const now = performance.now();
      this.lastEventAt = now;
      this.eventTimes.push(now);
      if (this.eventTimes.length > 120) this.eventTimes.splice(0, this.eventTimes.length - 120);

      const s = this.settings;
      const beta = e.beta - s.calibration.beta; // front/back tilt, deg
      const gamma = e.gamma - s.calibration.gamma; // left/right tilt, deg
      // Gravity in the device frame (portrait-up reference).
      let gx = Math.sin((clamp(gamma, -90, 90) * Math.PI) / 180);
      let gy = Math.sin((clamp(beta, -90, 90) * Math.PI) / 180);
      // Rotate into the current screen orientation.
      const angle = (getScreenAngle() * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const rx = gx * cos + gy * sin;
      const ry = -gx * sin + gy * cos;
      gx = rx * s.sensitivity;
      gy = ry * s.sensitivity;
      const len = Math.hypot(gx, gy);
      if (len > 1) {
        gx /= len;
        gy /= len;
      }
      if (s.invertX) gx = -gx;
      if (s.invertY) gy = -gy;
      const alpha = clamp(1 - s.smoothing, 0.02, 1);
      this.smoothed = {
        x: this.smoothed.x + (gx - this.smoothed.x) * alpha,
        y: this.smoothed.y + (gy - this.smoothed.y) * alpha,
      };
      this.processed = { x: this.smoothed.x, y: this.smoothed.y };
      if (this.status !== "active") {
        this.clearNoDataTimer();
        this.setStatus("active", "Sensor gravity active");
      }
    } catch (err) {
      this.setStatus("error", `Sensor processing failed: ${(err as Error).message ?? "unknown"}`);
      this.disable();
    }
  }

  get vector(): Vec2 {
    return this.processed;
  }
}

function getScreenAngle(): number {
  try {
    if (typeof screen !== "undefined" && screen.orientation && typeof screen.orientation.angle === "number") {
      return screen.orientation.angle;
    }
    const legacy = (window as unknown as { orientation?: number }).orientation;
    if (typeof legacy === "number") return legacy;
  } catch {
    /* ignore */
  }
  return 0;
}
