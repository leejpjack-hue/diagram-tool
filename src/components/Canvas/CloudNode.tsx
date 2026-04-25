import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { CloudNodeData } from './types';

// Provider visual identity — colored badges with stylized geometric glyphs.
// Glyphs are deliberately abstract to evoke each provider without copying
// trademarked logos.
const PROVIDER_META: Record<string, { label: string; bg: string; fg: string; pill: string; pillFg: string }> = {
  aws:   { label: 'AWS',   bg: '#FFF7ED', fg: '#9A3412', pill: '#FB923C', pillFg: '#FFFFFF' },
  azure: { label: 'Azure', bg: '#EFF6FF', fg: '#1E3A8A', pill: '#2563EB', pillFg: '#FFFFFF' },
  gcp:   { label: 'GCP',   bg: '#ECFDF5', fg: '#064E3B', pill: '#0EA5E9', pillFg: '#FFFFFF' },
  k8s:   { label: 'K8s',   bg: '#EFF6FF', fg: '#1E40AF', pill: '#326CE5', pillFg: '#FFFFFF' },
};

// Small inline SVG glyphs (16x16) keyed by provider. Drawn with currentColor
// so the parent badge can control fill via the `style.color` prop.
function ProviderGlyph({ provider }: { provider: string }) {
  const sz = 16;
  switch (provider) {
    case 'aws':
      // Stacked chevrons evoking AWS cloud-stack shape
      return (
        <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none">
          <path d="M2 5 L8 2 L14 5 L8 8 Z" fill="currentColor" />
          <path d="M2 9 L8 12 L14 9" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
          <path d="M2 12 L8 15 L14 12" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" opacity="0.6" />
        </svg>
      );
    case 'azure':
      // Two triangular peaks
      return (
        <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none">
          <path d="M2 13 L7 3 L11 9 L8 9 L9 13 Z" fill="currentColor" />
          <path d="M9 13 L13 13 L11 9 Z" fill="currentColor" opacity="0.7" />
        </svg>
      );
    case 'gcp':
      // Four-color quadrant dots
      return (
        <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none">
          <circle cx="5"  cy="5"  r="3" fill="#4285F4" />
          <circle cx="11" cy="5"  r="3" fill="#EA4335" />
          <circle cx="5"  cy="11" r="3" fill="#FBBC04" />
          <circle cx="11" cy="11" r="3" fill="#34A853" />
        </svg>
      );
    case 'k8s':
      // Heptagon (helm-like)
      return (
        <svg width={sz} height={sz} viewBox="0 0 16 16" fill="none">
          <polygon points="8,1.5 13.5,4.5 14,11 8,14.5 2,11 2.5,4.5" fill="currentColor" />
          <polygon points="8,4 11,5.5 11,9.5 8,11.5 5,9.5 5,5.5" fill="white" opacity="0.95" />
          <polygon points="8,5.5 9.7,6.5 9.7,9 8,10 6.3,9 6.3,6.5" fill="currentColor" />
        </svg>
      );
    default:
      return <span className="text-[11px] font-bold">?</span>;
  }
}

const KIND_ICON: Record<string, string> = {
  // AWS
  lambda: 'λ', s3: 'S3', rds: 'DB', ec2: 'EC', dynamodb: 'DY', sqs: 'Q', apigateway: 'API', cloudfront: 'CF',
  // Azure
  vm: 'VM', functions: 'ƒ', cosmosdb: 'CX', blob: 'BL',
  // GCP
  gce: 'GCE', cloudfunction: 'ƒ', bigquery: 'BQ', gcs: 'GCS',
  // K8s
  pod: '⬢', service: '⚙', ingress: '↗', configmap: '☰', deployment: '⊞',
};

function kindLabel(kind?: string): string {
  if (!kind) return '';
  return kind.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export const CloudNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as CloudNodeData;
  const provider = nodeData.provider || 'aws';
  const meta = PROVIDER_META[provider] ?? PROVIDER_META.aws;
  const kindKey = (nodeData.kind || '').replace(/-/g, '');
  // Show kind glyph (e.g. λ for lambda) when available, else fall back to provider glyph.
  const kindBadge = KIND_ICON[kindKey];

  return (
    <div
      className={`
        px-4 py-3 rounded-lg border-2 shadow-md transition-all duration-200
        ${selected ? 'scale-105 shadow-xl' : 'hover:shadow-lg hover:scale-102'}
        min-w-[180px]
      `}
      style={{
        background: meta.bg,
        borderColor: meta.pill,
        boxShadow: selected
          ? `0 0 0 3px ${meta.pill}40`
          : '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: meta.pill }} />

      <div className="flex items-center gap-2 mb-1">
        <div
          className="rounded flex items-center justify-center font-bold"
          style={{ background: meta.pill, color: meta.pillFg, width: 28, height: 24 }}
          title={meta.label}
        >
          {kindBadge ? (
            <span className="text-xs">{kindBadge}</span>
          ) : (
            <ProviderGlyph provider={provider} />
          )}
        </div>
        <div className="font-semibold text-sm" style={{ color: meta.fg }}>
          {nodeData.label}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="text-[10px] font-mono px-1.5 py-0.5 rounded"
          style={{ background: meta.pill + '20', color: meta.fg }}
        >
          {meta.label}
        </span>
        {nodeData.kind && (
          <span className="text-xs" style={{ color: meta.fg, opacity: 0.8 }}>
            {kindLabel(nodeData.kind)}
          </span>
        )}
      </div>

      {(nodeData.tech || nodeData.region) && (
        <div className="text-[11px] mt-1" style={{ color: meta.fg, opacity: 0.7 }}>
          {nodeData.tech}{nodeData.tech && nodeData.region ? ' • ' : ''}{nodeData.region}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: meta.pill }} />
    </div>
  );
});

CloudNode.displayName = 'CloudNode';
