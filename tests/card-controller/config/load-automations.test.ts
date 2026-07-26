import { describe, expect, it, vi } from 'vitest';

import { setAutomationsFromConfig } from '../../../src/card-controller/config/load-automations';
import { createConfig } from '../../config/test-utils';
import { createCardAPI } from '../../test-utils';

describe('setAutomationsFromConfig', () => {
  it('without config', () => {
    const api = createCardAPI();
    setAutomationsFromConfig(api);

    expect(api.getAutomationsManager().deleteAutomations).toHaveBeenCalled();
    expect(api.getAutomationsManager().addAutomations).toHaveBeenCalledWith([]);
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
        triggers: [{ trigger: 'fullscreen' as const, fullscreen: true }],
      },
    ];
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        automations: automations,
      }),
    );

    setAutomationsFromConfig(api);

    expect(api.getAutomationsManager().deleteAutomations).toHaveBeenCalled();
    expect(api.getAutomationsManager().addAutomations).toHaveBeenCalledWith(automations);
  });
});
