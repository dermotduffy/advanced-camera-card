import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConditionEvaluator } from '../../../../src/condition-trigger/conditions/factory';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('and condition', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should evaluate a simple and condition', () => {
    const evaluator = createConditionEvaluator(
      {
        condition: 'and' as const,
        conditions: [
          { condition: 'fullscreen' as const, fullscreen: true },
          { condition: 'expand' as const, expand: true },
        ],
      },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(evaluator.evaluate({ fullscreen: true }).result).toBeFalsy();
    expect(evaluator.evaluate({ fullscreen: true, expand: true }).result).toBeTruthy();
    expect(evaluator.evaluate({ fullscreen: false, expand: true }).result).toBeFalsy();
  });

  it('should report combined trigger data for an and condition', () => {
    // Not a terribly realistic example, but chosen so that trigger data for
    // both camera and view should be returned.
    const evaluator = createConditionEvaluator(
      {
        condition: 'and' as const,
        conditions: [{ condition: 'camera' as const }, { condition: 'view' as const }],
      },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(evaluator.evaluate({ camera: 'camera-1' }, {}).result).toBeFalsy();

    expect(
      evaluator.evaluate(
        { camera: 'camera-2', view: 'clip' },
        { camera: 'camera-1', view: 'live' },
      ),
    ).toEqual({
      result: true,
      triggerData: {
        camera: { from: 'camera-1', to: 'camera-2' },
        view: { from: 'live', to: 'clip' },
      },
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
    // not — forwarding must handle both.
    const evaluator = createConditionEvaluator(
      {
        condition: 'and' as const,
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
