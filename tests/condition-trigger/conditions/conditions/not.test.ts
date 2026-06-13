import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConditionEvaluator } from '../../../../src/condition-trigger/conditions/factory';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('not condition', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should evaluate a not condition', () => {
    const evaluator = createConditionEvaluator(
      {
        condition: 'not' as const,
        conditions: [
          { condition: 'fullscreen' as const, fullscreen: true },
          { condition: 'expand' as const, expand: true },
        ],
      },
      createEvaluatorContext(),
    );

    // Neither sub-condition is true, so `not` passes; these children have no
    // change edge, so none is reported.
    expect(evaluator.evaluate({})).toEqual({ result: true, changed: false });

    // Any sub-condition being true means `not` fails.
    expect(evaluator.evaluate({ fullscreen: true }).result).toBeFalsy();
    expect(evaluator.evaluate({ expand: true }).result).toBeFalsy();

    // Both sub-conditions false again -- `not` passes.
    expect(evaluator.evaluate({ fullscreen: false, expand: false }).result).toBeTruthy();
  });

  it('should report a change when a child input transitions', () => {
    const evaluator = createConditionEvaluator(
      {
        condition: 'not' as const,
        conditions: [{ condition: 'camera' as const, cameras: ['front'] }],
      },
      createEvaluatorContext(),
    );

    // The camera moves between two non-listed cameras: `not [camera in front]`
    // stays true, and the child's transition surfaces as a change edge.
    expect(evaluator.evaluate({ camera: 'side' }, { camera: 'back' })).toEqual({
      result: true,
      changed: true,
    });
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
        condition: 'not' as const,
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
