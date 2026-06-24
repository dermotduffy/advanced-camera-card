import { describe, expect, it } from 'vitest';

import { createConditionEvaluator } from '../../../../src/condition-trigger/conditions/factory';
import { callConditionSchema } from '../../../../src/config/schema/condition-trigger/conditions/custom/call';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('call condition', () => {
  it('should require a value', () => {
    expect(() => callConditionSchema.parse({ condition: 'call' })).toThrow();
  });

  it('should match when call is true', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'call' as const, call: true },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(evaluator.evaluate({ call: true }).result).toBeTruthy();
    expect(evaluator.evaluate({ call: false }).result).toBeFalsy();
  });

  it('should match when call is false', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'call' as const, call: false },
      createEvaluatorContext(),
    );

    // With no state.call published, the bare condition matches `false`,
    // so `call: false` is satisfied.
    expect(evaluator.evaluate({}).result).toBeTruthy();
    expect(evaluator.evaluate({ call: true }).result).toBeFalsy();
    expect(evaluator.evaluate({ call: false }).result).toBeTruthy();
  });
});
