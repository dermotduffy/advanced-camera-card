import { HassEntities, HassEntity } from 'home-assistant-js-websocket';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { TemplateRenderer } from '../../../../src/card-controller/templates';
import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import { NumericStateTrigger } from '../../../../src/condition-trigger/triggers/triggers/numeric-state';
import { TriggerOfType } from '../../../../src/condition-trigger/triggers/triggers/types';
import { createHASS, createStateEntity } from '../../../test-utils';

const SENSOR = 'sensor.temperature';
const SENSOR_TWO = 'sensor.humidity';
const THRESHOLD = 'input_number.limit';

// @vitest-environment jsdom
describe('NumericStateTrigger', () => {
  const create = (
    config: TriggerOfType<'numeric_state'>,
  ): {
    trigger: NumericStateTrigger;
    stateManager: ConditionStateManager;
    onFire: Mock;
  } => {
    const stateManager = new ConditionStateManager();
    const onFire = vi.fn();
    const trigger = new NumericStateTrigger(config, {
      stateManager,
      templateRenderer: new TemplateRenderer(),
    });
    return { trigger, stateManager, onFire };
  };

  const setHass = (
    manager: ConditionStateManager,
    states: Record<string, Partial<HassEntity>>,
  ): void => {
    const entities: HassEntities = {};
    for (const [id, partial] of Object.entries(states)) {
      entities[id] = createStateEntity(partial);
    }
    manager.setState({ hass: createHASS(entities) });
  };

  it('should fire on the crossing into range', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'numeric_state',
      entity_id: SENSOR,
      above: 20,
    });
    trigger.subscribe(onFire);

    // Below the threshold: arms but does not fire.
    setHass(stateManager, { [SENSOR]: { state: '10' } });
    expect(onFire).not.toHaveBeenCalled();

    // Crosses above the threshold: fires once.
    setHass(stateManager, { [SENSOR]: { state: '25' } });
    expect(onFire).toHaveBeenCalledTimes(1);
    expect(onFire).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'numeric_state',
        entity_id: SENSOR,
        entity: SENSOR,
      }),
    );
  });

  it('should not re-fire while the value stays in range', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'numeric_state',
      entity_id: SENSOR,
      above: 20,
    });
    trigger.subscribe(onFire);

    setHass(stateManager, { [SENSOR]: { state: '10' } });
    setHass(stateManager, { [SENSOR]: { state: '25' } });
    expect(onFire).toHaveBeenCalledTimes(1);

    // Still in range: not a fresh crossing, so no re-fire.
    setHass(stateManager, { [SENSOR]: { state: '26' } });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('should fire again after leaving and re-entering the range', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'numeric_state',
      entity_id: SENSOR,
      above: 20,
    });
    trigger.subscribe(onFire);

    setHass(stateManager, { [SENSOR]: { state: '10' } });
    setHass(stateManager, { [SENSOR]: { state: '25' } });
    expect(onFire).toHaveBeenCalledTimes(1);

    // Leave the range (re-arms), then cross back in.
    setHass(stateManager, { [SENSOR]: { state: '10' } });
    setHass(stateManager, { [SENSOR]: { state: '25' } });
    expect(onFire).toHaveBeenCalledTimes(2);
  });

  it('should respect a range with both above and below', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'numeric_state',
      entity_id: SENSOR,
      above: 20,
      below: 30,
    });
    trigger.subscribe(onFire);

    // Below the range: arms.
    setHass(stateManager, { [SENSOR]: { state: '10' } });

    // Into the range: fires.
    setHass(stateManager, { [SENSOR]: { state: '25' } });
    expect(onFire).toHaveBeenCalledTimes(1);

    // Out the top of the range: re-arms, no fire.
    setHass(stateManager, { [SENSOR]: { state: '35' } });
    expect(onFire).toHaveBeenCalledTimes(1);

    // Back into the range: fires again.
    setHass(stateManager, { [SENSOR]: { state: '25' } });
    expect(onFire).toHaveBeenCalledTimes(2);
  });

  it('should resolve an entity-id reference as the threshold', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'numeric_state',
      entity_id: SENSOR,
      above: THRESHOLD,
    });
    trigger.subscribe(onFire);

    // 10 > 20 is false: arms.
    setHass(stateManager, { [SENSOR]: { state: '10' }, [THRESHOLD]: { state: '20' } });

    // 25 > 20 is true: fires.
    setHass(stateManager, { [SENSOR]: { state: '25' }, [THRESHOLD]: { state: '20' } });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('should match against an attribute', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'numeric_state',
      entity_id: SENSOR,
      attribute: 'battery',
      above: 20,
    });
    trigger.subscribe(onFire);

    setHass(stateManager, { [SENSOR]: { state: 'on', attributes: { battery: 10 } } });
    setHass(stateManager, { [SENSOR]: { state: 'on', attributes: { battery: 25 } } });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('should match the rendered value_template', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'numeric_state',
      entity_id: SENSOR,
      value_template: `{{ states('${SENSOR}') | float * 10 }}`,
      above: 20,
    });
    trigger.subscribe(onFire);

    // Template value 1 * 10 = 10: arms.
    setHass(stateManager, { [SENSOR]: { state: '1' } });

    // Template value 3 * 10 = 30: crosses in and fires.
    setHass(stateManager, { [SENSOR]: { state: '3' } });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('should fan out independently over a list of entities', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'numeric_state',
      entity_id: [SENSOR, SENSOR_TWO],
      above: 20,
    });
    trigger.subscribe(onFire);

    setHass(stateManager, {
      [SENSOR]: { state: '10' },
      [SENSOR_TWO]: { state: '10' },
    });

    // Only SENSOR crosses in.
    setHass(stateManager, { [SENSOR]: { state: '25' }, [SENSOR_TWO]: { state: '10' } });
    expect(onFire).toHaveBeenCalledTimes(1);
    expect(onFire).toHaveBeenLastCalledWith(
      expect.objectContaining({ entity_id: SENSOR }),
    );

    // Now SENSOR_TWO crosses in.
    setHass(stateManager, { [SENSOR]: { state: '25' }, [SENSOR_TWO]: { state: '25' } });
    expect(onFire).toHaveBeenCalledTimes(2);
    expect(onFire).toHaveBeenLastCalledWith(
      expect.objectContaining({ entity_id: SENSOR_TWO }),
    );
  });

  it('should not fire for an entity that did not change', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'numeric_state',
      entity_id: SENSOR,
      above: 20,
    });
    trigger.subscribe(onFire);

    setHass(stateManager, { [SENSOR]: { state: '10' } });

    // An unrelated entity changes; SENSOR is unchanged so must not fire.
    setHass(stateManager, {
      [SENSOR]: { state: '10' },
      [SENSOR_TWO]: { state: '25' },
    });
    expect(onFire).not.toHaveBeenCalled();
  });

  it('should arm an entity already outside the range at subscribe', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'numeric_state',
      entity_id: SENSOR,
      above: 20,
    });

    // Already below the threshold before subscribe: armed at subscribe.
    setHass(stateManager, { [SENSOR]: { state: '10' } });
    trigger.subscribe(onFire);

    // The first crossing in fires.
    setHass(stateManager, { [SENSOR]: { state: '25' } });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('should not fire for an entity already in range at subscribe', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'numeric_state',
      entity_id: SENSOR,
      above: 20,
    });

    // Already in range before subscribe: not armed.
    setHass(stateManager, { [SENSOR]: { state: '25' } });
    trigger.subscribe(onFire);

    // A further in-range change is not a crossing.
    setHass(stateManager, { [SENSOR]: { state: '26' } });
    expect(onFire).not.toHaveBeenCalled();
  });

  it('should not fire for an entity unreadable at subscribe until it crosses in afresh', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'numeric_state',
      entity_id: SENSOR,
      above: 20,
    });

    // No value at subscribe: not armed (an unreadable entity is not a crossing
    // source until it has been outside the range).
    trigger.subscribe(onFire);

    setHass(stateManager, { [SENSOR]: { state: '25' } });
    expect(onFire).not.toHaveBeenCalled();

    // After it has been outside, the next crossing in fires.
    setHass(stateManager, { [SENSOR]: { state: '10' } });
    setHass(stateManager, { [SENSOR]: { state: '25' } });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('should provide the full from_state/to_state objects', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'numeric_state',
      entity_id: SENSOR,
      above: 20,
    });
    trigger.subscribe(onFire);

    setHass(stateManager, { [SENSOR]: { state: '10' } });
    setHass(stateManager, { [SENSOR]: { state: '25' } });
    expect(onFire).toHaveBeenCalledWith(
      expect.objectContaining({
        from_state: expect.objectContaining({ state: '10' }),
        to_state: expect.objectContaining({ state: '25' }),
      }),
    );
  });

  it('should fire without a from_state when an armed entity is removed and reappears in range', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'numeric_state',
      entity_id: SENSOR,
      above: 20,
    });
    trigger.subscribe(onFire);

    // Arm the entity below the range, then remove it (still armed).
    setHass(stateManager, { [SENSOR]: { state: '10' } });
    setHass(stateManager, {});

    // It reappears already in range: fires, but there is no prior state.
    setHass(stateManager, { [SENSOR]: { state: '25' } });
    expect(onFire).toHaveBeenCalledTimes(1);
    expect(onFire).toHaveBeenLastCalledWith({
      platform: 'numeric_state',
      entity_id: SENSOR,
      entity: SENSOR,
      to_state: expect.objectContaining({ state: '25' }),
    });
  });

  it('should accept the entity alias', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'numeric_state',
      entity: SENSOR,
      above: 20,
    });
    trigger.subscribe(onFire);

    setHass(stateManager, { [SENSOR]: { state: '10' } });
    setHass(stateManager, { [SENSOR]: { state: '25' } });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  describe('for', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should fire only after the value is held in range for the duration', () => {
      const { trigger, stateManager, onFire } = create({
        trigger: 'numeric_state',
        entity_id: SENSOR,
        above: 20,
        for: '00:00:05',
      });
      trigger.subscribe(onFire);

      setHass(stateManager, { [SENSOR]: { state: '10' } });
      setHass(stateManager, { [SENSOR]: { state: '25' } });
      vi.advanceTimersByTime(4999);
      expect(onFire).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(onFire).toHaveBeenCalledTimes(1);
    });

    it('should cancel the pending fire when the value leaves the range', () => {
      const { trigger, stateManager, onFire } = create({
        trigger: 'numeric_state',
        entity_id: SENSOR,
        above: 20,
        for: '00:00:05',
      });
      trigger.subscribe(onFire);

      setHass(stateManager, { [SENSOR]: { state: '10' } });
      setHass(stateManager, { [SENSOR]: { state: '25' } });
      vi.advanceTimersByTime(3000);

      // Leaves the range before the hold elapses: cancelled.
      setHass(stateManager, { [SENSOR]: { state: '10' } });
      vi.advanceTimersByTime(5000);
      expect(onFire).not.toHaveBeenCalled();
    });

    it('should keep the hold across an in-range change', () => {
      const { trigger, stateManager, onFire } = create({
        trigger: 'numeric_state',
        entity_id: SENSOR,
        above: 20,
        for: '00:00:05',
      });
      trigger.subscribe(onFire);

      setHass(stateManager, { [SENSOR]: { state: '10' } });
      setHass(stateManager, { [SENSOR]: { state: '25' } });
      vi.advanceTimersByTime(3000);

      // Still in range: the fixed-deadline hold keeps running, not reset.
      setHass(stateManager, { [SENSOR]: { state: '26' } });
      vi.advanceTimersByTime(2000);
      expect(onFire).toHaveBeenCalledTimes(1);
    });

    it('should clear a pending for: timer on destroy', () => {
      const { trigger, stateManager, onFire } = create({
        trigger: 'numeric_state',
        entity_id: SENSOR,
        above: 20,
        for: '00:00:05',
      });
      trigger.subscribe(onFire);

      setHass(stateManager, { [SENSOR]: { state: '10' } });
      setHass(stateManager, { [SENSOR]: { state: '25' } });
      trigger.destroy();
      vi.advanceTimersByTime(5000);
      expect(onFire).not.toHaveBeenCalled();
    });

    it('should reset the for: timer on a fresh crossing', () => {
      const { trigger, stateManager, onFire } = create({
        trigger: 'numeric_state',
        entity_id: SENSOR,
        above: 20,
        for: '00:00:05',
      });
      trigger.subscribe(onFire);

      setHass(stateManager, { [SENSOR]: { state: '10' } });
      setHass(stateManager, { [SENSOR]: { state: '25' } });
      vi.advanceTimersByTime(3000);

      // Leave and cross back in: the hold restarts from zero.
      setHass(stateManager, { [SENSOR]: { state: '10' } });
      setHass(stateManager, { [SENSOR]: { state: '25' } });
      vi.advanceTimersByTime(4000);
      expect(onFire).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1000);
      expect(onFire).toHaveBeenCalledTimes(1);
    });

    it('should not fire when for is unparseable', () => {
      const { trigger, stateManager, onFire } = create({
        trigger: 'numeric_state',
        entity_id: SENSOR,
        above: 20,
        for: 'not-a-duration',
      });
      trigger.subscribe(onFire);

      setHass(stateManager, { [SENSOR]: { state: '10' } });
      setHass(stateManager, { [SENSOR]: { state: '25' } });
      vi.advanceTimersByTime(100000);
      expect(onFire).not.toHaveBeenCalled();
    });
  });

  it('should stop firing after destroy', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'numeric_state',
      entity_id: SENSOR,
      above: 20,
    });
    trigger.subscribe(onFire);
    trigger.destroy();

    setHass(stateManager, { [SENSOR]: { state: '10' } });
    setHass(stateManager, { [SENSOR]: { state: '25' } });
    expect(onFire).not.toHaveBeenCalled();
  });
});
