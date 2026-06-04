import { describe, expect, it } from 'vitest';
import { createConditionEvaluator } from '../../../src/conditions/factory';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('triggered condition', () => {
  it('should match a triggered condition', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'triggered' as const, triggered: ['camera_1', 'camera_2'] },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(evaluator.evaluate({ triggered: new Set(['camera_1']) }).result).toBeTruthy();
    expect(
      evaluator.evaluate({ triggered: new Set(['camera_2', 'camera_1', 'camera_3']) })
        .result,
    ).toBeTruthy();
    expect(evaluator.evaluate({ triggered: new Set(['camera_3']) }).result).toBeFalsy();
  });
});
