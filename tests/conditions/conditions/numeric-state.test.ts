import { describe, expect, it } from 'vitest';
import { createConditionEvaluator } from '../../../src/conditions/factory';
import { createHASS, createStateEntity } from '../../test-utils';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('numeric state condition', () => {
  it('should match above a threshold', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'numeric_state' as const, entity_id: 'sensor.foo', above: 10 },
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
      { condition: 'numeric_state' as const, entity_id: 'sensor.foo', below: 10 },
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

  it('should accept the entity field', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'numeric_state' as const, entity: 'sensor.foo', above: 10 },
      createEvaluatorContext(),
    );

    expect(
      evaluator.evaluate({
        hass: createHASS({ 'sensor.foo': createStateEntity({ state: '11' }) }),
      }).result,
    ).toBeTruthy();
  });

  it('should match a list of entities only when all of them match', () => {
    const evaluator = createConditionEvaluator(
      {
        condition: 'numeric_state' as const,
        entity_id: ['sensor.a', 'sensor.b'],
        above: 10,
      },
      createEvaluatorContext(),
    );

    // Both above -> match.
    expect(
      evaluator.evaluate({
        hass: createHASS({
          'sensor.a': createStateEntity({ state: '11' }),
          'sensor.b': createStateEntity({ state: '12' }),
        }),
      }).result,
    ).toBeTruthy();
    // One below -> no match.
    expect(
      evaluator.evaluate({
        hass: createHASS({
          'sensor.a': createStateEntity({ state: '11' }),
          'sensor.b': createStateEntity({ state: '9' }),
        }),
      }).result,
    ).toBeFalsy();
    // One absent -> no match.
    expect(
      evaluator.evaluate({
        hass: createHASS({
          'sensor.a': createStateEntity({ state: '11' }),
        }),
      }).result,
    ).toBeFalsy();
  });

  it('should match against an attribute instead of the state', () => {
    const evaluator = createConditionEvaluator(
      {
        condition: 'numeric_state' as const,
        entity_id: 'sensor.foo',
        attribute: 'battery',
        below: 20,
      },
      createEvaluatorContext(),
    );

    expect(
      evaluator.evaluate({
        hass: createHASS({
          'sensor.foo': createStateEntity({ state: 'on', attributes: { battery: 15 } }),
        }),
      }).result,
    ).toBeTruthy();
    expect(
      evaluator.evaluate({
        hass: createHASS({
          'sensor.foo': createStateEntity({ state: 'on', attributes: { battery: 50 } }),
        }),
      }).result,
    ).toBeFalsy();
  });

  it('should compare the rendered value_template instead of the state', () => {
    const evaluator = createConditionEvaluator(
      {
        condition: 'numeric_state' as const,
        entity_id: 'sensor.foo',
        value_template: '{{ 11 }}',
        above: 10,
      },
      createEvaluatorContext(),
    );

    // The entity state (0) would fail; the template value (11) passes.
    expect(
      evaluator.evaluate({
        hass: createHASS({ 'sensor.foo': createStateEntity({ state: '0' }) }),
      }).result,
    ).toBeTruthy();
  });

  it('should not match when the value is not numeric', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'numeric_state' as const, entity_id: 'sensor.foo', above: 10 },
      createEvaluatorContext(),
    );

    expect(
      evaluator.evaluate({
        hass: createHASS({ 'sensor.foo': createStateEntity({ state: 'unavailable' }) }),
      }).result,
    ).toBeFalsy();
  });

  it('should not match when the entity is absent', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'numeric_state' as const, entity_id: 'sensor.missing', above: 10 },
      createEvaluatorContext(),
    );

    expect(
      evaluator.evaluate({
        hass: createHASS({ 'sensor.foo': createStateEntity({ state: '11' }) }),
      }).result,
    ).toBeFalsy();
  });

  it('should resolve an entity-id reference as the above/below threshold', () => {
    const evaluator = createConditionEvaluator(
      {
        condition: 'numeric_state' as const,
        entity_id: 'sensor.foo',
        above: 'input_number.limit',
      },
      createEvaluatorContext(),
    );

    // sensor.foo (20) > input_number.limit (10) -> true.
    expect(
      evaluator.evaluate({
        hass: createHASS({
          'sensor.foo': createStateEntity({ state: '20' }),
          'input_number.limit': createStateEntity({ state: '10' }),
        }),
      }).result,
    ).toBeTruthy();
    // sensor.foo (5) > input_number.limit (10) -> false.
    expect(
      evaluator.evaluate({
        hass: createHASS({
          'sensor.foo': createStateEntity({ state: '5' }),
          'input_number.limit': createStateEntity({ state: '10' }),
        }),
      }).result,
    ).toBeFalsy();
  });

  it('should not match when a threshold entity is unresolvable', () => {
    const evaluator = createConditionEvaluator(
      {
        condition: 'numeric_state' as const,
        entity_id: 'sensor.foo',
        below: 'input_number.limit',
      },
      createEvaluatorContext(),
    );

    expect(
      evaluator.evaluate({
        hass: createHASS({
          'sensor.foo': createStateEntity({ state: '5' }),
          'input_number.limit': createStateEntity({ state: 'unavailable' }),
        }),
      }).result,
    ).toBeFalsy();
  });
});
