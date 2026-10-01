import { useEffect, useRef } from 'react';
import { Engine, type Callbacks, type Upgrades } from '../game/engine';

interface Props {
  levelIndex: number;
  upgrades: Upgrades;
  runKey: number;
  callbacks: Callbacks;
  engineRef: React.MutableRefObject<Engine | null>;
}

export default function GameCanvas({ levelIndex, upgrades, runKey, callbacks, engineRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;
  const upRef = useRef(upgrades);
  upRef.current = upgrades;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new Engine(canvas, levelIndex, upRef.current, {
      onClear: (i) => cbRef.current.onClear(i),
      onPause: (p) => cbRef.current.onPause(p),
    });
    engineRef.current = engine;
    engine.run();
    const down = (e: KeyboardEvent) => {
      if (engine.keyDown(e)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => engine.keyUp(e);
    const blur = () => engine.onBlur();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      engine.destroy();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [levelIndex, runKey, engineRef]);

  return (
    <canvas
      ref={canvasRef}
      className="block rounded-lg shadow-[0_0_60px_rgba(56,189,248,0.15)] border border-slate-800 bg-black"
      style={{ width: 'min(100%, calc((100vh - 64px) * 1.3699))', aspectRatio: '800 / 584' }}
    />
  );
}
