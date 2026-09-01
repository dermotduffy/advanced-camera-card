import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TemplateManager } from '../../../../src/card-controller/templates';
import { createConditionEvaluator } from '../../../../src/condition-trigger/conditions/factory';
import {
  createHASS,
  createStateEntity,
  stubConnectedHomeAssistant,
} from '../../../test-utils';
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

  describe('attribute matching by type', () => {
    const evaluateBattery = (state: unknown, batteryLevel: unknown): boolean =>
      !!createConditionEvaluator(
        {
          condition: 'state' as const,
          entity_id: 'sensor.battery',
          attribute: 'battery_level',
          // `state` is compared raw against the attribute (Home Assistant's
          // `match_all` semantics), so it may be any type.
          state,
        },
        createEvaluatorContext(),
      ).evaluate({
        hass: createHASS({
          'sensor.battery': createStateEntity({
            attributes: { battery_level: batteryLevel },
          }),
        }),
      }).result;

    it('should match a numeric attribute against an unquoted number', () => {
      expect(evaluateBattery(50, 50)).toBe(true);
    });

    it('should not match a numeric attribute against a stringified number', () => {
      // `50 == "50"` is false in Home Assistant.
      expect(evaluateBattery('50', 50)).toBe(false);
    });

    it('should treat a boolean attribute as equal to its integer form', () => {
      // Python's `bool` is a subtype of `int`, so `true == 1`.
      expect(evaluateBattery(1, true)).toBe(true);
      expect(evaluateBattery(true, 1)).toBe(true);
      expect(evaluateBattery(0, true)).toBe(false);
    });

    it('should match a falsy attribute value of zero', () => {
      // `0` is a real attribute value, not the "no value" sentinel.
      expect(evaluateBattery(0, 0)).toBe(true);
    });

    it('should match a list of numeric values by membership', () => {
      expect(evaluateBattery([50, 80], 80)).toBe(true);
      expect(evaluateBattery([50, 80], 20)).toBe(false);
    });

    it('should match a present null attribute against state: null', () => {
      const evaluator = createConditionEvaluator(
        {
          condition: 'state' as const,
          entity_id: 'sensor.foo',
          attribute: 'bar',
          state: null,
        },
        createEvaluatorContext(),
      );

      // A present `null` value is a real value and matches.
      expect(
        evaluator.evaluate({
          hass: createHASS({
            'sensor.foo': createStateEntity({ attributes: { bar: null } }),
          }),
        }).result,
      ).toBeTruthy();
      // A non-null value does not.
      expect(
        evaluator.evaluate({
          hass: createHASS({
            'sensor.foo': createStateEntity({ attributes: { bar: 'x' } }),
          }),
        }).result,
      ).toBeFalsy();
    });

    it('should not match a missing attribute key even against state: null', () => {
      // HA distinguishes an absent key (no match) from a present `null` value.
      const evaluator = createConditionEvaluator(
        {
          condition: 'state' as const,
          entity_id: 'sensor.foo',
          attribute: 'bar',
          state: null,
        },
        createEvaluatorContext(),
      );

      expect(
        evaluator.evaluate({
          hass: createHASS({ 'sensor.foo': createStateEntity({ attributes: {} }) }),
        }).result,
      ).toBeFalsy();
    });

    it('should not treat an inherited property name as an attribute', () => {
      // `toString` etc. exist on the prototype but are not real attribute keys.
      const evaluator = createConditionEvaluator(
        {
          condition: 'state' as const,
          entity_id: 'sensor.foo',
          attribute: 'toString',
          state_not: 'x',
        },
        createEvaluatorContext(),
      );

      // The attribute is absent, so the condition cannot match (not "not x").
      expect(
        evaluator.evaluate({
          hass: createHASS({ 'sensor.foo': createStateEntity({ attributes: {} }) }),
        }).result,
      ).toBeFalsy();
    });

    it('should resolve an input helper expected value on the attribute path', () => {
      // HA resolves an `input_*` helper name to its state on the attribute path
      // too, and compares against the resolved state (not the literal name).
      const evaluator = createConditionEvaluator(
        {
          condition: 'state' as const,
          entity_id: 'sensor.foo',
          attribute: 'linked',
          state: 'input_text.expected',
        },
        createEvaluatorContext(),
      );

      // The attribute value matches the helper's resolved state.
      expect(
        evaluator.evaluate({
          hass: createHASS({
            'sensor.foo': createStateEntity({ attributes: { linked: 'bar' } }),
            'input_text.expected': createStateEntity({ state: 'bar' }),
          }),
        }).result,
      ).toBeTruthy();

      // The literal helper name is not matched (only the resolved state is).
      expect(
        evaluator.evaluate({
          hass: createHASS({
            'sensor.foo': createStateEntity({
              attributes: { linked: 'input_text.expected' },
            }),
            'input_text.expected': createStateEntity({ state: 'bar' }),
          }),
        }).result,
      ).toBeFalsy();
    });

    it('should not resolve a non-input entity name on the attribute path', () => {
      // Only `input_*` helpers are resolved; other entity names compare literally.
      const evaluator = createConditionEvaluator(
        {
          condition: 'state' as const,
          entity_id: 'sensor.foo',
          attribute: 'linked',
          state: 'sensor.other',
        },
        createEvaluatorContext(),
      );

      expect(
        evaluator.evaluate({
          hass: createHASS({
            'sensor.foo': createStateEntity({ attributes: { linked: 'bar' } }),
            'sensor.other': createStateEntity({ state: 'bar' }),
          }),
        }).result,
      ).toBeFalsy();
    });

    it('should not match when a named input helper is missing', () => {
      // HA errors when the referenced helper is unavailable; the card treats it
      // as no value, so it matches nothing.
      const evaluator = createConditionEvaluator(
        {
          condition: 'state' as const,
          entity_id: 'sensor.foo',
          attribute: 'linked',
          state: 'input_text.expected',
        },
        createEvaluatorContext(),
      );

      expect(
        evaluator.evaluate({
          hass: createHASS({
            'sensor.foo': createStateEntity({ attributes: { linked: 'bar' } }),
          }),
        }).result,
      ).toBeFalsy();
    });

    it('should match any raw change of the attribute when neither state nor state_not is set', () => {
      const evaluator = createConditionEvaluator(
        {
          condition: 'state' as const,
          entity_id: 'sensor.battery',
          attribute: 'battery_level',
        },
        createEvaluatorContext(),
      );

      const evaluateChange = (to: unknown, from: unknown): boolean =>
        !!evaluator.evaluate(
          {
            hass: createHASS({
              'sensor.battery': createStateEntity({ attributes: { battery_level: to } }),
            }),
          },
          {
            hass: createHASS({
              'sensor.battery': createStateEntity({
                attributes: { battery_level: from },
              }),
            }),
          },
        ).result;

      // A real numeric change matches; a raw-equal value does not.
      expect(evaluateChange(60, 50)).toBe(true);
      expect(evaluateChange(50, 50)).toBe(false);
    });

    it('should still match non-attribute state as strings', () => {
      // Regression guard: without `attribute`, matching stays string-vs-string.
      const evaluator = createConditionEvaluator(
        { condition: 'state' as const, entity_id: 'sensor.battery', state: '50' },
        createEvaluatorContext(),
      );
      expect(
        evaluator.evaluate({
          hass: createHASS({ 'sensor.battery': createStateEntity({ state: '50' }) }),
        }).result,
      ).toBeTruthy();
    });
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

      // Held 8s (> 5s) -> match.
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

    it('should not match when held for exactly the duration', () => {
      // HA compares strictly (`>`): held == for is not yet a match.
      const evaluator = createConditionEvaluator(
        {
          condition: 'state' as const,
          entity_id: 'binary_sensor.foo',
          state: 'on',
          for: '00:00:05',
        },
        createEvaluatorContext(),
      );

      // Held exactly 5s (now 22:56:56, last_changed 22:56:51).
      expect(
        evaluator.evaluate({
          hass: createHASS({
            'binary_sensor.foo': createStateEntity({
              state: 'on',
              last_changed: '2026-06-05T22:56:51Z',
            }),
          }),
        }).result,
      ).toBeFalsy();
    });

    it('should render a templated "for" before comparing', async () => {
      // This case renders a real templated `for`, so load the lazily-imported
      // engine for the synchronous renderer.
      const templateManager = new TemplateManager();
      stubConnectedHomeAssistant();
      await templateManager.loadRenderer();

      const evaluator = createConditionEvaluator(
        {
          condition: 'state' as const,
          entity_id: 'binary_sensor.foo',
          state: 'on',
          for: "{{ states('input_number.delay') }}",
        },
        createEvaluatorContext({ templateRenderer: templateManager }),
      );

      const evaluateHeldSince = (lastChanged: string): boolean =>
        !!evaluator.evaluate({
          hass: createHASS({
            'binary_sensor.foo': createStateEntity({
              state: 'on',
              last_changed: lastChanged,
            }),
            'input_number.delay': createStateEntity({ state: '5' }),
          }),
        }).result;

      // `for` renders to 5s: held 2s -> no match, held 8s -> match.
      expect(evaluateHeldSince('2026-06-05T22:56:54Z')).toBe(false);
      expect(evaluateHeldSince('2026-06-05T22:56:48Z')).toBe(true);
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

  it('should resolve an expected state that names another entity', () => {
    const evaluator = createConditionEvaluator(
      {
        condition: 'state' as const,
        entity_id: 'binary_sensor.foo',
        state: 'input_text.expected',
      },
      createEvaluatorContext(),
    );

    // The entity's state matches the resolved state of `input_text.expected`.
    expect(
      evaluator.evaluate({
        hass: createHASS({
          'binary_sensor.foo': createStateEntity({ state: 'armed' }),
          'input_text.expected': createStateEntity({ state: 'armed' }),
        }),
      }).result,
    ).toBeTruthy();

    // It does not match when the resolved state differs.
    expect(
      evaluator.evaluate({
        hass: createHASS({
          'binary_sensor.foo': createStateEntity({ state: 'disarmed' }),
          'input_text.expected': createStateEntity({ state: 'armed' }),
        }),
      }).result,
    ).toBeFalsy();
  });

  it.each([
    ['input_text.expected', true],
    ['input_text.a_1', true],
    ['input_text._expected', false],
    ['input_text.expected_', false],
    ['input_text.expected__name', false],
  ])('should only resolve valid input helper IDs (%s)', (expected, resolves) => {
    const evaluator = createConditionEvaluator(
      {
        condition: 'state' as const,
        entity_id: 'binary_sensor.foo',
        state: expected,
      },
      createEvaluatorContext(),
    );

    expect(
      evaluator.evaluate({
        hass: createHASS({
          'binary_sensor.foo': createStateEntity({ state: 'armed' }),
          [expected]: createStateEntity({ state: 'armed' }),
        }),
      }).result,
    ).toBe(resolves);
  });

  it('should compare an input helper by its state, not its literal name', () => {
    // HA replaces the helper name with its state, so the literal name never
    // matches (resolved-value-only).
    const evaluator = createConditionEvaluator(
      {
        condition: 'state' as const,
        entity_id: 'binary_sensor.foo',
        state: 'input_text.expected',
      },
      createEvaluatorContext(),
    );

    expect(
      evaluator.evaluate({
        hass: createHASS({
          'binary_sensor.foo': createStateEntity({ state: 'input_text.expected' }),
          'input_text.expected': createStateEntity({ state: 'armed' }),
        }),
      }).result,
    ).toBeFalsy();
  });

  it('should not resolve a non-input entity name', () => {
    // Only `input_*` helpers are resolved; other entity names compare literally.
    const evaluator = createConditionEvaluator(
      {
        condition: 'state' as const,
        entity_id: 'binary_sensor.foo',
        state: 'sensor.other',
      },
      createEvaluatorContext(),
    );

    // Not resolved: the watched state does not match the helper's state.
    expect(
      evaluator.evaluate({
        hass: createHASS({
          'binary_sensor.foo': createStateEntity({ state: 'armed' }),
          'sensor.other': createStateEntity({ state: 'armed' }),
        }),
      }).result,
    ).toBeFalsy();

    // The literal name is compared as-is.
    expect(
      evaluator.evaluate({
        hass: createHASS({
          'binary_sensor.foo': createStateEntity({ state: 'sensor.other' }),
          'sensor.other': createStateEntity({ state: 'armed' }),
        }),
      }).result,
    ).toBeTruthy();
  });

  it('should fail when an unavailable input helper is reached before a match', () => {
    // HA scans in order and raises at the unavailable `input_*` helper before it
    // would reach (and match) the later `bar`.
    const evaluator = createConditionEvaluator(
      {
        condition: 'state' as const,
        entity_id: 'binary_sensor.foo',
        state: ['input_text.missing', 'bar'],
      },
      createEvaluatorContext(),
    );

    expect(
      evaluator.evaluate({
        hass: createHASS({ 'binary_sensor.foo': createStateEntity({ state: 'bar' }) }),
      }).result,
    ).toBeFalsy();
  });

  it('should match a value listed before an unavailable input helper', () => {
    // HA breaks on the first match, so an unavailable helper listed *after* the
    // matching value is never reached.
    const evaluator = createConditionEvaluator(
      {
        condition: 'state' as const,
        entity_id: 'binary_sensor.foo',
        state: ['bar', 'input_text.missing'],
      },
      createEvaluatorContext(),
    );

    expect(
      evaluator.evaluate({
        hass: createHASS({ 'binary_sensor.foo': createStateEntity({ state: 'bar' }) }),
      }).result,
    ).toBeTruthy();
  });

  it('should match a state_not against an empty-string entity state', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'state' as const, entity_id: 'sensor.foo', state_not: 'on' },
      createEvaluatorContext(),
    );

    expect(
      evaluator.evaluate({
        hass: createHASS({ 'sensor.foo': createStateEntity({ state: '' }) }),
      }).result,
    ).toBeTruthy();
  });

  it('should match an empty-string expected state', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'state' as const, entity_id: 'sensor.foo', state: '' },
      createEvaluatorContext(),
    );

    // An entity state of "" matches the configured empty `state`.
    expect(
      evaluator.evaluate({
        hass: createHASS({ 'sensor.foo': createStateEntity({ state: '' }) }),
      }).result,
    ).toBeTruthy();

    // A non-empty entity state does not.
    expect(
      evaluator.evaluate({
        hass: createHASS({ 'sensor.foo': createStateEntity({ state: 'on' }) }),
      }).result,
    ).toBeFalsy();
  });
});
