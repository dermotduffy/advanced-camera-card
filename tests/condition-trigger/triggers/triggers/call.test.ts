import { describe, expect, it, vi, type Mock } from 'vitest';

import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import { CallTrigger } from '../../../../src/condition-trigger/triggers/triggers/call';
import type { TriggerOfType } from '../../../../src/condition-trigger/triggers/triggers/types';
import { createTriggerEvaluatorContext } from './test-utils';

// @vitest-environment jsdom
describe('CallTrigger', () => {
  const create = (
    trigger: TriggerOfType<'call'>,
  ): { stateManager: ConditionStateManager; callback: Mock } => {
    const stateManager = new ConditionStateManager();
    const callback = vi.fn();
    new CallTrigger(trigger, createTriggerEvaluatorContext({ stateManager })).subscribe(
      callback,
    );
    return { stateManager, callback };
  };

  it('should treat an absent call state as idle', () => {
    const { stateManager, callback } = create({ trigger: 'call' });

    // Absent (undefined) is equivalent to idle, so this is not a change.
    stateManager.setState({ call: 'idle' });
    expect(callback).not.toHaveBeenCalled();

    stateManager.setState({ call: 'ringing' });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should trigger on any phase change without from or to', () => {
    const { stateManager, callback } = create({ trigger: 'call' });

    stateManager.setState({ call: 'ringing' });
    stateManager.setState({ call: 'answered' });
    stateManager.setState({ call: 'idle' });

    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('should not trigger when the phase is unchanged', () => {
    const { stateManager, callback } = create({ trigger: 'call' });

    stateManager.setState({ call: 'ringing' });
    stateManager.setState({ call: 'ringing', camera: 'camera.office' });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should trigger when an inbound call is answered', () => {
    const { stateManager, callback } = create({
      trigger: 'call',
      from: 'ringing',
      to: 'answered',
    });

    stateManager.setState({ call: 'ringing' });
    expect(callback).not.toHaveBeenCalled();

    stateManager.setState({ call: 'answered' });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not trigger on an outbound call when from is ringing', () => {
    const { stateManager, callback } = create({
      trigger: 'call',
      from: 'ringing',
      to: 'answered',
    });

    // An outbound call is answered by construction, so it moves from idle
    // straight to answered without ringing.
    stateManager.setState({ call: 'answered' });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should trigger on an outbound call when only to is given', () => {
    const { stateManager, callback } = create({ trigger: 'call', to: 'answered' });

    stateManager.setState({ call: 'answered' });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should trigger when a ringing call is rejected', () => {
    const { stateManager, callback } = create({
      trigger: 'call',
      from: 'ringing',
      to: 'idle',
    });

    stateManager.setState({ call: 'ringing' });
    expect(callback).not.toHaveBeenCalled();

    stateManager.setState({ call: 'idle' });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not trigger a reject when an answered call ends', () => {
    const { stateManager, callback } = create({
      trigger: 'call',
      from: 'ringing',
      to: 'idle',
    });

    stateManager.setState({ call: 'ringing' });
    stateManager.setState({ call: 'answered' });
    stateManager.setState({ call: 'idle' });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should trigger when an answered call is hung up', () => {
    const { stateManager, callback } = create({
      trigger: 'call',
      from: 'answered',
      to: 'idle',
    });

    stateManager.setState({ call: 'answered' });
    expect(callback).not.toHaveBeenCalled();

    stateManager.setState({ call: 'idle' });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should trigger on both answer and reject with from alone', () => {
    const answered = create({ trigger: 'call', from: 'ringing' });
    const rejected = create({ trigger: 'call', from: 'ringing' });

    answered.stateManager.setState({ call: 'ringing' });
    answered.stateManager.setState({ call: 'answered' });

    rejected.stateManager.setState({ call: 'ringing' });
    rejected.stateManager.setState({ call: 'idle' });

    expect(answered.callback).toHaveBeenCalledTimes(1);
    expect(rejected.callback).toHaveBeenCalledTimes(1);
  });

  it('should trigger on any end with to alone', () => {
    const { stateManager, callback } = create({ trigger: 'call', to: 'idle' });

    stateManager.setState({ call: 'ringing' });
    stateManager.setState({ call: 'idle' });
    stateManager.setState({ call: 'answered' });
    stateManager.setState({ call: 'idle' });

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should match any phase in a from or to list', () => {
    const { stateManager, callback } = create({
      trigger: 'call',
      from: ['ringing', 'answered'],
      to: ['idle'],
    });

    stateManager.setState({ call: 'ringing' });
    stateManager.setState({ call: 'idle' });
    expect(callback).toHaveBeenCalledTimes(1);

    stateManager.setState({ call: 'answered' });
    stateManager.setState({ call: 'idle' });
    expect(callback).toHaveBeenCalledTimes(2);
  });
});
