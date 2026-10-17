import { Handle, Position } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { ConnectionSide } from '../../store/types';
import type { ArchitectureHandleSlots } from './ArchitectureHandles';
import { architectureHandleId } from './architectureHandleIds';

const SIDES: ConnectionSide[] = ['top', 'right', 'bottom', 'left'];

function sideToPosition(side: ConnectionSide): Position {
  switch (side) {
    case 'top':
      return Position.Top;
    case 'right':
      return Position.Right;
    case 'bottom':
      return Position.Bottom;
    case 'left':
      return Position.Left;
  }
}

function styleForHandle(side: ConnectionSide, slot: number, count: number, accent: string): CSSProperties {
  const offset = `${((slot + 1) / (count + 1)) * 100}%`;
  const style: CSSProperties = {
    background: accent,
    zIndex: 4,
  };
  if (side === 'top' || side === 'bottom') style.left = offset;
  else style.top = offset;
  return style;
}

/**
 * Connectable N/E/S/W handles for every Flow node. One source and one target
 * per side (extra slots when several edges share a side). Idle dots stay
 * subtle; hover and selection bring them forward. See `.flow-handle` in CSS.
 */
export function FlowHandles({ accent, slots }: { accent: string; slots?: ArchitectureHandleSlots }) {
  return (
    <>
      {SIDES.flatMap((side) => {
        const count = Math.max(1, slots?.source?.[side] ?? 0, slots?.target?.[side] ?? 0);
        return Array.from({ length: count }, (_, slot) => {
          const position = sideToPosition(side);
          return (
            <span key={`${side}-${slot}`}>
              <Handle
                id={architectureHandleId('target', side, slot)}
                type="target"
                position={position}
                isConnectableStart={false}
                isConnectableEnd
                className="flow-handle"
                data-testid={`flow-handle-target-${side}-${slot}`}
                style={styleForHandle(side, slot, count, accent)}
              />
              <Handle
                id={architectureHandleId('source', side, slot)}
                type="source"
                position={position}
                isConnectableStart
                isConnectableEnd={false}
                className="flow-handle"
                data-testid={`flow-handle-source-${side}-${slot}`}
                style={styleForHandle(side, slot, count, accent)}
              />
            </span>
          );
        });
      })}
    </>
  );
}
