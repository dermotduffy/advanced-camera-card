import {
  CapabilitiesRaw,
  CapabilityKey,
  capabilityKeys,
  PTZCapabilities,
} from '../types';
import { CapabilitySearchKeys } from './types';

export class Capabilities {
  private _capabilities: CapabilitiesRaw;

  constructor(
    capabilities: CapabilitiesRaw,
    options?: {
      disable?: CapabilityKey[];
      disableExcept?: CapabilityKey[];
    },
  ) {
    this._capabilities = capabilities;

    for (const key of options?.disable ?? []) {
      this._disable(key);
    }
    for (const key of capabilityKeys) {
      if (options?.disableExcept?.length && !options.disableExcept.includes(key)) {
        this._disable(key);
      }
    }
  }

  protected _disable(capability: CapabilityKey): void {
    delete this._capabilities[capability];
  }

  public matches(capability: CapabilitySearchKeys): boolean {
    let result = true;
    if (typeof capability === 'string') {
      result &&= this.has(capability);
    }
    if (typeof capability === 'object' && capability.allCapabilities) {
      result &&= capability.allCapabilities.every((capability) => this.has(capability));
    }
    if (typeof capability === 'object' && capability.anyCapabilities) {
      result &&= capability.anyCapabilities.some((capability) => this.has(capability));
    }
    return result;
  }

  public has(capability: CapabilityKey): boolean {
    return !!this._capabilities[capability];
  }

  public getPTZCapabilities(): PTZCapabilities | null {
    return this._capabilities.ptz ?? null;
  }

  public hasPTZCapability(): boolean {
    return !!(
      this._capabilities.ptz?.down?.length ||
      this._capabilities.ptz?.up?.length ||
      this._capabilities.ptz?.left?.length ||
      this._capabilities.ptz?.right?.length ||
      this._capabilities.ptz?.zoomIn?.length ||
      this._capabilities.ptz?.zoomOut?.length ||
      this._capabilities.ptz?.presets?.length
    );
  }

  public getRawCapabilities(): CapabilitiesRaw {
    return this._capabilities;
  }
}
