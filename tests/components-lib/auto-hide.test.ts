import { describe, expect, it } from 'vitest';
import { isAutoHidden, resolveAutoHideState } from '../../src/components-lib/auto-hide';

describe('isAutoHidden', () => {
  it('should not hide with an empty condition list', () => {
    expect(isAutoHidden([], { call: true, casting: true })).toBe(false);
  });

  it('should hide when a configured condition is active', () => {
    expect(isAutoHidden(['call'], { call: true, casting: false })).toBe(true);
  });

  it('should not hide when no configured condition is active', () => {
    expect(isAutoHidden(['call'], { call: false, casting: true })).toBe(false);
  });

  it('should hide when any of multiple configured conditions is active', () => {
    expect(isAutoHidden(['call', 'casting'], { call: false, casting: true })).toBe(true);
  });
});

describe('resolveAutoHideState', () => {
  it('should resolve with the supplied call state', () => {
    expect(resolveAutoHideState(true)).toEqual({ call: true, casting: false });
  });

  it('should default the call state to false', () => {
    expect(resolveAutoHideState()).toEqual({ call: false, casting: false });
  });
});
