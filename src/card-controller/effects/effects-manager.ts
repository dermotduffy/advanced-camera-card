import { EffectName, EffectsContainer, EffectsManagerInterface } from '../../types';
import { Timer } from '../../utils/timer';
import { EffectComponent, EffectModule, EffectOptions } from './types';

const effectRegistry: Record<EffectName, () => Promise<EffectModule>> = {
  check: async () => {
    const module = await import('../../components/effects/check');
    return { default: module.AdvancedCameraCardEffectCheck };
  },
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

export class EffectsManager implements EffectsManagerInterface {
  private _importedModules: Map<EffectName, EffectModule> = new Map();
  private _durationTimers: Map<EffectName, Timer> = new Map();

  // Effects that have been requested to start but are still loading or waiting
  // for a container to be registered (test case: a card without cameras or
  // folders will initialize very quickly and the card will be loaded before
  // effects can be started).
  private _pendingEffects: Map<EffectName, EffectOptions | undefined> = new Map();
  private _activeEffects: Map<EffectName, EffectComponent | null> = new Map();
  private _container: EffectsContainer | null = null;

  public setContainer(container: EffectsContainer): void {
    this._container = container;
    this._startPendingEffects();
  }

  public removeContainer(): void {
    this._container = null;
    this._pendingEffects.clear();

    for (const timer of this._durationTimers.values()) {
      timer.stop();
    }
    this._durationTimers.clear();

    for (const instance of this._activeEffects.values()) {
      instance?.remove();
    }
    this._activeEffects.clear();
  }

  public async startEffect(name: EffectName, options?: EffectOptions): Promise<void> {
    if (this._activeEffects.has(name)) {
      return;
    }

    // Reserve the slot immediately with null to prevent concurrent starts.
    this._activeEffects.set(name, null);
    if (!this._container) {
      this._pendingEffects.set(name, options);
      return;
    }

    await this._startEffect(name, options);
  }

  public async stopEffect(effect: EffectName): Promise<void> {
    const timer = this._durationTimers.get(effect);
    if (timer) {
      timer.stop();
      this._durationTimers.delete(effect);
    }
    this._pendingEffects.delete(effect);

    if (!this._activeEffects.has(effect)) {
      return;
    }

    const instance = this._activeEffects.get(effect);
    this._activeEffects.delete(effect);

    // If instance is null, it's still loading - just clearing the reservation
    // will prevent it from appearing (startEffect checks this after import).
    if (instance) {
      await instance.startFadeOut();
      instance.remove();
    }
  }

  public async toggleEffect(name: EffectName, options?: EffectOptions): Promise<void> {
    if (this._activeEffects.has(name)) {
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

  private async _startEffect(name: EffectName, options?: EffectOptions): Promise<void> {
    const effectModule = await this._importEffectModule(name);

    // Check if the effect was cancelled during loading.
    if (!effectModule || !this._activeEffects.has(name)) {
      this._pendingEffects.delete(name);
      this._activeEffects.delete(name);
      return;
    }

    if (!this._container) {
      this._pendingEffects.set(name, options);
      return;
    }
    this._pendingEffects.delete(name);

    const effectComponent = new effectModule.default();
    effectComponent.fadeIn = options?.fadeIn ?? true;
    this._container.appendChild(effectComponent);
    this._activeEffects.set(name, effectComponent);

    const duration = options?.duration;
    if (duration !== undefined) {
      return new Promise<void>((resolve) => {
        const timer = new Timer();
        this._durationTimers.set(name, timer);
        timer.start(duration, async () => {
          this._durationTimers.delete(name);
          await this.stopEffect(name);
          resolve();
        });
      });
    }
  }

  private _startPendingEffects(): void {
    for (const [name, options] of this._pendingEffects.entries()) {
      this._pendingEffects.delete(name);
      this._startEffect(name, options);
    }
  }
}
