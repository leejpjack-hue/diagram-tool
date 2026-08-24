import { describe, expect, it } from 'vitest';
import {
  CURSOR_MCP_FOLDER_SENTENCE,
  CURSOR_MCP_PRIVACY_SENTENCE,
  DIAGRAM_TOOL_DIR_PLACEHOLDER,
  cursorMcpJsonSnippet,
} from './cursorMcpSnippet';

describe('cursorMcpJsonSnippet', () => {
  it('emits an mcp.json snippet with a DIAGRAM_TOOL_DIR placeholder', () => {
    const snippet = cursorMcpJsonSnippet();
    const parsed = JSON.parse(snippet) as {
      mcpServers: { 'diagram-tool': { env: { DIAGRAM_TOOL_DIR: string }; command: string } };
    };
    expect(parsed.mcpServers['diagram-tool'].command).toBe('npx');
    expect(parsed.mcpServers['diagram-tool'].env.DIAGRAM_TOOL_DIR).toBe(DIAGRAM_TOOL_DIR_PLACEHOLDER);
    expect(snippet).toContain('src/server.ts');
    expect(CURSOR_MCP_PRIVACY_SENTENCE).toMatch(/nothing is uploaded/i);
    expect(CURSOR_MCP_FOLDER_SENTENCE).toMatch(/DIAGRAM_TOOL_DIR/);
  });
});
