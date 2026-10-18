import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath, type EdgeProps } from '@xyflow/react';
import { useDiagramStore } from '../../store/diagramStore';
import { ICON_STYLES } from './iconStyles';

type ArchitectureRoute = 'bezier' | 'smoothstep' | 'step' | 'straight';

interface ArchitectureStepData extends Record<string, unknown> {
  step?: number;
  route?: ArchitectureRoute;
}

/**
 * DT-ARCH-02 — architecture edge with a circled step at the midpoint,
 * beside the label. The path matches the board's edge style. The badge
 * lives in the edge-label layer so PNG/SVG capture of `.react-flow` includes it.
 */
export function ArchitectureStepEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  markerStart,
  interactionWidth,
  label,
  data,
}: EdgeProps) {
  const stepData = (data ?? {}) as ArchitectureStepData;
  const route = stepData.route ?? 'bezier';
  const step = stepData.step;
  const pathArgs = {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  };
  const [path, labelX, labelY] = route === 'straight'
    ? getStraightPath(pathArgs)
    : route === 'smoothstep'
      ? getSmoothStepPath({ ...pathArgs, borderRadius: 14 })
      : route === 'step'
        ? getSmoothStepPath({ ...pathArgs, borderRadius: 0 })
        : getBezierPath(pathArgs);

  const iconStyle = useDiagramStore(s => s.iconStyle);
  const styled = iconStyle !== 'clean';
  const tokens = ICON_STYLES[iconStyle];
  const opacity = typeof style?.opacity === 'number' ? style.opacity : 1;
  const stroke = typeof style?.stroke === 'string' ? style.stroke : '#64748b';
  const labelText = typeof label === 'string' || typeof label === 'number' ? String(label) : '';
  const badgeBackground = styled ? tokens.stepBadge.background : '#ffffff';
  const badgeBorder = styled ? tokens.stepBadge.border : '#6366f1';
  const badgeColor = styled ? tokens.stepBadge.color : '#4338ca';
  const labelBackground = styled ? tokens.edge.labelBg : '#FDFDFD';
  const labelColor = styled ? tokens.edge.labelColor : '#1E293B';

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={style}
        markerEnd={markerEnd}
        markerStart={markerStart}
        interactionWidth={interactionWidth}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            opacity,
          }}
        >
          <span
            data-testid="architecture-step-badge"
            data-step={step}
            role="img"
            aria-label={`Step ${step}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 999,
              background: badgeBackground,
              border: `1px solid ${badgeBorder}`,
              color: badgeColor,
              fontSize: 10,
              fontWeight: 700,
              lineHeight: '14px',
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            }}
          >
            {step}
          </span>
          {labelText ? (
            <span
              style={{
                background: labelBackground,
                border: `1px solid ${stroke}`,
                borderRadius: 6,
                padding: '2px 6px',
                fontSize: 11,
                fontWeight: 700,
                color: labelColor,
                fontFamily: "'JetBrains Mono', monospace",
                lineHeight: '14px',
              }}
            >
              {labelText}
            </span>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
