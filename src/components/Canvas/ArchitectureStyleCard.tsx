import type { CSSProperties, ReactNode } from 'react';
import { ICON_STYLES, resolveArchFace, type ArchStyleKind, type IconStyleId } from './iconStyles';
import { StyleIcon } from './icons/styles/StyleIcon';
import { ArchitectureHandles, type ArchitectureHandleSlots } from './ArchitectureHandles';

interface ArchitectureStyleCardProps {
  iconStyle: Exclude<IconStyleId, 'clean'>;
  kind: ArchStyleKind;
  /** DSL `color:`. Wins over the style colour. */
  color?: string;
  selected?: boolean;
  label: string;
  meta?: ReactNode;
  mark?: string;
  minWidth?: number;
  slots?: ArchitectureHandleSlots;
}

/**
 * Line / Bold / Blueprint card. Clean keeps each node's existing component
 * so that look stays pixel-identical.
 */
export function ArchitectureStyleCard({
  iconStyle,
  kind,
  color,
  selected,
  label,
  meta,
  mark,
  minWidth = 180,
  slots,
}: ArchitectureStyleCardProps) {
  const face = resolveArchFace(iconStyle, kind, color);
  const tokens = ICON_STYLES[iconStyle];
  const ring: CSSProperties = selected
    ? {
        outline: `${tokens.selection.width}px solid ${tokens.selection.color}`,
        outlineOffset: tokens.selection.offset,
      }
    : {};
  const handleAccent = iconStyle === 'bold' ? '#ffffff' : face.color;

  return (
    <div
      data-arch-kind={kind}
      data-arch-style={iconStyle}
      data-arch-treatment={face.treatment}
      data-part-mark={mark}
      className="px-4 py-3"
      style={{
        background: face.fill,
        border: face.borderWidth ? `${face.borderWidth}px solid ${face.borderColor}` : 'none',
        borderRadius: face.radius,
        minWidth,
        ...ring,
      }}
    >
      <ArchitectureHandles accent={handleAccent} slots={slots} />
      <div className="flex items-center gap-3">
        <StyleIcon
          name={face.icon}
          size={face.iconSize}
          strokeWidth={face.iconStroke}
          filled={face.iconFilled}
          color={face.iconColor}
          kind={kind}
          decorative
        />
        <div
          className="font-semibold text-[14px]"
          style={{ color: face.labelColor, fontFamily: face.fontFamily, fontWeight: face.fontWeight }}
        >
          {label}
        </div>
      </div>
      {meta ? (
        <div
          className="mt-1.5 text-[11px]"
          style={{ color: face.labelColor, fontFamily: face.fontFamily, fontWeight: 500 }}
        >
          {meta}
        </div>
      ) : null}
    </div>
  );
}
