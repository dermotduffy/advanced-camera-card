import { describe, expect, it } from 'vitest';
import { createConditionEvaluator } from '../../../src/conditions/factory';
import { createHASS, createStateEntity } from '../../test-utils';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('template condition', () => {
  it('should evaluate true when template evalutes to true', () => {
    const evaluator = createConditionEvaluator(
      {
        condition: 'template' as const,
        value_template: '{{ is_state("sensor.foo", "on") }}',
      },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(
      evaluator.evaluate({
        hass: createHASS({ 'sensor.foo': createStateEntity({ state: 'on' }) }),
      }).result,
    ).toBeTruthy();
    expect(
      evaluator.evaluate({
        hass: createHASS({ 'sensor.foo': createStateEntity({ state: 'off' }) }),
      }).result,
    ).toBeFalsy();
  });

  it('should evaluate false when template evalutes to non-boolean', () => {
    const evaluator = createConditionEvaluator(
      {
        condition: 'template' as const,
        // This does not result in a boolean.
        value_template: '{{ hass.states["light.office"].state }}',
      },
      createEvaluatorContext(),
    );

    expect(
      evaluator.evaluate({
        hass: createHASS({ 'light.office': createStateEntity({ state: 'on' }) }),
      }).result,
    ).toBeFalsy();
  });
});
