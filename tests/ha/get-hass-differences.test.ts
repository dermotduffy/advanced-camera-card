import { describe, expect, it } from 'vitest';
import { getHassDifferences } from '../../src/ha/get-hass-differences';
import { createHASS, createStateEntity } from '../test-utils';

describe('getHassDifferences', () => {
  const newHass = createHASS({
    'light.office': createStateEntity({
      entity_id: 'light.office',
      state: 'on',
    }),
    'light.kitchen': createStateEntity({
      entity_id: 'light.kitchen',
      state: 'on',
    }),
    'light.attributes_only': createStateEntity({
      entity_id: 'light.attributes_only',
      state: 'on',
      attributes: {
        friendly_name: 'Attributes Only After',
      },
    }),
  });
  const oldHass = createHASS({
    'light.office': createStateEntity({
      entity_id: 'light.office',
      state: 'off',
    }),
    'light.kitchen': createStateEntity({
      entity_id: 'light.kitchen',
      state: 'off',
    }),
    'light.attributes_only': createStateEntity({
      entity_id: 'light.attributes_only',
      state: 'on',
      attributes: {
        friendly_name: 'Attributes Only Before',
      },
    }),
  });

  it('should return empty list without difference', () => {
    expect(getHassDifferences(newHass, newHass, ['light.office'])).toEqual([]);
  });

  it('should return differences', () => {
    expect(
      getHassDifferences(newHass, oldHass, [
        'light.office',
        'light.kitchen',
        'light.attributes_only',
      ]),
    ).toEqual([
      {
        entityID: 'light.office',
        oldState: expect.objectContaining({
          entity_id: 'light.office',
          state: 'off',
        }),
        newState: expect.objectContaining({
          entity_id: 'light.office',
          state: 'on',
        }),
      },
      {
        entityID: 'light.kitchen',
        oldState: expect.objectContaining({
          entity_id: 'light.kitchen',
          state: 'off',
        }),
        newState: expect.objectContaining({
          entity_id: 'light.kitchen',
          state: 'on',
        }),
      },
      {
        entityID: 'light.attributes_only',
        oldState: expect.objectContaining({
          entity_id: 'light.attributes_only',
          state: 'on',
          attributes: {
            friendly_name: 'Attributes Only Before',
          },
        }),
        newState: expect.objectContaining({
          entity_id: 'light.attributes_only',
          state: 'on',
          attributes: {
            friendly_name: 'Attributes Only After',
          },
        }),
      },
    ]);
  });

  it('should return single difference', () => {
    expect(
      getHassDifferences(newHass, oldHass, ['light.office', 'light.kitchen'], {
        firstOnly: true,
      }),
    ).toEqual([
      {
        entityID: 'light.office',
        oldState: expect.objectContaining({
          entity_id: 'light.office',
          state: 'off',
        }),
        newState: expect.objectContaining({
          entity_id: 'light.office',
          state: 'on',
        }),
      },
    ]);
  });

  it('should return only state differences', () => {
    expect(
      getHassDifferences(
        newHass,
        oldHass,
        ['light.office', 'light.kitchen', 'light.attributes_only'],
        {
          stateOnly: true,
        },
      ),
    ).toEqual([
      {
        entityID: 'light.office',
        oldState: expect.objectContaining({
          entity_id: 'light.office',
          state: 'off',
        }),
        newState: expect.objectContaining({
          entity_id: 'light.office',
          state: 'on',
        }),
      },
      {
        entityID: 'light.kitchen',
        oldState: expect.objectContaining({
          entity_id: 'light.kitchen',
          state: 'off',
        }),
        newState: expect.objectContaining({
          entity_id: 'light.kitchen',
          state: 'on',
        }),
      },
    ]);
  });

  describe('should return empty list with empty values', () => {
    it('should return empty list for empty new hass', () => {
      expect(getHassDifferences(null, oldHass, ['light.office'])).toEqual([]);
    });

    it('should return empty list for empty entity list', () => {
      expect(getHassDifferences(newHass, oldHass, [])).toEqual([]);
    });
  });
});
