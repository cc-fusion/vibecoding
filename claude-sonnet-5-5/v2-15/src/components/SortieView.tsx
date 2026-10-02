import { useEffect, useRef, useState } from "react";
import { Sortie } from "../game/sortie";
import { audio } from "../game/audio";
import type { Campaign, Settings, SortieResult } from "../game/state";
import { Btn, HelpPanel, Modal, SettingsPanel } from "./ui";

interface Props {
  camp: Campaign; apex: boolean; ambush: boolean; tutorial: boolean;
  settings: Settings; onSettings: (s: Settings) => void;
  onEnd: (r: SortieResult) => void; onQuit: () => void; onTutorialDone: () => void;
}

export default function SortieView({ camp, apex, ambush, tutorial, settings, onSettings, onEnd, onQuit, onTutorialDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sortieRef = useRef<Sortie | null>(null);
  const live = useRef<Settings>({ ...settings });
  const latest = useRef({ settings, onSettings, onEnd, onTutorialDone });
  const [paused, setPaused] = useState(false);
  const [panel, setPanel] = useState<"menu" | "settings" | "help">("menu");
  const [key, setKey] = useState(0);

  useEffect(() => { latest.current = { settings, onSettings, onEnd, onTutorialDone }; Object.assign(live.current, settings); });

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const s = new Sortie(canvas, {
      camp, apex, ambush, tutorial, settings: live.current,
      onEnd: (r) => latest.current.onEnd(r),
      onPause: () => { setPanel("menu"); setPaused(true); },
      onMute: () => { const st = latest.current.settings; latest.current.onSettings({ ...st, muted: !st.muted }); },
      onTutorialDone: () => latest.current.onTutorialDone(),
    });
    sortieRef.current = s;
    s.start();
    setPaused(false);
    return () => { s.destroy(); sortieRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const resume = () => { setPaused(false); sortieRef.current?.resume(); };

  useEffect(() => {
    if (!paused) return;
    const onKey = (e: KeyboardEvent) => { if (e.code === "Escape" || e.code === "KeyP") resume(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused]);

  return (
    <div className="absolute inset-0 bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block touch-none" style={{ cursor: paused ? "default" : "none" }} />
      {paused && (
        <Modal>
          {panel === "menu" && (
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-amber-200 text-center mb-3">⏸ Paused</h2>
              <Btn className="w-full" onClick={resume}>▶ Resume</Btn>
              <Btn variant="steel" className="w-full" onClick={() => setPanel("settings")}>🔊 Settings & Volume</Btn>
              <Btn variant="steel" className="w-full" onClick={() => setPanel("help")}>📖 Controls & Help</Btn>
              <Btn variant="green" className="w-full" onClick={() => { setPaused(false); sortieRef.current?.resume(); sortieRef.current?.forceReturn(); }}>⚓ Abandon hunt — return to port</Btn>
              <Btn variant="steel" className="w-full" onClick={() => { audio.sfx("click"); setKey((k) => k + 1); }}>🔄 Restart this hunt</Btn>
              <Btn variant="red" className="w-full" onClick={onQuit}>🏠 Quit to title</Btn>
              <div className="text-xs text-center text-amber-100/60 pt-1">Quitting returns you to your last port save.</div>
            </div>
          )}
          {panel === "settings" && (
            <div>
              <h2 className="text-xl font-bold text-amber-200 mb-3">Settings</h2>
              <SettingsPanel settings={settings} onChange={onSettings} />
              <Btn variant="steel" className="mt-4" onClick={() => setPanel("menu")}>← Back</Btn>
            </div>
          )}
          {panel === "help" && (
            <div>
              <h2 className="text-xl font-bold text-amber-200 mb-3">Help</h2>
              <HelpPanel />
              <Btn variant="steel" className="mt-4" onClick={() => setPanel("menu")}>← Back</Btn>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
