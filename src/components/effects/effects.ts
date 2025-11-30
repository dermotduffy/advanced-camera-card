import { LitElement, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';
import { EffectsController } from '../../components-lib/effects/effects-controller';
import { EffectOptions } from '../../components-lib/effects/types';
import effectsStyle from '../../scss/effects.scss';
import { EffectName, EffectsControllerAPI } from '../../types';

@customElement('advanced-camera-card-effects')
export class AdvancedCameraCardEffects
  extends LitElement
  implements EffectsControllerAPI
{
  protected _controller = new EffectsController();

  public async startEffect(effect: EffectName, options?: EffectOptions): Promise<void> {
    await this._controller.startEffect(effect, options);
  }

  public stopEffect(effect: EffectName): void {
    this._controller.stopEffect(effect);
  }

  public async toggleEffect(effect: EffectName, options?: EffectOptions): Promise<void> {
    await this._controller.toggleEffect(effect, options);
  }

  protected updated(): void {
    this._controller.setContainer(this.renderRoot);
  }

  static get styles() {
    return unsafeCSS(effectsStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-effects': AdvancedCameraCardEffects;
  }
}
