import { Box, ChevronDown, Globe, Layers, Link2, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { BODY_KIND_LABEL } from "@/editor/bodies";
import { CONSTRAINT_KIND_LABEL } from "@/editor/constraints";
import { useEditor, useEditorVersion } from "@/editor/useEditor";
import { BodyPanel, MultiBodyPanel } from "./panels/BodyPanel";
import { ConstraintPanel } from "./panels/ConstraintPanel";
import { ToolPanel } from "./panels/ToolPanel";
import { WorldPanel } from "./panels/WorldPanel";

export function PropertiesPanel() {
  const editor = useEditor();
  useEditorVersion();
  const bodies = editor.selectedBodies();
  const constraints = editor.selectedConstraints();
  const total = bodies.length + constraints.length;

  let title: ReactNode;
  let sub = "";
  let Icon = Globe;
  let content: ReactNode;

  if (total === 0 && editor.tool !== "select") {
    Icon = Wrench;
    title = "Tool";
    sub = editor.tool in BODY_KIND_LABEL ? BODY_KIND_LABEL[editor.tool as keyof typeof BODY_KIND_LABEL] : CONSTRAINT_KIND_LABEL[editor.tool as keyof typeof CONSTRAINT_KIND_LABEL];
    content = <ToolPanel />;
  } else if (total === 0) {
    title = "World";
    sub = editor.settings.world.name;
    content = <WorldPanel />;
  } else if (bodies.length === 1 && constraints.length === 0) {
    Icon = Box;
    title = "Body";
    sub = bodies[0].body.label;
    content = <BodyPanel key={bodies[0].id} entity={bodies[0]} />;
  } else if (constraints.length === 1 && bodies.length === 0) {
    Icon = Link2;
    title = "Constraint";
    sub = constraints[0].constraint.label;
    content = <ConstraintPanel key={constraints[0].id} entity={constraints[0]} />;
  } else if (bodies.length >= 1) {
    Icon = Layers;
    title = "Selection";
    sub = `${bodies.length} bodies${constraints.length ? ` + ${constraints.length} constraints` : ""}`;
    content = <MultiBodyPanel key={bodies.map((b) => b.id).join("|")} bodies={bodies} />;
  } else {
    Icon = Link2;
    title = "Selection";
    sub = `${constraints.length} constraints`;
    content = (
      <div className="section-body pt-3">
        <p className="hint">Multiple constraints selected. Select a single constraint to edit its properties, or press Delete to remove them.</p>
        <button type="button" className="btn is-outline is-danger" onClick={() => editor.deleteSelection()}>
          Delete {constraints.length} constraints
        </button>
      </div>
    );
  }

  return (
    <aside className={`panel ${editor.panelOpen ? "is-open" : ""}`} aria-label="Properties">
      <span className="panel-grip" aria-hidden />
      <header className="panel-header">
        <h2 className="panel-title">
          <Icon size={15} aria-hidden style={{ color: "var(--accent)" }} />
          {title}
          <span className="sub">{sub}</span>
        </h2>
        <button type="button" className="btn is-icon panel-close" aria-label="Close properties" onClick={() => editor.setPanelOpen(false)}>
          <ChevronDown size={18} aria-hidden />
        </button>
      </header>
      <div className="panel-body">{content}</div>
    </aside>
  );
}
