export type EffectComponent = HTMLElement & {
  fadeIn: boolean;
  startFadeOut(): Promise<void>;
};

export type EffectModule = { default: new () => EffectComponent };

export interface EffectOptions {
  fadeIn?: boolean;
  duration?: number;
}
