import { describe, expect, it } from 'vitest';
import { parseDiagram } from '../parser/parser';
import {
  applyBoardSource,
  CONVERTED_FROM_MERMAID_GANTT,
  detectMermaidMode,
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

  it('imports a mermaid gantt file as native diagram: gantt', () => {
    const imported = detectRawDiagramImport('sprint.mmd', `gantt
title Sprint Plan
dateFormat YYYY-MM-DD
Design :a1, 2026-08-01, 4d
Implement :after a1, 5d
`);
    expect(imported).toMatchObject({ mode: 'gantt', title: 'Sprint Plan' });
    expect(imported?.dslText).toMatch(/diagram:\s*gantt/);
    expect(imported?.dslText).toContain('duration: 4d');
    expect(imported?.dslText).toContain('duration: 5d');
    expect(imported?.dslText).toContain('after: Design');
    expect(imported?.dslText).not.toMatch(/^gantt\b/m);
  });

  it('imports a mermaid gantt .txt the same way', () => {
    const imported = detectRawDiagramImport('plan.txt', '%% note\n\ngantt\ntitle Roadmap\nDesign :a1, 2026-08-01, 2d\n');
    expect(imported?.mode).toBe('gantt');
    expect(imported?.title).toBe('Roadmap');
    expect(imported?.dslText).toContain('task Design');
  });

  it('rejects an empty mermaid gantt instead of returning a board', () => {
    expect(() => detectRawDiagramImport('empty.mmd', 'gantt\ntitle Empty plan\n')).toThrow(/couldn't be opened/i);
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

  it('rejects Mermaid gantt that the native parser cannot schedule', () => {
    const result = applyBoardSource(`gantt
title Cycle
dateFormat YYYY-MM-DD
Design :a1, after a2, 2d
Build :a2, after a1, 2d
`, 'gantt');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Circular dependency: Design → Build → Design/);
  });
});

const MERMAID_GANTT = `gantt
title Sprint Plan
dateFormat YYYY-MM-DD
section Build
Design :a1, 2026-08-01, 4d
Implement :a2, after a1, 5d
Ship :milestone, m1, after a2, 0d
`;

describe('applyBoardSource Mermaid gantt routing', () => {
  it('converts Mermaid gantt on a Gantt board via mermaidGanttToDSL', () => {
    const result = applyBoardSource(MERMAID_GANTT, 'gantt');
    expect(result.ok).toBe(true);
    if (!result.ok || result.kind !== 'gantt') return;
    expect(result.dslText).toMatch(/^diagram:\s*gantt/m);
    expect(result.dslText).toContain('title: Sprint Plan');
    expect(result.dslText).toContain('duration: 4d');
    expect(result.dslText).toContain('duration: 5d');
    expect(result.dslText).toContain('after: Design');
    expect(result.dslText).toContain('group Build');
    expect(result.dslText).toContain('milestone: true');
    expect(result.dslText).not.toMatch(/^gantt\b/m);
    expect(result.warnings[0]).toBe(CONVERTED_FROM_MERMAID_GANTT);
    expect(result.project.tasks.map(task => task.name)).toEqual(expect.arrayContaining(['Build', 'Design', 'Implement', 'Ship']));
    expect(result.project.tasks.find(task => task.name === 'Ship')?.milestone).toBe(true);
    expect(result.project.dependencies.length).toBeGreaterThan(0);

    const again = applyBoardSource(result.dslText!, 'gantt');
    expect(again.ok).toBe(true);
    if (again.ok && again.kind === 'gantt') {
      expect(again.warnings[0]).toBe(CONVERTED_FROM_MERMAID_GANTT);
      expect(again.dslText).toBeUndefined();
    }
  });

  it('does not attach the conversion note to a different native plan', () => {
    const result = applyBoardSource(`diagram: gantt
title: Other
task Other {
  start: 2026-09-01
  end: 2026-09-03
}`, 'gantt');
    expect(result.ok).toBe(true);
    if (result.ok && result.kind === 'gantt') {
      expect(result.warnings).not.toContain(CONVERTED_FROM_MERMAID_GANTT);
    }
  });

  it('auto-switches Mermaid gantt on Flow, Architecture, and Sequence boards to gantt mode', () => {
    for (const mode of ['flow', 'architecture', 'sequence'] as const) {
      const result = applyBoardSource(MERMAID_GANTT, mode);
      expect(result.ok).toBe(true);
      if (!result.ok || result.kind !== 'gantt') continue;
      expect(result.mode).toBe('gantt');
      expect(result.dslText).toMatch(/^diagram:\s*gantt/m);
      expect(result.warnings[0]).toBe(CONVERTED_FROM_MERMAID_GANTT);
      expect(result.project.tasks.map(task => task.name)).toEqual(expect.arrayContaining(['Build', 'Design', 'Implement', 'Ship']));
    }
  });

  it('leaves an empty Mermaid gantt as a parser error across all modes', () => {
    for (const mode of ['gantt', 'flow', 'architecture', 'sequence'] as const) {
      const result = applyBoardSource('gantt\ntitle Empty plan\n', mode);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/couldn't be opened/i);
    }
  });

  it('does not treat a flow that merely mentions gantt as Mermaid gantt', () => {
    const result = applyBoardSource(`diagram: flow
title: Gantt rollout
direction: LR
Intake -> Review
Review -> Done`, 'flow');
    expect(result.ok).toBe(true);
    if (result.ok && result.kind === 'diagram') {
      expect(result.mode).toBe('flow');
      expect(result.parsed.nodes.map(node => node.name)).toEqual(expect.arrayContaining(['Intake', 'Review', 'Done']));
    }
  });

  it('still parses native Gantt DSL without a conversion note', () => {
    const result = applyBoardSource(`diagram: gantt
title: Native
task Design {
  start: 2026-08-01
  end: 2026-08-04
}`, 'gantt');
    expect(result.ok).toBe(true);
    if (result.ok && result.kind === 'gantt') {
      expect(result.mode).toBe('gantt');
      expect(result.dslText).toBeUndefined();
      expect(result.warnings).not.toContain(CONVERTED_FROM_MERMAID_GANTT);
      expect(result.project.tasks.map(task => task.name)).toEqual(['Design']);
    }
  });

  it('auto-switches a Mermaid sequenceDiagram to sequence mode from any board', () => {
    for (const mode of ['sequence', 'flow', 'architecture', 'gantt'] as const) {
      const result = applyBoardSource(SEQUENCE, mode);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.kind).toBe('sequence');
        expect(result.mode).toBe('sequence');
      }
    }
  });

  it('auto-switches a Mermaid flowchart / graph to flow mode from any board', () => {
    for (const mode of ['flow', 'architecture', 'sequence', 'gantt'] as const) {
      const flowResult = applyBoardSource(FLOW_MERMAID, mode);
      expect(flowResult.ok).toBe(true);
      if (flowResult.ok && flowResult.kind === 'diagram') {
        expect(flowResult.mode).toBe('flow');
        expect(flowResult.parsed.mode).toBe('flow');
        expect(flowResult.parsed.nodes.map(node => node.name)).toEqual(expect.arrayContaining(['Intake', 'Review', 'Done']));
      }

      const graphResult = applyBoardSource('graph TD\nA[Start] --> B[End]\n', mode);
      expect(graphResult.ok).toBe(true);
      if (graphResult.ok && graphResult.kind === 'diagram') {
        expect(graphResult.mode).toBe('flow');
        expect(graphResult.parsed.mode).toBe('flow');
        expect(graphResult.parsed.nodes).toHaveLength(2);
      }
    }
  });

  it('detects Mermaid target modes via detectMermaidMode', () => {
    expect(detectMermaidMode(FLOW_MERMAID)).toBe('flow');
    expect(detectMermaidMode('graph TD\nA-->B')).toBe('flow');
    expect(detectMermaidMode(SEQUENCE)).toBe('sequence');
    expect(detectMermaidMode(MERMAID_GANTT)).toBe('gantt');
    expect(detectMermaidMode(FLOW_DSL)).toBeNull();
    expect(detectMermaidMode('erDiagram\n  A ||--o{ B : has')).toBeNull();
  });

  it('rejects unknown/unsupported Mermaid types with clear copy naming the type on every board', () => {
    const unsupportedCases: Array<[string, string]> = [
      ['erDiagram\n  CUSTOMER ||--o{ ORDER : places\n', "Mermaid erDiagram isn't supported yet."],
      ['classDiagram\n  class Animal\n', "Mermaid classDiagram isn't supported yet."],
      ['mindmap\n  root((ideas))\n', "Mermaid mindmap isn't supported yet."],
      ['stateDiagram-v2\n  [*] --> Still\n', "Mermaid stateDiagram-v2 isn't supported yet."],
      ['pie title Pets\n  "Dogs" : 386\n', "Mermaid pie isn't supported yet."],
      ['gitGraph\n  commit\n', "Mermaid gitGraph isn't supported yet."],
      ['journey\n  title Working day\n', "Mermaid journey isn't supported yet."],
      ['quadrantChart\n  title Reach\n', "Mermaid quadrantChart isn't supported yet."],
      ['timeline\n  title History\n', "Mermaid timeline isn't supported yet."],
      ['unknownDiagram\n  A --> B\n', "Mermaid unknownDiagram isn't supported yet."],
    ];

    for (const [source, expectedError] of unsupportedCases) {
      for (const mode of ['flow', 'architecture', 'sequence', 'gantt'] as const) {
        const result = applyBoardSource(source, mode);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBe(expectedError);
        }
      }
    }
  });

  it('converts a leading gantt keyword after a mermaid comment', () => {
    const result = applyBoardSource('%% note\n\ngantt\ntitle Roadmap\nDesign :a1, 2026-08-01, 2d\n', 'gantt');
    expect(result.ok).toBe(true);
    if (result.ok && result.kind === 'gantt') {
      expect(result.dslText).toContain('task Design');
      expect(result.warnings[0]).toBe(CONVERTED_FROM_MERMAID_GANTT);
    }
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
