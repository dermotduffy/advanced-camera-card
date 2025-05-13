import { errorToConsole } from '../../../utils/basic';
import { HomeAssistant } from '../../types';
import { homeAssistantWSRequest } from '../../ws-request';
import { Device, DeviceCache, DeviceList, deviceListSchema } from './types';

export class DeviceRegistryManager {
  protected _cache: DeviceCache;
  protected _fetchedDeviceList = false;

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

  protected async _fetchDeviceList(hass: HomeAssistant): Promise<void> {
    if (this._fetchedDeviceList) {
      return;
    }

    let deviceList: DeviceList | null = null;
    try {
      deviceList = await homeAssistantWSRequest<DeviceList>(hass, deviceListSchema, {
        type: 'config/device_registry/list',
      });
    } catch (e) {
      errorToConsole(e as Error);
      return;
    }
    deviceList.forEach((device) => {
      this._cache.set(device.id, device);
    });
    this._fetchedDeviceList = true;
  }
}
