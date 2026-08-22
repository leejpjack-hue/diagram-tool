import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('share host deploy surface', () => {
  it('does not import from src/ so vite preview works after rsync of server/ only', () => {
    const directory = import.meta.dirname;
    const sources = readdirSync(directory).filter(name => name.endsWith('.ts'));
    expect(sources.length).toBeGreaterThan(0);
    for (const name of sources) {
      const text = readFileSync(join(directory, name), 'utf8');
      expect(text, name).not.toMatch(/from ['"]\.\.\/src\//);
    }
  });
});
