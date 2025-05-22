import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeviceRegistryManager } from '../../../../src/ha/registry/device';
import { DeviceCache } from '../../../../src/ha/registry/device/types';
import { homeAssistantWSRequest } from '../../../../src/ha/ws-request';
import { createHASS, createRegistryDevice } from '../../../test-utils.js';

vi.mock('../../../../src/ha/ws-request');
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

      const manager = new DeviceRegistryManager(cache);
      expect(await manager.getDevice(createHASS(), 'test')).toEqual(testDevice);

      expect(homeAssistantWSRequest).not.toHaveBeenCalled();
    });

    it('should fetch and cache when not cached', async () => {
      const testDevice = createRegistryDevice({ id: 'test' });

      const manager = new DeviceRegistryManager(new DeviceCache());
      vi.mocked(homeAssistantWSRequest).mockResolvedValueOnce([testDevice]);

      expect(await manager.getDevice(createHASS(), 'test')).toEqual(testDevice);
      expect(homeAssistantWSRequest).toBeCalledTimes(1);

      expect(await manager.getDevice(createHASS(), 'test')).toEqual(testDevice);
      expect(homeAssistantWSRequest).toBeCalledTimes(1);

      expect(await manager.getDevice(createHASS(), 'missing')).toBeNull();

      // The fetch call is called exactly once.
      expect(homeAssistantWSRequest).toBeCalledTimes(1);
    });

    it('should return null when fetch fails', async () => {
      vi.mocked(homeAssistantWSRequest).mockRejectedValueOnce(new Error('Fetch error'));

      const manager = new DeviceRegistryManager(new DeviceCache());
      expect(await manager.getDevice(createHASS(), 'test')).toBeNull();

      vi.mocked(expect(console.warn)).toBeCalledWith('Fetch error');
    });
  });

  it('getMatchingDevices', async () => {
    const matchingDevice = createRegistryDevice({ id: 'matching' });
    const notMatchingDevice = createRegistryDevice({ id: 'not-matching' });
    const hass = createHASS();

    vi.mocked(homeAssistantWSRequest).mockResolvedValueOnce([
      matchingDevice,
      notMatchingDevice,
    ]);

    const manager = new DeviceRegistryManager(new DeviceCache());
    expect(
      await manager.getMatchingDevices(hass, (entity) => entity.id == 'matching'),
    ).toEqual([matchingDevice]);
  });
});
