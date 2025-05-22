import { describe, expect, it } from 'vitest';
import { getEntitiesFromHASS } from '../../src/ha/get-entities';
import { createHASS, createStateEntity } from '../test-utils';

describe('getEntitiesFromHASS', () => {
  const hass = createHASS({
    'camera.front_door': createStateEntity(),
    'light.kitchen': createStateEntity(),
    'light.living_room': createStateEntity(),
    'sensor.temperature': createStateEntity(),
    'switch.garage': createStateEntity(),
  });

  it('returns all entity ids when no domain is specified', () => {
    expect(getEntitiesFromHASS(hass)).toEqual([
      'camera.front_door',
      'light.kitchen',
      'light.living_room',
      'sensor.temperature',
      'switch.garage',
    ]);
  });

  it('returns only entities of the specified domain', () => {
    expect(getEntitiesFromHASS(hass, 'light')).toEqual([
      'light.kitchen',
      'light.living_room',
    ]);
  });

  it('returns an empty array if no entities match the domain', () => {
    const result = getEntitiesFromHASS(hass, 'binary_sensor');
    expect(result).toEqual([]);
  });
});
