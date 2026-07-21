import { html, unsafeCSS, type CSSResultGroup, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';

import checkCircleIcon from '../../images/check-circle.svg';
import checkStyle from '../../scss/check.scss';
import { BaseEffectComponent } from './base';

@customElement('advanced-camera-card-effect-check')
export class AdvancedCameraCardEffectCheck extends BaseEffectComponent {
  protected render(): TemplateResult {
    // Using inline SVG to avoid ha-icon lazy-loading delay on first use.
    return html`<span class="check">
      <svg viewBox=${checkCircleIcon.viewBox} fill="currentColor">
        <path d=${checkCircleIcon.path}></path>
      </svg>
    </span>`;
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
