import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../utils/cn';
import { audio } from '../game/audio';

export function Btn({
  children,
  onClick,
  variant = 'default',
  disabled,
  className,
  title,
  small,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'gold' | 'danger' | 'ghost' | 'green';
  disabled?: boolean;
  className?: string;
  title?: string;
  small?: boolean;
}) {
  const base = 'rounded-lg font-bold tracking-wide transition-all duration-150 active:scale-95 border select-none disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100';
  const sizes = small ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm';
  const v = {
    default: 'bg-[#2a2342] border-[#5a4d86] hover:bg-[#3a3060] hover:border-[#8a78c8] text-[#efe9ff]',
    gold: 'bg-gradient-to-b from-[#f7d98b] to-[#d89a3a] border-[#fff0c0] text-[#2a1a05] hover:brightness-110 shadow-[0_2px_14px_rgba(245,190,90,0.35)]',
    danger: 'bg-[#4a1b24] border-[#a04050] hover:bg-[#662635] text-[#ffd8dc]',
    ghost: 'bg-transparent border-transparent hover:bg-white/10 text-[#d6cdf0]',
    green: 'bg-[#1d4a37] border-[#3fa078] hover:bg-[#256048] text-[#d8ffe9]',
  }[variant];
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={() => {
        audio.init();
        audio.sfx('click');
        onClick?.();
      }}
      className={cn(base, sizes, v, className)}
    >
      {children}
    </button>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-xl border border-[#3d3460] bg-[#171326]/90 backdrop-blur-sm shadow-xl', className)}>{children}</div>;
}

export function Modal({ children, onClose, title, wide }: { children: ReactNode; onClose?: () => void; title?: string; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 anim-fade" onClick={onClose}>
      <div
        className={cn('anim-pop max-h-[92vh] w-full overflow-y-auto scroll-thin rounded-2xl border border-[#5a4d86] bg-[#151022] p-5 shadow-2xl', wide ? 'max-w-4xl' : 'max-w-lg')}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 className="font-display mb-3 text-2xl font-extrabold text-[#f5d78a]">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function Chip({ children, color = '#3a3060', className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-white/90', className)} style={{ background: color }}>
      {children}
    </span>
  );
}

export function HexBackdrop({ intensity = 1 }: { intensity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    const embers = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() * 0.5 + 0.2, r: Math.random() * 2 + 0.5 }));
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = cv.clientWidth * dpr;
      cv.height = cv.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    let t = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const W = cv.clientWidth;
      const H = cv.clientHeight;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0d0b16');
      g.addColorStop(1, '#241636');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const s = 38;
      const hw = s * Math.sqrt(3);
      for (let r = -1; r < H / (s * 1.5) + 2; r++)
        for (let c = -1; c < W / hw + 2; c++) {
          const x = c * hw + (r & 1 ? hw / 2 : 0);
          const y = r * s * 1.5;
          const wob = Math.sin(t * 0.8 + c * 0.7 + r * 0.9);
          const fall = Math.sin(t * 0.3 + c * 1.3 - r * 0.4) > 0.93 ? 1 : 0;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 180) * (60 * i - 30);
            const px = x + (s - 2) * Math.cos(a);
            const py = y + (s - 2) * Math.sin(a) + wob * 1.5;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fillStyle = fall ? 'rgba(0,0,0,0.6)' : `rgba(120,100,190,${0.04 + (wob + 1) * 0.02 * intensity})`;
          ctx.fill();
          ctx.strokeStyle = fall ? 'rgba(255,120,60,0.5)' : 'rgba(140,120,220,0.12)';
          ctx.stroke();
        }
      for (const e of embers) {
        e.y -= dt * e.s * 0.15;
        e.x += Math.sin(t + e.r) * dt * 0.01;
        if (e.y < -0.05) {
          e.y = 1.05;
          e.x = Math.random();
        }
        ctx.fillStyle = `rgba(255,${140 + e.r * 30},60,${0.3 + e.s * 0.5})`;
        ctx.beginPath();
        ctx.arc(e.x * W, e.y * H, e.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [intensity]);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}
