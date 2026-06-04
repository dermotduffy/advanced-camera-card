import { describe, expect, it } from 'vitest';
import { createConditionEvaluator } from '../../../src/conditions/factory';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('display mode condition', () => {
  it('should match a display mode condition', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'display_mode' as const, display_mode: 'grid' as const },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(evaluator.evaluate({ displayMode: 'grid' }).result).toBeTruthy();
    expect(evaluator.evaluate({ displayMode: 'single' }).result).toBeFalsy();
  });
});
