import { describe, expect, it } from 'vitest';
import { exportFileName } from './useExport';

describe('exportFileName', () => {
  it('keeps the existing name when step-through is off', () => {
    expect(exportFileName('Untitled Workflow', 'flow', 'png', null, '2026-11-22')).toBe(
      'untitled-workflow-flow-2026-11-22.png',
    );
  });

  it('names the file for the current 1-based step while a walk is open', () => {
    expect(exportFileName('Untitled Workflow', 'flow', 'svg', 0, '2026-11-22')).toBe(
      'untitled-workflow-flow-step-1-2026-11-22.svg',
    );
    expect(exportFileName('diagram', 'sequence', 'pdf', 1, '2026-11-22')).toBe(
      'diagram-sequence-step-2-2026-11-22.pdf',
    );
  });
});
