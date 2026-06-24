export type EffectComponent = HTMLElement & {
  fadeIn: boolean;
  startFadeOut(): Promise<void>;
};

export interface EffectModule {
  default: new () => EffectComponent;
}

export interface EffectOptions {
  fadeIn?: boolean;
  duration?: number;
}
