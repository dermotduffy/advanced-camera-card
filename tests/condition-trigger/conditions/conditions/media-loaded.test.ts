import { describe, expect, it } from 'vitest';

import { createConditionEvaluator } from '../../../../src/condition-trigger/conditions/factory';
import { mediaLoadedConditionSchema } from '../../../../src/config/schema/condition-trigger/conditions/custom/media-loaded';
import { createMediaLoadedInfo } from '../../../test-utils';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('media loaded condition', () => {
  it('should match a media loaded condition', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'media_loaded' as const, media_loaded: true },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(
      evaluator.evaluate({ mediaLoadedInfo: createMediaLoadedInfo() }).result,
    ).toBeTruthy();
    expect(evaluator.evaluate({ mediaLoadedInfo: null }).result).toBeFalsy();
  });

  it('should require a value', () => {
    expect(() =>
      mediaLoadedConditionSchema.parse({ condition: 'media_loaded' }),
    ).toThrow();
  });
});
