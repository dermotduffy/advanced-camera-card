import { describe, expect, it } from 'vitest';
import { createConditionEvaluator } from '../../../src/conditions/factory';
import { createHASS, createStateEntity } from '../../test-utils';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('numeric state condition', () => {
  it('should match above a threshold', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'numeric_state' as const, entity: 'sensor.foo', above: 10 },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(
      evaluator.evaluate({
        hass: createHASS({ 'sensor.foo': createStateEntity({ state: '11' }) }),
      }).result,
    ).toBeTruthy();
    expect(
      evaluator.evaluate({
        hass: createHASS({ 'binary_sensor.foo': createStateEntity({ state: '9' }) }),
      }).result,
    ).toBeFalsy();
  });

  it('should match below a threshold', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'numeric_state' as const, entity: 'sensor.foo', below: 10 },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(
      evaluator.evaluate({
        hass: createHASS({ 'sensor.foo': createStateEntity({ state: '11' }) }),
      }).result,
    ).toBeFalsy();
    expect(
      evaluator.evaluate({
        hass: createHASS({ 'sensor.foo': createStateEntity({ state: '9' }) }),
      }).result,
    ).toBeTruthy();
  });
});
