import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { hasPopOutAnimationEnded } from '../../src/utils/animation.js';

describe('hasPopOutAnimationEnded', () => {
  const element = mock<EventTarget>();

  it('should return true when a pop-out animation ends on the bound element', () => {
    expect(
      hasPopOutAnimationEnded({
        target: element,
        currentTarget: element,
        animationName: 'pop-out',
      }),
    ).toBe(true);
  });

  it('should return false when the event bubbled from a descendant', () => {
    expect(
      hasPopOutAnimationEnded({
        target: mock<EventTarget>(),
        currentTarget: element,
        animationName: 'pop-out',
      }),
    ).toBe(false);
  });

  it('should return false for a different animation', () => {
    expect(
      hasPopOutAnimationEnded({
        target: element,
        currentTarget: element,
        animationName: 'pop-in',
      }),
    ).toBe(false);
  });
});
