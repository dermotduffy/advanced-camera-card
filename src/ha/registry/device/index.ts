import { errorToConsole } from '../../../utils/basic';
import { OnceRunner } from '../../../utils/concurrency/once-runner';
import type { HomeAssistant } from '../../types';
import { homeAssistantWSRequest } from '../../ws-request';
import {
  deviceListSchema,
  type Device,
  type DeviceCache,
  type DeviceList,
} from './types';

export class DeviceRegistryManager {
  private _cache: DeviceCache;
  private _deviceListFetch = new OnceRunner();

  constructor(cache: DeviceCache) {
    this._cache = cache;
  }

  public async getDevice(hass: HomeAssistant, deviceID: string): Promise<Device | null> {
    if (this._cache.has(deviceID)) {
      return this._cache.get(deviceID);
    }

    // There is currently no way to fetch a single device.
    await this._fetchDeviceList(hass);
    return this._cache.get(deviceID) ?? null;
  }

  public async getMatchingDevices(
    hass: HomeAssistant,
    func: (arg: Device) => boolean,
  ): Promise<Device[]> {
    await this._fetchDeviceList(hass);
    return this._cache.getMatches(func);
  }

  private async _fetchDeviceList(hass: HomeAssistant): Promise<void> {
    try {
      await this._deviceListFetch.run(async () => {
        const deviceList = await homeAssistantWSRequest<DeviceList>(
          hass,
          deviceListSchema,
          {
            type: 'config/device_registry/list',
          },
        );
        deviceList.forEach((device) => {
          this._cache.set(device.id, device);
        });
      });
    } catch (e) {
      errorToConsole(e);
    }
  }
}
