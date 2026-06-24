import { describe, expect, it } from 'vitest';

import { isActionAllowedBasedOnInteractionState } from '../../src/utils/interaction-mode';

describe('isActionAllowedBasedOnInteractionState', () => {
  it('should handle interactionMode: all', () => {
    expect(isActionAllowedBasedOnInteractionState('all', true)).toBeTruthy();
    expect(isActionAllowedBasedOnInteractionState('all', false)).toBeTruthy();
  });

  it('should handle interactionMode: active', () => {
    expect(isActionAllowedBasedOnInteractionState('active', true)).toBeTruthy();
    expect(isActionAllowedBasedOnInteractionState('active', false)).toBeFalsy();
  });

  it('should handle interactionMode: inactive', () => {
    expect(isActionAllowedBasedOnInteractionState('inactive', true)).toBeFalsy();
    expect(isActionAllowedBasedOnInteractionState('inactive', false)).toBeTruthy();
  });
});
