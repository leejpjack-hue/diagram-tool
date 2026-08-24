export const DIAGRAM_TOOL_DIR_PLACEHOLDER = '/absolute/path/to/your/boards';
export const MCP_PACKAGE_DIR_PLACEHOLDER = '/absolute/path/to/diagram-tool/mcp';

export const CURSOR_MCP_PRIVACY_SENTENCE =
  'Nothing is uploaded — Cursor talks to a local stdio process that only reads the folder you set as DIAGRAM_TOOL_DIR.';

export const CURSOR_MCP_FOLDER_SENTENCE =
  'File → Open and File → Save use the same folder DIAGRAM_TOOL_DIR points at.';

export function cursorMcpJsonSnippet(): string {
  return `${JSON.stringify({
    mcpServers: {
      'diagram-tool': {
        command: 'npx',
        args: ['-y', 'tsx', 'src/server.ts'],
        cwd: MCP_PACKAGE_DIR_PLACEHOLDER,
        env: {
          DIAGRAM_TOOL_DIR: DIAGRAM_TOOL_DIR_PLACEHOLDER,
        },
      },
    },
  }, null, 2)}\n`;
}
