import { memo } from 'react';
import { Handle } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { CloudNodeData } from './types';
import { ProviderIcon, KindIcon, hasKindIcon } from './icons';
import { useLayoutHandles } from './layoutDirection';
import { cardStyle, chipStyle, badgeStyle, isCode, TITLE_COLOR, MUTED_COLOR, TITLE_FONT, MONO_FONT } from './cardStyle';

// Provider visual identity — colored badges with stylized geometric glyphs.
// Glyphs themselves now live as standalone .svg files in ./icons/providers/.
const PROVIDER_META: Record<string, { label: string; bg: string; fg: string; pill: string; pillFg: string }> = {
  aws:   { label: 'AWS',   bg: '#FFF7ED', fg: '#9A3412', pill: '#FB923C', pillFg: '#FFFFFF' },
  azure: { label: 'Azure', bg: '#EFF6FF', fg: '#1E3A8A', pill: '#2563EB', pillFg: '#FFFFFF' },
  gcp:   { label: 'GCP',   bg: '#ECFDF5', fg: '#064E3B', pill: '#0EA5E9', pillFg: '#FFFFFF' },
  k8s:   { label: 'K8s',   bg: '#EFF6FF', fg: '#1E40AF', pill: '#326CE5', pillFg: '#FFFFFF' },
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
  const provider = nodeData.provider || 'aws';
  const meta = PROVIDER_META[provider] ?? PROVIDER_META.aws;
  const { target, source } = useLayoutHandles();
  const kindKey = (nodeData.kind || '').replace(/-/g, '');
  // Priority: custom kind SVG (designer-supplied) → unicode kind glyph → provider SVG glyph.
  const kindBadge = KIND_ICON[kindKey];
  const customKind = hasKindIcon(kindKey);
  // A `color:` in the DSL overrides the provider accent.
  const accent = nodeData.color || meta.pill;

  return (
    <div
      className={`
        px-4 py-3 transition-all duration-200
        ${selected ? 'scale-105' : 'hover:scale-102'}
        min-w-[180px]
      `}
      style={cardStyle(accent, !!selected)}
    >
      <Handle type="target" position={target} style={{ background: accent }} />

      <div className="flex items-center gap-3 mb-1">
        <div
          className="rounded-[9px] flex items-center justify-center font-bold shrink-0 w-9 h-9"
          style={chipStyle(accent)}
          title={meta.label}
        >
          {nodeData.icon ? (
            isCode(nodeData.icon) ? (
              <span style={{ fontFamily: MONO_FONT, fontWeight: 700, fontSize: nodeData.icon.length > 2 ? 10 : 13, lineHeight: 1 }}>{nodeData.icon}</span>
            ) : (
              <span style={{ fontSize: 20, lineHeight: 1 }}>{nodeData.icon}</span>
            )
          ) : customKind ? (
            <KindIcon name={kindKey} size={22} />
          ) : kindBadge ? (
            <span style={{ fontSize: kindBadge.length > 2 ? 11 : 14, lineHeight: 1, fontFamily: MONO_FONT }}>{kindBadge}</span>
          ) : (
            <ProviderIcon name={provider} size={22} fallback={<span className="text-[11px] font-bold">?</span>} />
          )}
        </div>
        <div className="font-semibold text-[14px]" style={{ color: TITLE_COLOR, fontFamily: TITLE_FONT }}>
          {nodeData.label}
        </div>
      </div>

      {/* Provider badge only when a provider/kind is explicitly declared. */}
      {(nodeData.provider || nodeData.kind) && (
        <div className="flex items-center gap-1.5 mt-1.5">
          {nodeData.provider && (
            <span
              className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
              style={{ ...badgeStyle(accent), fontFamily: MONO_FONT }}
            >
              {meta.label}
            </span>
          )}
          {nodeData.kind && (
            <span className="text-[11px]" style={{ color: MUTED_COLOR, fontFamily: MONO_FONT }}>
              {kindLabel(nodeData.kind)}
            </span>
          )}
        </div>
      )}

      {(nodeData.tech || nodeData.region) && (
        <div className="text-[11px] mt-1" style={{ color: MUTED_COLOR, fontFamily: MONO_FONT }}>
          {nodeData.tech}{nodeData.tech && nodeData.region ? ' • ' : ''}{nodeData.region}
        </div>
      )}

      <Handle type="source" position={source} style={{ background: accent }} />
    </div>
  );
});

CloudNode.displayName = 'CloudNode';
