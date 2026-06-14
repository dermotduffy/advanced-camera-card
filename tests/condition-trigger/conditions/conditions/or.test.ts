import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConditionEvaluator } from '../../../../src/condition-trigger/conditions/factory';
import { createHASS, createStateEntity } from '../../../test-utils';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('or condition', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should evaluate a simple or condition', () => {
    const evaluator = createConditionEvaluator(
      {
        condition: 'or' as const,
        conditions: [
          { condition: 'fullscreen' as const, fullscreen: true },
          { condition: 'expand' as const, expand: true },
        ],
      },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(evaluator.evaluate({ fullscreen: true }).result).toBeTruthy();
    expect(evaluator.evaluate({ expand: true }).result).toBeTruthy();
    expect(evaluator.evaluate({ fullscreen: false, expand: false }).result).toBeFalsy();
  });

  it('should forward the first matching sub-condition evaluation', () => {
    const evaluator = createConditionEvaluator(
      {
        condition: 'or' as const,
        conditions: [
          { condition: 'state' as const, entity_id: 'switch.one', state: 'on' },
          { condition: 'state' as const, entity_id: 'switch.two', state: 'on' },
        ],
      },
      createEvaluatorContext(),
    );

    const bothOff = {
      hass: createHASS({
        'switch.one': createStateEntity({ state: 'off' }),
        'switch.two': createStateEntity({ state: 'off' }),
      }),
    };
    const oneOn = {
      hass: createHASS({
        'switch.one': createStateEntity({ state: 'on' }),
        'switch.two': createStateEntity({ state: 'off' }),
      }),
    };

    expect(evaluator.evaluate(bothOff, bothOff).result).toBeFalsy();

    // The first child transitions to `on` and matches, so its evaluation
    // (including the change edge) is forwarded.
    expect(evaluator.evaluate(oneOn, bothOff)).toEqual({ result: true, changed: true });
  });

  it('should forward subscribe and destroy to its children', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      addEventListener: addEventListener,
      removeEventListener: removeEventListener,
    } as unknown as MediaQueryList);

    // The `screen` child supports subscribe/destroy; the `fullscreen` child does
    // not -- forwarding must handle both.
    const evaluator = createConditionEvaluator(
      {
        condition: 'or' as const,
        conditions: [
          { condition: 'screen' as const, media_query: 'whatever' },
          { condition: 'fullscreen' as const, fullscreen: true },
        ],
      },
      createEvaluatorContext(),
    );

    const onChange = vi.fn();
    evaluator.subscribe?.(onChange);
    expect(addEventListener).toHaveBeenCalledWith('change', expect.anything());
    addEventListener.mock.calls[0][1]();
    expect(onChange).toHaveBeenCalled();

    evaluator.destroy?.();
    expect(removeEventListener).toHaveBeenCalled();
  });
});
