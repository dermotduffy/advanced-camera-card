import { describe, expect, it, vi } from 'vitest';
import { CallServiceAction } from '../../../../src/card-controller/actions/actions/call-service';
import { createCardAPI, createHASS } from '../../../test-utils';

describe('CallServiceAction', () => {
  it('should call service', async () => {
    const api = createCardAPI();
    const hass = createHASS();
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

    const action = new CallServiceAction(
      {},
      {
        action: 'call-service',
        service: 'light.turn_on',
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

  it('should not call service without hass', async () => {
    const api = createCardAPI();

    const action = new CallServiceAction(
      {},
      {
        action: 'call-service',
        service: 'light.turn_on',
        data: { brightness_pct: 80 },
        target: { entity_id: 'light.office' },
      },
    );
    await action.execute(api);

    // No observable effect.
  });
});
