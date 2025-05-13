import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHassDifferences } from '../../src/ha/get-hass-differences';
import { isHassDifferent } from '../../src/ha/is-hass-different';
import { createHASS, createStateEntity } from '../test-utils';

vi.mock('../../src/ha/get-hass-differences');

describe('isHassDifferent', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return true with difference', async () => {
    vi.mocked(getHassDifferences).mockReturnValue([
      { entityID: 'light.office', newState: createStateEntity() },
    ]);

    const newHass = createHASS();
    const oldHass = createHASS();
    const entities = ['light.office'];

    expect(isHassDifferent(newHass, oldHass, entities)).toBe(true);
    expect(getHassDifferences).toBeCalledWith(newHass, oldHass, entities, {
      firstOnly: true,
    });
  });

  it('should return false without difference', async () => {
    vi.mocked(getHassDifferences).mockReturnValue([]);
    expect(isHassDifferent(createHASS(), createHASS(), ['light.office'])).toBe(false);
  });
});
