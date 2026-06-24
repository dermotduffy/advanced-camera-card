import { describe, expect, it } from 'vitest';

import { createConditionEvaluator } from '../../../../src/condition-trigger/conditions/factory';
import { interactionConditionSchema } from '../../../../src/config/schema/condition-trigger/conditions/custom/interaction';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('interaction condition', () => {
  it('should match an interaction condition', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'interaction' as const, interaction: true },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(evaluator.evaluate({ interaction: true }).result).toBeTruthy();
    expect(evaluator.evaluate({ interaction: false }).result).toBeFalsy();
  });

  it('should require a value', () => {
    expect(() =>
      interactionConditionSchema.parse({ condition: 'interaction' }),
    ).toThrow();
  });
});
