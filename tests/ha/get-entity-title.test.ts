import type { HassEntities } from 'home-assistant-js-websocket';
import { describe, expect, it } from 'vitest';

import { getEntityTitle } from '../../src/ha/get-entity-title';
import type { HomeAssistant } from '../../src/ha/types';
import { createHASS, createStateEntity } from '../test-utils';

const createStates = (): HassEntities => ({
  'sensor.temperature': createStateEntity({
    entity_id: 'sensor.temperature',
    attributes: {
      friendly_name: 'Temperature Sensor',
    },
  }),
  'light.living_room': createStateEntity({
    entity_id: 'light.living_room',
    attributes: {
      friendly_name: 'Living Room Light',
    },
  }),
  'switch.no_friendly': createStateEntity({
    entity_id: 'switch.no_friendly',
    attributes: {},
  }),
});

const createHASSWithVersion = (version: string): HomeAssistant => {
  const hass = createHASS(createStates());
  hass.config.version = version;
  return hass;
};

describe('getEntityTitle', () => {
  const hass: HomeAssistant = createHASS(createStates());

  it('should return the name for a valid entity', () => {
    expect(getEntityTitle(hass, 'sensor.temperature')).toBe('Temperature Sensor');
    expect(getEntityTitle(hass, 'light.living_room')).toBe('Living Room Light');
  });

  it('should return null if the entity does not exist', () => {
    expect(getEntityTitle(hass, 'sensor.unknown')).toBeNull();
  });

  it('should return null if hass is undefined', () => {
    expect(getEntityTitle(undefined, 'sensor.temperature')).toBeNull();
  });

  it('should return null if entity is undefined', () => {
    expect(getEntityTitle(hass)).toBeNull();
  });

  it('should return null if both hass and entity are undefined', () => {
    expect(getEntityTitle()).toBeNull();
  });

  describe('on Home Assistant 2026.4 and later', () => {
    it('should return the name composed from the registry context', () => {
      const hass = createHASSWithVersion('2026.4.0');
      hass.formatEntityName = () => 'Temperature';

      expect(getEntityTitle(hass, 'sensor.temperature')).toBe('Temperature');
    });

    it('should derive a name from the entity id if the entity has no name', () => {
      expect(
        getEntityTitle(createHASSWithVersion('2026.4.0'), 'switch.no_friendly'),
      ).toBe('no friendly');
    });

    it('should return null if the composed name is empty', () => {
      const hass = createHASSWithVersion('2026.4.0');
      hass.formatEntityName = () => '';

      expect(getEntityTitle(hass, 'sensor.temperature')).toBeNull();
    });
  });

  describe('before Home Assistant 2026.4', () => {
    it('should return the friendly name', () => {
      expect(
        getEntityTitle(createHASSWithVersion('2026.3.0'), 'sensor.temperature'),
      ).toBe('Temperature Sensor');
    });

    it('should return null if the friendly_name attribute is missing', () => {
      expect(
        getEntityTitle(createHASSWithVersion('2026.3.0'), 'switch.no_friendly'),
      ).toBeNull();
    });

    it('should return the friendly name if hass has no config yet', () => {
      // Home Assistant builds the hass object with a null config, and fills it
      // in once its own `get_config` resolves. The type does not admit null, so
      // it has to be written in from outside the type.
      const hass = createHASS(createStates());
      Reflect.set(hass, 'config', null);

      expect(getEntityTitle(hass, 'sensor.temperature')).toBe('Temperature Sensor');
    });
  });
});
