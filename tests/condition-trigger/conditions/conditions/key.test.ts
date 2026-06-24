import { describe, expect, it } from 'vitest';

import { createConditionEvaluator } from '../../../../src/condition-trigger/conditions/factory';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('key condition', () => {
  it('should match a simple keypress', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'key' as const, key: 'a' },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(
      evaluator.evaluate({
        keys: {
          a: { state: 'down', ctrl: false, shift: false, alt: false, meta: false },
        },
      }).result,
    ).toBeTruthy();
    expect(
      evaluator.evaluate({
        keys: {
          a: { state: 'up', ctrl: false, shift: false, alt: false, meta: false },
        },
      }).result,
    ).toBeFalsy();
  });

  it('should match a keypress with modifiers', () => {
    const evaluator = createConditionEvaluator(
      {
        condition: 'key' as const,
        key: 'a',
        state: 'down' as const,
        ctrl: true,
        shift: true,
        alt: true,
        meta: true,
      },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(
      evaluator.evaluate({
        keys: {
          a: { state: 'down', ctrl: false, shift: false, alt: false, meta: false },
        },
      }).result,
    ).toBeFalsy();
    expect(
      evaluator.evaluate({
        keys: {
          a: { state: 'down', ctrl: true, shift: true, alt: true, meta: false },
        },
      }).result,
    ).toBeFalsy();
    expect(
      evaluator.evaluate({
        keys: {
          a: { state: 'down', ctrl: true, shift: true, alt: true, meta: true },
        },
      }).result,
    ).toBeTruthy();
  });
});
