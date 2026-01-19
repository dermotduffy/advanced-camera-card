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
import { CameraManager } from '../../camera-manager/manager';
import { MediaDetailsController } from '../../components-lib/media/details-controller';
import { HomeAssistant } from '../../ha/types';
import thumbnailDetailsStyle from '../../scss/thumbnail-details.scss';
import { MetadataField } from '../../types';
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

  private _controller = new MediaDetailsController();

  protected willUpdate(changedProperties: PropertyValues): void {
    if (['item', 'seek', 'cameraManager'].some((prop) => changedProperties.has(prop))) {
      this._controller.calculate(this.cameraManager, this.item, this.seek);
    }
  }

  protected render(): TemplateResult | void {
    const heading = this._controller.getHeading();
    const details = this._controller.getDetails();

    const renderDetail = (detail: MetadataField, heading = false): TemplateResult => {
      return html`<div
        class=${classMap({
          heading,
        })}
      >
        ${detail.icon
          ? html` <advanced-camera-card-icon
              severity=${detail.emphasis}
              title=${detail.hint ?? ''}
              .icon=${detail.icon}
            ></advanced-camera-card-icon>`
          : ''}
        <span title=${detail.title}>${detail.title}</span>
      </div>`;
    };

    return html`
      ${heading ? renderDetail(heading, true) : ``}
      ${details.length ? details.map((detail) => renderDetail(detail)) : ``}
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
