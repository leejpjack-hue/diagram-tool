import { afterEach, describe, expect, it } from 'vitest';
import {
  BOARD_FILE_PICKER_TYPES,
  OPEN_FILE_ACCEPT,
  OPEN_FILE_PICKER_TYPES,
  boardFileHandles,
  isBoardJsonFilename,
  mustSaveBoardJsonAsNewFile,
  type FileSystemFileHandleLike,
} from './fileSystemAccess';

function handle(name: string): FileSystemFileHandleLike {
  return {
    name,
    getFile: async () => new File([''], name),
    createWritable: async () => ({ write: async () => undefined, close: async () => undefined }),
  };
}

afterEach(() => {
  boardFileHandles.clear();
});

describe('File → Open accept list', () => {
  it('lists JSON, Mermaid, native DSL, and draw.io', () => {
    expect(OPEN_FILE_ACCEPT).toBe('.json,.board.json,.mmd,.mermaid,.txt,.dsl,.drawio,.xml');
    expect(OPEN_FILE_PICKER_TYPES.map(type => type.description)).toEqual([
      'DiagramTool board',
      'Mermaid',
      'Native DSL',
      'draw.io',
    ]);
    expect(BOARD_FILE_PICKER_TYPES).toEqual([
      { description: 'DiagramTool board', accept: { 'application/json': ['.json'] } },
    ]);
  });
});

describe('mustSaveBoardJsonAsNewFile', () => {
  it('Save on a mermaid or draw.io handle does not write JSON onto that file', () => {
    expect(mustSaveBoardJsonAsNewFile(handle('checkout.mmd'), 'source')).toBe(true);
    expect(mustSaveBoardJsonAsNewFile(handle('flow.drawio'), 'source')).toBe(true);
    expect(mustSaveBoardJsonAsNewFile(handle('arch.dsl'), 'source')).toBe(true);
    expect(mustSaveBoardJsonAsNewFile(handle('payments.json'), 'board-json')).toBe(false);
    expect(mustSaveBoardJsonAsNewFile(undefined)).toBe(true);
  });

  it('treats .mmd / .drawio filenames as non-JSON even without a stored format', () => {
    expect(isBoardJsonFilename('checkout.mmd')).toBe(false);
    expect(isBoardJsonFilename('flow.drawio')).toBe(false);
    expect(isBoardJsonFilename('payments.json')).toBe(true);
    expect(mustSaveBoardJsonAsNewFile(handle('checkout.mmd'))).toBe(true);
  });
});
