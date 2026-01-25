import { CSSResultGroup, html, TemplateResult, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import checkCircleSVG from '../../images/check-circle.svg';
import checkStyle from '../../scss/check.scss';
import { BaseEffectComponent } from './base';

@customElement('advanced-camera-card-effect-check')
export class AdvancedCameraCardEffectCheck extends BaseEffectComponent {
  protected render(): TemplateResult {
    // Using inline SVG to avoid ha-icon lazy-loading delay on first use.
    return html`<span class="check">${unsafeHTML(checkCircleSVG)}</span>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(checkStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-effect-check': AdvancedCameraCardEffectCheck;
  }
}
