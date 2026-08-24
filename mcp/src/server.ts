#!/usr/bin/env node
// Local stdio MCP for DiagramTool portable board JSON (docs/board-format.md).
// Reads and writes version 3.x kind:"board" files in DIAGRAM_TOOL_DIR.
// No HTTP listener, no OAuth, no remote share store.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import {
  BOARD_MODES,
  createBoard,
  getBoard,
  listBoards,
  resolveBoardsDir,
  setSource,
} from '../../src/utils/localMcpBoards.ts';

const server = new McpServer({
  name: 'diagram-tool',
  version: '0.1.0',
});

function textResult(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { isError: true as const, content: [{ type: 'text' as const, text: message }] };
}

server.registerTool(
  'list_boards',
  {
    description:
      'List single-board JSON files (version 3.x, kind: "board") in DIAGRAM_TOOL_DIR. ' +
      'Ignores workspace backups and unknown files. Returns filename, title, mode, and mtime.',
    inputSchema: {},
  },
  async () => {
    try {
      return textResult(listBoards(resolveBoardsDir()));
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  'get_board',
  {
    description:
      'Read one board JSON file. Returns title, mode, source text, and a short node/edge summary. ' +
      'Does not return presentation rasters or thumbnails.',
    inputSchema: {
      filename: z.string().describe('Board file name inside DIAGRAM_TOOL_DIR, e.g. payments.json'),
    },
  },
  async ({ filename }) => {
    try {
      return textResult(getBoard(filename, resolveBoardsDir()));
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  'set_source',
  {
    description:
      'Replace board.source.text and dslText. Validates with the same parsers the app uses. ' +
      'Invalid source returns an error and leaves the file unchanged. Does not rewrite nodes or edges.',
    inputSchema: {
      filename: z.string().describe('Board file name inside DIAGRAM_TOOL_DIR.'),
      source: z.string().describe('Replacement DSL or Mermaid source text.'),
    },
  },
  async ({ filename, source }) => {
    try {
      return textResult(setSource(filename, source, resolveBoardsDir()));
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  'create_board',
  {
    description:
      'Create a new version 3.0 kind:"board" JSON file. Writes source only; nodes and edges stay empty ' +
      'so the app import path rebuilds the graph when the file is opened.',
    inputSchema: {
      title: z.string().describe('Board title.'),
      mode: z.enum(BOARD_MODES).describe('Board mode.'),
      source: z.string().describe('Initial DSL or Mermaid source text.'),
    },
  },
  async ({ title, mode, source }) => {
    try {
      return textResult(createBoard({ title, mode, source }, resolveBoardsDir()));
    } catch (error) {
      return errorResult(error);
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[diagram-tool-mcp] local stdio server ready');
}

main().catch(error => {
  console.error('[diagram-tool-mcp] fatal:', error);
  process.exit(1);
});
