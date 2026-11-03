import React, { useEffect, useRef } from 'react';
import { GameEngine } from '../engine/gameEngine';

interface MinimapProps {
  engine: GameEngine | null;
  playerX: number;
  playerZ: number;
  yaw: number;
}

const MAP_CELLS = 49; // 49x49 blocks around player (~98m radar diameter at 2m/px)

export const Minimap: React.FC<MinimapProps> = ({ engine, playerX, playerZ, yaw }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !engine) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderMap = () => {
      const cx = Math.floor(engine.physics.position.x);
      const cz = Math.floor(engine.physics.position.z);
      const half = Math.floor(MAP_CELLS / 2);

      for (let py = 0; py < MAP_CELLS; py++) {
        const wz = cz + (py - half) * 2;
        for (let px = 0; px < MAP_CELLS; px++) {
          const wx = cx + (px - half) * 2;
          ctx.fillStyle = engine.world.sampleTopBlockColor(wx, wz);
          ctx.fillRect(px * 2, py * 2, 2, 2);
        }
      }

      // Nearby creatures on radar
      for (const mob of engine.entities.mobs) {
        const dx = Math.round((mob.pos.x - cx) / 2) + half;
        const dz = Math.round((mob.pos.z - cz) / 2) + half;
        if (dx >= 1 && dx < MAP_CELLS - 1 && dz >= 1 && dz < MAP_CELLS - 1) {
          ctx.fillStyle = mob.hostile ? '#ef4444' : '#f8fafc';
          ctx.fillRect(dx * 2, dz * 2, 2, 2);
        }
      }
    };

    renderMap();
    const id = window.setInterval(renderMap, 300);
    return () => window.clearInterval(id);
  }, [engine]);

  // Camera forward vector (-sin(yaw), -cos(yaw)) -> top of map is -Z (North = 0 deg)
  const deg = (-yaw * 180) / Math.PI;

  return (
    <div
      className="relative w-[98px] h-[98px] rounded-xl overflow-hidden border-2 border-slate-600/80 shadow-xl bg-slate-900 hidden sm:block"
      title={`Radar (${Math.round(playerX)}, ${Math.round(playerZ)}) — North Up`}
    >
      <canvas ref={canvasRef} width={98} height={98} className="w-full h-full pixelated" />
      <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[8px] font-black text-white bg-slate-950/75 px-1 rounded">
        N
      </span>
      {/* Player Heading Marker */}
      <div
        className="absolute left-1/2 top-1/2 w-3.5 h-3.5 -ml-[7px] -mt-[7px] flex items-center justify-center"
        style={{ transform: `rotate(${deg}deg)` }}
      >
        <div
          className="w-0 h-0"
          style={{
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderBottom: '10px solid #facc15',
            filter: 'drop-shadow(0 0 2px #000)',
          }}
        />
      </div>
    </div>
  );
};
