import { describe, expect, it, vi } from 'vitest';
import { createCardAPI, createHASS } from '../../../test-utils';
import { PerformActionAction } from '../../../../src/card-controller/actions/actions/perform-action';

describe('PerformActionAction', () => {
  it('should perform action', async () => {
    const api = createCardAPI();
    const hass = createHASS();
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

    const action = new PerformActionAction(
      {},
      {
        action: 'perform-action',
        perform_action: 'light.turn_on',
        data: { brightness_pct: 80 },
        target: { entity_id: 'light.office' },
      },
    );
    await action.execute(api);

    expect(hass.callService).toBeCalledWith(
      'light',
      'turn_on',
      {
        brightness_pct: 80,
      },
      { entity_id: 'light.office' },
    );
  });

  it('should not perform action without hass', async () => {
    const api = createCardAPI();

    const action = new PerformActionAction(
      {},
      {
        action: 'perform-action',
        perform_action: 'light.turn_on',
        data: { brightness_pct: 80 },
        target: { entity_id: 'light.office' },
      },
    );
    await action.execute(api);

    // No observable effect.
  });
});
