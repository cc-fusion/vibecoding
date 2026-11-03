import { getIcon } from "../game/textures";
import { getName, getTool } from "../game/blocks";
import type { Stack } from "../game/inventory";

export function ItemIcon({ id, size = 36 }: { id: number; size?: number }) {
  return <img className="pixel" src={getIcon(id)} width={size} height={size} alt={getName(id)} draggable={false} />;
}

export function Slot({
  stack,
  selected,
  onClick,
  onContextMenu,
  title,
  className = "",
  onMouseEnter,
  onMouseLeave,
}: {
  stack: Stack | null;
  selected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  title?: string;
  className?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const tool = stack ? getTool(stack.id) : undefined;
  const duraPct = stack && tool && stack.durability !== undefined ? stack.durability / tool.durability : 1;
  return (
    <div
      className={`slot ${selected ? "selected" : ""} ${className}`}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e);
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title={title ?? (stack ? getName(stack.id) : undefined)}
    >
      {stack && (
        <>
          <ItemIcon id={stack.id} />
          {stack.count > 1 && <span className="count">{stack.count}</span>}
          {tool && duraPct < 1 && (
            <div className="dura">
              <div style={{ width: `${duraPct * 100}%`, background: duraPct > 0.5 ? "#5fd35f" : duraPct > 0.2 ? "#e6c14a" : "#e05454" }} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
