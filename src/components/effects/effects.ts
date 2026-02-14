import { LitElement, PropertyValues, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { EffectsManager } from '../../card-controller/effects/effects-manager';
import effectsStyle from '../../scss/effects.scss';

@customElement('advanced-camera-card-effects')
export class AdvancedCameraCardEffects extends LitElement {
  @property({ attribute: false })
  public effectsManager?: EffectsManager;

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has('effectsManager')) {
      const previousManager: EffectsManager | undefined =
        changedProperties.get('effectsManager');
      previousManager?.removeContainer();
    }
  }

  protected updated(): void {
    this.effectsManager?.setContainer(this.renderRoot);
  }

  public disconnectedCallback(): void {
    this.effectsManager?.removeContainer();
    super.disconnectedCallback();
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
