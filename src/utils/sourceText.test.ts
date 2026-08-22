import { describe, expect, it } from 'vitest';
import { parseDiagram } from '../parser/parser';
import {
  applyBoardSource,
  detectRawDiagramImport,
  extractBoardTitle,
  renameNodeInSource,
  toDslSource,
  toMermaidSource,
} from './sourceText';

const FLOW_DSL = `diagram: flow
title: Checkout
direction: LR
Intake -> Review
Review -> Done`;

const FLOW_MERMAID = `flowchart LR
title: Checkout
  Intake[Intake] --> Review[Review]
  Review --> Done[Done]`;

const SEQUENCE = `sequenceDiagram
title Checkout
participant U as User
participant A as API
U->>A: GET /orders`;

describe('extractBoardTitle', () => {
  it('reads architecture and flow title: lines', () => {
    expect(extractBoardTitle('diagram: architecture\ntitle: AWS 3-Tier Web App\nservice API {}', 'architecture'))
      .toBe('AWS 3-Tier Web App');
    expect(extractBoardTitle('diagram: flow\ntitle: User Signup\nstart A', 'flow')).toBe('User Signup');
  });

  it('reads sequence title, title:, and the first heading', () => {
    expect(extractBoardTitle('sequenceDiagram\ntitle Checkout\nA->>B: hi', 'sequence')).toBe('Checkout');
    expect(extractBoardTitle('sequenceDiagram\ntitle: Auth Flow\nA->>B: hi', 'sequence')).toBe('Auth Flow');
    expect(extractBoardTitle('sequenceDiagram\n# Password reset\nA->>B: hi', 'sequence')).toBe('Password reset');
  });

  it('returns null when the source has no title', () => {
    expect(extractBoardTitle('sequenceDiagram\nAlice->>Bob: hi', 'sequence')).toBeNull();
    expect(extractBoardTitle('diagram: architecture\nservice API {}', 'architecture')).toBeNull();
  });
});

describe('detectRawDiagramImport', () => {
  it('imports a sequenceDiagram .mmd file', () => {
    const imported = detectRawDiagramImport('checkout.mmd', SEQUENCE);
    expect(imported).toMatchObject({ mode: 'sequence', title: 'Checkout' });
    expect(imported?.dslText).toContain('U->>A: GET /orders');
  });

  it('imports a flowchart mermaid file', () => {
    const imported = detectRawDiagramImport('flow.mermaid', FLOW_MERMAID);
    expect(imported).toMatchObject({ mode: 'flow', title: 'Checkout' });
  });

  it('does not treat JSON as mermaid', () => {
    expect(detectRawDiagramImport('board.json', '{"version":"3.0"}')).toBeNull();
  });
});

describe('applyBoardSource last-good contract', () => {
  it('parses architecture DSL', () => {
    const result = applyBoardSource('diagram: architecture\nservice Gateway {}', 'architecture');
    expect(result.ok).toBe(true);
    if (result.ok && result.kind === 'diagram') {
      expect(result.parsed.nodes.map(n => n.name)).toContain('Gateway');
    }
  });

  it('returns an error for unclosed architecture blocks', () => {
    const result = applyBoardSource('diagram: architecture\nservice Gateway {', 'architecture');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Expected/i);
  });

  it('returns an error for leftover sequence arrows', () => {
    const result = applyBoardSource('sequenceDiagram\nA -> B\n', 'sequence');
    expect(result.ok).toBe(false);
  });

  it('parses native Gantt DSL', () => {
    const result = applyBoardSource(`diagram: gantt
title: Plan
task Design {
  start: 2026-08-01
  end: 2026-08-05
}
task Build {
  start: 2026-08-06
  end: 2026-08-12
  depends: Design
  progress: 25
}`, 'gantt');
    expect(result.ok).toBe(true);
    if (result.ok && result.kind === 'gantt') {
      expect(result.project.tasks.map(task => task.name)).toEqual(['Design', 'Build']);
      expect(result.project.dependencies).toHaveLength(1);
    }
  });

  it('returns an error for an unclosed Gantt task and does not invent a plan', () => {
    const result = applyBoardSource(`diagram: gantt
title: Plan
task Design {
  start: 2026-08-01
`, 'gantt');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Expected \}/i);
  });

  it('rejects Mermaid gantt so the native DSL stays the only format', () => {
    const result = applyBoardSource(`gantt
    title Mermaid Plan
    dateFormat YYYY-MM-DD
    section Build
    Design :a1, 2026-08-01, 4d
`, 'gantt');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/diagram:\s*gantt/i);
  });
});

describe('copy-as-Mermaid / copy-as-DSL', () => {
  it('converts native flow DSL to mermaid', () => {
    const mermaid = toMermaidSource(FLOW_DSL, 'flow');
    expect(mermaid).toMatch(/^flowchart LR/m);
    expect(mermaid).toContain('Intake');
    expect(mermaid).toContain('Review');
  });

  it('converts mermaid flow to native DSL', () => {
    const dsl = toDslSource(FLOW_MERMAID, 'flow');
    expect(dsl).toMatch(/diagram:\s*flow/);
    expect(dsl).toContain('Intake ->');
    const parsed = parseDiagram(dsl);
    expect(parsed.nodes.length).toBeGreaterThanOrEqual(3);
  });

  it('copies sequence mermaid as both mermaid and source DSL', () => {
    expect(toMermaidSource(SEQUENCE, 'sequence')).toContain('sequenceDiagram');
    expect(toDslSource(SEQUENCE, 'sequence')).toContain('U->>A: GET /orders');
  });
});

describe('renameNodeInSource', () => {
  it('renames an architecture service and its connects list', () => {
    const dsl = `diagram: architecture
service Gateway {
  connects: API
}
service API {}`;
    const out = renameNodeInSource(dsl, { id: 'gateway', name: 'Gateway' }, 'Edge');
    expect(out).toContain('service Edge');
    expect(out).not.toContain('service Gateway');
    expect(out).toContain('connects: API');
  });

  it('renames a sequence participant display name', () => {
    const out = renameNodeInSource(SEQUENCE, { id: 'U', name: 'User' }, 'Customer');
    expect(out).toContain('participant U as Customer');
  });
});
