import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { CloudNodeData } from './types';

// Provider visual identity — colored badges with provider letter.
// Using colored badges rather than vendor logos avoids trademark issues
// while still making provider origin instantly recognizable.
const PROVIDER_META: Record<string, { label: string; bg: string; fg: string; pill: string; pillFg: string; badge: string }> = {
  aws:   { label: 'AWS',   bg: '#FFF7ED', fg: '#9A3412', pill: '#FB923C', pillFg: '#FFFFFF', badge: 'A' },
  azure: { label: 'Azure', bg: '#EFF6FF', fg: '#1E3A8A', pill: '#2563EB', pillFg: '#FFFFFF', badge: 'Z' },
  gcp:   { label: 'GCP',   bg: '#ECFDF5', fg: '#064E3B', pill: '#0EA5E9', pillFg: '#FFFFFF', badge: 'G' },
  k8s:   { label: 'K8s',   bg: '#EFF6FF', fg: '#1E40AF', pill: '#326CE5', pillFg: '#FFFFFF', badge: 'K' },
};

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
  const meta = PROVIDER_META[nodeData.provider || 'aws'] ?? PROVIDER_META.aws;
  const kindKey = (nodeData.kind || '').replace(/-/g, '');
  const badgeText = KIND_ICON[kindKey] || meta.badge;

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
          className="rounded flex items-center justify-center text-xs font-bold px-2"
          style={{ background: meta.pill, color: meta.pillFg, minWidth: 28, height: 24 }}
        >
          {badgeText}
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
