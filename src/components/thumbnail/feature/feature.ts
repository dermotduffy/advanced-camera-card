import {
  CSSResult,
  LitElement,
  PropertyValues,
  TemplateResult,
  html,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CameraManager } from '../../../camera-manager/manager';
import { ThumbnailFeatureController } from '../../../components-lib/thumbnail/feature/controller';
import { HomeAssistant } from '../../../ha/types';
import thumbnailFeatureStyle from '../../../scss/thumbnail-feature.scss';
import { ViewItem } from '../../../view/item';
import '../../icon.js';
import './thumbnail.js';

@customElement('advanced-camera-card-thumbnail-feature')
export class AdvancedCameraCardThumbnailFeature extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public item?: ViewItem;

  @property({ attribute: false })
  public hasDetails?: boolean;

  private _controller = new ThumbnailFeatureController();

  protected willUpdate(changedProperties: PropertyValues): void {
    if (
      ['item', 'hasDetails', 'cameraManager'].some((prop) => changedProperties.has(prop))
    ) {
      this._controller.calculate(this.cameraManager, this.item, this.hasDetails);
    }
  }

  protected render(): TemplateResult | void {
    const title = this._controller.getTitle();
    const subtitles = this._controller.getSubtitles();
    const iconClasses = classMap({
      background: title || subtitles.length,
    });

    return html`
      ${this._controller.getThumbnail()
        ? html` <advanced-camera-card-thumbnail-feature-thumbnail
            .hass=${this.hass}
            .thumbnail=${this._controller.getThumbnail()}
            aria-label=${this._controller.getTitle() ?? ''}
            title=${this._controller.getTitle() ?? ''}
          ></advanced-camera-card-thumbnail-feature-thumbnail>`
        : this._controller.getIcon()
          ? html`<advanced-camera-card-icon
              class="${iconClasses}"
              .icon=${{ icon: this._controller.getIcon() }}
            ></advanced-camera-card-icon>`
          : ''}
      ${title || subtitles.length
        ? html`
            ${title ? html`<div class="title">${title}</div>` : ''}
            ${subtitles.length
              ? html`<div>
                  ${subtitles.map(
                    (subtitle) => html`<div class="subtitle">${subtitle}</div>`,
                  )}
                </div>`
              : ''}
          `
        : html``}
    `;
  }

  static get styles(): CSSResult {
    return unsafeCSS(thumbnailFeatureStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-thumbnail-feature': AdvancedCameraCardThumbnailFeature;
  }
}
