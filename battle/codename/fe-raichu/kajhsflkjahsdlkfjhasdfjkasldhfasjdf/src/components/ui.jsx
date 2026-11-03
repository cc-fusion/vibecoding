import { useState } from 'react';
import { Check, Copy, ArrowUpRight, X, ChevronRight, Sparkles, Zap, Box, Droplets, Circle, Waves } from 'lucide-react';

export function Logo({ small = false }) {
  return <span className={`brand ${small ? 'brand-small' : ''}`}><span className="brand-symbol"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 4 28 11 16 18 4 11 16 4Z" fill="currentColor"/><path d="m4 16 12 7 12-7M4 21l12 7 12-7" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/></svg></span>{!small && <span className="brand-name">taichi<span className="brand-dot">.</span><span className="brand-caption">PHYSICS PLAYGROUND</span></span>}</span>;
}
export function Toggle({ checked, onChange, label, disabled = false }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={checked} disabled={disabled} className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}><span /></button>;
}
export function Pill({ children, variant = 'neutral' }) { return <span className={`pill ${variant}`}>{children}</span>; }
export function ScenePreview({ scene, large = false }) {
  const id = typeof scene === 'string' ? scene : scene?.id;
  const points = Array.from({ length: large ? 380 : 200 }, (_, i) => {
    const a = Math.sin(i * 127.1 + 17.3) * 43758.5453;
    const b = Math.sin(i * 311.7 + 7.8) * 97531.243;
    return [a - Math.floor(a), b - Math.floor(b)];
  });
  const isWheel = id?.includes('wheel') || id?.includes('stir') || id === 'my-first-scene';
  const isWater = id?.includes('water') || id === 'buoyancy' || id?.includes('rigid-pile');
  const colors = isWater ? ['#60b6ee', '#9bcefa', '#4f8dd3'] : isWheel ? ['#ddae72', '#e8c895', '#b28a59'] : ['#c991cf', '#91b4e9', '#90c6b1'];
  return <div className={`scene-preview ${large ? 'large' : ''}`} aria-hidden="true"><svg viewBox="0 0 360 180" fill="none">
    <defs><pattern id={`grid-${id}`} width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" stroke="#b8c5e5" strokeOpacity=".055" strokeWidth=".7"/></pattern><radialGradient id={`glow-${id}`}><stop stopColor={isWater ? '#285178' : '#5c3a6a'} stopOpacity=".2"/><stop offset="1" stopColor="#101722" stopOpacity="0"/></radialGradient></defs>
    <rect width="360" height="180" fill="#101722"/><rect width="360" height="180" fill={`url(#grid-${id})`}/><ellipse cx="180" cy="95" rx="150" ry="100" fill={`url(#glow-${id})`}/>
    {isWheel ? <g>
      <circle cx="180" cy="94" r="51" stroke="#a78d76" strokeWidth="1.4"/><circle cx="180" cy="94" r="43" stroke="#b89e7b" strokeOpacity=".6" strokeWidth=".6"/>
      {Array.from({length:12},(_,i)=><line key={i} x1="180" y1="94" x2={180+51*Math.cos(i*Math.PI/6)} y2={94+51*Math.sin(i*Math.PI/6)} stroke="#c3ab86" strokeWidth="1.6"/>)}
      <circle cx="180" cy="94" r="5" stroke="#d4b591" strokeWidth="2"/>
      {points.slice(0,120).map(([x,y],i)=><circle key={i} cx={145+x*72} cy={16+y*40} r={.8+x*.6} fill={colors[i%3]} opacity={.35+x*.6}/>)}</g>
    : isWater ? <g>
      <path d="M91 65h178v70H91z" stroke="#596f87" strokeWidth="1"/><path d="M91 107c20-17 34 5 53-2s28-11 45-1 29-4 45-6 24 2 35 4v34H91Z" fill="#3870a2" fillOpacity=".25"/>
      {points.map(([x,y],i)=><circle key={i} cx={94+x*172} cy={106+y*28} r=".8" fill={colors[i%3]} opacity={.3+y*.55}/>)}
      <rect x="122" y="75" width="22" height="19" rx="2" fill="#d8ba7b" transform="rotate(14 133 84)"/><rect x="205" y="89" width="23" height="19" rx="2" fill="#b1c9d7" transform="rotate(-12 216 98)"/></g>
    : <g>
      <path d="M90 135 130 122M150 132 195 122M237 135 274 122" stroke="#9cabbf" strokeWidth="1.8"/>
      {points.map(([x,y],i)=>{const col=i%3;return <circle key={i} cx={96+col*58+x*32} cy={51+col*6+y*47} r=".8" fill={colors[col]} opacity={.4+y*.55}/>;})}
    </g>}
    <path d="M24 147v-10m0 10h10M336 33v-10m0 10h-10" stroke="#8995b0" strokeOpacity=".4"/>
    <text x="24" y="29" fill="#8290a6" fontSize="9" fontFamily="monospace">{scene?.dim === 3 || id?.endsWith('3d') ? '3D' : '2D'} / {isWheel ? 'MOTION' : isWater ? 'FLUID' : 'MATERIALS'}</text>
  </svg></div>;
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const area = document.createElement('textarea');area.value = text;area.style.position = 'fixed';area.style.opacity = '0';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();
  }
}
export function CodeBlock({ code, language = 'javascript', title, compact = false }) {
  const [copied, setCopied] = useState(false);
  const parts = code.split(/(\/\/[^\n]*|"[^"\n]*"|'[^'\n]*'|\b(?:const|let|await|async|function|return|new|true|false|import|from)\b|\b\d+(?:\.\d+)?\b)/g);
  return <div className={`code-block ${compact ? 'compact' : ''}`}>
    <div className="code-toolbar"><span>{title || language}</span><button aria-label="Copy code" onClick={async () => {await copyText(code);setCopied(true);setTimeout(()=>setCopied(false),1800);}}>{copied ? <Check size={14}/> : <Copy size={14}/>}<span>{copied ? 'Copied' : 'Copy'}</span></button></div>
    <pre><code>{parts.map((part,i)=><span key={i} className={part.startsWith('//')?'token-comment':/^['"]/.test(part)?'token-string':/^(const|let|await|async|function|return|new|true|false|import|from)$/.test(part)?'token-keyword':/^\d/.test(part)?'token-number':''}>{part}</span>)}</code></pre>
  </div>;
}
export function SectionHeading({ eyebrow, title, description, children }) { return <div className="page-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{description}</p></div><div className="page-actions">{children}</div></div>; }
export function EmptyState({ title, description, onReset }) { return <div className="empty-state"><Box size={32}/><h3>{title}</h3><p>{description}</p>{onReset && <button className="button secondary" onClick={onReset}>Clear filters</button>}</div>; }
export function download(content, filename, type = 'application/json') { const blob = new Blob([content], {type}); const url = URL.createObjectURL(blob); const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }

export function Github({size=16}) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 19c-4.5 1.5-4.5-2.5-6-3m12 6v-3.9c0-1.1-.4-2-1-2.5 3.3-.4 6.7-1.6 6.7-7.4A5.8 5.8 0 0 0 19.2 4a5.4 5.4 0 0 0-.1-4S17.8-.4 15 1.5a13.4 13.4 0 0 0-7 0C5.2-.4 3.9 0 3.9 0a5.4 5.4 0 0 0-.1 4 5.8 5.8 0 0 0-1.5 4.2c0 5.8 3.4 7 6.7 7.4-.6.5-1 1.4-1 2.5V22" transform="translate(1 1) scale(.9)"/></svg>; }
