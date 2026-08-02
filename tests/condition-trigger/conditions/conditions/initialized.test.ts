import { describe, expect, it } from 'vitest';

import { createConditionEvaluator } from '../../../../src/condition-trigger/conditions/factory';
import { createEvaluatorContext } from './test-utils';

describe('initialized condition', () => {
  it('should match an initialized condition', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'initialized' as const, ever: false },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(evaluator.evaluate({ initialized: true }).result).toBeTruthy();
    expect(evaluator.evaluate({ initialized: false }).result).toBeFalsy();
  });

  it('should match an ever initialized condition', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'initialized' as const, ever: true },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(evaluator.evaluate({ everInitialized: true }).result).toBeTruthy();

    expect(
      evaluator.evaluate({ initialized: false, everInitialized: true }).result,
    ).toBeTruthy();
  });
});
