import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import fireworkParticleStyle from '../../scss/firework-particle.scss';

@customElement('advanced-camera-card-firework-particle')
export class AdvancedCameraCardFireworkParticle extends LitElement {
  @property({ type: Number })
  public angle = 0;

  @property({ type: Number })
  public distance = 100;

  @property({ type: String })
  public color = '#ffcc00';

  @property({ type: String })
  public size = '4px';

  @property({ type: String })
  public duration = '1.5s';

  @property({ type: String })
  public delay = '0s';

  @property({ type: Number })
  public gravity = 0;

  protected render(): TemplateResult {
    return html`<span class="spark">✦</span>`;
  }

  protected updated(): void {
    const radians = (this.angle * Math.PI) / 180;
    const endX = Math.cos(radians) * this.distance;
    const endY = Math.sin(radians) * this.distance + this.gravity;

    this.style.setProperty('--end-x', `${endX}px`);
    this.style.setProperty('--end-y', `${endY}px`);
    this.style.setProperty('--color', this.color);
    this.style.setProperty('--size', this.size);
    this.style.setProperty('--duration', this.duration);
    this.style.setProperty('--delay', this.delay);
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(fireworkParticleStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-firework-particle': AdvancedCameraCardFireworkParticle;
  }
}
