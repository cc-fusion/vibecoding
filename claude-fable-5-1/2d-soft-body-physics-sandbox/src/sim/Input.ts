import type { Sandbox } from './Sandbox';
import type { Vec } from './types';
import { areaCentroid, dedupe, dist, isSimplePolygon, polylineSegmentValid, signedArea } from './geometry';

interface Sample {
  t: number;
  p: Vec;
}

/**
 * Translates pointer / keyboard input into sandbox actions.
 * Only a single pointer is tracked (first touch wins) so multi-touch
 * gestures don't create stray objects.
 */
export class InputController {
  private activePointer: number | null = null;
  private samples: Sample[] = [];
  private downPos: Vec | null = null;
  private moved = false;
  private disposed = false;

  constructor(
    private sb: Sandbox,
    private canvas: HTMLCanvasElement,
  ) {
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onCancel);
    canvas.addEventListener('pointerleave', this.onLeave);
    canvas.addEventListener('dblclick', this.onDblClick);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', this.onKey);
  }

  dispose() {
    this.disposed = true;
    const c = this.canvas;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('pointercancel', this.onCancel);
    c.removeEventListener('pointerleave', this.onLeave);
    c.removeEventListener('dblclick', this.onDblClick);
    window.removeEventListener('keydown', this.onKey);
  }

  private pos(e: PointerEvent | MouseEvent): Vec {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /* ------------------------------------------------------------------ */

  private onDown = (e: PointerEvent) => {
    if (this.disposed) return;
    if (this.activePointer !== null) return;
    if (e.button !== 0 && e.pointerType === 'mouse') {
      // right-click: cancel polygon / deselect
      if (this.sb.draft?.kind === 'polygon') this.cancelPolygon();
      return;
    }
    this.activePointer = e.pointerId;
    this.canvas.setPointerCapture(e.pointerId);
    const p = this.pos(e);
    this.downPos = p;
    this.moved = false;
    this.samples = [{ t: performance.now(), p }];
    const sb = this.sb;
    const tool = sb.tools.tool;

    if (tool === 'select') {
      const hit = sb.objectAt(p);
      if (hit) {
        sb.select(hit.id);
        sb.beginGrab(hit, p);
      } else {
        sb.select(null);
      }
      return;
    }
    if (tool === 'rect' || tool === 'circle' || tool === 'soft') {
      sb.draft = { kind: 'box', tool, start: p, end: p, seed: Math.random() * 1000 };
      return;
    }
    if (tool === 'polygon') {
      this.addPolygonPoint(p);
    }
  };

  private onMove = (e: PointerEvent) => {
    const p = this.pos(e);
    const sb = this.sb;
    sb.pointer = p;

    if (this.activePointer === null || e.pointerId !== this.activePointer) {
      // hover feedback / polygon rubber band
      if (sb.tools.tool === 'select') {
        const hit = sb.objectAt(p);
        sb.hoverId = hit ? hit.id : null;
        this.canvas.style.cursor = hit ? 'grab' : 'default';
      } else {
        sb.hoverId = null;
        this.canvas.style.cursor = 'crosshair';
      }
      if (sb.draft?.kind === 'polygon') this.updatePolygonCursor(p);
      return;
    }

    if (this.downPos && dist(this.downPos, p) > 3) this.moved = true;
    const now = performance.now();
    this.samples.push({ t: now, p });
    while (this.samples.length > 12 || (this.samples.length > 2 && now - this.samples[0].t > 120)) this.samples.shift();

    if (sb.grab) {
      sb.updateGrab(p);
      this.canvas.style.cursor = 'grabbing';
    } else if (sb.draft?.kind === 'box') {
      sb.draft.end = p;
    } else if (sb.draft?.kind === 'polygon') {
      this.updatePolygonCursor(p);
    }
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.activePointer) return;
    this.activePointer = null;
    const p = this.pos(e);
    const sb = this.sb;

    if (sb.grab) {
      sb.endGrab(this.pointerVelocity());
      this.canvas.style.cursor = 'grab';
    } else if (sb.draft?.kind === 'box') {
      this.finishBox(sb.draft.tool, sb.draft.start, p, sb.draft.seed);
      sb.draft = null;
    }
    this.downPos = null;
    this.samples = [];
  };

  private onCancel = (e: PointerEvent) => {
    if (e.pointerId !== this.activePointer) return;
    this.activePointer = null;
    this.sb.endGrab(null);
    if (this.sb.draft?.kind === 'box') this.sb.draft = null;
  };

  private onLeave = () => {
    this.sb.pointer = null;
    this.sb.hoverId = null;
  };

  private onDblClick = (e: MouseEvent) => {
    if (this.sb.tools.tool === 'polygon' && this.sb.draft?.kind === 'polygon') {
      e.preventDefault();
      this.closePolygon();
    }
  };

  /* ------------------------------------------------------------------ */
  /* throwing                                                            */
  /* ------------------------------------------------------------------ */

  private pointerVelocity(): Vec | null {
    const s = this.samples;
    if (s.length < 2) return null;
    const now = performance.now();
    // use samples from the last ~90ms
    let i = s.length - 1;
    while (i > 0 && now - s[i - 1].t < 90) i--;
    const a = s[i];
    const b = s[s.length - 1];
    const dt = Math.max(1, b.t - a.t);
    if (now - b.t > 80) return { x: 0, y: 0 }; // pointer stopped before release
    return { x: (b.p.x - a.p.x) / dt, y: (b.p.y - a.p.y) / dt };
  }

  /* ------------------------------------------------------------------ */
  /* box creation (rect / circle / soft presets)                         */
  /* ------------------------------------------------------------------ */

  private finishBox(tool: 'rect' | 'circle' | 'soft' | string, start: Vec, end: Vec, seed: number) {
    const sb = this.sb;
    let w = Math.abs(end.x - start.x);
    let h = Math.abs(end.y - start.y);
    let cx = (start.x + end.x) / 2;
    let cy = (start.y + end.y) / 2;
    if (!this.moved || (w < 8 && h < 8)) {
      // simple click: default size at click position
      w = tool === 'soft' ? 120 : 60;
      h = tool === 'soft' ? 110 : 60;
      cx = start.x;
      cy = start.y;
    }
    w = Math.max(w, 14);
    h = Math.max(h, 14);
    const mode = sb.tools.bodyMode;
    let created = null;
    if (tool === 'rect') created = sb.createRigid({ shape: 'rect', w, h }, { x: cx, y: cy }, mode);
    else if (tool === 'circle') created = sb.createRigid({ shape: 'circle', r: Math.max(w, h) / 2 }, { x: cx, y: cy }, mode);
    else created = sb.createSoftPreset(sb.tools.softPreset, { x: cx, y: cy }, w, h, {}, seed);
    if (created) sb.select(created.id);
    sb.refreshStats();
  }

  /* ------------------------------------------------------------------ */
  /* polygon tool                                                        */
  /* ------------------------------------------------------------------ */

  private addPolygonPoint(p: Vec) {
    const sb = this.sb;
    if (!sb.draft || sb.draft.kind !== 'polygon') {
      sb.draft = { kind: 'polygon', points: [p], cursor: p, valid: true, closing: false };
      sb.emit();
      return;
    }
    const d = sb.draft;
    // clicking the first point closes the polygon
    if (d.points.length >= 3 && dist(p, d.points[0]) < 14) {
      this.closePolygon();
      return;
    }
    if (dist(p, d.points[d.points.length - 1]) < 4) return;
    if (!polylineSegmentValid(d.points, p)) {
      d.valid = false; // flash invalid (renderer shows red)
      return;
    }
    d.points.push(p);
    d.valid = true;
    sb.emit();
  }

  private updatePolygonCursor(p: Vec) {
    const d = this.sb.draft;
    if (!d || d.kind !== 'polygon') return;
    d.cursor = p;
    d.closing = d.points.length >= 3 && dist(p, d.points[0]) < 14;
    d.valid = polylineSegmentValid(d.points, p);
  }

  closePolygon() {
    const sb = this.sb;
    const d = sb.draft;
    if (!d || d.kind !== 'polygon') return;
    const pts = dedupe(d.points, 2);
    if (pts.length < 3 || !isSimplePolygon(pts) || Math.abs(signedArea(pts)) < 150) {
      d.valid = false;
      sb.emit();
      return;
    }
    const target = sb.tools.polyTarget;
    let created = null;
    if (target === 'soft') {
      created = sb.createSoft(pts);
    } else {
      const c = areaCentroid(pts);
      const local = pts.map((v) => ({ x: v.x - c.x, y: v.y - c.y }));
      created = sb.createRigid({ shape: 'polygon', verts: local }, c, target);
    }
    sb.draft = null;
    if (created) sb.select(created.id);
    sb.refreshStats();
  }

  cancelPolygon() {
    this.sb.draft = null;
    this.sb.emit();
  }

  undoPolygonPoint() {
    const d = this.sb.draft;
    if (!d || d.kind !== 'polygon') return;
    d.points.pop();
    if (!d.points.length) this.sb.draft = null;
    this.sb.emit();
  }

  /* ------------------------------------------------------------------ */
  /* keyboard                                                            */
  /* ------------------------------------------------------------------ */

  private onKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    const sb = this.sb;
    const meta = e.ctrlKey || e.metaKey;
    switch (e.key) {
      case 'v':
      case 'V':
        sb.setTools({ tool: 'select' });
        break;
      case 's':
      case 'S':
        if (!meta) sb.setTools({ tool: 'soft' });
        break;
      case 'r':
      case 'R':
        if (!meta) sb.setTools({ tool: 'rect' });
        break;
      case 'c':
      case 'C':
        if (!meta) sb.setTools({ tool: 'circle' });
        break;
      case 'p':
      case 'P':
        sb.setTools({ tool: 'polygon' });
        break;
      case 'g':
      case 'G':
        sb.setWorldParams({ debug: { ...sb.params.debug, nodes: !sb.params.debug.nodes, springs: !sb.params.debug.nodes } });
        break;
      case ' ':
        e.preventDefault();
        sb.togglePause();
        break;
      case '.':
        if (!sb.params.paused) sb.setWorldParams({ paused: true });
        sb.requestStep();
        break;
      case 'Delete':
      case 'Backspace':
        if (sb.draft?.kind === 'polygon') this.undoPolygonPoint();
        else if (sb.selectedId !== null) {
          sb.remove(sb.selectedId);
          sb.refreshStats();
        }
        break;
      case 'd':
      case 'D':
        if (meta) {
          e.preventDefault();
          if (sb.selectedId !== null) {
            sb.duplicate(sb.selectedId);
            sb.refreshStats();
          }
        }
        break;
      case 'Escape':
        if (sb.draft) this.cancelPolygon();
        else sb.select(null);
        break;
      case 'Enter':
        if (sb.draft?.kind === 'polygon') this.closePolygon();
        break;
      case 'q':
      case 'Q':
        sb.rotateSelected(-Math.PI / 36);
        break;
      case 'e':
      case 'E':
        sb.rotateSelected(Math.PI / 36);
        break;
      default:
        return;
    }
  };
}
