import { useEffect, useRef, useState } from "react";
import { audio } from "../audio";

interface Common { onWin: () => void; onFail: (sus: number) => void; onCancel: () => void }

const shell = "w-full max-w-md rounded-2xl border border-cyan-400/40 bg-[#08101d]/95 p-5 shadow-[0_0_40px_rgba(92,200,255,0.2)]";

export function Keypad({ code, notes, onWin, onFail, onCancel }: Common & { code: string; notes: string[] }) {
  const [val, setVal] = useState("");
  const [tries, setTries] = useState(3);
  const [state, setState] = useState<"idle" | "bad" | "ok">("idle");
  const locked = useRef(false);
  const valRef = useRef("");
  const triesRef = useRef(3);
  const set = (v: string) => { valRef.current = v; setVal(v); };

  const press = (d: string) => {
    if (locked.current || valRef.current.length >= code.length) return;
    audio.sfx("key");
    const nv = valRef.current + d;
    set(nv);
    if (nv.length === code.length) setTimeout(() => check(nv), 150);
  };
  const check = (nv: string) => {
    if (locked.current) return;
    if (nv === code) {
      locked.current = true;
      setState("ok");
      setTimeout(onWin, 400);
    } else {
      setState("bad");
      onFail(6);
      triesRef.current--;
      setTries(triesRef.current);
      if (triesRef.current <= 0) { locked.current = true; onFail(25); setTimeout(onCancel, 700); }
      setTimeout(() => { set(""); setState("idle"); }, 500);
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") set(valRef.current.slice(0, -1));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  return (
    <div className={shell}>
      <h3 className="mb-1 text-center text-lg font-bold tracking-widest text-cyan-300">KEYPAD LOCK</h3>
      <p className="mb-3 text-center text-xs text-slate-400">Enter the {code.length}-digit code. Attempts left: <b className={tries < 2 ? "text-red-400" : "text-amber-300"}>{tries}</b></p>
      <div className={`mb-4 rounded-lg border bg-black/60 py-3 text-center font-mono text-3xl tracking-[0.6em] ${state === "bad" ? "animate-pulse border-red-500 text-red-400" : state === "ok" ? "border-emerald-400 text-emerald-300" : "border-cyan-500/40 text-cyan-200"}`}>
        {val.padEnd(code.length, "·")}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map((d) => (
          <button key={d} onClick={() => (d === "C" ? set("") : d === "⌫" ? set(valRef.current.slice(0, -1)) : press(d))}
            className="rounded-lg border border-cyan-500/30 bg-slate-800/80 py-3 font-mono text-xl text-cyan-100 transition hover:bg-cyan-500/20 active:scale-95">{d}</button>
        ))}
      </div>
      {notes.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/5 p-2 text-xs text-amber-200">
          <b>Journal notes:</b>
          {notes.map((n, i) => <div key={i} className="mt-1">• {n}</div>)}
        </div>
      )}
      <button onClick={onCancel} className="mt-3 w-full rounded-lg py-2 text-sm text-slate-400 hover:text-white">Walk away (Esc)</button>
    </div>
  );
}

const GLYPHS = ["◆", "▲", "●", "■", "✚", "★", "⬟", "⬢", "☾"];
export function Hack({ len, onWin, onFail, onCancel }: Common & { len: number }) {
  const mk = () => Array.from({ length: len }, () => Math.floor(Math.random() * 9));
  const [seq, setSeq] = useState<number[]>(mk);
  const [phase, setPhase] = useState<"show" | "input">("show");
  const [lit, setLit] = useState(-1);
  const [step, setStep] = useState(0);
  const [bad, setBad] = useState(false);
  const [round, setRound] = useState(0);
  useEffect(() => {
    setPhase("show"); setStep(0);
    const timers: number[] = [];
    seq.forEach((c, i) => {
      timers.push(window.setTimeout(() => { setLit(c); audio.sfx("beep"); }, 600 + i * 650));
      timers.push(window.setTimeout(() => setLit(-1), 600 + i * 650 + 400));
    });
    timers.push(window.setTimeout(() => setPhase("input"), 600 + seq.length * 650));
    return () => timers.forEach(clearTimeout);
  }, [seq, round]);
  const click = (c: number) => {
    if (phase !== "input") return;
    setLit(c); setTimeout(() => setLit(-1), 150);
    if (seq[step] === c) {
      audio.sfx("key");
      if (step + 1 >= seq.length) { setTimeout(onWin, 250); setPhase("show"); }
      else setStep(step + 1);
    } else {
      setBad(true); onFail(8);
      setTimeout(() => { setBad(false); setSeq(mk()); setRound((r) => r + 1); }, 600);
      setPhase("show");
    }
  };
  return (
    <div className={shell}>
      <h3 className="mb-1 text-center text-lg font-bold tracking-widest text-cyan-300">INTRUSION</h3>
      <p className="mb-3 text-center text-xs text-slate-400">
        {phase === "show" ? (bad ? "ICE detected your trace! Re-keying…" : "Memorize the signal path…") : `Repeat the path: ${step}/${seq.length}`}
      </p>
      <div className="mx-auto grid max-w-[280px] grid-cols-3 gap-3">
        {GLYPHS.map((g, i) => (
          <button key={i} onClick={() => click(i)}
            className={`aspect-square rounded-xl border text-3xl transition ${lit === i ? "scale-105 border-white bg-cyan-400 text-slate-900 shadow-[0_0_25px_#5cc8ff]" : bad ? "border-red-500/60 bg-red-900/30 text-red-300" : "border-cyan-500/30 bg-slate-800/70 text-cyan-200 hover:bg-slate-700"}`}>{g}</button>
        ))}
      </div>
      <button onClick={onCancel} className="mt-4 w-full rounded-lg py-2 text-sm text-slate-400 hover:text-white">Disconnect (Esc)</button>
    </div>
  );
}

