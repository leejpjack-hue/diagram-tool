import { StyleIcon } from './icons/styles/StyleIcon';
import type { ResolvedFace } from './iconStyles';

/** Role / type glyph. Static. The role word is the accessible name when the text chip is hidden. */
export function FlowGlyph({ face, decorative = false }: { face: ResolvedFace; decorative?: boolean }) {
  if (!face.showIcon) return null;
  return (
    <StyleIcon
      name={face.icon}
      size={face.iconSize}
      strokeWidth={face.iconStroke}
      filled={face.iconFilled}
      color={face.iconColor}
      markColor={face.iconFilled ? face.fill : undefined}
      label={decorative ? undefined : face.ariaLabel}
      role={decorative ? undefined : face.roleWord}
      kind={face.kind}
      decorative={decorative}
    />
  );
}
