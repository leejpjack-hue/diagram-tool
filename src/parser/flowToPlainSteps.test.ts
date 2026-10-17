import { describe, it, expect } from 'vitest';
import { parseDiagram } from './parser';
import { flowStepList, flowToPlainSteps } from './flowToPlainSteps';
import { plainStepsToDSL } from './plainSteps';
import { plainStepsFromBoardSource } from './boardToPlainSteps';

describe('flowToPlainSteps (DT-AI-05)', () => {
  it('emits one node per line in topological order for a plain chain', () => {
    const parsed = parseDiagram(`diagram: flow
title: "Chain"
A -> B
B -> C
node A {
  label: "Ask"
}
node B {
  label: "Draft"
}
node C {
  label: "Send"
}
`);
    expect(flowToPlainSteps(parsed).split('\n')).toEqual(['Ask', 'Draft', 'Send']);
  });

  it('prefixes Human:/Model:/Tool:/Check: from node roles', () => {
    const parsed = parseDiagram(`diagram: flow
Ask -> Model
node Ask {
  label: "ask the question"
  role: human
}
node Model {
  label: "draft reply"
  role: model
}
`);
    expect(flowToPlainSteps(parsed)).toBe('Human: ask the question\nModel: draft reply');
  });

  it('formats Yes/No decision as If / then / else', () => {
    const parsed = parseDiagram(`diagram: flow
D ->|Yes| Y
D ->|No| N
node D {
  type: decision
  label: "email valid"
}
node Y {
  label: "Deliver"
}
node N {
  label: "Bounce"
}
`);
    expect(flowToPlainSteps(parsed).split('\n')).toEqual([
      'If email valid',
      'then Deliver',
      'else Bounce',
    ]);
  });

  it('treats ok/retry labels as Yes/No stand-ins (AI workflow)', () => {
    const parsed = parseDiagram(`diagram: flow
title: AI workflow
Ask -> Model
Model -> Tool
Tool -> Check
Check ->|retry| Model
Check ->|ok| Reply
node Ask {
  label: "Human ask"
  role: human
}
node Model {
  label: "Model"
  role: model
}
node Tool {
  label: "Tool"
  role: tool
}
node Check {
  type: decision
  label: "Check"
  role: check
}
node Reply {
  label: "Reply"
  role: human
}
`);
    const lines = flowToPlainSteps(parsed).split('\n');
    expect(lines[0]).toBe('Human: Human ask');
    expect(lines).toContain('If Check: Check');
    expect(lines).toContain('then Human: Reply');
    expect(lines).toContain('else go back to Model');
  });

  it('round-trips a role-word chain through plainStepsToDSL', () => {
    const input = 'Human: ask\nModel: draft\nTool: search';
    const parsed = parseDiagram(plainStepsToDSL(input));
    const back = flowToPlainSteps(parsed);
    // Without DT-AI-04, labels keep the role words; with it, roles re-prefix.
    // Either way the readable lines match the typed vocabulary.
    expect(back.split('\n')).toEqual([
      'Human: ask',
      'Model: draft',
      'Tool: search',
    ]);
  });

  it('round-trips step notes through Copy as steps (DT-AI-15)', () => {
    const input = 'Model: draft reply — uses the last 3 tickets\nthen Send reply -- blocks if confidence < 0.8\nHuman: review — spot-check tone';
    const parsed = parseDiagram(plainStepsToDSL(input));
    const back = flowToPlainSteps(parsed);
    expect(back.split('\n')).toEqual([
      'Model: draft reply — uses the last 3 tickets',
      'Send reply — blocks if confidence < 0.8',
      'Human: review — spot-check tone',
    ]);
    // The emitted lines rebuild the same board: labels, notes and edges.
    const rebuilt = parseDiagram(plainStepsToDSL(back));
    const props = (id: string) => {
      const n = rebuilt.nodes.find(x => x.id === id);
      return n && n.type === 'flow' ? n.properties : undefined;
    };
    expect(props('draft_reply')).toMatchObject({ label: 'draft reply', role: 'model', note: 'uses the last 3 tickets' });
    expect(props('send_reply')).toMatchObject({ label: 'Send reply', note: 'blocks if confidence < 0.8' });
    expect(props('review')).toMatchObject({ label: 'review', role: 'human', note: 'spot-check tone' });
    expect(rebuilt.edges.map(e => `${e.from}->${e.to}`)).toEqual([
      'draft_reply->send_reply',
      'send_reply->review',
    ]);
    // Pasting the copied text back yields byte-identical DSL.
    expect(plainStepsToDSL(back)).toBe(plainStepsToDSL(input));
  });

  it('round-trips Data:/File: and collapses Memory:/DB: to Data: (DT-AI-24)', () => {
    const input = 'Human: ask\nData: customer tickets\nMemory: vector store\nDB crm\nFile: brief — signed copy';
    const once = plainStepsToDSL(input);
    const copied = flowToPlainSteps(parseDiagram(once));
    expect(copied).toBe(
      'Human: ask\nData: customer tickets\nData: vector store\nData: crm\nFile: brief — signed copy',
    );
    // build → copy → build is stable: aliases collapse, then the Data:/File: text rebuilds the same DSL.
    expect(plainStepsToDSL(copied)).toBe(once);
    const again = flowToPlainSteps(parseDiagram(plainStepsToDSL(copied)));
    expect(again).toBe(copied);

    const viaLoad = plainStepsFromBoardSource(once);
    expect(viaLoad).toBe(copied);
  });

  it('emits Data:/File: for hand-authored data and document nodes and skips the role', () => {
    const parsed = parseDiagram(`diagram: flow
title: "Data"
Ask -> Tickets
Tickets -> Brief
node Ask {
  label: "ask"
  role: human
}
node Tickets {
  type: data
  label: "tickets"
  role: model
}
node Brief {
  type: document
  label: "brief"
}
`);
    expect(flowToPlainSteps(parsed)).toBe('Human: ask\nData: tickets\nFile: brief');
  });

  it('round-trips go back to through Copy as steps (DT-AI-25)', () => {
    const input = [
      'Model: draft reply',
      'Check: quality ok?',
      'If no then go back to draft reply',
      'Send',
    ].join('\n');
    const once = plainStepsToDSL(input);
    const copied = flowToPlainSteps(parseDiagram(once));
    expect(copied).toContain('go back to draft reply');
    expect(copied).not.toContain('go back to Model:');
    expect(plainStepsToDSL(copied)).toBe(once);

    const plain = 'Draft reply\nCheck quality\nrepeat from Draft reply\nSend';
    const plainOnce = plainStepsToDSL(plain);
    expect(plainStepsToDSL(flowToPlainSteps(parseDiagram(plainOnce)))).toBe(plainOnce);
  });

  it('leaves note-less steps unchanged in Copy as steps output (DT-AI-15)', () => {
    const parsed = parseDiagram(`diagram: flow
title: "Plain"
A -> B
node A {
  label: "Ask"
  role: human
}
node B {
  label: "Draft"
}
`);
    expect(flowToPlainSteps(parsed)).toBe('Human: Ask\nDraft');
  });

  it('throws a teachable error on empty / non-flow', () => {
    expect(() => flowToPlainSteps(parseDiagram('diagram: flow\ntitle: "Empty"\n'))).toThrow(/No steps/i);
    const arch = parseDiagram(`diagram: architecture
title: "Arch"
service web { }
`);
    expect(() => flowToPlainSteps(arch)).toThrow(/Flow boards/i);
  });
});

