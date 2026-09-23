import { describe, it, expect } from 'vitest';
import { parseDiagram } from './parser';
import { flowToPlainSteps } from './flowToPlainSteps';
import { plainStepsToDSL } from './plainSteps';

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
    expect(lines).toContain('else Model: Model');
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

  it('throws a teachable error on empty / non-flow', () => {
    expect(() => flowToPlainSteps(parseDiagram('diagram: flow\ntitle: "Empty"\n'))).toThrow(/No steps/i);
    const arch = parseDiagram(`diagram: architecture
title: "Arch"
service web { }
`);
    expect(() => flowToPlainSteps(arch)).toThrow(/Flow boards/i);
  });
});
