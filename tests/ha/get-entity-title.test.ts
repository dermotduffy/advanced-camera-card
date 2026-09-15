import { describe, expect, it } from 'vitest';

import { getEntityTitle } from '../../src/ha/get-entity-title';
import type { HomeAssistant } from '../../src/ha/types';
import { createHASS, createStateEntity } from '../test-utils';

describe('getEntityTitle', () => {
  const hass: HomeAssistant = createHASS({
    'sensor.temperature': createStateEntity({
      attributes: {
        friendly_name: 'Temperature Sensor',
      },
    }),
    'light.living_room': createStateEntity({
      attributes: {
        friendly_name: 'Living Room Light',
      },
    }),
    'switch.no_friendly': createStateEntity({
      attributes: {},
    }),
  });

  it('returns the friendly_name for a valid entity', () => {
    expect(getEntityTitle(hass, 'sensor.temperature')).toBe('Temperature Sensor');
    expect(getEntityTitle(hass, 'light.living_room')).toBe('Living Room Light');
  });

  it('returns null if the entity does not exist', () => {
    expect(getEntityTitle(hass, 'sensor.unknown')).toBeNull();
  });

  it('returns null if hass is undefined', () => {
    expect(getEntityTitle(undefined, 'sensor.temperature')).toBeNull();
  });

  it('returns null if entity is undefined', () => {
    expect(getEntityTitle(hass)).toBeNull();
  });

  it('returns null if friendly_name attribute is missing', () => {
    expect(getEntityTitle(hass, 'switch.no_friendly')).toBeNull();
  });

  it('returns null if both hass and entity are undefined', () => {
    expect(getEntityTitle()).toBeNull();
  });

  describe('on Home Assistant 2026.4 and later', () => {
    const createHASSWithEntityNames = (): HomeAssistant => {
      const hassWithNames = createHASS({
        'sensor.temperature': createStateEntity({
          attributes: { friendly_name: 'Thermostat Temperature' },
        }),
      });
      hassWithNames.config.version = '2026.4.0';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (hassWithNames as any).formatEntityName = () => 'Temperature';
      return hassWithNames;
    };

    it('uses the name composed from the registry context', () => {
      expect(getEntityTitle(createHASSWithEntityNames(), 'sensor.temperature')).toBe(
        'Temperature',
      );
    });

    it('returns null when the composed name is empty', () => {
      const hassWithNames = createHASSWithEntityNames();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (hassWithNames as any).formatEntityName = () => '';

      expect(getEntityTitle(hassWithNames, 'sensor.temperature')).toBeNull();
    });

    it('falls back to friendly_name when hass reports the version but has no helper', () => {
      const hassWithoutHelper = createHASS({
        'sensor.temperature': createStateEntity({
          attributes: { friendly_name: 'Thermostat Temperature' },
        }),
      });
      hassWithoutHelper.config.version = '2026.4.0';
      // createHASS auto-mocks every property, so the helper has to be removed
      // explicitly to reproduce a hass that does not carry it.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (hassWithoutHelper as any).formatEntityName = undefined;

      expect(getEntityTitle(hassWithoutHelper, 'sensor.temperature')).toBe(
        'Thermostat Temperature',
      );
    });

    it('still returns null for an entity that does not exist', () => {
      expect(getEntityTitle(createHASSWithEntityNames(), 'sensor.unknown')).toBeNull();
    });
  });
});
