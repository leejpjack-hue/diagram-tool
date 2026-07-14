import type { ConnectionSide } from '../../store/types';

export type ArchitectureHandleKind = 'source' | 'target';

export function architectureHandleId(kind: ArchitectureHandleKind, side: ConnectionSide, slot: number): string {
  return `${kind}-${side}-${slot}`;
}
