import { describe, expect, it } from 'vitest';

import { createConditionEvaluator } from '../../../../src/condition-trigger/conditions/factory';
import { createEvaluatorContext } from './test-utils';

describe('initialized condition', () => {
  it('should match an initialized condition', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'initialized' as const },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(evaluator.evaluate({ initialized: true }).result).toBeTruthy();
    expect(evaluator.evaluate({ initialized: false }).result).toBeFalsy();
  });
});
