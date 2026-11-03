import { B, BLOCKS } from '../game/blocks';

interface Props { id: number; size?: number; className?: string; }

export function ItemIcon({ id, size = 42, className = '' }: Props) {
  const def = BLOCKS[id];
  if (!def || id === B.AIR) return null;
  const shared = { width: size, height: size, viewBox: '0 0 48 48', className: `item-icon ${className}`, 'aria-hidden': true as const };
  if ([B.WOOD_PICK, B.STONE_PICK, B.IRON_PICK, B.AXE].includes(id as never)) {
    return <svg {...shared} shapeRendering="crispEdges">
      <path d="M10 35h5v-5h5v-5h5v-5h5v-5h-7v5h-5v5h-5v5h-3z" fill="#805d36" />
      <path d="M12 33h4v-5h5v-5h5v-5h-3v4h-5v5h-5z" fill="#bd9960" />
      {id === B.AXE ? <><path d="M21 7h13v5h6v14H29v-5h-5V15h-6V9h3z" fill="#6e7466" /><path d="M23 7h11v6h5v10H29v-6h-8v-5h-3V9h5z" fill={def.color} /><path d="M29 9h4v5h4v5h-4v-4h-4z" fill="#e5d8b8" opacity=".5" /></> : <><path d="M13 7h16v4h8v5h5v13h-6V19h-5v-4H19v-3h-9V8h3z" fill="#686c5e" /><path d="M12 6h17v4h8v5h5v10h-4v-9h-7v-4H18V9h-8V7h2z" fill={def.color} /><path d="M16 6h13v3H16zM32 11h5v3h-5z" fill="#fff8df" opacity=".4" /></>}
    </svg>;
  }
  if (id === B.APPLE) return <svg {...shared} shapeRendering="crispEdges"><path d="M23 6h4v8h-4z" fill="#78613a" /><path d="M28 7h9v5h-9v3h-5v-5h5z" fill="#759b57" /><path d="M10 15h10v3h8v-3h10v5h4v15h-5v6H14v-5H9V20h1z" fill="#ab5145" /><path d="M12 15h9v3h8v-3h8v6h4v12h-5v6H16v-5h-5V21h1z" fill="#d47758" /><path d="M15 20h5v4h-3v7h-4V23h2z" fill="#edb183" /><path d="M22 35h13v4H22z" fill="#ba5e46" /></svg>;
  if (id === B.STICK) return <svg {...shared} shapeRendering="crispEdges"><path d="M9 34h6v-6h6v-6h6v-6h6v-6h6v7h-6v6h-6v6h-6v6h-6v6H9z" fill="#87653c" /><path d="M11 34h5v-5h6v-6h6v-6h6v-6h3v5h-6v6h-6v6h-6v6h-6v5h-2z" fill="#c6a16a" /></svg>;
  if (id === B.TORCH) return <svg {...shared} shapeRendering="crispEdges"><path d="M20 19h8v24h-8z" fill="#96703e" /><path d="M21 22h3v19h-3z" fill="#c5a16a" /><path d="M17 9h4V4h6v5h5v7h-3v8H18v-7h-3v-5h2z" fill="#df9d43" /><path d="M20 9h3V6h3v7h4v5h-3v4h-7v-7h-2v-3h2z" fill="#f8ca69" /><path d="M23 13h4v7h-5v-4h1z" fill="#fff0ba" /></svg>;
  if (id === B.INGOT) return <svg {...shared} shapeRendering="crispEdges"><path d="m8 22 10-10h22l3 13-9 11H7z" fill="#8d9d91" /><path d="m9 22 10-9h20l-9 10z" fill="#e0e5d8" /><path d="m9 23 21 1 4 10H9z" fill="#bac5b5" /><path d="m31 24 9-10 3 11-9 10z" fill="#a3b19f" /><path d="M15 18h16v2H13z" fill="#f6f5e6" /></svg>;
  if (id === B.BLOOM || id === B.FLOWER) return <svg {...shared} shapeRendering="crispEdges"><path d="M22 19h4v25h-4zM13 28h10v4h-7v-2h-3zM26 23h9v5h-9z" fill="#6e934b" /><path d="M19 5h11v6h6v11h-7v6H18v-6h-6V11h7z" fill="#efcd8b" /><path d="M20 12h9v9h-9z" fill="#ce9363" /><path d="M23 14h4v5h-4z" fill="#f9e6ab" /></svg>;
  if (id === B.CAMPFIRE) return <svg {...shared} shapeRendering="crispEdges"><path d="m9 30 27 10 4-7-28-9z" fill="#8f6941" /><path d="m9 35 4 5 28-11-4-5z" fill="#b39160" /><path d="M18 25V15h5V7h5v8h6v10h-4v7H19v-7z" fill="#de9b49" /><path d="M22 18h5v-5h3v9h-3v8h-6v-7h1z" fill="#f7d17e" /></svg>;
  const top = def.top || def.color;
  return <svg {...shared} shapeRendering="crispEdges">
    <path d="m24 4 19 10v22L24 46 5 36V14z" fill="#33412d" opacity=".16" transform="translate(0 1)" />
    <path d="m24 3 19 10-19 10L5 13z" fill={top} />
    <path d="m5 13 19 10v22L5 35z" fill={def.side || def.color} />
    <path d="m24 23 19-10v22L24 45z" fill={def.side || def.color} />
    <path d="m24 23 19-10v22L24 45z" fill="#18311b" opacity=".18" />
    {id === B.GRASS && <><path d="m5 13 19 10v7l-5-3v-3l-5-2v3l-5-3v-3l-4-2z" fill="#92ac60" /><path d="m24 23 19-10v5l-5 3v3l-5 2v-2l-5 3v3l-4 2z" fill="#75964e" /></>}
    {[B.LOG, B.BIRCH].includes(id as never) && <><path d="m24 7 11 6-11 6-11-6z" fill="none" stroke="#8b7049" strokeWidth="1.5" /><path d="m24 10 6 3-6 3-6-3z" fill="none" stroke="#8b7049" strokeWidth="1" /><path d="m10 19 2 1v16l-2-1zM18 23l2 1v16l-2-1zM30 23l2-1v15l-2 1zM37 19l2-1v15l-2 1z" fill={id === B.BIRCH ? '#727c68' : '#644c32'} opacity=".65" /></>}
    {[B.PLANKS, B.BENCH].includes(id as never) && <><path d="m5 20 19 10 19-10v2L24 32 5 22zm0 8 19 10 19-10v2L24 40 5 30z" fill="#8b704b" opacity=".7" /><path d="m14 9 19 10 2-1L16 8zm-4 2 19 10 2-1-19-10z" fill="#ae8a59" /></>}
    {[B.STONE, B.COBBLE, B.BRICK, B.COAL, B.IRON, B.FURNACE].includes(id as never) && <><path d="m9 23 5 2v4l-5-2zm8 10 4 2v4l-4-2zm13-4 5-3v4l-5 3zm7 2 4-2v4l-4 2z" fill="#52624f" opacity=".23" /><path d="m17 10 5-2 4 2-5 3zm12 5 6-3 3 2-6 3z" fill="#fffbe7" opacity=".24" /></>}
    {[B.LEAVES, B.GOLD_LEAVES, B.PINE_LEAVES].includes(id as never) && <><path d="m7 17 5 2v4l-5-2zm8 11 5 2v4l-5-2zm14 1 5-3v4l-5 3zm9-8 4-2v5l-4 2z" fill="#d3dd97" opacity=".4" /><path d="m14 12 5-3 5 3-5 3zm13 4 5-3 4 2-5 3z" fill="#d3dd97" opacity=".45" /></>}
    {id === B.GLASS && <><path d="m7 16 15 8v17L7 33zm19 8 15-8v17l-15 8z" fill="none" stroke="#e3f0da" strokeWidth="1.5" /><path d="m10 20 2 1v7l-2-1zm20 7 2-1v8l-2 1z" fill="#eff6e7" /></>}
    {id === B.BENCH && <path d="m14 8 19 10m-14-13 19 10M11 16 30 6m-13 13L36 9" stroke="#735839" strokeWidth="1.5" />}
    {id === B.FURNACE && <><path d="m8 24 13 7v10L8 34z" fill="#35483d" /><path d="m11 31 8 4v3l-8-4z" fill="#d49b52" /></>}
    <path d="m5 13 19 10 19-10M24 23v22" fill="none" stroke="#fffde3" strokeWidth=".6" opacity=".2" />
  </svg>;
}

export function WorldMark({ size = 36 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="m20 3 16 9v17l-16 9L4 29V12z" stroke="currentColor" strokeWidth="1.4" /><path d="m4 12 16 9 16-9M20 21v17M12 8l16 9v8l-8 5" stroke="currentColor" strokeWidth="1.4" /><path d="m20 7 10 5-10 6-10-6z" fill="currentColor" opacity=".24" /><path d="M19 9v6m-3-4 3 2 4-3" stroke="currentColor" strokeWidth="1.2" /></svg>;
}