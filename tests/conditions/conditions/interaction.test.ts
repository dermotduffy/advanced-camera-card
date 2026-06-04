import { describe, expect, it } from 'vitest';
import { createConditionEvaluator } from '../../../src/conditions/factory';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('interaction condition', () => {
  it('should match an interaction condition', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'interaction' as const, interaction: true },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(evaluator.evaluate({ interaction: true }).result).toBeTruthy();
    expect(evaluator.evaluate({ interaction: false }).result).toBeFalsy();
  });
});
