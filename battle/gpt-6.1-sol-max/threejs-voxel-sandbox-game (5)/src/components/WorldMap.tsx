import { useEffect, useRef } from 'react';
import type { GameEngine } from '../game/engine';
import { SEA } from '../game/world';

interface Props {
  engine: GameEngine | null;
  position: [number, number, number];
  waypoint: [number, number] | null;
  onWaypoint: (waypoint: [number, number]) => void;
}

export default function WorldMap({ engine, position, waypoint, onWaypoint }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const center = useRef<[number, number]>([position[0], position[2]]);
  useEffect(() => {
    if (!engine || !ref.current) return;
    const ctx = ref.current.getContext('2d')!;
    const [cx, cz] = center.current;
    for (let x = 0; x < 96; x++) for (let z = 0; z < 96; z++) {
      const col = engine.world.column(Math.floor(cx + (x - 48) * 2), Math.floor(cz + (z - 48) * 2));
      ctx.fillStyle = col.height <= SEA ? '#75afb0' : col.height <= SEA + 1 ? '#d8c995' : col.biome === 'Highlands' ? col.height > 48 ? '#d9dfce' : '#a2ab93' : col.biome === 'Golden grove' ? '#a9ad6d' : col.biome === 'Pine woods' ? '#658769' : '#8ea474';
      ctx.fillRect(x * 3, z * 3, 3, 3);
      if (col.height % 5 === 0 && col.height > SEA) { ctx.fillStyle = '#3c56330d'; ctx.fillRect(x * 3, z * 3, 3, 3); }
    }
    ctx.strokeStyle = '#ffffff20'; ctx.lineWidth = 1;
    for (let i = 0; i <= 288; i += 36) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 288); ctx.moveTo(0, i); ctx.lineTo(288, i); ctx.stroke(); }
    const px = 144 + (position[0] - cx) * 1.5, pz = 144 + (position[2] - cz) * 1.5;
    ctx.beginPath(); ctx.arc(px, pz, 8, 0, Math.PI * 2); ctx.fillStyle = '#f7f3dd'; ctx.fill();
    ctx.beginPath(); ctx.arc(px, pz, 4, 0, Math.PI * 2); ctx.fillStyle = '#3b6656'; ctx.fill();
    if (waypoint) {
      const wx = 144 + (waypoint[0] - cx) * 1.5, wz = 144 + (waypoint[1] - cz) * 1.5;
      ctx.fillStyle = '#d3895c'; ctx.strokeStyle = '#fff1d7'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(wx, wz - 7); ctx.lineTo(wx + 5, wz); ctx.lineTo(wx, wz + 7); ctx.lineTo(wx - 5, wz); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#f8f2dc'; ctx.font = '600 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('N', 144, 20);
  }, [engine, position, waypoint]);
  return <canvas ref={ref} width={288} height={288} className="world-map" aria-label="Local terrain map. Click to place a trail marker."
    onClick={event => {
      const rect = event.currentTarget.getBoundingClientRect();
      onWaypoint([Math.round(center.current[0] + ((event.clientX - rect.left) / rect.width - 0.5) * 192), Math.round(center.current[1] + ((event.clientY - rect.top) / rect.height - 0.5) * 192)]);
    }} />;
}