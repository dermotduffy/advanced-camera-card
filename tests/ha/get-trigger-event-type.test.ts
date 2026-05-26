import { describe, expect, it } from 'vitest';
import { getTriggerEventType } from '../../src/ha/get-trigger-event-type';
import { createStateEntity } from '../test-utils';

describe('getTriggerEventType', () => {
  describe('for non-event entities', () => {
    it.each([['on'], ['open'], ['unlocked']])(
      'returns "new" when the new state is %s',
      (state: string) => {
        expect(
          getTriggerEventType({
            entityID: 'binary_sensor.motion',
            oldState: createStateEntity({ state: 'off' }),
            newState: createStateEntity({ state }),
          }),
        ).toBe('new');
      },
    );

    it.each([
      ['off'],
      ['closed'],
      ['locked'],
      ['unavailable'],
      ['unknown'],
      ['anything-else'],
    ])('returns "end" when the new state is %s', (state: string) => {
      expect(
        getTriggerEventType({
          entityID: 'binary_sensor.motion',
          oldState: createStateEntity({ state: 'on' }),
          newState: createStateEntity({ state }),
        }),
      ).toBe('end');
    });
  });

  describe('for event entities', () => {
    it('returns "momentary" for a transition between two real timestamps', () => {
      expect(
        getTriggerEventType({
          entityID: 'event.front_door_doorbell',
          oldState: createStateEntity({ state: '2026-05-24T12:00:00.000+00:00' }),
          newState: createStateEntity({ state: '2026-05-24T12:00:05.123+00:00' }),
        }),
      ).toBe('momentary');
    });

    it('returns null when there is no old state', () => {
      expect(
        getTriggerEventType({
          entityID: 'event.front_door_doorbell',
          newState: createStateEntity({ state: '2026-05-24T12:00:05.123+00:00' }),
        }),
      ).toBeNull();
    });

    it('returns null when the old state is unavailable (entity reconnecting)', () => {
      expect(
        getTriggerEventType({
          entityID: 'event.front_door_doorbell',
          oldState: createStateEntity({ state: 'unavailable' }),
          newState: createStateEntity({ state: '2026-05-24T12:00:05.123+00:00' }),
        }),
      ).toBeNull();
    });

    it('returns "momentary" when the old state is unknown (first fire after startup)', () => {
      expect(
        getTriggerEventType({
          entityID: 'event.front_door_doorbell',
          oldState: createStateEntity({ state: 'unknown' }),
          newState: createStateEntity({ state: '2026-05-24T12:00:05.123+00:00' }),
        }),
      ).toBe('momentary');
    });

    it.each([['unavailable'], ['unknown']])(
      'returns null when the new state is %s',
      (state: string) => {
        expect(
          getTriggerEventType({
            entityID: 'event.front_door_doorbell',
            oldState: createStateEntity({ state: '2026-05-24T12:00:00.000+00:00' }),
            newState: createStateEntity({ state }),
          }),
        ).toBeNull();
      },
    );
  });
});
