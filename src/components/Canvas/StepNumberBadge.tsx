import { createContext, memo, useContext, type ComponentType } from 'react';
import type { NodeProps } from '@xyflow/react';
import { useDiagramStore } from '../../store/diagramStore';
import { ICON_STYLES } from './iconStyles';

/** Stable empty map so a hidden toggle does not rebuild context every render. */
export const NO_STEP_NUMBERS: ReadonlyMap<string, number> = new Map();

export const StepNumberContext = createContext<ReadonlyMap<string, number>>(NO_STEP_NUMBERS);

/**
 * DT-AI-29 — small walk-order badge on the top-left of a flow node.
 * The role chip stays top-right. Nothing is rendered when numbers are off
 * or this node is not a numbered step (fork/join diamonds, lanes, notes).
 */
export function StepNumberBadge({ nodeId }: { nodeId: string }) {
  const step = useContext(StepNumberContext).get(nodeId);
  const iconStyle = useDiagramStore(s => s.iconStyle);
  if (!step) return null;
  const tokens = ICON_STYLES[iconStyle];
  const badge = tokens.stepBadge;
  return (
    <span
      data-testid="step-number"
      data-step-number={step}
      role="img"
      aria-label={`Step ${step}`}
      style={{
        position: 'absolute',
        top: -9,
        left: 8,
        zIndex: 2,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 16,
        height: 16,
        padding: '0 4px',
        borderRadius: 999,
        background: badge.background,
        border: `1px solid ${badge.border}`,
        color: badge.color,
        fontFamily: tokens.label.font,
        fontSize: 10,
        fontWeight: 700,
        lineHeight: '14px',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {step}
    </span>
  );
}

/** Badge slot for every flow node face. The host is the positioning box. */
export function withStepNumber(Component: ComponentType<NodeProps>) {
  const Wrapped = (props: NodeProps) => (
    <div style={{ position: 'relative', width: 'max-content' }}>
      <Component {...props} />
      <StepNumberBadge nodeId={props.id} />
    </div>
  );
  Wrapped.displayName = `WithStepNumber(${Component.displayName || Component.name || 'Node'})`;
  return memo(Wrapped);
}
