import { afterEach, describe, expect, it, vi } from 'vitest';

import { DeviceRegistryManager } from '../../../../src/ha/registry/device';
import { DeviceCache } from '../../../../src/ha/registry/device/types';
import { AdvancedCameraCardError } from '../../../../src/types';
import { createHASS, createRegistryDevice } from '../../../test-utils.js';

vi.spyOn(global.console, 'warn').mockImplementation(() => true);

describe('DeviceRegistryManager', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getDevice', () => {
    it('should not fetch when cached', async () => {
      const cache = new DeviceCache();
      const testDevice = createRegistryDevice({ id: 'test' });

      cache.set('test', testDevice);

      const hass = createHASS();
      const manager = new DeviceRegistryManager(cache);
      expect(await manager.getDevice(hass, 'test')).toEqual(testDevice);

      expect(hass.callWS).not.toHaveBeenCalled();
    });

    it('should fetch and cache when not cached', async () => {
      const testDevice = createRegistryDevice({ id: 'test' });

      const hass = createHASS();
      const manager = new DeviceRegistryManager(new DeviceCache());
      vi.mocked(hass.callWS).mockResolvedValueOnce([testDevice]);

      expect(await manager.getDevice(hass, 'test')).toEqual(testDevice);
      expect(hass.callWS).toBeCalledTimes(1);

      expect(await manager.getDevice(hass, 'test')).toEqual(testDevice);
      expect(hass.callWS).toBeCalledTimes(1);

      expect(await manager.getDevice(hass, 'missing')).toBeNull();

      // The fetch call is called exactly once.
      expect(hass.callWS).toBeCalledTimes(1);
    });

    it('should return null when fetch fails', async () => {
      const hass = createHASS();
      vi.mocked(hass.callWS).mockRejectedValueOnce(new Error('Fetch error'));

      const manager = new DeviceRegistryManager(new DeviceCache());
      expect(await manager.getDevice(hass, 'test')).toBeNull();

      expect(console.warn).toBeCalledWith(
        expect.any(AdvancedCameraCardError),
        expect.anything(),
      );
    });
  });

  it('getMatchingDevices', async () => {
    const matchingDevice = createRegistryDevice({ id: 'matching' });
    const notMatchingDevice = createRegistryDevice({ id: 'not-matching' });
    const hass = createHASS();

    vi.mocked(hass.callWS).mockResolvedValueOnce([matchingDevice, notMatchingDevice]);

    const manager = new DeviceRegistryManager(new DeviceCache());
    expect(
      await manager.getMatchingDevices(hass, (entity) => entity.id == 'matching'),
    ).toEqual([matchingDevice]);
  });
});
