import { describe, expect, it } from 'vitest';
import { createConditionEvaluator } from '../../../../src/condition-trigger/conditions/factory';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('triggered condition', () => {
  it('should match any triggered camera when no list is given', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'triggered' as const },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(evaluator.evaluate({ triggered: new Set() }).result).toBeFalsy();
    expect(evaluator.evaluate({ triggered: new Set(['camera_1']) }).result).toBeTruthy();
  });

  it('should match when one of the listed cameras is triggered', () => {
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

  it('should match when no camera is triggered for an empty list', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'triggered' as const, triggered: [] },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeTruthy();
    expect(evaluator.evaluate({ triggered: new Set() }).result).toBeTruthy();
    expect(evaluator.evaluate({ triggered: new Set(['camera_1']) }).result).toBeFalsy();
  });
});
