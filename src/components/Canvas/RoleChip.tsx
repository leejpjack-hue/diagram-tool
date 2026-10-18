import type { FlowNodeData } from './types';
import { MONO_FONT } from './flowShapeStyle';
import { ROLE_CHIP_PALETTE } from './rolePalette';
import { useDiagramStore } from '../../store/diagramStore';

/**
 * DT-AI-03 — display-only role chip for flow nodes (human / model / tool /
 * check). A tiny static badge pinned to the node's top-right corner so it
 * never covers the source/target handles (which sit on the centre lines of
 * every edge).
 *
 * Deliberately static: no keyframes, no transitions, no pulse. That keeps
 * `prefers-reduced-motion` satisfied by construction — there is nothing to
 * suppress.
 *
 * Purely display metadata. A role does NOT execute tools, call models, or
 * gate rendering; unknown role values never reach this component because
 * the parser drops them, but it also bails defensively on anything that
 * isn't in the known set.
 */
const ROLE_STYLES = ROLE_CHIP_PALETTE;

export function RoleChip({ role }: { role?: FlowNodeData['role'] }) {
  const iconStyle = useDiagramStore(s => s.iconStyle);
  // Line / Bold / Blueprint replace the text chip with a role icon.
  if (iconStyle !== 'clean') return null;
  if (!role || !ROLE_STYLES[role]) return null;
  const s = ROLE_STYLES[role];
  return (
    <span
      data-role-chip={role}
      style={{
        position: 'absolute',
        top: -9,
        right: 8,
        zIndex: 1,
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 7px',
        borderRadius: 999,
        background: s.tint,
        border: `1px solid ${s.border}`,
        color: s.text,
        fontFamily: MONO_FONT,
        fontSize: 9,
        fontWeight: 600,
        lineHeight: '12px',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  );
}
