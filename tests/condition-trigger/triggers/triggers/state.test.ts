import { HassEntities, HassEntity } from 'home-assistant-js-websocket';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { TemplateRenderer } from '../../../../src/card-controller/templates';
import { ConditionStateManager } from '../../../../src/condition-trigger/conditions/state-manager';
import { StateTrigger } from '../../../../src/condition-trigger/triggers/triggers/state';
import { TriggerOfType } from '../../../../src/condition-trigger/triggers/triggers/types';
import { createHASS, createStateEntity } from '../../../test-utils';

const ENTITY = 'binary_sensor.door';
const ENTITY_TWO = 'binary_sensor.window';

// @vitest-environment jsdom
describe('StateTrigger', () => {
  const create = (
    config: TriggerOfType<'state'>,
  ): {
    trigger: StateTrigger;
    stateManager: ConditionStateManager;
    onFire: Mock;
  } => {
    const stateManager = new ConditionStateManager();
    const onFire = vi.fn();
    const trigger = new StateTrigger(config, {
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

  it('should fire on a transition to a matching state', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'state',
      entity_id: ENTITY,
      to: 'on',
    });
    trigger.subscribe(onFire);

    setHass(stateManager, { [ENTITY]: { state: 'off' } });
    expect(onFire).not.toHaveBeenCalled();

    setHass(stateManager, { [ENTITY]: { state: 'on' } });
    expect(onFire).toHaveBeenCalledTimes(1);
    expect(onFire).toHaveBeenCalledWith(
      expect.objectContaining({ platform: 'state', entity_id: ENTITY, entity: ENTITY }),
    );
  });

  it('should not fire on a transition to a non-matching state', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'state',
      entity_id: ENTITY,
      to: 'on',
    });
    trigger.subscribe(onFire);

    setHass(stateManager, { [ENTITY]: { state: 'off' } });
    setHass(stateManager, { [ENTITY]: { state: 'unavailable' } });
    expect(onFire).not.toHaveBeenCalled();
  });

  it('should require the from state to match', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'state',
      entity_id: ENTITY,
      from: 'off',
      to: 'on',
    });
    trigger.subscribe(onFire);

    setHass(stateManager, { [ENTITY]: { state: 'unknown' } });
    setHass(stateManager, { [ENTITY]: { state: 'on' } });

    // From 'unknown', not 'off'.
    expect(onFire).not.toHaveBeenCalled();

    setHass(stateManager, { [ENTITY]: { state: 'off' } });
    setHass(stateManager, { [ENTITY]: { state: 'on' } });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('should match not_to', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'state',
      entity_id: ENTITY,
      not_to: 'unavailable',
    });
    trigger.subscribe(onFire);

    // Fires (initial -> off, not unavailable).
    setHass(stateManager, { [ENTITY]: { state: 'off' } });
    expect(onFire).toHaveBeenCalledTimes(1);

    // To unavailable -> excluded.
    setHass(stateManager, { [ENTITY]: { state: 'unavailable' } });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('should exclude transitions from a not_from state', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'state',
      entity_id: ENTITY,
      not_from: 'unavailable',
    });
    trigger.subscribe(onFire);

    // From undefined (not 'unavailable') -> fires.
    setHass(stateManager, { [ENTITY]: { state: 'unavailable' } });
    expect(onFire).toHaveBeenCalledTimes(1);

    // From 'unavailable' -> excluded.
    setHass(stateManager, { [ENTITY]: { state: 'on' } });
    expect(onFire).toHaveBeenCalledTimes(1);

    // From 'on' -> fires.
    setHass(stateManager, { [ENTITY]: { state: 'off' } });
    expect(onFire).toHaveBeenCalledTimes(2);
  });

  it('should match a list of to-states', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'state',
      entity_id: ENTITY,
      to: ['armed_home', 'armed_away'],
    });
    trigger.subscribe(onFire);

    setHass(stateManager, { [ENTITY]: { state: 'disarmed' } });
    setHass(stateManager, { [ENTITY]: { state: 'armed_home' } });
    expect(onFire).toHaveBeenCalledTimes(1);
    setHass(stateManager, { [ENTITY]: { state: 'armed_away' } });
    expect(onFire).toHaveBeenCalledTimes(2);
  });

  it('should fan out independently over a list of entities', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'state',
      entity_id: [ENTITY, ENTITY_TWO],
      to: 'on',
    });
    trigger.subscribe(onFire);

    setHass(stateManager, {
      [ENTITY]: { state: 'off' },
      [ENTITY_TWO]: { state: 'off' },
    });

    setHass(stateManager, { [ENTITY]: { state: 'on' }, [ENTITY_TWO]: { state: 'off' } });
    expect(onFire).toHaveBeenCalledTimes(1);
    expect(onFire).toHaveBeenLastCalledWith(
      expect.objectContaining({ entity_id: ENTITY }),
    );

    setHass(stateManager, { [ENTITY]: { state: 'on' }, [ENTITY_TWO]: { state: 'on' } });
    expect(onFire).toHaveBeenCalledTimes(2);
    expect(onFire).toHaveBeenLastCalledWith(
      expect.objectContaining({ entity_id: ENTITY_TWO }),
    );
  });

  it('should not fire for a watched entity that did not change', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'state',
      entity_id: ENTITY,
      to: 'on',
    });
    trigger.subscribe(onFire);

    setHass(stateManager, { [ENTITY]: { state: 'off' } });

    // An unrelated entity changes; ENTITY is unchanged so must not fire.
    setHass(stateManager, {
      [ENTITY]: { state: 'off' },
      [ENTITY_TWO]: { state: 'on' },
    });
    expect(onFire).not.toHaveBeenCalled();
  });

  it('should provide the full from_state/to_state objects', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'state',
      entity_id: ENTITY,
      to: 'on',
    });
    trigger.subscribe(onFire);

    setHass(stateManager, { [ENTITY]: { state: 'off' } });
    setHass(stateManager, { [ENTITY]: { state: 'on' } });
    expect(onFire).toHaveBeenCalledWith(
      expect.objectContaining({
        from_state: expect.objectContaining({ state: 'off' }),
        to_state: expect.objectContaining({ state: 'on' }),
      }),
    );
  });

  it('should accept the entity alias', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'state',
      entity: ENTITY,
      to: 'on',
    });
    trigger.subscribe(onFire);

    setHass(stateManager, { [ENTITY]: { state: 'off' } });
    setHass(stateManager, { [ENTITY]: { state: 'on' } });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  describe('attribute-only changes', () => {
    it('should fire on an attribute-only change when no from/to is set', () => {
      const { trigger, stateManager, onFire } = create({
        trigger: 'state',
        entity_id: ENTITY,
      });
      trigger.subscribe(onFire);

      // Initial change.
      setHass(stateManager, { [ENTITY]: { state: 'on', attributes: { a: 1 } } });
      expect(onFire).toHaveBeenCalledTimes(1);

      // Attribute-only change still fires.
      setHass(stateManager, { [ENTITY]: { state: 'on', attributes: { a: 2 } } });
      expect(onFire).toHaveBeenCalledTimes(2);
    });

    it('should not fire on an attribute-only change when a to is set', () => {
      const { trigger, stateManager, onFire } = create({
        trigger: 'state',
        entity_id: ENTITY,
        to: 'on',
      });
      trigger.subscribe(onFire);

      setHass(stateManager, { [ENTITY]: { state: 'off' } });

      // Off -> on.
      setHass(stateManager, { [ENTITY]: { state: 'on', attributes: { a: 1 } } });
      expect(onFire).toHaveBeenCalledTimes(1);

      // Attribute-only -> suppressed.
      setHass(stateManager, { [ENTITY]: { state: 'on', attributes: { a: 2 } } });
      expect(onFire).toHaveBeenCalledTimes(1);
    });
  });

  it('should treat a null to as matching any state change but not attributes', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'state',
      entity_id: ENTITY,
      to: null,
    });
    trigger.subscribe(onFire);

    setHass(stateManager, { [ENTITY]: { state: 'off' } });
    expect(onFire).toHaveBeenCalledTimes(1);

    // Any state change.
    setHass(stateManager, { [ENTITY]: { state: 'on' } });
    expect(onFire).toHaveBeenCalledTimes(2);

    // Attribute-only suppressed (key present).
    setHass(stateManager, { [ENTITY]: { state: 'on', attributes: { a: 1 } } });
    expect(onFire).toHaveBeenCalledTimes(2);
  });

  it('should match against an attribute', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'state',
      entity_id: ENTITY,
      attribute: 'device_class',
      to: 'door',
    });
    trigger.subscribe(onFire);

    setHass(stateManager, {
      [ENTITY]: { state: 'on', attributes: { device_class: 'window' } },
    });
    expect(onFire).not.toHaveBeenCalled();
    setHass(stateManager, {
      [ENTITY]: { state: 'on', attributes: { device_class: 'door' } },
    });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('should not fire when the watched attribute is unchanged', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'state',
      entity_id: ENTITY,
      attribute: 'device_class',
      to: 'door',
    });
    trigger.subscribe(onFire);

    setHass(stateManager, {
      [ENTITY]: { state: 'on', attributes: { device_class: 'window' } },
    });

    // The state changes but the watched attribute does not -> ignored.
    setHass(stateManager, {
      [ENTITY]: { state: 'off', attributes: { device_class: 'window' } },
    });
    expect(onFire).not.toHaveBeenCalled();
  });

  it('should treat an absent watched attribute as no value', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'state',
      entity_id: ENTITY,
      attribute: 'device_class',
      to: 'door',
    });
    trigger.subscribe(onFire);

    // The entity has no `device_class` attribute, so there is no value to match.
    setHass(stateManager, { [ENTITY]: { state: 'on' } });
    setHass(stateManager, { [ENTITY]: { state: 'off' } });
    expect(onFire).not.toHaveBeenCalled();
  });

  it('should fire without a to_state when the entity is removed', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'state',
      entity_id: ENTITY,
    });
    trigger.subscribe(onFire);

    setHass(stateManager, { [ENTITY]: { state: 'on' } });
    expect(onFire).toHaveBeenCalledTimes(1);

    // Remove the entity from hass entirely.
    stateManager.setState({ hass: createHASS({}) });
    expect(onFire).toHaveBeenCalledTimes(2);
    expect(onFire).toHaveBeenLastCalledWith({
      platform: 'state',
      entity_id: ENTITY,
      entity: ENTITY,
      from_state: expect.objectContaining({ state: 'on' }),
    });
  });

  describe('for', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should fire only after the state has been held for the duration', () => {
      const { trigger, stateManager, onFire } = create({
        trigger: 'state',
        entity_id: ENTITY,
        to: 'on',
        for: '00:00:05',
      });
      trigger.subscribe(onFire);

      setHass(stateManager, { [ENTITY]: { state: 'off' } });
      setHass(stateManager, { [ENTITY]: { state: 'on' } });
      vi.advanceTimersByTime(4999);
      expect(onFire).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(onFire).toHaveBeenCalledTimes(1);
    });

    it('should cancel the pending fire when the state leaves the match', () => {
      const { trigger, stateManager, onFire } = create({
        trigger: 'state',
        entity_id: ENTITY,
        to: 'on',
        for: '00:00:05',
      });
      trigger.subscribe(onFire);

      setHass(stateManager, { [ENTITY]: { state: 'off' } });
      setHass(stateManager, { [ENTITY]: { state: 'on' } });
      vi.advanceTimersByTime(3000);
      setHass(stateManager, { [ENTITY]: { state: 'off' } });
      vi.advanceTimersByTime(5000);
      expect(onFire).not.toHaveBeenCalled();
    });

    it('should clear a pending for: timer on destroy', () => {
      const { trigger, stateManager, onFire } = create({
        trigger: 'state',
        entity_id: ENTITY,
        to: 'on',
        for: '00:00:05',
      });
      trigger.subscribe(onFire);

      setHass(stateManager, { [ENTITY]: { state: 'off' } });

      // Arms the for: timer.
      setHass(stateManager, { [ENTITY]: { state: 'on' } });
      trigger.destroy();
      vi.advanceTimersByTime(5000);
      expect(onFire).not.toHaveBeenCalled();
    });

    it('should reset the for: timer on a fresh matching transition', () => {
      const { trigger, stateManager, onFire } = create({
        trigger: 'state',
        entity_id: ENTITY,
        to: ['on', 'off'],
        for: '00:00:05',
      });
      trigger.subscribe(onFire);

      // Arms (to includes 'off').
      setHass(stateManager, { [ENTITY]: { state: 'off' } });
      vi.advanceTimersByTime(3000);

      // Re-arms (resets the 5s).
      setHass(stateManager, { [ENTITY]: { state: 'on' } });
      vi.advanceTimersByTime(4000);

      // Would have fired at 5s without the reset.
      expect(onFire).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1000);
      expect(onFire).toHaveBeenCalledTimes(1);
    });

    it('should not cancel the for: hold on an attribute-only change', () => {
      const { trigger, stateManager, onFire } = create({
        trigger: 'state',
        entity_id: ENTITY,
        to: 'on',
        for: '00:00:05',
      });
      trigger.subscribe(onFire);

      setHass(stateManager, { [ENTITY]: { state: 'off' } });

      // Arms.
      setHass(stateManager, { [ENTITY]: { state: 'on', attributes: { a: 1 } } });
      vi.advanceTimersByTime(3000);

      // The state stays 'on'; only an attribute moves -- the hold must continue.
      setHass(stateManager, { [ENTITY]: { state: 'on', attributes: { a: 2 } } });

      // 5s total since arming.
      vi.advanceTimersByTime(2000);
      expect(onFire).toHaveBeenCalledTimes(1);
    });

    it('should not fire when for is unparseable', () => {
      const { trigger, stateManager, onFire } = create({
        trigger: 'state',
        entity_id: ENTITY,
        to: 'on',
        for: 'not-a-duration',
      });
      trigger.subscribe(onFire);

      setHass(stateManager, { [ENTITY]: { state: 'off' } });
      setHass(stateManager, { [ENTITY]: { state: 'on' } });
      vi.advanceTimersByTime(100000);
      expect(onFire).not.toHaveBeenCalled();
    });
  });

  it('should stop firing after destroy', () => {
    const { trigger, stateManager, onFire } = create({
      trigger: 'state',
      entity_id: ENTITY,
      to: 'on',
    });
    trigger.subscribe(onFire);
    trigger.destroy();

    setHass(stateManager, { [ENTITY]: { state: 'off' } });
    setHass(stateManager, { [ENTITY]: { state: 'on' } });
    expect(onFire).not.toHaveBeenCalled();
  });
});
