import { describe, expect, it } from 'vitest';
import { parseDiagram } from '../parser/parser';
import { importDrawio, looksLikeDrawio } from './drawioImport';

const TWO_BOXES = `<mxfile host="app.diagrams.net">
  <diagram id="two-boxes" name="Two Boxes">
    <mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="2" value="Intake" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1">
          <mxGeometry x="80" y="80" width="120" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="3" value="Review" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1">
          <mxGeometry x="320" y="80" width="120" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="4" value="" style="endArrow=classic;html=1;" edge="1" parent="1" source="2" target="3">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

const WITH_SWIMLANE = `<mxfile host="app.diagrams.net">
  <diagram name="Pool">
    <mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="lane" value="Pool" style="swimlane;" vertex="1" parent="1">
          <mxGeometry x="40" y="40" width="400" height="200" as="geometry"/>
        </mxCell>
        <mxCell id="2" value="Intake" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="lane">
          <mxGeometry x="40" y="40" width="120" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="3" value="Review" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="lane">
          <mxGeometry x="220" y="40" width="120" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="4" edge="1" parent="1" source="2" target="3">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

const INFRA = `<mxfile host="app.diagrams.net">
  <diagram name="Payments">
    <mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="2" value="API" style="outlineConnect=0;dashed=0;verticalLabelPosition=bottom;html=1;shape=mxgraph.aws4.resourceIcon;" vertex="1" parent="1">
          <mxGeometry x="40" y="40" width="78" height="78" as="geometry"/>
        </mxCell>
        <mxCell id="3" value="OrdersDB" style="outlineConnect=0;dashed=0;html=1;shape=mxgraph.aws4.rds;" vertex="1" parent="1">
          <mxGeometry x="280" y="40" width="78" height="78" as="geometry"/>
        </mxCell>
        <mxCell id="4" edge="1" parent="1" source="2" target="3">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

const CONTAINERS_ONLY = `<mxfile host="app.diagrams.net">
  <diagram name="Empty-ish">
    <mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="lane" value="Pool" style="swimlane;" vertex="1" parent="1">
          <mxGeometry x="40" y="40" width="400" height="200" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

describe('looksLikeDrawio', () => {
  it('accepts mxfile and mxGraphModel XML', () => {
    expect(looksLikeDrawio('flow.drawio', TWO_BOXES)).toBe(true);
    expect(looksLikeDrawio('flow.xml', '<mxGraphModel><root/></mxGraphModel>')).toBe(true);
  });

  it('rejects JSON and mermaid', () => {
    expect(looksLikeDrawio('board.json', '{"version":"3.0"}')).toBe(false);
    expect(looksLikeDrawio('flow.mmd', 'flowchart LR\nA --> B')).toBe(false);
  });
});

describe('importDrawio', () => {
  it('maps two boxes and one edge to a flow board', async () => {
    const imported = await importDrawio('two-boxes.drawio', TWO_BOXES);
    expect(imported.mode).toBe('flow');
    expect(imported.title).toBe('Two Boxes');
    expect(imported.mapped).toBe(3);
    expect(imported.skipped).toEqual([]);
    expect(imported.dslText).toMatch(/diagram:\s*flow/);
    expect(imported.dslText).toContain('Intake -> Review');

    const parsed = parseDiagram(imported.dslText);
    expect(parsed.nodes.map(node => node.name)).toEqual(expect.arrayContaining(['Intake', 'Review']));
    expect(parsed.edges).toHaveLength(1);
  });

  it('reports skipped containers and still maps child nodes', async () => {
    const imported = await importDrawio('pool.drawio', WITH_SWIMLANE);
    expect(imported.mapped).toBe(3);
    expect(imported.skipped.some(item => item.kind === 'container')).toBe(true);
    const parsed = parseDiagram(imported.dslText);
    expect(parsed.nodes).toHaveLength(2);
  });

  it('uses architecture when infra stencils dominate', async () => {
    const imported = await importDrawio('payments.drawio', INFRA);
    expect(imported.mode).toBe('architecture');
    expect(imported.dslText).toMatch(/diagram:\s*architecture/);
    expect(imported.dslText).toMatch(/service API/);
    expect(imported.dslText).toMatch(/database OrdersDB/);
    const parsed = parseDiagram(imported.dslText);
    expect(parsed.nodes).toHaveLength(2);
    expect(parsed.edges).toHaveLength(1);
  });

  it('refuses a non-empty file that maps to nothing', async () => {
    await expect(importDrawio('empty.drawio', CONTAINERS_ONLY)).rejects.toThrow(/no mappable nodes/i);
  });

  it('imports a bare mxGraphModel .xml file', async () => {
    const xml = `<mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="2" value="Intake" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1">
          <mxGeometry x="40" y="40" width="120" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="3" value="Review" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1">
          <mxGeometry x="240" y="40" width="120" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="4" edge="1" parent="1" source="2" target="3"/>
      </root>
    </mxGraphModel>`;
    const imported = await importDrawio('flow.xml', xml);
    expect(imported.mode).toBe('flow');
    expect(imported.mapped).toBe(3);
  });
});
