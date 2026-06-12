import { describe, expect, it } from 'vitest';
import { createConditionEvaluator } from '../../../../src/condition-trigger/conditions/factory';
import { createConfig } from '../../../test-utils';
import { createEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('config condition', () => {
  const config_1 = createConfig({
    // Default is:
    //
    // view: {
    //   default: live,
    // },
  });
  const config_2 = createConfig({
    view: {
      default: 'clips',
    },
  });
  const config_3 = createConfig({
    view: {
      default: 'clips',
      default_cycle_camera: true,
    },
  });
  const config_4 = createConfig({
    view: {
      default: 'clips',
      default_cycle_camera: true,
      dim: true,
    },
  });

  it('should report trigger data for any config change', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'config' as const },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({ config: config_1 }, {})).toEqual({
      result: true,
      triggerData: {
        config: {
          to: config_1,
        },
      },
    });

    expect(evaluator.evaluate({ config: config_2 }, { config: config_1 })).toEqual({
      result: true,
      triggerData: {
        config: {
          from: config_1,
          to: config_2,
        },
      },
    });
  });

  it('should not match when the config is unchanged', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'config' as const },
      createEvaluatorContext(),
    );

    expect(
      evaluator.evaluate({ config: config_1 }, { config: config_1 }).result,
    ).toBeFalsy();
  });

  it('should match a specific config change', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'config' as const, paths: ['view.default'] },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({ config: config_1 }, {}).result).toBeTruthy();
    expect(
      evaluator.evaluate({ config: config_2 }, { config: config_1 }).result,
    ).toBeTruthy();
    expect(
      evaluator.evaluate({ config: config_3 }, { config: config_2 }).result,
    ).toBeFalsy();
  });

  it('should match multiple specific config changes', () => {
    const evaluator = createConditionEvaluator(
      {
        condition: 'config' as const,
        paths: ['view.default', 'view.default_cycle_camera'],
      },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({ config: config_1 }, {}).result).toBeTruthy();
    expect(
      evaluator.evaluate({ config: config_2 }, { config: config_1 }).result,
    ).toBeTruthy();
    expect(
      evaluator.evaluate({ config: config_3 }, { config: config_2 }).result,
    ).toBeTruthy();
    expect(
      evaluator.evaluate({ config: config_4 }, { config: config_3 }).result,
    ).toBeFalsy();
  });
});
