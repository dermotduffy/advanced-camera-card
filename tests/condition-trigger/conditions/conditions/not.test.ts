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

    // Neither sub-condition is true, so `not` passes.
    expect(evaluator.evaluate({})).toEqual({ result: true });

    // Any sub-condition being true means `not` fails.
    expect(evaluator.evaluate({ fullscreen: true }).result).toBeFalsy();
    expect(evaluator.evaluate({ expand: true }).result).toBeFalsy();

    // Both sub-conditions false again -- `not` passes.
    expect(evaluator.evaluate({ fullscreen: false, expand: false }).result).toBeTruthy();
  });

  it('should expose its children external invalidation sources', () => {
    // The `screen` child contributes an external source; the `fullscreen` child
    // contributes none -- the union must include only the former.
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

    expect(evaluator.externalSources).toHaveLength(1);
  });
});
