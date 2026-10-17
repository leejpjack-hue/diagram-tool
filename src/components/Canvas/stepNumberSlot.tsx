import { memo, type ComponentType } from 'react';
import type { NodeProps } from '@xyflow/react';
import { StepNumberBadge } from './StepNumberBadge';

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
