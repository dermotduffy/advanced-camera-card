import { html, unsafeCSS, type CSSResultGroup, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';

import ghostStyle from '../../scss/ghost.scss?inline';
import { BaseEffectComponent } from './base';

@customElement('advanced-camera-card-effect-ghost')
export class AdvancedCameraCardEffectGhost extends BaseEffectComponent {
  protected render(): TemplateResult {
    return html`<span class="ghost">👻</span>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(ghostStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-effect-ghost': AdvancedCameraCardEffectGhost;
  }
}
