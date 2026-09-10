import { Compass, Crosshair, Power } from "lucide-react";
import { useEditor, useEditorVersion } from "@/editor/useEditor";
import type { SensorStatus } from "@/editor/types";
import { CheckField, NumberField, Row, Section, SelectField } from "../fields";

const STATUS_LABEL: Record<SensorStatus, { text: string; tone: "ok" | "warn" | "danger" | "muted" }> = {
  unsupported: { text: "Unsupported", tone: "muted" },
  idle: { text: "Off", tone: "muted" },
  "needs-permission": { text: "Permission needed", tone: "warn" },
  requesting: { text: "Requesting…", tone: "warn" },
  active: { text: "Active", tone: "ok" },
  "no-data": { text: "No data", tone: "warn" },
  denied: { text: "Denied", tone: "danger" },
  error: { text: "Error", tone: "danger" },
};

const fmt = (v: number | null, d = 1) => (v === null || !Number.isFinite(v) ? "—" : v.toFixed(d));

export function GravitySection() {
  const editor = useEditor();
  useEditorVersion();
  const g = editor.settings.gravity;
  const diag = editor.sensor.diagnostics;
  const status = STATUS_LABEL[diag.status];
  const sensorDriving = editor.usingSensorGravity;
  const caps = editor.sensor.caps;
  const canEnable = caps.supported && diag.status !== "active" && diag.status !== "requesting";
  const effective = { x: editor.engine.gravity.x, y: editor.engine.gravity.y };

  return (
    <Section
      id="gravity"
      title="Gravity"
      badge={
        <span className={`badge ${status.tone === "ok" ? "is-ok" : status.tone === "warn" ? "is-warn" : status.tone === "danger" ? "is-danger" : ""}`}>
          <span className="dot" aria-hidden />
          {sensorDriving ? "Sensor" : "Manual"}
        </span>
      }
    >
      <SelectField
        label="Source"
        value={g.mode}
        options={[
          { value: "auto", label: "Auto — sensor when available" },
          { value: "manual", label: "Manual only" },
        ]}
        onChange={(v) => editor.updateSettings("gravity", { mode: v })}
      />

      <div className={`note ${status.tone === "ok" ? "is-ok" : status.tone === "danger" ? "is-error" : status.tone === "warn" ? "is-warn" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold flex items-center gap-1.5">
            <Compass size={13} aria-hidden /> Motion sensor: {status.text}
          </span>
          {caps.supported && !caps.secureContext && <span className="hint">needs HTTPS</span>}
        </div>
        <div className="mt-1 hint" style={{ color: "inherit", opacity: 0.85 }}>
          {diag.message || (diag.status === "idle" ? "Sensor gravity is not running" : "")}
        </div>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {canEnable && diag.status !== "active" && (
            <button type="button" className="btn btn-sm is-primary" onClick={() => void editor.enableSensorGravity()}>
              <Power size={12} aria-hidden /> {diag.status === "needs-permission" || diag.status === "denied" ? "Enable motion" : "Start sensor"}
            </button>
          )}
          {(diag.status === "active" || diag.status === "no-data") && (
            <button type="button" className="btn btn-sm is-outline" onClick={() => editor.disableSensorGravity()}>
              <Power size={12} aria-hidden /> Use manual
            </button>
          )}
          <button type="button" className="btn btn-sm is-outline" disabled={diag.status !== "active"} onClick={() => editor.calibrateSensor()}>
            <Crosshair size={12} aria-hidden /> Recenter
          </button>
        </div>
      </div>

      <p className="field-label mt-1" style={{ fontWeight: 600 }}>
        Manual gravity {sensorDriving && <span className="hint">(fallback while sensor active)</span>}
      </p>
      <div className="field-pair">
        <NumberField bare value={g.x} step={0.1} min={-5} max={5} title="Gravity X" onCommit={(v) => editor.updateSettings("gravity", { x: v })} />
        <NumberField bare value={g.y} step={0.1} min={-5} max={5} title="Gravity Y" onCommit={(v) => editor.updateSettings("gravity", { y: v })} />
      </div>
      <div className="btn-grid">
        <button type="button" className="btn btn-sm" onClick={() => editor.updateSettings("gravity", { x: 0, y: 1 })}>
          Down
        </button>
        <button type="button" className="btn btn-sm" onClick={() => editor.updateSettings("gravity", { x: 0, y: 0 })}>
          Zero-g
        </button>
        <button type="button" className="btn btn-sm" onClick={() => editor.updateSettings("gravity", { x: 0, y: -1 })}>
          Up
        </button>
      </div>
      <NumberField label="Scale" value={g.scale} step={0.0001} min={0} max={0.01} decimals={4} title="Matter.js gravity.scale" onCommit={(v) => editor.updateSettings("gravity", { scale: v })} />

      <p className="field-label mt-1" style={{ fontWeight: 600 }}>
        Sensor processing
      </p>
      <NumberField label="Sensitivity" value={g.sensitivity} min={0.1} max={3} step={0.1} slider onCommit={(v) => editor.updateSettings("gravity", { sensitivity: v })} />
      <NumberField label="Smoothing" value={g.smoothing} min={0} max={0.95} step={0.05} slider onCommit={(v) => editor.updateSettings("gravity", { smoothing: v })} />
      <CheckField label="Invert X" checked={g.invertX} onChange={(v) => editor.updateSettings("gravity", { invertX: v })} />
      <CheckField label="Invert Y" checked={g.invertY} onChange={(v) => editor.updateSettings("gravity", { invertY: v })} />
      <Row label="Calibration">
        <span className="hint font-mono">
          β {fmt(g.calibration.beta)}° γ {fmt(g.calibration.gamma)}°
        </span>
      </Row>

      <p className="field-label mt-1" style={{ fontWeight: 600 }}>
        Diagnostics
      </p>
      <div className="diag">
        <span>raw α/β/γ</span>
        <span>
          {fmt(diag.raw.alpha)} / {fmt(diag.raw.beta)} / {fmt(diag.raw.gamma)}
        </span>
        <span>screen angle</span>
        <span>{diag.screenAngle}°</span>
        <span>processed</span>
        <span>
          {fmt(diag.processed.x, 3)}, {fmt(diag.processed.y, 3)}
        </span>
        <span>effective</span>
        <span>
          {fmt(effective.x, 3)}, {fmt(effective.y, 3)}
        </span>
        <span>events/s</span>
        <span>{diag.eventsPerSecond}</span>
        <span>permission API</span>
        <span>{caps.needsPermission ? "required" : caps.supported ? "not required" : "n/a"}</span>
      </div>
    </Section>
  );
}
