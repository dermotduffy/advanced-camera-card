import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createConditionEvaluator } from '../../../../src/condition-trigger/conditions/factory';
import { createHASS, createStateEntity } from '../../../test-utils';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('state condition', () => {
  it('should match any transition when neither state nor state_not is set', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'state' as const, entity_id: 'binary_sensor.foo' },
      createEvaluatorContext(),
    );

    expect(
      evaluator.evaluate(
        {
          hass: createHASS({ 'binary_sensor.foo': createStateEntity({ state: 'on' }) }),
        },
        {},
      ),
    ).toEqual({ result: true });

    expect(
      evaluator.evaluate(
        {
          hass: createHASS({ 'binary_sensor.foo': createStateEntity({ state: 'off' }) }),
        },
        {
          hass: createHASS({ 'binary_sensor.foo': createStateEntity({ state: 'on' }) }),
        },
      ),
    ).toEqual({ result: true });
  });

  it('should match a single positive state', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'state' as const, entity_id: 'binary_sensor.foo', state: 'on' },
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
        entity_id: 'binary_sensor.foo',
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
      { condition: 'state' as const, entity_id: 'binary_sensor.foo', state_not: 'on' },
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
        entity_id: 'binary_sensor.foo',
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
      { entity_id: 'binary_sensor.foo', state: 'on' },
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

  it('should not match when no entity is set', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'state' as const, state: 'on' },
      createEvaluatorContext(),
    );

    const result = evaluator.evaluate({
      hass: createHASS({ 'binary_sensor.foo': createStateEntity({ state: 'on' }) }),
    });
    expect(result.result).toBeFalsy();
  });

  it('should accept the entity field', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'state' as const, entity: 'binary_sensor.foo', state: 'on' },
      createEvaluatorContext(),
    );

    expect(
      evaluator.evaluate({
        hass: createHASS({ 'binary_sensor.foo': createStateEntity({ state: 'on' }) }),
      }).result,
    ).toBeTruthy();
    expect(
      evaluator.evaluate({
        hass: createHASS({ 'binary_sensor.foo': createStateEntity({ state: 'off' }) }),
      }).result,
    ).toBeFalsy();
  });

  it('should match a list of entities only when all match by default', () => {
    const evaluator = createConditionEvaluator(
      {
        condition: 'state' as const,
        entity_id: ['binary_sensor.foo', 'binary_sensor.bar'],
        state: 'on',
      },
      createEvaluatorContext(),
    );

    // Both on -> match.
    expect(
      evaluator.evaluate({
        hass: createHASS({
          'binary_sensor.foo': createStateEntity({ state: 'on' }),
          'binary_sensor.bar': createStateEntity({ state: 'on' }),
        }),
      }).result,
    ).toBeTruthy();
    // One off -> no match.
    expect(
      evaluator.evaluate({
        hass: createHASS({
          'binary_sensor.foo': createStateEntity({ state: 'on' }),
          'binary_sensor.bar': createStateEntity({ state: 'off' }),
        }),
      }).result,
    ).toBeFalsy();
    // One absent -> no match.
    expect(
      evaluator.evaluate({
        hass: createHASS({
          'binary_sensor.foo': createStateEntity({ state: 'on' }),
        }),
      }).result,
    ).toBeFalsy();
  });

  it('should match a list of entities when any matches and match is any', () => {
    const evaluator = createConditionEvaluator(
      {
        condition: 'state' as const,
        entity_id: ['binary_sensor.foo', 'binary_sensor.bar'],
        state: 'on',
        match: 'any' as const,
      },
      createEvaluatorContext(),
    );

    // One on -> match.
    expect(
      evaluator.evaluate({
        hass: createHASS({
          'binary_sensor.foo': createStateEntity({ state: 'on' }),
          'binary_sensor.bar': createStateEntity({ state: 'off' }),
        }),
      }).result,
    ).toBeTruthy();
    // None on -> no match.
    expect(
      evaluator.evaluate({
        hass: createHASS({
          'binary_sensor.foo': createStateEntity({ state: 'off' }),
          'binary_sensor.bar': createStateEntity({ state: 'off' }),
        }),
      }).result,
    ).toBeFalsy();
  });

  it('should match against an attribute instead of the state', () => {
    const evaluator = createConditionEvaluator(
      {
        condition: 'state' as const,
        entity_id: 'binary_sensor.foo',
        attribute: 'device_class',
        state: 'door',
      },
      createEvaluatorContext(),
    );

    expect(
      evaluator.evaluate({
        hass: createHASS({
          'binary_sensor.foo': createStateEntity({
            state: 'on',
            attributes: { device_class: 'door' },
          }),
        }),
      }).result,
    ).toBeTruthy();
    expect(
      evaluator.evaluate({
        hass: createHASS({
          'binary_sensor.foo': createStateEntity({
            state: 'on',
            attributes: { device_class: 'window' },
          }),
        }),
      }).result,
    ).toBeFalsy();
    // Attribute absent on the entity -> no value -> no match.
    expect(
      evaluator.evaluate({
        hass: createHASS({
          'binary_sensor.foo': createStateEntity({ state: 'on', attributes: {} }),
        }),
      }).result,
    ).toBeFalsy();
  });

  describe('for', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-05T22:56:56Z'));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should not match until the state has been held long enough', () => {
      const evaluator = createConditionEvaluator(
        {
          condition: 'state' as const,
          entity_id: 'binary_sensor.foo',
          state: 'on',
          for: '00:00:05',
        },
        createEvaluatorContext(),
      );

      // Held 2s (< 5s) -> no match.
      expect(
        evaluator.evaluate({
          hass: createHASS({
            'binary_sensor.foo': createStateEntity({
              state: 'on',
              last_changed: '2026-06-05T22:56:54Z',
            }),
          }),
        }).result,
      ).toBeFalsy();

      // Held 8s (>= 5s) -> match.
      expect(
        evaluator.evaluate({
          hass: createHASS({
            'binary_sensor.foo': createStateEntity({
              state: 'on',
              last_changed: '2026-06-05T22:56:48Z',
            }),
          }),
        }).result,
      ).toBeTruthy();
    });

    it('should not match when last_changed is unavailable', () => {
      const evaluator = createConditionEvaluator(
        {
          condition: 'state' as const,
          entity_id: 'binary_sensor.foo',
          state: 'on',
          for: '00:00:05',
        },
        createEvaluatorContext(),
      );

      expect(
        evaluator.evaluate({
          hass: createHASS({
            'binary_sensor.foo': createStateEntity({ state: 'on', last_changed: '' }),
          }),
        }).result,
      ).toBeFalsy();
    });

    it('should not match when for is unparseable', () => {
      const evaluator = createConditionEvaluator(
        {
          condition: 'state' as const,
          entity_id: 'binary_sensor.foo',
          state: 'on',
          for: 'not-a-duration',
        },
        createEvaluatorContext(),
      );

      expect(
        evaluator.evaluate({
          hass: createHASS({
            'binary_sensor.foo': createStateEntity({
              state: 'on',
              last_changed: '2026-06-05T22:56:46Z',
            }),
          }),
        }).result,
      ).toBeFalsy();
    });
  });
});
