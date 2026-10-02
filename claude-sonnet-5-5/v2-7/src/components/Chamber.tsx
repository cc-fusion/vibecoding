import { useEffect, useRef } from "react";
import { FACTIONS } from "../game/data";
import { forecast } from "../game/core";
import type { Game } from "../game/core";

interface Pos { x: number; y: number; a: number; r: number; row: number; }
const ROWS = [12, 16, 20, 24, 27];

function buildLayout(): { a: number; row: number }[] {
  const arr: { a: number; row: number; k: number }[] = [];
  ROWS.forEach((n, row) => { for (let j = 0; j < n; j++) arr.push({ a: Math.PI - ((j + 0.5) / n) * Math.PI, row, k: j }); });
  arr.sort((p, q) => q.a - p.a || p.row - q.row);
  return arr;
}
const LAYOUT = buildLayout();

export default function Chamber({ g }: { g: Game }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const gRef = useRef(g); gRef.current = g;
  const stamp = useRef<number[]>([]);
  const lastReveal = useRef(0);

  useEffect(() => {
    const cv = ref.current; if (!cv) return; const ctx = cv.getContext("2d"); if (!ctx) return;
    let w = 300, h = 200, dpr = 1, raf = 0;
    const resize = () => {
      const r = cv.parentElement!.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(200, r.width); h = Math.max(140, r.height);
      cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr); cv.style.width = w + "px"; cv.style.height = h + "px";
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(cv.parentElement!);
    const loop = (now: number) => {
      const G = gRef.current; const t = now / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h - 26; const Rmax = Math.min(w / 2 - 16, h - 56);
      const sr = Math.max(3.5, Math.min(11, Rmax * 0.052));
      const pos: Pos[] = LAYOUT.map(p => { const r = Rmax * (0.42 + 0.58 * (p.row / (ROWS.length - 1))); return { x: cx + Math.cos(p.a) * r, y: cy - Math.sin(p.a) * r, a: p.a, r, row: p.row }; });
      const fc = forecast(G, false);
      const voting = G.phase === "voting" || ((G.phase === "result") && G.vote);
      const reveal = G.phase === "voting" ? G.reveal : G.vote ? G.vote.votes.length : 0;
      if (G.phase === "voting") { for (let i = lastReveal.current; i < reveal; i++) stamp.current[i] = t; lastReveal.current = reveal; } else if (G.phase !== "result") lastReveal.current = 0;
      // floor glow
      const grd = ctx.createRadialGradient(cx, cy, 10, cx, cy, Rmax * 1.15); grd.addColorStop(0, "rgba(242,193,78,.10)"); grd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < G.seats.length && i < pos.length; i++) {
        const seat = G.seats[i]; const p = pos[i]; const col = FACTIONS[seat.f].color;
        let ring = ""; let fill = col; let scale = 1; let alpha = 1;
        if (seat.absent) { alpha = 0.25; }
        else if (voting && i < reveal && G.vote) {
          const v = G.vote.votes[i]; ring = v === "y" ? "#4ade80" : v === "n" ? "#fb7185" : "";
          const age = t - (stamp.current[i] || 0); scale = 1 + 0.9 * Math.exp(-age * 7) * (G.phase === "voting" ? 1 : 0);
        } else {
          const m = fc.margins[i]; const unc = fc.per[seat.f].uncertain; const k = Math.min(1, Math.abs(m) / 35);
          const flick = unc ? 0.55 + 0.45 * Math.sin(t * 6 + i) : 1;
          ring = m > 0 ? `rgba(74,222,128,${(0.25 + 0.75 * k) * flick})` : `rgba(251,113,133,${(0.25 + 0.75 * k) * flick})`;
          if (voting && G.phase === "voting") alpha = 0.5;
        }
        ctx.globalAlpha = alpha;
        ctx.save(); ctx.translate(p.x, p.y + (voting && i < reveal ? 0 : Math.sin(t * 1.5 + i) * 0.4)); ctx.scale(scale, scale);
        ctx.fillStyle = "rgba(10,8,22,.85)"; ctx.beginPath(); ctx.arc(0, 0, sr + 1.5, 0, 6.3); ctx.fill();
        ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(0, 0, sr, 0, 6.3); ctx.fill();
        // crow head silhouette: beak
        ctx.fillStyle = "rgba(10,8,22,.8)"; ctx.beginPath(); ctx.arc(0, 0, sr * 0.62, 0, 6.3); ctx.fill();
        ctx.fillStyle = "#f2c14e"; ctx.beginPath(); ctx.moveTo(sr * 0.1, -sr * 0.05); ctx.lineTo(sr * 0.95, sr * 0.1); ctx.lineTo(sr * 0.1, sr * 0.3); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.fillRect(-sr * 0.15, -sr * 0.28, Math.max(1, sr * 0.2), Math.max(1, sr * 0.2));
        if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = Math.max(1.5, sr * 0.3); ctx.beginPath(); ctx.arc(0, 0, sr + 1.5, 0, 6.3); ctx.stroke(); }
        ctx.restore(); ctx.globalAlpha = 1;
      }
      // center podium + tally
      const yes = voting && G.vote ? (G.phase === "voting" ? G.vote.votes.slice(0, reveal).filter(v => v === "y").length : G.vote.yes) : fc.yes;
      const no = voting && G.vote ? (G.phase === "voting" ? G.vote.votes.slice(0, reveal).filter(v => v === "n").length : G.vote.no) : fc.no;
      const need = voting && G.vote ? G.vote.needed : fc.needed;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const big = Math.max(18, Math.min(44, Rmax * 0.2));
      ctx.font = `900 ${big}px Cinzel, Georgia, serif`;
      ctx.fillStyle = yes >= need ? "#4ade80" : "#fbbf24"; ctx.fillText(String(yes), cx - big * 1.1, cy - Rmax * 0.16);
      ctx.fillStyle = "#94a3b8"; ctx.font = `700 ${big * 0.45}px Cinzel, serif`; ctx.fillText("—", cx, cy - Rmax * 0.16);
      ctx.font = `900 ${big}px Cinzel, Georgia, serif`; ctx.fillStyle = "#fb7185"; ctx.fillText(String(no), cx + big * 1.1, cy - Rmax * 0.16);
      ctx.font = `600 ${Math.max(10, big * 0.34)}px Cinzel, serif`; ctx.fillStyle = "#c9c3e6";
      ctx.fillText(`AYE  ·  need ${need}  ·  NAY`, cx, cy - Rmax * 0.16 + big * 0.85);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} id="chamber" className="block w-full h-full" aria-label="Parliament chamber" />;
}
