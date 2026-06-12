import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConditionEvaluator } from '../../../../src/condition-trigger/conditions/factory';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('screen condition', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should evaluate the media query', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
    } as unknown as MediaQueryList);

    const evaluator = createConditionEvaluator(
      { condition: 'screen' as const, media_query: 'whatever' },
      createEvaluatorContext(),
    );
    expect(evaluator.evaluate().result).toBeTruthy();
  });

  it('should not match and not subscribe without a media query', () => {
    const matchMedia = vi.spyOn(window, 'matchMedia');
    const evaluator = createConditionEvaluator(
      { condition: 'screen' as const },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate().result).toBeFalsy();
    evaluator.subscribe?.(vi.fn());
    expect(matchMedia).not.toHaveBeenCalled();
  });

  it('should register and invoke a media-query listener on subscribe', () => {
    const addEventListener = vi.fn();
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      addEventListener: addEventListener,
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);

    const evaluator = createConditionEvaluator(
      { condition: 'screen' as const, media_query: 'whatever' },
      createEvaluatorContext(),
    );

    const onChange = vi.fn();
    evaluator.subscribe?.(onChange);

    expect(addEventListener).toHaveBeenCalledWith('change', expect.anything());

    // Invoke the registered handler and confirm it triggers the callback.
    addEventListener.mock.calls[0][1]();
    expect(onChange).toHaveBeenCalled();
  });

  it('should remove the media-query listener on destroy', () => {
    const removeEventListener = vi.fn();
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      addEventListener: vi.fn(),
      removeEventListener: removeEventListener,
    } as unknown as MediaQueryList);

    const evaluator = createConditionEvaluator(
      { condition: 'screen' as const, media_query: 'whatever' },
      createEvaluatorContext(),
    );

    evaluator.subscribe?.(vi.fn());
    evaluator.destroy?.();
    expect(removeEventListener).toHaveBeenCalledWith('change', expect.anything());
  });
});
