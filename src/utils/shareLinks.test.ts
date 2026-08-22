import { describe, expect, it } from 'vitest';
import { viewTokenFromPath } from './shareLinks';

describe('viewTokenFromPath', () => {
  it('reads a tokenized view URL and ignores other routes', () => {
    expect(viewTokenFromPath('/view/abcdefghijklmnopqrstuvwx')).toBe('abcdefghijklmnopqrstuvwx');
    expect(viewTokenFromPath('/view/abcdefghijklmnopqrstuvwx/')).toBe('abcdefghijklmnopqrstuvwx');
    expect(viewTokenFromPath('/')).toBeNull();
    expect(viewTokenFromPath('/view/short')).toBeNull();
  });
});
