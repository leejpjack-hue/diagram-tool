import { describe, expect, it } from 'vitest';
import { ICON_STYLES, roleLaneColor } from './iconStyles';

describe('roleLaneColor (DT-AI-27)', () => {
  it('uses the active style role colours for role lanes', () => {
    expect(roleLaneColor('Human', 'clean')).toBe(ICON_STYLES.clean.types.human.color);
    expect(roleLaneColor('AI agent', 'clean')).toBe(ICON_STYLES.clean.types.agent.color);
    expect(roleLaneColor('Tool', 'clean')).toBe(ICON_STYLES.clean.types.tool.color);
    expect(roleLaneColor('Check', 'clean')).toBe(ICON_STYLES.clean.types.check.color);
    expect(roleLaneColor('Data', 'clean')).toBe(ICON_STYLES.clean.types.data.color);
    expect(roleLaneColor('Other', 'clean')).toBe(ICON_STYLES.clean.types.step.color);
    expect(roleLaneColor('Human', 'line')).toBe(ICON_STYLES.line.types.human.color);
    expect(roleLaneColor('AI agent', 'blueprint')).toBe(ICON_STYLES.blueprint.types.agent.color);
    expect(roleLaneColor('Tool', 'bold')).toBe(ICON_STYLES.bold.types.tool.color);
  });

  it('leaves a custom lane title alone', () => {
    expect(roleLaneColor('Customer', 'clean')).toBeNull();
    expect(roleLaneColor('LoanOfficer', 'bold')).toBeNull();
  });
});
