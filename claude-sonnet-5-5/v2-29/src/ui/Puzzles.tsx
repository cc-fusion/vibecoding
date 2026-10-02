import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '../game/audio';
import type { PuzzleReq } from '../game/engine';

const GLYPHS = ['△', '◯', '◇', '☐'];
const GCOL = ['#ff8d6b', '#7cc7ff', '#9dff8a', '#ffd86b'];

function useKey(fn: (e: KeyboardEvent) => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const h = (e: KeyboardEvent) => ref.current(e);
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, []);
}

/* ---------------- Glyph Echo ---------------- */
function Echo({ level, done }: { level: number; done: (ok: boolean) => void }) {
  const len = 3 + Math.min(4, Math.round(level * 0.8));
  const seq = useMemo(() => Array.from({ length: len }, () => Math.floor(Math.random() * 4)), [len]);
  const [phase, setPhase] = useState<'show' | 'input'>('show');
  const [lit, setLit] = useState(-1);
  const [pos, setPos] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [round, setRound] = useState(0);
  const [msg, setMsg] = useState('Watch the sequence…');

  useEffect(() => {
    setPhase('show');
    setMsg('Watch the sequence…');
    const ids: number[] = [];
    seq.forEach((g, i) => {
      ids.push(window.setTimeout(() => { setLit(g); audio.glyph(g); }, 700 + i * 700));
      ids.push(window.setTimeout(() => setLit(-1), 700 + i * 700 + 450));
    });
    ids.push(window.setTimeout(() => { setPhase('input'); setMsg('Repeat the echo'); }, 700 + seq.length * 700));
    return () => ids.forEach(clearTimeout);
  }, [round, seq]);

  const press = useCallback((g: number) => {
    if (phase !== 'input') return;
    audio.glyph(g);
    setLit(g);
    window.setTimeout(() => setLit(-1), 180);
    if (g === seq[pos]) {
      if (pos + 1 === seq.length) { setMsg('Echo accepted'); setPhase('show'); window.setTimeout(() => done(true), 400); }
      else setPos(pos + 1);
    } else {
      audio.play('deny');
      const s = strikes + 1;
      setStrikes(s);
      if (s >= 3) { done(false); return; }
      setPos(0);
      setRound((r) => r + 1);
      setMsg(`Wrong glyph! Strike ${s}/3`);
    }
  }, [phase, pos, seq, strikes, done]);

  useKey((e) => {
    const m: Record<string, number> = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, KeyW: 0, KeyD: 1, KeyS: 2, KeyA: 3 };
    if (e.code in m) { e.preventDefault(); press(m[e.code]); }
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-cyan-100/80 text-sm text-center">{msg} <span className="text-amber-300">Strikes: {'✖'.repeat(strikes) || '—'}</span></p>
      <div className="grid grid-cols-2 gap-3">
        {GLYPHS.map((g, i) => (
          <button
            key={i}
            onClick={() => press(i)}
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl text-5xl border-2 transition-all duration-150 active:scale-95"
            style={{
              borderColor: GCOL[i],
              color: lit === i ? '#05121c' : GCOL[i],
              background: lit === i ? GCOL[i] : 'rgba(5,20,32,0.8)',
              boxShadow: lit === i ? `0 0 40px ${GCOL[i]}` : 'none',
              transform: lit === i ? 'scale(1.08)' : undefined,
            }}
          >
            {g}
            <div className="text-xs opacity-60">{i + 1}</div>
          </button>
        ))}
      </div>
      <p className="text-xs text-cyan-200/60">Click, or press 1–4 / arrow keys · Progress {pos}/{seq.length}</p>
    </div>
  );
}

