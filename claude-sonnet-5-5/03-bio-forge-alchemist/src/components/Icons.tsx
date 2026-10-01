import { ING, type IngId, EL_ORDER, type El } from "../game/data";

export function IngIcon({ id, size = 24, className = "" }: { id: IngId; size?: number; className?: string }) {
  const d = ING[id];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={{ filter: `drop-shadow(0 0 3px ${d.color}88)` }}>
      <path d={d.path} fill={d.color} stroke="rgba(0,0,0,.45)" strokeWidth="0.8" strokeLinejoin="round" />
    </svg>
  );
}

export function keyColors(key: string): string[] {
  if (key === "X") return ["#b14cff", "#46e08a"];
  const cols = EL_ORDER.filter((e) => key.includes(e)).map((e) => ING[e as El].color);
  return cols.length ? cols : ["#888"];
}

let uid = 0;

export function PotionIcon({ k, tier = 1, size = 40 }: { k: string; tier?: number; size?: number }) {
  const cols = keyColors(k);
  const id = `pg${(uid = (uid + 1) % 100000)}`;
  const c1 = cols[0];
  const c2 = cols[1] ?? cols[0];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ filter: `drop-shadow(0 0 ${2 + tier * 2}px ${c1}99)` }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect x="15" y="3" width="10" height="5" rx="1.5" fill="#8a6a3f" />
      <path d="M16 8h8v8l7 12a5 5 0 0 1-4.3 7.5H13.3A5 5 0 0 1 9 28l7-12z" fill="rgba(200,230,255,.18)" stroke="#dbeafe" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M12.3 24h15.4l3 5a4 4 0 0 1-3.4 5.8H12.7A4 4 0 0 1 9.3 29z" fill={`url(#${id})`} opacity="0.95" />
      {k === "X" && (
        <>
          <circle cx="16" cy="29" r="1.6" fill="#fff" opacity=".7" />
          <circle cx="23" cy="31" r="1.2" fill="#fff" opacity=".7" />
          <circle cx="20" cy="26" r="1" fill="#fff" opacity=".7" />
        </>
      )}
      <path d="M14 20l-1.5 4" stroke="#fff" strokeOpacity=".5" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function Pips({ tier, max = 3 }: { tier: number; max?: number }) {
  return (
    <span className="inline-flex gap-0.5 align-middle">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={`inline-block h-1.5 w-1.5 rounded-full ${i < tier ? "bg-amber-300 shadow-[0_0_4px_#fbbf24]" : "bg-white/15"}`} />
      ))}
    </span>
  );
}

export function KeyIcons({ k, size = 16 }: { k: string; size?: number }) {
  if (k === "X") return <span className="text-fuchsia-300 text-xs font-bold">ALL!</span>;
  return (
    <span className="inline-flex gap-0.5">
      {k.split("").map((e) => (
        <IngIcon key={e} id={e as El} size={size} />
      ))}
    </span>
  );
}
