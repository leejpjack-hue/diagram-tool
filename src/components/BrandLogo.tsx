// Brand mark for the app header — mirrors public/favicon.svg.
export function BrandLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="brand-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="55%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#9333ea" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#brand-bg)" />
      <path
        d="M22 22 L42 22 M22 22 L22 42 M22 42 L42 42 M42 22 L42 42"
        stroke="#ffffff"
        strokeOpacity="0.45"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M22 22 L42 42" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round" />
      <rect x="14" y="14" width="16" height="16" rx="5" fill="#ffffff" />
      <circle cx="42" cy="22" r="7" fill="#ffffff" fillOpacity="0.92" />
      <circle cx="22" cy="42" r="7" fill="#ffffff" fillOpacity="0.92" />
      <rect x="34" y="34" width="16" height="16" rx="8" fill="#fbbf24" />
    </svg>
  );
}
