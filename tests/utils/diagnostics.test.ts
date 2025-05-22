import { HassConfig } from 'home-assistant-js-websocket';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { DeviceRegistryManager } from '../../src/ha/registry/device';
import { homeAssistantWSRequest } from '../../src/ha/ws-request';
import { getLanguage } from '../../src/localize/localize';
import { getDiagnostics, getReleaseVersion } from '../../src/utils/diagnostics.js';
import { createHASS, createRegistryDevice } from '../test-utils';

vi.mock('../../package.json', () => ({
  default: {
    gitAbbrevHash: 'g4cf13b1',
    buildDate: 'Tue, 19 Sep 2023 04:59:27 GMT',
    gitDate: 'Wed, 6 Sep 2023 21:27:28 -0700',
  },
}));
vi.mock('../../src/ha');
vi.mock('../../src/localize/localize.js');
vi.mock('../../src/ha/registry/device/index.js');
vi.mock('../../src/ha/ws-request.js');

describe('getReleaseVersion', () => {
  it('should get release version', () => {
    expect(getReleaseVersion()).toBe('__ADVANCED_CAMERA_CARD_RELEASE_VERSION__');
  });
});

// @vitest-environment jsdom
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
      card_version: '__ADVANCED_CAMERA_CARD_RELEASE_VERSION__',
      config: {
        cameras: [{ camera_entity: 'camera.office' }],
      },
      git: {
        build_date: 'Tue, 19 Sep 2023 04:59:27 GMT',
        commit_date: 'Wed, 6 Sep 2023 21:27:28 -0700',
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
      card_version: '__ADVANCED_CAMERA_CARD_RELEASE_VERSION__',
      git: {
        build_date: 'Tue, 19 Sep 2023 04:59:27 GMT',
        commit_date: 'Wed, 6 Sep 2023 21:27:28 -0700',
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
    });
  });

  it('should fetch diagnostics without device model', async () => {
    const deviceRegistryManager = mock<DeviceRegistryManager>();
    deviceRegistryManager.getMatchingDevices.mockResolvedValue([]);

    expect(await getDiagnostics(hass, deviceRegistryManager)).toEqual({
      browser: 'AdvancedCameraCardTest/1.0',
      card_version: '__ADVANCED_CAMERA_CARD_RELEASE_VERSION__',
      git: {
        build_date: 'Tue, 19 Sep 2023 04:59:27 GMT',
        commit_date: 'Wed, 6 Sep 2023 21:27:28 -0700',
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
    });
  });
});
