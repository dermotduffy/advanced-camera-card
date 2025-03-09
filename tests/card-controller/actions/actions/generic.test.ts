import { describe, expect, it, vi } from 'vitest';
import { createCardAPI, createHASS, createLitElement } from '../../../test-utils.js';
import { GenericAction } from '../../../../src/card-controller/actions/actions/generic.js';
import { handleActionConfig } from '../../../../src/ha/handle-action.js';

vi.mock('../../../../src/ha/handle-action.js');

describe('should handle generic action', () => {
  it('without hass', async () => {
    const api = createCardAPI();
    const action = new GenericAction(
      {},
      {
        action: 'fire-dom-event',
      },
    );

    await action.execute(api);

    expect(handleActionConfig).not.toBeCalled();
  });

  // @vitest-environment jsdom
  it('with hass', async () => {
    const api = createCardAPI();
    const hass = createHASS();
    const element = createLitElement();
    vi.mocked(api.getCardElementManager()).getElement.mockReturnValue(element);
    vi.mocked(api.getHASSManager()).getHASS.mockReturnValue(hass);
    const action = new GenericAction(
      {},
      {
        action: 'fire-dom-event',
      },
    );

    await action.execute(api);

    expect(handleActionConfig).toBeCalledWith(
      element,
      hass,
      {},
      { action: 'fire-dom-event' },
    );
  });
});