export function Breaker({ order, notes, onWin, onFail, onCancel }: Common & { order: string[]; notes: string[] }) {
  const letters = ["A", "B", "C", "D", "E"];
  const [flipped, setFlipped] = useState<string[]>([]);
  const [zap, setZap] = useState(false);
  const flip = (l: string) => {
    if (flipped.includes(l) || zap) return;
    audio.sfx("key");
    const nf = [...flipped, l];
    if (order[nf.length - 1] !== l) {
      setZap(true); onFail(6);
      setFlipped(nf);
      setTimeout(() => { setZap(false); setFlipped([]); }, 700);
      return;
    }
    setFlipped(nf);
    if (nf.length === order.length) setTimeout(onWin, 350);
  };
  return (
    <div className={shell}>
      <h3 className="mb-1 text-center text-lg font-bold tracking-widest text-amber-300">BREAKER PANEL</h3>
      <p className="mb-3 text-center text-xs text-slate-400">Flip the breakers in the right order. A wrong flip arcs the panel.</p>
      <div className={`flex justify-center gap-3 rounded-xl border p-4 ${zap ? "animate-pulse border-red-500 bg-red-900/30" : "border-amber-400/30 bg-black/40"}`}>
        {letters.map((l) => {
          const on = flipped.includes(l);
          return (
            <button key={l} onClick={() => flip(l)} className="flex flex-col items-center gap-2">
              <div className={`h-20 w-10 rounded-md border-2 transition-all ${on ? "border-emerald-400 bg-emerald-500/30" : "border-slate-500 bg-slate-800"}`}>
                <div className={`mx-auto mt-1 h-8 w-6 rounded bg-slate-300 transition-transform ${on ? "translate-y-9" : ""}`} />
              </div>
              <span className="font-mono text-lg font-bold text-amber-200">{l}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/5 p-2 text-xs text-amber-200">
        {notes.length ? notes.map((n, i) => <div key={i}>• {n}</div>) : "You don't know the correct sequence. Guessing will shock you."}
      </div>
      <button onClick={onCancel} className="mt-3 w-full rounded-lg py-2 text-sm text-slate-400 hover:text-white">Step back (Esc)</button>
    </div>
  );
}

export function Safe({ hits, onWin, onFail, onCancel }: Common & { hits: number }) {
  const [got, setGot] = useState(0);
  const [pos, setPos] = useState(0);
  const [zone, setZone] = useState(0.5);
  const [flash, setFlash] = useState<"" | "ok" | "bad">("");
  const state = useRef({ got: 0, zone: 0.5, pos: 0 });
  const width = Math.max(0.09, 0.2 - got * 0.03);
  useEffect(() => {
    let raf = 0, t0 = performance.now();
    const loop = (ts: number) => {
      const sp = 1.6 + state.current.got * 0.5;
      const p = 0.5 + 0.5 * Math.sin(((ts - t0) / 1000) * sp * 2);
      state.current.pos = p;
      setPos(p);
      raf = requestAnimationFrame(loop);
    };
    t0 = performance.now();
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const newZone = () => { const z = 0.15 + Math.random() * 0.7; state.current.zone = z; setZone(z); };
  useEffect(() => { newZone(); }, []);
  const lock = () => {
    const s = state.current;
    const w = Math.max(0.09, 0.2 - s.got * 0.03);
    if (Math.abs(s.pos - s.zone) <= w / 2) {
      s.got++; setGot(s.got); setFlash("ok"); audio.sfx("right"); newZone();
      if (s.got >= hits) setTimeout(onWin, 350);
    } else {
      setFlash("bad"); onFail(5);
      s.got = Math.max(0, s.got - 1); setGot(s.got);
    }
    setTimeout(() => setFlash(""), 250);
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); lock(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  return (
    <div className={shell}>
      <h3 className="mb-1 text-center text-lg font-bold tracking-widest text-cyan-300">LOCK MECHANISM</h3>
      <p className="mb-3 text-center text-xs text-slate-400">Press SPACE (or the button) when the pick is inside the green tumbler window. Tumblers set: {got}/{hits}</p>
      <div className={`relative mx-auto h-14 w-full overflow-hidden rounded-xl border-2 ${flash === "bad" ? "border-red-500" : flash === "ok" ? "border-emerald-400" : "border-cyan-500/40"} bg-black/60`}>
        <div className="absolute top-0 h-full bg-emerald-500/40" style={{ left: `${(zone - width / 2) * 100}%`, width: `${width * 100}%` }} />
        <div className="absolute top-0 h-full w-1.5 bg-white shadow-[0_0_14px_#fff]" style={{ left: `${pos * 100}%` }} />
      </div>
      <div className="mt-3 flex justify-center gap-2">
        {Array.from({ length: hits }).map((_, i) => <div key={i} className={`h-3 w-8 rounded ${i < got ? "bg-emerald-400" : "bg-slate-700"}`} />)}
      </div>
      <button onClick={lock} className="mt-4 w-full rounded-lg border border-cyan-400/50 bg-cyan-500/20 py-3 font-bold tracking-widest text-cyan-100 hover:bg-cyan-500/30 active:scale-95">SET TUMBLER</button>
      <button onClick={onCancel} className="mt-2 w-full rounded-lg py-2 text-sm text-slate-400 hover:text-white">Give up (Esc)</button>
    </div>
  );
}
