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
import { ifDefined } from 'lit/directives/if-defined.js';
import { CameraManager } from '../../camera-manager/manager';
import { MediaNotificationController } from '../../components-lib/media/notification-controller';
import { NotificationDetail } from '../../config/schema/actions/types';
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

  private _notificationController = new MediaNotificationController();

  protected willUpdate(changedProperties: PropertyValues): void {
    if (['item', 'seek', 'cameraManager'].some((prop) => changedProperties.has(prop))) {
      this._notificationController.calculate(this.cameraManager, this.item, this.seek);
    }
  }

  protected render(): TemplateResult | void {
    const heading = this._notificationController.getHeading();
    const details = this._notificationController.getMetadata();

    const renderDetail = (
      detail: NotificationDetail,
      heading = false,
    ): TemplateResult => {
      return html`<div
        class=${classMap({
          heading,
        })}
      >
        ${detail.icon
          ? html` <advanced-camera-card-icon
              severity=${ifDefined(detail.severity)}
              title=${detail.tooltip ?? ''}
              .icon=${{ icon: detail.icon }}
            ></advanced-camera-card-icon>`
          : ''}
        <span title=${detail.text}>${detail.text}</span>
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
