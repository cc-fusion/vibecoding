import { CARD_MAP, TYPE_META, cardName, cardText, type CardInst } from "../game/data";
import { cn } from "../utils/cn";

interface Props {
  inst: CardInst;
  cost?: number;
  ok?: boolean;
  hotkey?: string;
  onClick?: () => void;
  size?: "hand" | "big" | "mini";
  deny?: boolean;
  locked?: boolean;
  selected?: boolean;
  animDelay?: number;
}

export default function CardView({ inst, cost, ok = true, hotkey, onClick, size = "big", deny, locked, selected, animDelay = 0 }: Props) {
  const def = CARD_MAP[inst.id];
  if (!def) return null;
  const meta = TYPE_META[def.type];
  const c = cost ?? def.cost;
  const rarityColor = def.rarity === "rare" ? "#ffd36a" : def.rarity === "uncommon" ? "#9fd0ff" : "#8a7fa8";
  const hand = size === "hand";
  const mini = size === "mini";
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      tabIndex={-1}
      title={cardText(inst)}
      disabled={!onClick}
      style={{
        borderColor: selected ? "#fff" : meta.color,
        background: `linear-gradient(170deg, ${meta.color}26 0%, rgba(14,8,28,0.96) 55%), radial-gradient(circle at 50% 18%, ${meta.glow}, transparent 60%)`,
        animationDelay: animDelay + "s",
      }}
      className={cn(
        "relative flex flex-col items-center text-center border-2 rounded-md overflow-hidden select-none transition-transform text-[#f3ebff] card-in",
        hand && "flex-1 min-w-0 max-w-[150px] h-[104px] sm:h-[148px] px-1 pt-3 pb-1 sm:pt-4",
        size === "big" && "w-[190px] h-[270px] px-3 pt-6 pb-3 shrink-0",
        mini && "w-[104px] h-[56px] px-1 pt-1",
        onClick && !hand && "hover:-translate-y-2 hover:scale-[1.03] cursor-pointer",
        hand && onClick && ok && "hover:-translate-y-2 playable cursor-pointer",
        hand && !ok && "opacity-55 saturate-50",
        deny && "deny",
        selected && "ring-2 ring-white",
        locked && "grayscale opacity-60"
      )}
    >
      {!mini && (
        <span
          className={cn("absolute top-0.5 left-0.5 rounded-full flex items-center justify-center font-bold border", hand ? "w-5 h-5 text-[11px] sm:w-7 sm:h-7 sm:text-sm" : "w-8 h-8 text-base")}
          style={{ background: "#0d0720", borderColor: meta.color, color: meta.color }}
        >
          {c}
        </span>
      )}
      {hotkey && <span className="absolute top-0.5 right-1 text-[10px] sm:text-xs opacity-70 font-bold">{hotkey}</span>}
      <div className={cn("leading-tight font-bold tracking-wide", hand ? "text-[9px] sm:text-[12px] mt-1" : mini ? "text-[10px]" : "text-[15px] mt-1")} style={{ color: "#fff3d0" }}>
        {cardName(inst)}
      </div>
      <div className={cn(hand ? "text-lg sm:text-3xl my-0 sm:my-1" : mini ? "text-base" : "text-5xl my-3")} style={{ color: meta.color, textShadow: `0 0 12px ${meta.color}` }}>
        {def.icon}
      </div>
      {!mini && (
        <div className={cn("uppercase tracking-[0.18em] font-semibold", hand ? "hidden sm:block text-[8px]" : "text-[10px]")} style={{ color: meta.color }}>
          {meta.label}
        </div>
      )}
      {!mini && (
        <div className={cn("leading-snug text-[#d8cdf0] font-sans mt-1", hand ? "hidden sm:block text-[9.5px] px-0.5 line-clamp-4" : "text-[12.5px]")}>
          {cardText(inst)}
        </div>
      )}
      {!mini && def.exhaust && <div className={cn("absolute bottom-0.5 right-1 text-[8px] sm:text-[9px] uppercase text-[#ff9ab0]")}>exhaust</div>}
      <span className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: rarityColor }} />
      {inst.up && <span className="absolute bottom-1 left-1 text-[10px] text-[#ffe9a8]">★</span>}
    </button>
  );
}
