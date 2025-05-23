import {
  CSSResult,
  LitElement,
  PropertyValues,
  TemplateResult,
  html,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CameraManager } from '../../camera-manager/manager';
import { ThumbnailDetailsController } from '../../components-lib/thumbnail/details-controller';
import { HomeAssistant } from '../../ha/types';
import thumbnailDetailsStyle from '../../scss/thumbnail-details.scss';
import { ViewItem } from '../../view/item';
import '../icon';

@customElement('advanced-camera-card-thumbnail-details')
export class AdvancedCameraCardThumbnailDetails extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public item?: ViewItem;

  @property({ attribute: false })
  public seek?: Date;

  private _controller = new ThumbnailDetailsController();

  protected willUpdate(changedProperties: PropertyValues): void {
    if (['item', 'seek', 'cameraManager'].some((prop) => changedProperties.has(prop))) {
      this._controller.calculate(this.cameraManager, this.item, this.seek);
    }
  }

  protected render(): TemplateResult | void {
    const heading = this._controller.getHeading();
    const details = this._controller.getDetails();

    return html`
      ${heading
        ? html` <div class="heading">
            <span title=${heading}>${heading}</span>
          </div>`
        : ``}
      ${details
        ? html` <div class="details">
            ${details.map(
              (detail) =>
                html`<div>
                  ${detail.icon
                    ? html` <advanced-camera-card-icon
                        title=${detail.hint ?? ''}
                        .icon=${detail.icon}
                      ></advanced-camera-card-icon>`
                    : ''}
                  <span>${detail.title}</span>
                </div>`,
            )}
          </div>`
        : ''}
    `;
  }

  static get styles(): CSSResult {
    return unsafeCSS(thumbnailDetailsStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-thumbnail-details': AdvancedCameraCardThumbnailDetails;
  }
}
