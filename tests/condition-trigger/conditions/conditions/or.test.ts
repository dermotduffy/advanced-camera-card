import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConditionEvaluator } from '../../../../src/condition-trigger/conditions/factory';
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

  it('should expose its children external invalidation sources', () => {
    // The `screen` child contributes an external source; the `fullscreen` child
    // contributes none -- the union must include only the former.
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

    expect(evaluator.externalSources).toHaveLength(1);
  });
});
