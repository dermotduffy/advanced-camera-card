import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';

import { MediaDimensionsContainerController } from '../components-lib/media-dimensions-container-controller.js';
import type { CameraDimensionsConfig } from '../config/schema/cameras';
import mediaDimensionsContainerStyle from '../scss/media-dimensions-container.scss';

@customElement('advanced-camera-card-media-dimensions-container')
export class AdvancedCameraCardMediaDimensionsContainer extends LitElement {
  @property({ attribute: false })
  public dimensionsConfig?: CameraDimensionsConfig;

  private _controller = new MediaDimensionsContainerController(this);

  private _refInnerContainer: Ref<HTMLElement> = createRef();
  private _refOuterContainer: Ref<HTMLElement> = createRef();

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('dimensionsConfig')) {
      this._controller.setConfig(this.dimensionsConfig);
    }
  }

  protected render(): TemplateResult | void {
    return html`
      <div class="outer" ${ref(this._refOuterContainer)}>
        <div class="inner" ${ref(this._refInnerContainer)}>
          <slot></slot>
        </div>
      </div>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(mediaDimensionsContainerStyle);
  }

  public updated(): void {
    this._controller.setContainers(
      this._refInnerContainer.value,
      this._refOuterContainer.value,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-media-dimensions-container': AdvancedCameraCardMediaDimensionsContainer;
  }
}
