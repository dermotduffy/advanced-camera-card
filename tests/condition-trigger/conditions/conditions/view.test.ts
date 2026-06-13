import { describe, expect, it } from 'vitest';
import { createConditionEvaluator } from '../../../../src/condition-trigger/conditions/factory';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('view condition', () => {
  it('should match a named view', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'view' as const, views: ['live'] },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(evaluator.evaluate({ view: 'live' }).result).toBeTruthy();
    expect(evaluator.evaluate({ view: 'clips' }).result).toBeFalsy();
  });

  it('should report a change for any view change', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'view' as const },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({ view: 'clips' }, {})).toEqual({
      result: true,
      changed: true,
    });

    expect(evaluator.evaluate({ view: 'timeline' }, { view: 'clips' })).toEqual({
      result: true,
      changed: true,
    });
  });
});
