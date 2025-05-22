import { describe, expect, it } from 'vitest';
import { isTriggeredState } from '../../src/ha/is-triggered-state';

describe('isTriggeredState', () => {
  it('returns true for a state included in STATES_ON', () => {
    expect(isTriggeredState('on')).toBe(true);
    expect(isTriggeredState('open')).toBe(true);
    expect(isTriggeredState('unlocked')).toBe(true);
  });

  it('returns false for a state not included in STATES_ON', () => {
    expect(isTriggeredState('off')).toBe(false);
    expect(isTriggeredState('closed')).toBe(false);
    expect(isTriggeredState('locked')).toBe(false);
    expect(isTriggeredState('other')).toBe(false);
  });

  it('returns false for undefined or empty state', () => {
    expect(isTriggeredState()).toBe(false);
  });
});
