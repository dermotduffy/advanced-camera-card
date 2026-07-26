import { describe, expect, it, vi, type Mock } from 'vitest';

import type { MicrophoneState } from '../../../../src/card-controller/types';
import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import { MicrophoneTrigger } from '../../../../src/condition-trigger/triggers/triggers/microphone';
import type { TriggerOfType } from '../../../../src/condition-trigger/triggers/triggers/types';
import { createTriggerEvaluatorContext } from './test-utils';

describe('MicrophoneTrigger', () => {
  const createMicrophoneState = (state: Partial<MicrophoneState>): MicrophoneState => ({
    connected: false,
    muted: false,
    forbidden: false,
    ...state,
  });

  const create = (
    trigger: TriggerOfType<'microphone'>,
  ): { stateManager: ConditionStateManager; callback: Mock } => {
    const stateManager = new ConditionStateManager();
    const callback = vi.fn();
    new MicrophoneTrigger(
      trigger,
      createTriggerEvaluatorContext({ stateManager }),
    ).subscribe(callback);
    return { stateManager, callback };
  };

  it('should trigger on any mute change without a value', () => {
    const { stateManager, callback } = create({ trigger: 'microphone' });
    stateManager.setState({ microphone: createMicrophoneState({ muted: true }) });
    stateManager.setState({ microphone: createMicrophoneState({ muted: false }) });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should trigger on any connection change without a value', () => {
    const { stateManager, callback } = create({ trigger: 'microphone' });
    stateManager.setState({ microphone: createMicrophoneState({ connected: true }) });
    stateManager.setState({ microphone: createMicrophoneState({ connected: false }) });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should trigger only on changes to the given connected value', () => {
    const { stateManager, callback } = create({
      trigger: 'microphone',
      connected: true,
    });
    stateManager.setState({ microphone: createMicrophoneState({ connected: true }) });
    expect(callback).toHaveBeenCalledTimes(1);

    stateManager.setState({ microphone: createMicrophoneState({ connected: false }) });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not trigger on a mute change when only connected is given', () => {
    const { stateManager, callback } = create({
      trigger: 'microphone',
      connected: true,
    });
    stateManager.setState({
      microphone: createMicrophoneState({ connected: true, muted: true }),
    });
    expect(callback).toHaveBeenCalledTimes(1);

    stateManager.setState({
      microphone: createMicrophoneState({ connected: true, muted: false }),
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not trigger on a connection change when only muted is given', () => {
    const { stateManager, callback } = create({ trigger: 'microphone', muted: true });
    stateManager.setState({
      microphone: createMicrophoneState({ connected: false, muted: true }),
    });
    expect(callback).toHaveBeenCalledTimes(1);

    stateManager.setState({
      microphone: createMicrophoneState({ connected: true, muted: true }),
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should require both connected and muted to match when both are given', () => {
    const { stateManager, callback } = create({
      trigger: 'microphone',
      connected: true,
      muted: false,
    });

    stateManager.setState({
      microphone: createMicrophoneState({ connected: true, muted: true }),
    });
    expect(callback).not.toHaveBeenCalled();

    stateManager.setState({
      microphone: createMicrophoneState({ connected: true, muted: false }),
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should trigger only on changes to the given mute value', () => {
    const { stateManager, callback } = create({ trigger: 'microphone', muted: true });
    stateManager.setState({ microphone: createMicrophoneState({ muted: true }) });
    expect(callback).toHaveBeenCalledTimes(1);

    stateManager.setState({ microphone: createMicrophoneState({ muted: false }) });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should trigger on the falling edge to a false value', () => {
    const { stateManager, callback } = create({ trigger: 'microphone', muted: false });

    stateManager.setState({ microphone: createMicrophoneState({ muted: true }) });
    expect(callback).not.toHaveBeenCalled();

    stateManager.setState({ microphone: createMicrophoneState({ muted: false }) });
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
