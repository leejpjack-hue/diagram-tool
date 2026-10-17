import { describe, it, expect } from 'vitest';
import {
  nextShowStepsAfterBuild,
  statsFromPlainStepsDsl,
  buildFromStepsSuccessMessage,
} from './buildFromStepsPanel';
import { plainStepsToDSL } from '../../parser/plainSteps';

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

describe('buildFromStepsSuccessMessage / statsFromPlainStepsDsl (DT-AI-13)', () => {
  it('formats step count without roles', () => {
    const dsl = plainStepsToDSL('Verify email\nSend reply\nArchive\nDone');
    const stats = statsFromPlainStepsDsl(dsl);
    expect(stats.stepCount).toBe(4);
    expect(buildFromStepsSuccessMessage(stats)).toBe('Built 4 steps onto the board');
  });

  it('uses singular "step" for one node', () => {
    const stats = statsFromPlainStepsDsl(plainStepsToDSL('Only one'));
    expect(stats.stepCount).toBe(1);
    expect(buildFromStepsSuccessMessage(stats)).toBe('Built 1 step onto the board');
  });

  it('appends compact role summary when roles present (omit zeros)', () => {
    const dsl = plainStepsToDSL('User: ask\nModel: draft\nModel: refine\nTool: search');
    const stats = statsFromPlainStepsDsl(dsl);
    expect(stats.stepCount).toBe(4);
    expect(stats.roles).toEqual({ human: 1, model: 2, tool: 1, check: 0 });
    expect(buildFromStepsSuccessMessage(stats)).toBe(
      'Built 4 steps onto the board · 1 Human · 2 Model · 1 Tool',
    );
  });

  it('counts decision nodes as steps', () => {
    const dsl = plainStepsToDSL('If invalid then Retry else Flag');
    const stats = statsFromPlainStepsDsl(dsl);
    expect(stats.stepCount).toBe(3); // invalid (decision) + Retry + Flag
    expect(buildFromStepsSuccessMessage(stats)).toBe('Built 3 steps onto the board');
  });

  it('handles pure message builder with explicit stats', () => {
    expect(
      buildFromStepsSuccessMessage({
        stepCount: 2,
        roles: { human: 0, model: 0, tool: 0, check: 2 },
        dataCount: 0,
      }),
    ).toBe('Built 2 steps onto the board · 2 Check');
  });

  it('counts data and document steps and appends "N data" (DT-AI-24)', () => {
    const dsl = plainStepsToDSL('Ask\nData: tickets\nModel: draft\nTool: search\nFile: log\nSend');
    const stats = statsFromPlainStepsDsl(dsl);
    expect(stats.stepCount).toBe(6);
    expect(stats.dataCount).toBe(2);
    expect(stats.roles).toEqual({ human: 0, model: 1, tool: 1, check: 0 });
    expect(buildFromStepsSuccessMessage(stats)).toBe(
      'Built 6 steps onto the board · 1 Model · 1 Tool · 2 data',
    );
  });

  it('omits the data tally when no data steps are present', () => {
    const stats = statsFromPlainStepsDsl(plainStepsToDSL('Verify email\nSend reply'));
    expect(stats.dataCount).toBe(0);
    expect(buildFromStepsSuccessMessage(stats)).toBe('Built 2 steps onto the board');
  });
});
