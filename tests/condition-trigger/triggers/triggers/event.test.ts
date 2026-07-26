import { describe, expect, it, vi, type Mock } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type {
  EventSubscriptionRequest,
  EventWatcherSubscriptionInterface,
} from '../../../../src/card-controller/hass/event-watcher';
import { EventTrigger } from '../../../../src/condition-trigger/triggers/triggers/event';
import type { TriggerOfType } from '../../../../src/condition-trigger/triggers/triggers/types';
import { createHASSEvent, createHASSManager } from '../../../test-utils';
import { createTriggerEvaluatorContext } from './test-utils';

interface Harness {
  trigger: EventTrigger;
  eventWatcher: EventWatcherSubscriptionInterface;
  callback: Mock;
}

const create = (config: TriggerOfType<'event'>): Harness => {
  const eventWatcher = mock<EventWatcherSubscriptionInterface>();
  const hassManager = createHASSManager({ eventWatcher });

  const callback = vi.fn();
  const trigger = new EventTrigger(
    config,
    createTriggerEvaluatorContext({ hassManager }),
  );
  return { trigger, eventWatcher, callback };
};

const getLastMatcher = (
  eventWatcher: EventWatcherSubscriptionInterface,
  n = 0,
): EventSubscriptionRequest['matcher'] =>
  vi.mocked(eventWatcher.subscribe).mock.calls[n][0].matcher;

const callEventCallback = (
  eventWatcher: EventWatcherSubscriptionInterface,
  event: ReturnType<typeof createHASSEvent>,
  n = 0,
): void => {
  vi.mocked(eventWatcher.subscribe).mock.calls[n][0].callback(event);
};

describe('EventTrigger', () => {
  it('should register one EventWatcher request per event_type', () => {
    const { trigger, eventWatcher, callback } = create({
      trigger: 'event',
      event_type: 'zha_event',
    });
    trigger.subscribe(callback);
    expect(eventWatcher.subscribe).toHaveBeenCalledTimes(1);
    expect(vi.mocked(eventWatcher.subscribe).mock.calls[0][0].event_type).toBe(
      'zha_event',
    );
  });

  it('should dedupe duplicate event_types in list form', () => {
    // A repeated entry would otherwise produce two requests and fire the
    // callback twice for every matching event.
    const { trigger, eventWatcher, callback } = create({
      trigger: 'event',
      event_type: ['zha_event', 'zha_event'],
    });
    trigger.subscribe(callback);
    expect(eventWatcher.subscribe).toHaveBeenCalledTimes(1);
  });

  it('should expand list-form event_type into one request per type', () => {
    const { trigger, eventWatcher, callback } = create({
      trigger: 'event',
      event_type: ['zha_event', 'deconz_event'],
    });
    trigger.subscribe(callback);
    expect(eventWatcher.subscribe).toHaveBeenCalledTimes(2);
    expect(vi.mocked(eventWatcher.subscribe).mock.calls[0][0].event_type).toBe(
      'zha_event',
    );
    expect(vi.mocked(eventWatcher.subscribe).mock.calls[1][0].event_type).toBe(
      'deconz_event',
    );
  });

  it('should fire with the full HA event on dispatch', () => {
    const { trigger, eventWatcher, callback } = create({
      trigger: 'event',
      event_type: 'zha_event',
    });
    trigger.subscribe(callback);
    const event = createHASSEvent('zha_event', { command: 'press' });
    callEventCallback(eventWatcher, event);
    expect(callback).toHaveBeenCalledWith({ platform: 'event', event });
  });

  it('should omit the matcher when neither event_data nor context is set', () => {
    const { trigger, eventWatcher, callback } = create({
      trigger: 'event',
      event_type: 'zha_event',
    });
    trigger.subscribe(callback);
    expect(vi.mocked(eventWatcher.subscribe).mock.calls[0][0].matcher).toBeUndefined();
  });

  it('should attach an event_data matcher', () => {
    const { trigger, eventWatcher, callback } = create({
      trigger: 'event',
      event_type: 'zha_event',
      event_data: { command: 'press' },
    });
    trigger.subscribe(callback);
    const matcher = getLastMatcher(eventWatcher);
    expect(matcher?.(createHASSEvent('zha_event', { command: 'press' }))).toBe(true);
    expect(matcher?.(createHASSEvent('zha_event', { command: 'release' }))).toBe(false);
  });

  it('should attach a context matcher', () => {
    const { trigger, eventWatcher, callback } = create({
      trigger: 'event',
      event_type: 'zha_event',
      context: { user_id: 'u-1' },
    });
    trigger.subscribe(callback);
    const matcher = getLastMatcher(eventWatcher);
    expect(
      matcher?.(
        createHASSEvent('zha_event', {}, { id: 'i', user_id: 'u-1', parent_id: null }),
      ),
    ).toBe(true);
    expect(
      matcher?.(
        createHASSEvent('zha_event', {}, { id: 'i', user_id: 'u-2', parent_id: null }),
      ),
    ).toBe(false);
  });

  it('should AND event_data and context filters', () => {
    const { trigger, eventWatcher, callback } = create({
      trigger: 'event',
      event_type: 'zha_event',
      event_data: { command: 'press' },
      context: { user_id: 'u-1' },
    });
    trigger.subscribe(callback);
    const matcher = getLastMatcher(eventWatcher);

    const matchingContext = { id: 'i', user_id: 'u-1', parent_id: null };
    const nonMatchingContext = { id: 'i', user_id: 'u-2', parent_id: null };

    expect(
      matcher?.(createHASSEvent('zha_event', { command: 'press' }, matchingContext)),
    ).toBe(true);
    expect(
      matcher?.(createHASSEvent('zha_event', { command: 'press' }, nonMatchingContext)),
    ).toBe(false);
    expect(
      matcher?.(createHASSEvent('zha_event', { command: 'release' }, matchingContext)),
    ).toBe(false);
  });

  it('should unsubscribe every request on destroy', () => {
    const { trigger, eventWatcher, callback } = create({
      trigger: 'event',
      event_type: ['zha_event', 'deconz_event'],
    });
    trigger.subscribe(callback);
    trigger.destroy();
    expect(eventWatcher.unsubscribe).toHaveBeenCalledTimes(2);
  });

  it('should be a no-op when destroyed without subscribing', () => {
    const { trigger, eventWatcher } = create({
      trigger: 'event',
      event_type: 'zha_event',
    });
    trigger.destroy();
    expect(eventWatcher.unsubscribe).not.toHaveBeenCalled();
  });
});
