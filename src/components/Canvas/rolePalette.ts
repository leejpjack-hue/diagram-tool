/**
 * Flow role-chip colours. Gantt bars tint AI / human / tool tasks from this
 * same palette (AI uses the model chip). One source so the two stay together.
 */
export const ROLE_CHIP_PALETTE: Record<string, { label: string; text: string; tint: string; border: string }> = {
  human: { label: 'human', text: '#1d4ed8', tint: '#eff6ff', border: '#93c5fd' },
  model: { label: 'model', text: '#6d28d9', tint: '#f5f3ff', border: '#c4b5fd' },
  tool: { label: 'tool', text: '#b45309', tint: '#fffbeb', border: '#fcd34d' },
  check: { label: 'check', text: '#15803d', tint: '#f0fdf4', border: '#86efac' },
};

/** Bar fill for a Gantt `custom: role=` value. Unknown roles are untinted. */
export function ganttRoleTint(role: unknown): string | undefined {
  if (role === 'ai') return ROLE_CHIP_PALETTE.model.text;
  if (role === 'human') return ROLE_CHIP_PALETTE.human.text;
  if (role === 'tool') return ROLE_CHIP_PALETTE.tool.text;
  return undefined;
}
