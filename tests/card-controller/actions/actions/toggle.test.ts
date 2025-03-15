import { describe, expect, it, vi } from 'vitest';
import { ToggleAction } from '../../../../src/card-controller/actions/actions/toggle';
import { createCardAPI, createHASS, createStateEntity } from '../../../test-utils';

describe('ToggleAction', () => {
  describe('should toggle entities', () => {
    it.each([
      ['light.office' as const, 'off' as const, 'light' as const, 'turn_on' as const],
      ['light.office' as const, 'on' as const, 'light' as const, 'turn_off' as const],
      [
        'cover.door' as const,
        'closed' as const,
        'cover' as const,
        'open_cover' as const,
      ],
      ['cover.door' as const, 'open' as const, 'cover' as const, 'close_cover' as const],
      ['lock.door' as const, 'locked' as const, 'lock' as const, 'unlock' as const],
      ['lock.door' as const, 'unlocked' as const, 'lock' as const, 'lock' as const],
      [
        'group.foo' as const,
        'off' as const,
        'homeassistant' as const,
        'turn_on' as const,
      ],
      [
        'group.foo' as const,
        'on' as const,
        'homeassistant' as const,
        'turn_off' as const,
      ],
    ])(
      '%s %s',
      async (
        entityID: string,
        state: string,
        expectedServiceDomain: string,
        expectedService: string,
      ) => {
        const api = createCardAPI();
        const hass = createHASS({
          [entityID]: createStateEntity({ entity_id: entityID, state: state }),
        });
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

        const action = new ToggleAction({}, { action: 'toggle' }, { entity: entityID });
        await action.execute(api);

        expect(hass.callService).toBeCalledWith(expectedServiceDomain, expectedService, {
          entity_id: entityID,
        });
      },
    );
  });

  it('should do nothing without an entity ID', async () => {
    const api = createCardAPI();
    const hass = createHASS();
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

    const action = new ToggleAction({}, { action: 'toggle' }, {});

    await action.execute(api);

    expect(hass.callService).not.toBeCalled();
  });

  it('should do nothing without an entity state', async () => {
    const api = createCardAPI();
    const hass = createHASS();
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

    const action = new ToggleAction(
      {},
      { action: 'toggle' },
      { entity: 'light.NOT_FOUND' },
    );
    await action.execute(api);

    expect(hass.callService).not.toBeCalled();
  });
});
