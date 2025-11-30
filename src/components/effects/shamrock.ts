import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import shamrockStyle from '../../scss/shamrock.scss';

@customElement('advanced-camera-card-shamrock')
export class AdvancedCameraCardShamrock extends LitElement {
  @property({ type: String })
  public char = '☘️';

  @property({ type: String })
  public size = '1em';

  @property({ type: Number })
  public maxOpacity = 1;

  @property({ type: String })
  public pulseDuration = '3s';

  @property({ type: String })
  public pulseDelay = '0s';

  @property({ type: String })
  public startX = '0%';

  @property({ type: String })
  public startY = '0%';

  public connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('animationiteration', this._handleAnimationIteration);
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('animationiteration', this._handleAnimationIteration);
  }

  private _handleAnimationIteration = (ev: AnimationEvent): void => {
    if (ev.animationName === 'shamrock-pulse') {
      this.startX = `${Math.random() * 100}%`;
      this.startY = `${Math.random() * 100}%`;
    }
  };

  protected render(): TemplateResult {
    return html`${this.char}`;
  }

  protected updated(): void {
    this.style.setProperty('--size', this.size);
    this.style.setProperty('--max-opacity', `${this.maxOpacity}`);
    this.style.setProperty('--pulse-duration', this.pulseDuration);
    this.style.setProperty('--pulse-delay', this.pulseDelay);
    this.style.setProperty('--start-x', this.startX);
    this.style.setProperty('--start-y', this.startY);
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(shamrockStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-shamrock': AdvancedCameraCardShamrock;
  }
}

