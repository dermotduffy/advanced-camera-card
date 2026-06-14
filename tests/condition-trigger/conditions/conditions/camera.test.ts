import { describe, expect, it } from 'vitest';
import { createConditionEvaluator } from '../../../../src/condition-trigger/conditions/factory';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('camera condition', () => {
  it('should match a named camera', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'camera' as const, cameras: ['bar'] },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(evaluator.evaluate({ camera: 'bar' }).result).toBeTruthy();
    expect(evaluator.evaluate({ camera: 'will-not-match' }).result).toBeFalsy();
  });

  it('should match any of several named cameras', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'camera' as const, cameras: ['foo', 'bar'] },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({ camera: 'bar' }).result).toBeTruthy();
    expect(evaluator.evaluate({ camera: 'foo' }).result).toBeTruthy();
    expect(evaluator.evaluate({ camera: 'baz' }).result).toBeFalsy();
  });

  it('should match a selected camera when cameras is omitted', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'camera' as const },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({ camera: 'bar' }).result).toBeTruthy();
    expect(evaluator.evaluate({}).result).toBeFalsy();
  });

  it('should match no selected camera for an empty list', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'camera' as const, cameras: [] },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeTruthy();
    expect(evaluator.evaluate({ camera: 'bar' }).result).toBeFalsy();
  });
});
