import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import convert from '../skills/type-to-flow/scripts/type-to-flow.js';

const readFixture = async name => JSON.parse(await readFile(new URL(`../fixtures/type-to-flow/${name}.json`, import.meta.url), 'utf8'));
const input = await readFixture('input');
const expected = await readFixture('spike-output');
const result = await convert(input);
assert.deepEqual(result.flow, expected.flow);
assert.match(result.mermaid, /^flowchart TD\n/);
assert.equal(result.warnings.length, 1);
for (const text of ['Start\nIf approved?\nDone', 'If approved?', 'Start\nIf approved?\nSend\nDone']) {
  const { flow } = await convert({ text });
  for (const decision of flow.nodes.filter(node => node.kind === 'decision')) {
    const outgoing = flow.edges.filter(edge => edge.from === decision.id);
    assert.ok(outgoing.length >= 2 && outgoing.every(edge => edge.label?.trim()));
    assert.ok(outgoing.every(edge => flow.nodes.some(node => node.id === edge.to)));
  }
}
await assert.rejects(() => convert({ text: '  ' }), /workflow step/);
console.log(`PROOF_OK=1 converter: ${result.flow.nodes.length} nodes, ${result.flow.edges.length} edges, spike graph isomorphic`);
