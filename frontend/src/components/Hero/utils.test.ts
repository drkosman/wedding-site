import { describe, expect, it } from 'vitest';
import { getSwipeDirection } from './utils';

describe('getSwipeDirection', () => {
  it('recognizes horizontal swipes in both directions', () => {
    expect(getSwipeDirection(120, 100, 40, 110)).toBe('left');
    expect(getSwipeDirection(40, 100, 120, 90)).toBe('right');
  });

  it('ignores short gestures', () => {
    expect(getSwipeDirection(100, 100, 65, 100)).toBeNull();
  });

  it('ignores gestures that are primarily vertical', () => {
    expect(getSwipeDirection(100, 100, 40, 20)).toBeNull();
  });
});
