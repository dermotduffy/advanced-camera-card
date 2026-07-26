import { describe, expect, it } from 'vitest';

import { createConditionEvaluator } from '../../../../src/condition-trigger/conditions/factory';
import { expandConditionSchema } from '../../../../src/config/schema/condition-trigger/conditions/custom/expand';
import { createEvaluatorContext } from './test-utils';

describe('expand condition', () => {
  it('should match an expand condition', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'expand' as const, expand: true },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(evaluator.evaluate({ expand: true }).result).toBeTruthy();
    expect(evaluator.evaluate({ expand: false }).result).toBeFalsy();
  });

  it('should require a value', () => {
    expect(() => expandConditionSchema.parse({ condition: 'expand' })).toThrow();
  });
});