/* ---------------- Ring Lock ---------------- */
function Rings({ level, done }: { level: number; done: (ok: boolean) => void }) {
  const n = level >= 3 ? 4 : 3;
  const init = useMemo(() => {
    const pos = Array(n).fill(0) as number[];
    const mv = (i: number, d: number) => { pos[i] += d; pos[(i + 1) % n] -= d; };
    const k = 4 + level * 2;
    for (let j = 0; j < k; j++) mv(Math.floor(Math.random() * n), Math.random() < 0.5 ? 1 : -1);
    if (pos.every((p) => ((p % 12) + 12) % 12 === 0)) mv(0, 1);
    return pos;
  }, [n, level]);
  const [pos, setPos] = useState<number[]>(init);
  const [sel, setSel] = useState(0);
  const [moves, setMoves] = useState(0);
  const finished = useRef(false);

  const rotate = useCallback((dir: number) => {
    if (finished.current) return;
    audio.play('click');
    audio.tone(300 + sel * 80 + (dir > 0 ? 40 : 0), 0.1, 'triangle', 0.1);
    setMoves((m) => m + 1);
    setPos((p) => {
      const np = p.slice();
      np[sel] += dir;
      np[(sel + 1) % n] -= dir;
      if (np.every((v) => ((v % 12) + 12) % 12 === 0)) { finished.current = true; window.setTimeout(() => done(true), 450); }
      return np;
    });
  }, [sel, n, done]);

  useKey((e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); rotate(-1); }
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); rotate(1); }
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); setSel((s) => (s + n - 1) % n); }
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); setSel((s) => (s + 1) % n); }
  });

  const radii = [138, 106, 74, 42];
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-cyan-100/80 text-sm text-center max-w-sm">Align every gold notch with the top marker. Turning a ring also nudges the ring <b>inside</b> it the opposite way.</p>
      <svg viewBox="-160 -160 320 320" className="w-72 h-72 sm:w-80 sm:h-80">
        <polygon points="-8,-158 8,-158 0,-146" fill="#ff8d6b" />
        {Array.from({ length: n }, (_, i) => {
          const r = radii[i];
          const solved = ((pos[i] % 12) + 12) % 12 === 0;
          return (
            <g key={i} style={{ transform: `rotate(${pos[i] * 30}deg)`, transition: 'transform 0.25s cubic-bezier(.2,.9,.3,1.3)' }}>
              <circle r={r} fill="none" stroke={sel === i ? '#7cc7ff' : '#2d4a60'} strokeWidth={22} opacity={0.9} />
              <circle r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={22} strokeDasharray="2 28" />
              <circle r={r} fill="none" stroke="transparent" strokeWidth={26} style={{ cursor: 'pointer' }} onClick={() => setSel(i)} />
              <circle cx={0} cy={-r} r={8} fill={solved ? '#6dffb0' : '#ffd86b'} />
              {Array.from({ length: 12 }, (_, k) => <circle key={k} cx={Math.sin((k * Math.PI) / 6) * r} cy={-Math.cos((k * Math.PI) / 6) * r} r={1.8} fill="#9fd0ee" opacity={0.6} />)}
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-3">
        <button className="px-4 py-2 rounded bg-cyan-900/70 border border-cyan-400/40 hover:bg-cyan-800" onClick={() => setSel((s) => (s + n - 1) % n)}>▲ Outer</button>
        <button className="px-4 py-2 rounded bg-cyan-900/70 border border-cyan-400/40 hover:bg-cyan-800" onClick={() => rotate(-1)}>◀ Turn</button>
        <button className="px-4 py-2 rounded bg-cyan-900/70 border border-cyan-400/40 hover:bg-cyan-800" onClick={() => rotate(1)}>Turn ▶</button>
        <button className="px-4 py-2 rounded bg-cyan-900/70 border border-cyan-400/40 hover:bg-cyan-800" onClick={() => setSel((s) => (s + 1) % n)}>▼ Inner</button>
      </div>
      <p className="text-xs text-cyan-200/60">←/→ turn · ↑/↓ choose ring · Moves {moves}</p>
    </div>
  );
}

/* ---------------- Resonance Grid ---------------- */
function Grid({ level, done }: { level: number; done: (ok: boolean) => void }) {
  const n = level >= 3 ? 4 : 3;
  const init = useMemo(() => {
    const g = Array(n * n).fill(true) as boolean[];
    const tog = (i: number) => {
      const x = i % n, y = Math.floor(i / n);
      [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < n && yy < n) g[yy * n + xx] = !g[yy * n + xx];
      });
    };
    const k = 3 + level;
    for (let j = 0; j < k; j++) tog(Math.floor(Math.random() * n * n));
    if (g.every(Boolean)) tog(0);
    return g;
  }, [n, level]);
  const [g, setG] = useState<boolean[]>(init);
  const [cur, setCur] = useState(0);
  const finished = useRef(false);

  const press = useCallback((i: number) => {
    if (finished.current) return;
    audio.tone(260 + i * 30, 0.12, 'triangle', 0.14);
    setG((old) => {
      const ng = old.slice();
      const x = i % n, y = Math.floor(i / n);
      [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < n && yy < n) ng[yy * n + xx] = !ng[yy * n + xx];
      });
      if (ng.every(Boolean)) { finished.current = true; window.setTimeout(() => done(true), 450); }
      return ng;
    });
  }, [n, done]);

  useKey((e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); setCur((c) => (c % n === 0 ? c : c - 1)); }
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); setCur((c) => (c % n === n - 1 ? c : c + 1)); }
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); setCur((c) => (c - n < 0 ? c : c - n)); }
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); setCur((c) => (c + n >= n * n ? c : c + n)); }
    else if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); press(cur); }
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-cyan-100/80 text-sm text-center max-w-sm">Light every resonator. Pressing a cell flips it and its four neighbours.</p>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {g.map((on, i) => (
          <button
            key={i}
            onClick={() => { setCur(i); press(i); }}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 transition-all duration-200"
            style={{
              background: on ? 'radial-gradient(circle,#c8fff0,#2fd4b0)' : 'rgba(6,22,34,0.9)',
              borderColor: cur === i ? '#ffd86b' : on ? '#6dffd0' : '#274a60',
              boxShadow: on ? '0 0 22px rgba(109,255,208,0.6)' : 'none',
            }}
          />
        ))}
      </div>
      <p className="text-xs text-cyan-200/60">Click, or arrows + Space</p>
    </div>
  );
}