describe('flowStepList (DT-AI-14 walk-through order = Copy as steps order)', () => {
  // Fixture flow with a decision and roles — the shape the AI workflow
  // template produces (Human → Model → Tool → Check → ok/retry).
  const dsl = `diagram: flow
title: "AI workflow"
Ask -> Model
Model -> Tool
Tool -> Check
Check ->|retry| Model
Check ->|ok| Reply
node Ask {
  label: "Human ask"
  role: human
}
node Model {
  label: "Model"
  role: model
}
node Tool {
  label: "Tool"
  role: tool
}
node Check {
  type: decision
  label: "Check"
  role: check
}
node Reply {
  label: "Reply"
  role: human
}
`;

  it('joined step lines are exactly the Copy as steps text (one source of order)', () => {
    const parsed = parseDiagram(dsl);
    const steps = flowStepList(parsed);
    expect(steps.map(s => s.line).join('\n')).toBe(flowToPlainSteps(parsed));
    expect(steps.map(s => s.line).join('\n')).toBe(plainStepsFromBoardSource(dsl));
  });

  it('walks the decision branches in Copy-as-steps line order, ids resolve to nodes', () => {
    const parsed = parseDiagram(dsl);
    const nodeIds = new Set(parsed.nodes.map(n => n.id));
    const steps = flowStepList(parsed);

    expect(steps.map(s => s.line)).toEqual([
      'Human: Human ask',
      'Model: Model',
      'Tool: Tool',
      'If Check: Check',
      'then Human: Reply',
      'else go back to Model',
    ]);
    for (const step of steps) {
      expect(nodeIds.has(step.id)).toBe(true);
    }
  });

  it('throws the same teachable errors as Copy as steps', () => {
    expect(() => flowStepList(parseDiagram('diagram: flow\ntitle: "Empty"\n'))).toThrow(/No steps on this board/i);
    expect(() => flowStepList(parseDiagram('diagram: architecture\ntitle: "Arch"\nservice web { }\n'))).toThrow(/Flow boards/i);
  });
});
