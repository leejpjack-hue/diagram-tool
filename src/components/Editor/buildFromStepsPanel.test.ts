import { describe, it, expect } from 'vitest';
import { nextShowStepsAfterBuild } from './buildFromStepsPanel';

describe('nextShowStepsAfterBuild (DT-AI-11)', () => {
  it('keeps Type steps open after successful Build', () => {
    expect(nextShowStepsAfterBuild(true, 'success')).toBe(true);
    // Even if somehow closed when Build succeeds, stay / become open.
    expect(nextShowStepsAfterBuild(false, 'success')).toBe(true);
  });

  it('leaves panel state alone on empty or error', () => {
    expect(nextShowStepsAfterBuild(true, 'empty')).toBe(true);
    expect(nextShowStepsAfterBuild(false, 'empty')).toBe(false);
    expect(nextShowStepsAfterBuild(true, 'error')).toBe(true);
    expect(nextShowStepsAfterBuild(false, 'error')).toBe(false);
  });
});
