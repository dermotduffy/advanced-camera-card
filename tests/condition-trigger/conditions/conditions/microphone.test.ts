import { describe, expect, it } from 'vitest';

import type { MicrophoneState } from '../../../../src/card-controller/types';
import { createConditionEvaluator } from '../../../../src/condition-trigger/conditions/factory';
import { createEvaluatorContext } from './test-utils';

describe('microphone condition', () => {
  const createMicrophoneState = (state: Partial<MicrophoneState>): MicrophoneState => {
    return {
      connected: false,
      muted: false,
      forbidden: false,
      ...state,
    };
  };

  it('should match when muted is true', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'microphone' as const, muted: true },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(
      evaluator.evaluate({ microphone: createMicrophoneState({ muted: true }) }).result,
    ).toBeTruthy();
    expect(
      evaluator.evaluate({ microphone: createMicrophoneState({ muted: false }) }).result,
    ).toBeFalsy();
  });

  it('should match when muted is false', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'microphone' as const, muted: false },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(
      evaluator.evaluate({ microphone: createMicrophoneState({ muted: true }) }).result,
    ).toBeFalsy();
    expect(
      evaluator.evaluate({ microphone: createMicrophoneState({ muted: false }) }).result,
    ).toBeTruthy();
  });

  it('should match when connected is true', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'microphone' as const, connected: true },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(
      evaluator.evaluate({ microphone: createMicrophoneState({ connected: true }) })
        .result,
    ).toBeTruthy();
    expect(
      evaluator.evaluate({ microphone: createMicrophoneState({ connected: false }) })
        .result,
    ).toBeFalsy();
  });

  it('should match when connected is false', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'microphone' as const, connected: false },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeFalsy();
    expect(
      evaluator.evaluate({ microphone: createMicrophoneState({ connected: true }) })
        .result,
    ).toBeFalsy();
    expect(
      evaluator.evaluate({ microphone: createMicrophoneState({ connected: false }) })
        .result,
    ).toBeTruthy();
  });

  it('should require both connected and muted to match when both are given', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'microphone' as const, connected: true, muted: false },
      createEvaluatorContext(),
    );

    expect(
      evaluator.evaluate({
        microphone: createMicrophoneState({ connected: true, muted: false }),
      }).result,
    ).toBeTruthy();
    expect(
      evaluator.evaluate({
        microphone: createMicrophoneState({ connected: true, muted: true }),
      }).result,
    ).toBeFalsy();
    expect(
      evaluator.evaluate({
        microphone: createMicrophoneState({ connected: false, muted: false }),
      }).result,
    ).toBeFalsy();
  });

  it('should match any microphone state when neither parameter is given', () => {
    const evaluator = createConditionEvaluator(
      { condition: 'microphone' as const },
      createEvaluatorContext(),
    );

    expect(evaluator.evaluate({}).result).toBeTruthy();
    expect(
      evaluator.evaluate({ microphone: createMicrophoneState({ connected: true }) })
        .result,
    ).toBeTruthy();
  });
});
