/**
 * Layout direction context — drives where each custom node mounts its
 * source/target handles. Provided once at the canvas root and consumed by
 * every node component via `useLayoutHandles`.
 *
 *   TB (default)  →  target on Top    / source on Bottom
 *   LR            →  target on Left   / source on Right
 *
 * Triggered by the DSL `direction:` keyword (parsed in parser.ts).
 */
import { createContext, useContext } from 'react';
import { Position } from '@xyflow/react';
import type { LayoutDirection } from '../../store/types';

export const LayoutDirectionContext = createContext<LayoutDirection>('TB');

export function useLayoutDirection(): LayoutDirection {
  return useContext(LayoutDirectionContext);
}

/**
 * Returns React Flow Position values for the target/source handles of the
 * current node, plus a `centerStyle` you can spread into a Handle's `style`
 * prop when you need to manually pin the handle to the centerline of an
 * irregular shape (parallelogram, document, BPMN gateway, etc.).
 *
 *   In TB mode `centerStyle(w)` centers along x: { left: w/2 }.
 *   In LR mode `centerStyle(_, h)` centers along y: { top: h/2 }.
 */
export function useLayoutHandles() {
  const dir = useLayoutDirection();
  const isLR = dir === 'LR';
  return {
    direction: dir,
    target: isLR ? Position.Left : Position.Top,
    source: isLR ? Position.Right : Position.Bottom,
    /** Returns a style object pinning the handle to the orthogonal centerline. */
    centerStyle(w: number, h: number): React.CSSProperties {
      return isLR ? { top: h / 2 } : { left: w / 2 };
    },
  };
}
