import { describe, expect, it } from 'vitest';
import { createConditionEvaluator } from '../../../src/conditions/factory';
import { createHASS, createUser } from '../../test-utils';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('user condition', () => {
  it('should match a user condition', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'user' as const, users: ['user_1', 'user_2'] },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(
      evaluator.evaluate({ hass: createHASS({}, createUser({ id: 'user_1' })) }).result,
    ).toBeTruthy();
    expect(
      evaluator.evaluate({ hass: createHASS({}, createUser({ id: 'user_WRONG' })) })
        .result,
    ).toBeFalsy();
  });

  it('should not match when no users are set', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'user' as const },
      createEvaluatorContext(),
    );

    expect(
      evaluator.evaluate({ hass: createHASS({}, createUser({ id: 'user_1' })) }).result,
    ).toBeFalsy();
  });
});
