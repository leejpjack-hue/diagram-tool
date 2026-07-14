import { Handle, Position } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { ConnectionSide } from '../../store/types';
import { architectureHandleId } from './architectureHandleIds';

export interface ArchitectureHandleSlots {
  source?: Partial<Record<ConnectionSide, number>>;
  target?: Partial<Record<ConnectionSide, number>>;
}

interface ArchitectureHandlesProps {
  accent: string;
  slots?: ArchitectureHandleSlots;
}

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

const SIDES: ConnectionSide[] = ['top', 'right', 'bottom', 'left'];

function styleForHandle(side: ConnectionSide, slot: number, count: number, accent: string, visible: boolean): CSSProperties {
  const offset = `${((slot + 1) / (count + 1)) * 100}%`;
  const style: CSSProperties = {
    width: 10,
    height: 10,
    background: accent,
    border: '2px solid #ffffff',
    boxShadow: visible ? '0 1px 4px rgba(15, 23, 42, 0.18)' : 'none',
    opacity: visible ? 1 : 0.001,
    pointerEvents: visible ? 'auto' : 'none',
    zIndex: visible ? 2 : 1,
  };

  if (side === 'top' || side === 'bottom') {
    style.left = offset;
  } else {
    style.top = offset;
  }

  return style;
}

export function ArchitectureHandles({ accent, slots }: ArchitectureHandlesProps) {
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
                style={styleForHandle(side, slot, count, accent, false)}
              />
              <Handle
                id={architectureHandleId('source', side, slot)}
                type="source"
                position={position}
                style={styleForHandle(side, slot, count, accent, true)}
              />
            </span>
          );
        });
      })}
    </>
  );
}
