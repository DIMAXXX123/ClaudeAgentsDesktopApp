import type { RoomObjectInstance } from "@/lib/rooms/types";
import { getObjectComponent } from "@/lib/rooms/objects";

interface RoomObjectProps {
  obj: RoomObjectInstance;
  color: string;
  working: boolean;
  errored: boolean;
  active: boolean;
  onFocus: (id: string) => void;
  onHover: (id: string | null) => void;
}

export function RoomObject({
  obj,
  color,
  working,
  errored,
  active,
  onFocus,
  onHover,
}: RoomObjectProps) {
  const component = getObjectComponent(obj.kind);

  if (!component) {
    // Render debug rect for missing component
    return (
      <g
        onClick={() => onFocus(obj.id)}
        onMouseEnter={() => onHover(obj.id)}
        onMouseLeave={() => onHover(null)}
      >
        <rect
          x={obj.x}
          y={obj.y}
          width={10}
          height={10}
          fill="#ff00ff"
          opacity={0.5}
        />
        <text
          x={obj.x + 2}
          y={obj.y + 6}
          fontSize="2"
          fill="#fff"
          fontFamily="monospace"
        >
          ?{obj.kind}
        </text>
      </g>
    );
  }

  if (obj.interactive === false) {
    // Non-interactive object
    return (
      <g>
        {component({
          x: obj.x,
          y: obj.y,
          color,
          working,
          errored,
          active: false,
          extra: obj.props,
        })}
      </g>
    );
  }

  // Interactive object with hit rect
  const hitW = (obj.props?.hitW as number) ?? 16;
  const hitH = (obj.props?.hitH as number) ?? 20;

  return (
    <g
      className={`obj-interactive ${active ? "obj-active" : ""}`}
      onClick={() => onFocus(obj.id)}
      onMouseEnter={() => onHover(obj.id)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Transparent hit rect */}
      <rect
        x={obj.x - hitW / 2}
        y={obj.y - hitH / 2}
        width={hitW}
        height={hitH}
        fill="transparent"
        pointerEvents="auto"
      />

      {/* Rendered object */}
      {component({
        x: obj.x,
        y: obj.y,
        color,
        working,
        errored,
        active,
        extra: obj.props,
      })}
    </g>
  );
}
