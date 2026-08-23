import type { HassConfig } from 'home-assistant-js-websocket';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { DeviceRegistryManager } from '../../src/ha/registry/device';
import { homeAssistantWSRequest } from '../../src/ha/ws-request';
import { getLanguage } from '../../src/localize/localize';
import { getDiagnostics } from '../../src/utils/diagnostics.js';
import { createHASS, createRegistryDevice } from '../test-utils';

vi.mock('../../src/utils/build-info.js', () => ({
  getReleaseVersion: () => '1.2.3',
  getGitInfo: () => ({
    hash: 'g4cf13b1',
    buildDate: '2023-09-19T04:59:27.000Z',
    commitDate: '2023-09-06T21:27:28-07:00',
  }),
}));
vi.mock('../../src/ha');
vi.mock('../../src/localize/localize.js');
vi.mock('../../src/ha/registry/device/index.js');
vi.mock('../../src/ha/ws-request.js');

describe('getDiagnostics', () => {
  const now = new Date('2023-10-01T21:53Z');
  const hass = createHASS();
  hass.config = { version: '2023.9.0' } as HassConfig;

  beforeEach(() => {
    vi.resetAllMocks();

    vi.useFakeTimers();
    vi.setSystemTime(now);

    vi.mocked(getLanguage).mockReturnValue('en');
    vi.stubGlobal('navigator', { userAgent: 'AdvancedCameraCardTest/1.0' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should fetch diagnostics', async () => {
    const deviceRegistryManager = mock<DeviceRegistryManager>();
    deviceRegistryManager.getMatchingDevices.mockResolvedValue([
      createRegistryDevice({
        id: 'id1',
        model: '4.0.0/0.13.0-aded314',
        config_entries: ['ac4e79d258449a83bc0cf6d47a021c46'],
      }),
      createRegistryDevice({
        id: 'id2',
        model: '4.0.0/0.13.0-aded314',
        config_entries: ['b03e70c659d58ae2ce7f2dc76fed2929'],
      }),
      createRegistryDevice({
        id: 'no-model',
        model: null,
        config_entries: ['b03e70c659d58ae2ce7f2dc76fed2920'],
      }),
    ]);

    vi.mocked(homeAssistantWSRequest).mockResolvedValue({
      domain: 'domain',
      version: '0.0.1',
    });

    expect(
      await getDiagnostics(hass, deviceRegistryManager, {
        cameras: [{ camera_entity: 'camera.office' }],
      }),
    ).toEqual({
      browser: 'AdvancedCameraCardTest/1.0',
      card_version: '1.2.3',
      config: {
        cameras: [{ camera_entity: 'camera.office' }],
      },
      git: {
        build_date: '2023-09-19T04:59:27.000Z',
        commit_date: '2023-09-06T21:27:28-07:00',
        hash: 'g4cf13b1',
      },
      custom_integrations: {
        frigate: {
          detected: true,
          devices: {
            ac4e79d258449a83bc0cf6d47a021c46: '4.0.0/0.13.0-aded314',
            b03e70c659d58ae2ce7f2dc76fed2929: '4.0.0/0.13.0-aded314',
          },
          version: '0.0.1',
        },
        hass_web_proxy: {
          detected: true,
          version: '0.0.1',
        },
      },
      date: now,
      lang: 'en',
      ha_version: '2023.9.0',
      timezone: expect.anything(),
      issues: [],
    });
  });

  it('should use correct device registry matcher', async () => {
    const deviceRegistryManager = mock<DeviceRegistryManager>();
    deviceRegistryManager.getMatchingDevices.mockResolvedValue([]);

    await getDiagnostics(hass, deviceRegistryManager, {
      cameras: [{ camera_entity: 'camera.office' }],
    });

    // Verify the matcher passed into the deviceRegistryManager correctly filters
    // Frigate cameras.
    const matcher = deviceRegistryManager.getMatchingDevices.mock.calls[0][1];
    expect(matcher(createRegistryDevice())).toBe(false);
    expect(
      matcher(
        createRegistryDevice({
          manufacturer: 'Frigate',
        }),
      ),
    ).toBe(true);
  });

  it('should fetch diagnostics without hass or config', async () => {
    expect(await getDiagnostics()).toEqual({
      browser: 'AdvancedCameraCardTest/1.0',
      card_version: '1.2.3',
      git: {
        build_date: '2023-09-19T04:59:27.000Z',
        commit_date: '2023-09-06T21:27:28-07:00',
        hash: 'g4cf13b1',
      },
      custom_integrations: {
        frigate: {
          detected: false,
        },
        hass_web_proxy: {
          detected: false,
        },
      },
      date: now,
      lang: 'en',
      timezone: expect.anything(),
      issues: [],
    });
  });

  it('should include issues in diagnostics', async () => {
    const deviceRegistryManager = mock<DeviceRegistryManager>();
    deviceRegistryManager.getMatchingDevices.mockResolvedValue([]);

    const issues = new Map([
      [
        'config_upgrade' as const,
        {
          icon: 'mdi:update',
          severity: 'medium' as const,
          notification: { body: { text: 'test' } },
        },
      ],
    ]);

    const result = await getDiagnostics(
      hass,
      deviceRegistryManager,
      { cameras: [{ camera_entity: 'camera.office' }] },
      issues,
    );

    expect(result.issues).toEqual(['config_upgrade']);
  });

  it('should include microphone diagnostics', async () => {
    const microphoneDiagnostics = {
      capabilities: {
        echoCancellation: [true, false],
      },
      constraints: {
        echoCancellation: { ideal: true },
      },
      settings: {
        echoCancellation: true,
      },
    };

    expect(
      await getDiagnostics(
        undefined,
        undefined,
        undefined,
        undefined,
        microphoneDiagnostics,
      ),
    ).toEqual(
      expect.objectContaining({
        microphone: microphoneDiagnostics,
      }),
    );
  });

  it('should fetch diagnostics without device model', async () => {
    const deviceRegistryManager = mock<DeviceRegistryManager>();
    deviceRegistryManager.getMatchingDevices.mockResolvedValue([]);

    expect(await getDiagnostics(hass, deviceRegistryManager)).toEqual({
      browser: 'AdvancedCameraCardTest/1.0',
      card_version: '1.2.3',
      git: {
        build_date: '2023-09-19T04:59:27.000Z',
        commit_date: '2023-09-06T21:27:28-07:00',
        hash: 'g4cf13b1',
      },
      custom_integrations: {
        frigate: {
          detected: false,
        },
        hass_web_proxy: {
          detected: false,
        },
      },
      ha_version: '2023.9.0',
      date: now,
      lang: 'en',
      timezone: expect.anything(),
      issues: [],
    });
  });
});