const TITLES = { echo: 'Glyph Echo', rings: 'Ring Lock', grid: 'Resonance Grid' } as const;

export function PuzzleOverlay({ req, onDone }: { req: PuzzleReq; onDone: (r: boolean | null) => void }) {
  const limit = Math.max(30, 56 - req.level * 3);
  const [left, setLeft] = useState(limit);
  const fin = useRef(false);
  const finish = useCallback((r: boolean | null) => {
    if (fin.current) return;
    fin.current = true;
    if (r === true) audio.play('good');
    onDone(r);
  }, [onDone]);

  useEffect(() => {
    const id = window.setInterval(() => setLeft((l) => l - 0.1), 100);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (left <= 0) finish(false); }, [left, finish]);
  useKey((e) => { if (e.code === 'Escape') { e.preventDefault(); finish(null); } });

  const done = useCallback((ok: boolean) => finish(ok), [finish]);
  const frac = Math.max(0, left / limit);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/65 backdrop-blur-sm p-3 overflow-auto">
      <div className="relative w-full max-w-lg rounded-2xl border border-cyan-300/30 bg-gradient-to-b from-[#0b2233] to-[#05111c] p-5 shadow-[0_0_60px_rgba(80,220,255,0.25)]">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-cyan-100" style={{ fontFamily: 'Cinzel, Georgia, serif' }}>Ancient Terminal — {TITLES[req.kind]}</h2>
          <button className="text-xs px-2 py-1 rounded border border-cyan-300/30 text-cyan-100 hover:bg-cyan-900" onClick={() => finish(null)}>Esc · Step away</button>
        </div>
        <div className="h-2 rounded bg-black/50 overflow-hidden mb-1">
          <div className="h-full transition-all duration-100" style={{ width: `${frac * 100}%`, background: frac < 0.25 ? '#ff5a5a' : '#6adfff' }} />
        </div>
        <p className="text-[11px] text-amber-200/80 mb-3">The sea is still moving outside — air and creatures do not wait. Failure triggers a feedback surge.</p>
        {req.kind === 'echo' && <Echo level={req.level} done={done} />}
        {req.kind === 'rings' && <Rings level={req.level} done={done} />}
        {req.kind === 'grid' && <Grid level={req.level} done={done} />}
      </div>
    </div>
  );
}
