export function Gauge({ pressure, rateMul }: { pressure: number; rateMul: number }) {
  const cx = 100;
  const cy = 100;
  const pt = (p: number, r: number) => {
    const a = ((180 - p * 1.8) * Math.PI) / 180;
    return [cx + Math.cos(a) * r, cy - Math.sin(a) * r];
  };
  const arc = (p1: number, p2: number, r: number) => {
    const [x1, y1] = pt(p1, r);
    const [x2, y2] = pt(p2, r);
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };
  const p = Math.max(0, Math.min(100, pressure));
  const needleDeg = -90 + p * 1.8;
  const crit = p > 75;
  return (
    <div className={crit ? 'tremble' : ''}>
      <svg viewBox="0 0 200 124" className="w-full max-w-[260px]">
        <path d={arc(0, 100, 84)} stroke="#120c07" strokeWidth={22} fill="none" strokeLinecap="round" />
        <path d={arc(0, 60, 84)} stroke="#3b8f5a" strokeWidth={14} fill="none" />
        <path d={arc(60, 80, 84)} stroke="#d9a21b" strokeWidth={14} fill="none" />
        <path d={arc(80, 100, 84)} stroke="#d1342a" strokeWidth={14} fill="none" />
        {Array.from({ length: 11 }, (_, k) => k * 10).map((v) => {
          const [x1, y1] = pt(v, 70);
          const [x2, y2] = pt(v, 62);
          return <line key={v} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e9d9ae" strokeWidth={v % 50 === 0 ? 3 : 1.5} />;
        })}
        <path d={arc(0, p, 84)} stroke="#ffffff" strokeOpacity={0.25} strokeWidth={4} fill="none" />
        <g style={{ transform: `rotate(${needleDeg}deg)`, transformOrigin: '100px 100px', transition: 'transform 0.15s linear' }}>
          <polygon points="97,100 103,100 100,28" fill="#f1e3c0" stroke="#000" strokeWidth={1} />
        </g>
        <circle cx={100} cy={100} r={9} fill="#b98a2e" stroke="#24160a" strokeWidth={3} />
        <text x={100} y={86} textAnchor="middle" fontSize={20} fontWeight={900} fill={crit ? '#ff6b5e' : '#f1e3c0'} fontFamily="ui-monospace, monospace">
          {Math.floor(p)}%
        </text>
        <text x={100} y={121} textAnchor="middle" fontSize={10} fill={rateMul > 1.05 ? '#ff9a5e' : '#a8967a'} fontFamily="ui-monospace, monospace">
          {rateMul > 1.05 ? `HEATING x${rateMul.toFixed(1)}` : 'BOILER PRESSURE'}
        </text>
      </svg>
    </div>
  );
}

export type RobotMood = 'idle' | 'working' | 'critical' | 'fixed' | 'boom';

export function Robot({ mood, size = 110, seed = 0 }: { mood: RobotMood; size?: number; seed?: number }) {
  const eye = mood === 'fixed' ? '#4ade80' : mood === 'critical' || mood === 'boom' ? '#ff4a3a' : mood === 'working' ? '#ffd45c' : '#9a8a6a';
  const hue = [0, 12, -10, 20, -20, 8, 30, -30][seed % 8];
  const body = `hsl(${32 + hue} 55% 42%)`;
  const dark = `hsl(${32 + hue} 55% 20%)`;
  const light = `hsl(${32 + hue} 60% 62%)`;
  return (
    <svg viewBox="0 0 120 140" width={size} height={size * 1.16} className={mood === 'fixed' ? 'dance' : mood === 'critical' ? 'tremble' : mood === 'idle' ? 'float' : ''}>
      {/* antenna */}
      <line x1={60} y1={8} x2={60} y2={26} stroke={dark} strokeWidth={4} />
      <circle cx={60} cy={8} r={6} fill={mood === 'critical' ? '#ff4a3a' : mood === 'fixed' ? '#4ade80' : '#d9a21b'} />
      {/* head */}
      <rect x={28} y={26} width={64} height={46} rx={10} fill={body} stroke={dark} strokeWidth={4} />
      <rect x={34} y={31} width={52} height={8} rx={4} fill={light} opacity={0.5} />
      <circle cx={46} cy={50} r={9} fill="#161008" stroke={dark} strokeWidth={2} />
      <circle cx={74} cy={50} r={9} fill="#161008" stroke={dark} strokeWidth={2} />
      <circle cx={46} cy={50} r={mood === 'boom' ? 2 : 5.5} fill={eye} style={{ filter: `drop-shadow(0 0 4px ${eye})` }} />
      <circle cx={74} cy={50} r={mood === 'boom' ? 2 : 5.5} fill={eye} style={{ filter: `drop-shadow(0 0 4px ${eye})` }} />
      {mood === 'fixed' ? (
        <path d="M46 63 Q60 72 74 63" stroke={dark} strokeWidth={3.5} fill="none" strokeLinecap="round" />
      ) : mood === 'critical' || mood === 'boom' ? (
        <path d="M46 66 L52 61 L58 66 L64 61 L70 66 L74 62" stroke={dark} strokeWidth={3} fill="none" strokeLinejoin="round" />
      ) : (
        <path d="M48 64 H72" stroke={dark} strokeWidth={3.5} strokeLinecap="round" />
      )}
      {/* neck + body */}
      <rect x={52} y={72} width={16} height={8} fill={dark} />
      <rect x={24} y={80} width={72} height={46} rx={8} fill={body} stroke={dark} strokeWidth={4} />
      <circle cx={60} cy={103} r={14} fill="#161008" stroke={dark} strokeWidth={3} />
      <circle cx={60} cy={103} r={9} fill={mood === 'fixed' ? '#2f7a47' : mood === 'critical' ? '#a02a20' : '#7a5a18'} className={mood === 'working' || mood === 'critical' ? 'flicker' : ''} />
      <path d="M60 94 V103 L67 107" stroke="#ffe9a0" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      {/* arms */}
      <rect x={8} y={84} width={14} height={34} rx={6} fill={body} stroke={dark} strokeWidth={3} />
      <rect x={98} y={84} width={14} height={34} rx={6} fill={body} stroke={dark} strokeWidth={3} />
      {/* legs */}
      <rect x={34} y={126} width={14} height={12} fill={dark} />
      <rect x={72} y={126} width={14} height={12} fill={dark} />
      {/* ear steam */}
      {(mood === 'critical' || mood === 'boom') && (
        <g>
          <circle cx={22} cy={46} r={7} fill="#e6fbff" className="puff" />
          <circle cx={98} cy={46} r={7} fill="#e6fbff" className="puff" style={{ animationDelay: '.4s' }} />
        </g>
      )}
    </svg>
  );
}
