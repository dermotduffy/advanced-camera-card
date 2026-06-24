import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResultGroup,
  type TemplateResult,
} from 'lit';
import { customElement } from 'lit/decorators.js';

import overlayStyle from '../scss/overlay.scss';

@customElement('advanced-camera-card-overlay')
export class AdvancedCameraCardOverlay extends LitElement {
  protected render(): TemplateResult | void {
    return html`
      <slot name="top"></slot>
      <slot name="left"></slot>
      <slot name="right"></slot>
      <slot name="bottom"></slot>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(overlayStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-overlay': AdvancedCameraCardOverlay;
  }
}
