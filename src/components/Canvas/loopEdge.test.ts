import { describe, expect, it } from 'vitest';
import { isUpstreamEdge, loopReturnPath } from './loopEdge';

const source = { x: 400, y: 340, width: 160, height: 64 };
const target = { x: 400, y: 100, width: 160, height: 64 };

describe('loop return routing (DT-AI-25)', () => {
  it('TB return channel sits left of both nodes, off the forward column', () => {
    const geometry = loopReturnPath(source, target, 'TB');
    const spine = source.x + source.width / 2;
    expect(geometry.channel).toBeLessThan(source.x);
    expect(geometry.channel).toBeLessThan(target.x);
    expect(geometry.channel).toBeLessThan(spine);
    expect(geometry.path.startsWith('M 400 ')).toBe(true);
  });

  it('LR return channel sits above both nodes, off the forward row', () => {
    const left = { x: 100, y: 220, width: 160, height: 64 };
    const right = { x: 540, y: 220, width: 160, height: 64 };
    const geometry = loopReturnPath(right, left, 'LR');
    const spine = left.y + left.height / 2;
    expect(geometry.channel).toBeLessThan(left.y);
    expect(geometry.channel).toBeLessThan(right.y);
    expect(geometry.channel).toBeLessThan(spine);
  });

  it('treats an upward or leftward target as upstream and ignores forward edges', () => {
    expect(isUpstreamEdge(source, target, 'TB')).toBe(true);
    expect(isUpstreamEdge(target, source, 'TB')).toBe(false);
    expect(isUpstreamEdge({ x: 540, y: 220 }, { x: 100, y: 220 }, 'LR')).toBe(true);
    expect(isUpstreamEdge({ x: 100, y: 220 }, { x: 540, y: 220 }, 'LR')).toBe(false);
    expect(isUpstreamEdge(undefined, target, 'TB')).toBe(false);
  });
});
