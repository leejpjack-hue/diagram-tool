// Inline glyphs for DT-STYLE-01. Paths adapted from Lucide (ISC License) —
// https://github.com/lucide-icons/lucide — copied in so the canvas never
// fetches an icon CDN. Static only: no animation.

import type { ArchIconName, StyleIconName } from '../../iconStyles';

interface StyleIconProps {
  name: StyleIconName | ArchIconName;
  size?: number;
  /** Desired on-screen stroke width in CSS pixels (outline styles). */
  strokeWidth?: number;
  filled?: boolean;
  color?: string;
  /**
   * Inner mark on filled glyphs (shield check, circle dot). Set to the node
   * fill so the mark stays visible on a solid white glyph.
   */
  markColor?: string;
  /** Role word or type name. Omitted when the icon is decorative beside a text label. */
  label?: string;
  role?: 'human' | 'model' | 'tool' | 'check';
  kind?: string;
  decorative?: boolean;
}

export function StyleIcon({
  name,
  size = 16,
  strokeWidth = 1.75,
  filled = false,
  color,
  markColor,
  label,
  role,
  kind,
  decorative = false,
}: StyleIconProps) {
  // Scale the stroke into viewBox units so a 16px glyph really is 1.75px.
  const sw = strokeWidth * (24 / size);
  const stroke = 'currentColor';
  const fill = filled ? 'currentColor' : 'none';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden={decorative || !label ? true : undefined}
      role={decorative || !label ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      data-role-icon={role}
      data-node-icon={kind ?? name}
      style={{ color, flexShrink: 0, display: 'block' }}
    >
      {!decorative && label ? <title>{label}</title> : null}
      <IconPaths name={name} stroke={stroke} sw={sw} fill={fill} filled={filled} mark={markColor} />
    </svg>
  );
}

function IconPaths({
  name,
  stroke,
  sw,
  fill,
  filled,
  mark,
}: {
  name: StyleIconName | ArchIconName;
  stroke: string;
  sw: number;
  fill: string;
  filled: boolean;
  mark?: string;
}) {
  const common = {
    stroke,
    strokeWidth: sw,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill,
  };
  switch (name) {
    case 'sparkles':
      return (
        <>
          <path {...common} d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
          <path {...common} fill="none" d="M20 3v4" />
          <path {...common} fill="none" d="M22 5h-4" />
          <path {...common} fill="none" d="M4 17v2" />
          <path {...common} fill="none" d="M5 18H3" />
        </>
      );
    case 'wrench':
      return (
        <path {...common} d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      );
    case 'shield-check':
      return (
        <>
          <path {...common} d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
          <path {...common} fill="none" stroke={filled && mark ? mark : stroke} d="m9 12 2 2 4-4" />
        </>
      );
    case 'user':
      return (
        <>
          <path {...common} d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle {...common} cx="12" cy="7" r="4" />
        </>
      );
    case 'git-branch':
      return (
        <>
          <line {...common} fill="none" x1="6" x2="6" y1="3" y2="15" />
          <circle {...common} cx="18" cy="6" r="3" />
          <circle {...common} cx="6" cy="18" r="3" />
          <path {...common} fill="none" d="M18 9a9 9 0 0 1-9 9" />
        </>
      );
    case 'database':
      return (
        <>
          <ellipse {...common} cx="12" cy="5" rx="9" ry="3" />
          <path {...common} fill="none" d="M3 5V19A9 3 0 0 0 21 19V5" />
          <path {...common} fill="none" d="M3 12A9 3 0 0 0 21 12" />
        </>
      );
    case 'circle-dot':
      return (
        <>
          <circle {...common} cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="3" fill={filled ? (mark ?? 'none') : stroke} stroke="none" />
        </>
      );
    case 'play':
      return <polygon {...common} points="6 3 20 12 6 21 6 3" />;
    case 'square':
      return <rect {...common} x="3" y="3" width="18" height="18" rx="2" />;
    case 'server':
      return (
        <>
          <rect {...common} x="2" y="2" width="20" height="8" rx="2" />
          <rect {...common} x="2" y="14" width="20" height="8" rx="2" />
          <line {...common} fill="none" x1="6" x2="6.01" y1="6" y2="6" />
          <line {...common} fill="none" x1="6" x2="6.01" y1="18" y2="18" />
        </>
      );
    case 'layers':
      return (
        <>
          <path {...common} d="m12.83 2.18 8.58 3.91a1 1 0 0 1 0 1.83l-8.58 3.9a2 2 0 0 1-1.66 0l-8.58-3.9a1 1 0 0 1 0-1.83l8.58-3.91a2 2 0 0 1 1.66 0z" />
          <path {...common} fill="none" d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
          <path {...common} fill="none" d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
        </>
      );
    case 'cloud':
      return <path {...common} d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />;
    case 'layout-grid':
      return (
        <>
          <rect {...common} x="3" y="3" width="7" height="7" rx="1" />
          <rect {...common} x="14" y="3" width="7" height="7" rx="1" />
          <rect {...common} x="14" y="14" width="7" height="7" rx="1" />
          <rect {...common} x="3" y="14" width="7" height="7" rx="1" />
        </>
      );
    default:
      return null;
  }
}
