import { EffectName, EffectsControllerAPI } from '../../types';
import { EffectComponent, EffectModule, EffectOptions } from './types';

const effectRegistry: Record<EffectName, () => Promise<EffectModule>> = {
  fireworks: async () => {
    const module = await import('../../components/effects/fireworks');
    return { default: module.AdvancedCameraCardEffectFireworks };
  },
  ghost: async () => {
    const module = await import('../../components/effects/ghost');
    return { default: module.AdvancedCameraCardEffectGhost };
  },
  hearts: async () => {
    const module = await import('../../components/effects/hearts');
    return { default: module.AdvancedCameraCardEffectHearts };
  },
  shamrocks: async () => {
    const module = await import('../../components/effects/shamrocks');
    return { default: module.AdvancedCameraCardEffectShamrocks };
  },
  snow: async () => {
    const module = await import('../../components/effects/snow');
    return { default: module.AdvancedCameraCardEffectSnow };
  },
};

type EffectsContainer = HTMLElement | DocumentFragment;

export class EffectsController implements EffectsControllerAPI {
  private _importedModules: Map<EffectName, EffectModule> = new Map();
  private _activeInstances: Map<EffectName, EffectComponent | null> = new Map();
  private _container: EffectsContainer | null = null;

  public setContainer(container: EffectsContainer | null): void {
    this._container = container;
  }

  public async startEffect(name: EffectName, options?: EffectOptions): Promise<void> {
    if (!this._container || this._activeInstances.has(name)) {
      return;
    }

    // Reserve the slot immediately with null to prevent concurrent starts.
    this._activeInstances.set(name, null);

    const effectModule = await this._importEffectModule(name);
    if (!effectModule) {
      this._activeInstances.delete(name);
      return;
    }

    const effectComponent = new effectModule.default();
    effectComponent.fadeIn = options?.fadeIn ?? true;
    this._container.appendChild(effectComponent);
    this._activeInstances.set(name, effectComponent);
  }

  public async stopEffect(effect: EffectName): Promise<void> {
    const instance = this._activeInstances.get(effect);
    if (!instance) {
      return;
    }

    this._activeInstances.delete(effect);
    await instance.startFadeOut();
    instance.remove();
  }

  public async toggleEffect(name: EffectName, options?: EffectOptions): Promise<void> {
    if (this._activeInstances.has(name)) {
      await this.stopEffect(name);
    } else {
      await this.startEffect(name, options);
    }
  }

  private async _importEffectModule(name: EffectName): Promise<EffectModule | null> {
    const existingModule = this._importedModules.get(name);
    if (existingModule) {
      return existingModule;
    }

    const effectModule = await effectRegistry[name]?.();
    if (!effectModule) {
      return null;
    }

    this._importedModules.set(name, effectModule);
    return effectModule;
  }
}
