import { HomeAssistant } from '../../../../ha/types';
import { errorToConsole } from '../../../basic';
import { homeAssistantWSRequest } from '../../ws-request';
import { RegistryCache } from '../cache';
import { Device, DeviceList, deviceListSchema } from './types';

export const createDeviceRegistryCache = (): RegistryCache<Device> => {
  return new RegistryCache<Device>((device) => device.id);
};

export class DeviceRegistryManager {
  protected _cache: RegistryCache<Device>;
  protected _fetchedDeviceList = false;

  constructor(cache: RegistryCache<Device>) {
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
    this._cache.add(deviceList);
    this._fetchedDeviceList = true;
  }
}
