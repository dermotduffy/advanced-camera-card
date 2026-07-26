import { describe, expect, it } from 'vitest';

import { createConditionEvaluator } from '../../../../src/condition-trigger/conditions/factory';
import { createEvaluatorContext } from './test-utils';

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

  it('should match any of several named views', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'view' as const, views: ['live', 'clips'] },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({ view: 'live' }).result).toBeTruthy();
    expect(evaluator.evaluate({ view: 'clips' }).result).toBeTruthy();
    expect(evaluator.evaluate({ view: 'timeline' }).result).toBeFalsy();
  });
});
