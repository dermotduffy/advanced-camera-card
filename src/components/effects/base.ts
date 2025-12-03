import { CSSResultGroup, LitElement, PropertyValues, unsafeCSS } from 'lit';
import { property } from 'lit/decorators.js';
import effectBaseStyle from '../../scss/effect-base.scss';
import { forceReflow } from '../../utils/basic';

export abstract class BaseEffectComponent extends LitElement {
  @property({ type: Boolean })
  public fadeIn = true;

  protected firstUpdated(): void {
    if (this.fadeIn) {
      this._startFadeIn();
    }
  }

  protected updated(changedProps: PropertyValues): void {
    // Skip if this is the initial property setting (handled by firstUpdated).
    if (changedProps.get('fadeIn') !== undefined) {
      if (!this.fadeIn) {
        this._setOpacity(1);
      } else {
        this._startFadeIn();
      }
    }
  }

  public startFadeOut(): Promise<void> {
    return new Promise((resolve) => {
      const handler = (ev: TransitionEvent) => {
        if (ev.propertyName === 'opacity') {
          this.removeEventListener('transitionend', handler);
          resolve();
        }
      };
      this.addEventListener('transitionend', handler);
      this._setOpacity(0);
    });
  }

  private _startFadeIn(): void {
    this._setOpacity(0);
    forceReflow(this);
    this._setOpacity(1);
  }

  private _setOpacity(opacity: number): void {
    this.style.opacity = `${opacity}`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(effectBaseStyle);
  }
}
