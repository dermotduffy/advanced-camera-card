import { describe, expect, it } from 'vitest';
import { createConditionEvaluator } from '../../../src/conditions/factory';
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

  it('should report trigger data for any camera change', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'camera' as const },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({ camera: 'bar' }, {})).toEqual({
      result: true,
      triggerData: {
        camera: {
          to: 'bar',
        },
      },
    });

    expect(evaluator.evaluate({ camera: 'foo' }, { camera: 'bar' })).toEqual({
      result: true,
      triggerData: {
        camera: {
          from: 'bar',
          to: 'foo',
        },
      },
    });
  });
});
