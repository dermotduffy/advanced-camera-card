import { describe, expect, it } from 'vitest';
import { createConditionEvaluator } from '../../../../src/condition-trigger/conditions/factory';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('fullscreen condition', () => {
  it('should match a fullscreen condition', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'fullscreen' as const, fullscreen: true },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(evaluator.evaluate({ fullscreen: true }).result).toBeTruthy();
    expect(evaluator.evaluate({ fullscreen: false }).result).toBeFalsy();
  });
});
