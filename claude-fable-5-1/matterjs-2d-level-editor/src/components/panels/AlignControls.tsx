import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
} from "lucide-react";
import type { AlignMode } from "@/editor/Editor";
import { useEditor, useEditorVersion } from "@/editor/useEditor";

const ALIGN: { mode: AlignMode; label: string; Icon: typeof AlignStartVertical }[] = [
  { mode: "left", label: "Align left", Icon: AlignStartVertical },
  { mode: "hcenter", label: "Align horizontal centers", Icon: AlignCenterVertical },
  { mode: "right", label: "Align right", Icon: AlignEndVertical },
  { mode: "top", label: "Align top", Icon: AlignStartHorizontal },
  { mode: "vcenter", label: "Align vertical centers", Icon: AlignCenterHorizontal },
  { mode: "bottom", label: "Align bottom", Icon: AlignEndHorizontal },
];

export function AlignControls({ compact = false }: { compact?: boolean }) {
  const editor = useEditor();
  useEditorVersion();
  const n = editor.selectedBodies().length;
  const canAlign = n >= 2;
  const canDistribute = n >= 3;
  if (compact) {
    return (
      <>
        {ALIGN.map(({ mode, label, Icon }) => (
          <button key={mode} type="button" className="btn is-icon" title={label} aria-label={label} disabled={!canAlign} onClick={() => editor.align(mode)}>
            <Icon size={16} aria-hidden />
          </button>
        ))}
        <button type="button" className="btn is-icon" title="Distribute horizontally" aria-label="Distribute horizontally" disabled={!canDistribute} onClick={() => editor.distribute("horizontal")}>
          <AlignHorizontalSpaceAround size={16} aria-hidden />
        </button>
        <button type="button" className="btn is-icon" title="Distribute vertically" aria-label="Distribute vertically" disabled={!canDistribute} onClick={() => editor.distribute("vertical")}>
          <AlignVerticalSpaceAround size={16} aria-hidden />
        </button>
      </>
    );
  }
  return (
    <>
      <div className="btn-grid">
        {ALIGN.map(({ mode, label, Icon }) => (
          <button key={mode} type="button" className="btn btn-sm" title={label} aria-label={label} disabled={!canAlign} onClick={() => editor.align(mode)}>
            <Icon size={15} aria-hidden />
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        <button type="button" className="btn btn-sm is-outline" disabled={!canDistribute} onClick={() => editor.distribute("horizontal")}>
          <AlignHorizontalSpaceAround size={15} aria-hidden /> Distribute H
        </button>
        <button type="button" className="btn btn-sm is-outline" disabled={!canDistribute} onClick={() => editor.distribute("vertical")}>
          <AlignVerticalSpaceAround size={15} aria-hidden /> Distribute V
        </button>
      </div>
      <p className="hint">Alignment needs 2+ bodies; distribution needs 3+.</p>
    </>
  );
}
