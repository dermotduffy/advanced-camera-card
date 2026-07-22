import { describe, expect, it } from 'vitest';

import { createConditionEvaluator } from '../../../../src/condition-trigger/conditions/factory';
import { callConditionSchema } from '../../../../src/config/schema/condition-trigger/conditions/custom/call';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('call condition', () => {
  it('should require a value', () => {
    expect(() => callConditionSchema.parse({ condition: 'call' })).toThrow();
  });

  it('should reject a phase that does not exist', () => {
    expect(() =>
      callConditionSchema.parse({ condition: 'call', call: 'hungup' }),
    ).toThrow();
  });

  it('should match the ringing phase', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'call' as const, call: 'ringing' as const },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({ call: 'ringing' }).result).toBeTruthy();
    expect(evaluator.evaluate({ call: 'answered' }).result).toBeFalsy();
    expect(evaluator.evaluate({ call: 'idle' }).result).toBeFalsy();
  });

  it('should match the answered phase', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'call' as const, call: 'answered' as const },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({ call: 'answered' }).result).toBeTruthy();
    expect(evaluator.evaluate({ call: 'ringing' }).result).toBeFalsy();
  });

  it('should treat an absent call state as idle', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'call' as const, call: 'idle' as const },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeTruthy();
    expect(evaluator.evaluate({ call: 'idle' }).result).toBeTruthy();
    expect(evaluator.evaluate({ call: 'ringing' }).result).toBeFalsy();
  });

  it('should match any phase in a list', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'call' as const, call: ['ringing', 'answered'] as const },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({ call: 'ringing' }).result).toBeTruthy();
    expect(evaluator.evaluate({ call: 'answered' }).result).toBeTruthy();
    expect(evaluator.evaluate({ call: 'idle' }).result).toBeFalsy();
    expect(evaluator.evaluate({}).result).toBeFalsy();
  });
});
