import { format } from 'date-fns';
import { CSSResult, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CameraManagerCameraMetadata } from '../../../camera-manager/types';
import thumbnailFeatureTextStyle from '../../../scss/thumbnail-feature-text.scss';
import '../../icon.js';

@customElement('advanced-camera-card-thumbnail-feature-text')
export class AdvancedCameraCardThumbnailFeatureText extends LitElement {
  @property({ attribute: false })
  public date?: Date;

  @property({ attribute: false })
  public cameraMetadata?: CameraManagerCameraMetadata;

  @property({ attribute: false })
  public showCameraTitle?: boolean;

  protected render(): TemplateResult | void {
    if (!this.date) {
      return;
    }
    return html`
      ${this.cameraMetadata?.engineIcon
        ? html`<advanced-camera-card-icon
            class="background"
            .icon=${{ icon: this.cameraMetadata.engineIcon }}
          ></advanced-camera-card-icon>`
        : ''}
      <div class="content">
        <div class="title">${format(this.date, 'HH:mm')}</div>
        <div class="subtitle">${format(this.date, 'MMM do')}</div>
        ${this.showCameraTitle && this.cameraMetadata?.title
          ? html`<div class="camera">${this.cameraMetadata.title}</div>`
          : html``}
      </div>
    `;
  }

  static get styles(): CSSResult {
    return unsafeCSS(thumbnailFeatureTextStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-thumbnail-feature-text': AdvancedCameraCardThumbnailFeatureText;
  }
}
