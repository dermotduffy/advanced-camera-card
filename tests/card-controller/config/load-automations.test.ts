import { describe, expect, it, vi } from 'vitest';
import { createCardAPI, createConfig } from '../../test-utils';
import { setAutomationsFromConfig } from '../../../src/card-controller/config/load-automations';

describe('setAutomationsFromConfig', () => {
  it('without config', () => {
    const api = createCardAPI();
    setAutomationsFromConfig(api);

    expect(api.getAutomationsManager().deleteAutomations).toBeCalled();
    expect(api.getAutomationsManager().addAutomations).toBeCalledWith([]);
  });

  it('with config', () => {
    const automations = [
      {
        actions: [
          {
            action: 'fire-dom-event' as const,
            advanced_camera_card_action: 'clips',
          },
        ],
        conditions: [{ condition: 'fullscreen' as const, fullscreen: true }],
      },
    ];
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        automations: automations,
      }),
    );

    setAutomationsFromConfig(api);

    expect(api.getAutomationsManager().deleteAutomations).toBeCalled();
    expect(api.getAutomationsManager().addAutomations).toBeCalledWith(automations);
  });
});
