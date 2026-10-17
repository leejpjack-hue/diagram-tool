import type { ConnectionSide } from '../../store/types';

export type ArchitectureHandleKind = 'source' | 'target';

export function architectureHandleId(kind: ArchitectureHandleKind, side: ConnectionSide, slot: number): string {
  return `${kind}-${side}-${slot}`;
}

/** `source-right-0` / `target-left` → the side. Unknown ids return undefined. */
export function sideFromHandleId(id: string | null | undefined): ConnectionSide | undefined {
  if (!id) return undefined;
  const side = id.split('-')[1];
  if (side === 'top' || side === 'right' || side === 'bottom' || side === 'left') return side;
  return undefined;
}
