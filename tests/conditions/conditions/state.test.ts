import { describe, expect, it } from 'vitest';
import { createConditionEvaluator } from '../../../src/conditions/factory';
import { createHASS, createStateEntity } from '../../test-utils';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('state condition', () => {
  it('should report trigger data for any change when neither state nor state_not is set', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'state' as const, entity: 'binary_sensor.foo' },
      createEvaluatorContext(),
    );

    expect(
      evaluator.evaluate(
        {
          hass: createHASS({ 'binary_sensor.foo': createStateEntity({ state: 'on' }) }),
        },
        {},
      ),
    ).toEqual({
      result: true,
      triggerData: {
        state: {
          entity: 'binary_sensor.foo',
          to: 'on',
        },
      },
    });

    expect(
      evaluator.evaluate(
        {
          hass: createHASS({ 'binary_sensor.foo': createStateEntity({ state: 'off' }) }),
        },
        {
          hass: createHASS({ 'binary_sensor.foo': createStateEntity({ state: 'on' }) }),
        },
      ),
    ).toEqual({
      result: true,
      triggerData: {
        state: {
          entity: 'binary_sensor.foo',
          from: 'on',
          to: 'off',
        },
      },
    });
  });

  it('should match a single positive state', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'state' as const, entity: 'binary_sensor.foo', state: 'on' },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(
      evaluator.evaluate({
        hass: createHASS({ 'binary_sensor.foo': createStateEntity() }),
      }).result,
    ).toBeTruthy();
    expect(
      evaluator.evaluate({
        hass: createHASS({ 'binary_sensor.foo': createStateEntity({ state: 'off' }) }),
      }).result,
    ).toBeFalsy();
  });

  it('should match multiple positive states', () => {
    const evaluator = createConditionEvaluator(
      {
        condition: 'state' as const,
        entity: 'binary_sensor.foo',
        state: ['active', 'on'],
      },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(
      evaluator.evaluate({
        hass: createHASS({ 'binary_sensor.foo': createStateEntity() }),
      }).result,
    ).toBeTruthy();
    expect(
      evaluator.evaluate({
        hass: createHASS({
          'binary_sensor.foo': createStateEntity({ state: 'active' }),
        }),
      }).result,
    ).toBeTruthy();
    expect(
      evaluator.evaluate({
        hass: createHASS({ 'binary_sensor.foo': createStateEntity({ state: 'off' }) }),
      }).result,
    ).toBeFalsy();
  });

  it('should match a single negative state', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'state' as const, entity: 'binary_sensor.foo', state_not: 'on' },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(
      evaluator.evaluate({
        hass: createHASS({ 'binary_sensor.foo': createStateEntity() }),
      }).result,
    ).toBeFalsy();
    expect(
      evaluator.evaluate({
        hass: createHASS({ 'binary_sensor.foo': createStateEntity({ state: 'off' }) }),
      }).result,
    ).toBeTruthy();
  });

  it('should match multiple negative states', () => {
    const evaluator = createConditionEvaluator(
      {
        condition: 'state' as const,
        entity: 'binary_sensor.foo',
        state_not: ['active', 'on'],
      },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(
      evaluator.evaluate({
        hass: createHASS({ 'binary_sensor.foo': createStateEntity() }),
      }).result,
    ).toBeFalsy();
    expect(
      evaluator.evaluate({
        hass: createHASS({
          'binary_sensor.foo': createStateEntity({ state: 'active' }),
        }),
      }).result,
    ).toBeFalsy();
    expect(
      evaluator.evaluate({
        hass: createHASS({ 'binary_sensor.foo': createStateEntity({ state: 'off' }) }),
      }).result,
    ).toBeTruthy();
  });

  it('should match an implicit state condition', () => {
    const evaluator = createConditionEvaluator(
      { entity: 'binary_sensor.foo', state: 'on' },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(
      evaluator.evaluate({
        hass: createHASS({ 'binary_sensor.foo': createStateEntity() }),
      }).result,
    ).toBeTruthy();
    expect(
      evaluator.evaluate({
        hass: createHASS({ 'binary_sensor.foo': createStateEntity({ state: 'off' }) }),
      }).result,
    ).toBeFalsy();
  });
});
