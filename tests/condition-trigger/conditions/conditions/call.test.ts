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
    expect(
      evaluator.evaluate({ call: { active: true, answered: false } }).result,
    ).toBeTruthy();
    expect(
      evaluator.evaluate({ call: { active: false, answered: false } }).result,
    ).toBeFalsy();
  });

  it('should match when call is false', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'call' as const, call: false },
      createEvaluatorContext(),
    );

    // With no state.call published, the bare condition matches `false`,
    // so `call: false` is satisfied.
    expect(evaluator.evaluate({}).result).toBeTruthy();
    expect(
      evaluator.evaluate({ call: { active: true, answered: false } }).result,
    ).toBeFalsy();
    expect(
      evaluator.evaluate({ call: { active: false, answered: false } }).result,
    ).toBeTruthy();
  });

  it('should additionally match on answered when specified', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'call' as const, call: true, answered: true },
      createEvaluatorContext(),
    );

    expect(
      evaluator.evaluate({ call: { active: true, answered: true } }).result,
    ).toBeTruthy();
    expect(
      evaluator.evaluate({ call: { active: true, answered: false } }).result,
    ).toBeFalsy();
    expect(
      evaluator.evaluate({ call: { active: false, answered: true } }).result,
    ).toBeFalsy();
  });

  it('should treat absent call state as inactive and unanswered when answered is specified', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'call' as const, call: false, answered: false },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeTruthy();
  });

  it('should match ended-while-unanswered (rejected) distinctly from ended-after-answered', () => {
    const rejected = createConditionEvaluator(
      { condition: 'call' as const, call: false, answered: false },
      createEvaluatorContext(),
    );
    const hungUp = createConditionEvaluator(
      { condition: 'call' as const, call: false, answered: true },
      createEvaluatorContext(),
    );

    const endedUnanswered = { call: { active: false, answered: false } };
    const endedAnswered = { call: { active: false, answered: true } };

    expect(rejected.evaluate(endedUnanswered).result).toBeTruthy();
    expect(rejected.evaluate(endedAnswered).result).toBeFalsy();
    expect(hungUp.evaluate(endedUnanswered).result).toBeFalsy();
    expect(hungUp.evaluate(endedAnswered).result).toBeTruthy();
  });
});
