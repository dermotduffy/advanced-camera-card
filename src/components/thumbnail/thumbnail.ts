import { CSSResult, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CameraManager } from '../../camera-manager/manager.js';
import { FoldersManager } from '../../card-controller/folders/manager.js';
import { ViewItemManager } from '../../card-controller/view/item-manager.js';
import { ViewManagerEpoch } from '../../card-controller/view/types.js';
import { HomeAssistant } from '../../ha/types.js';
import thumbnailStyle from '../../scss/thumbnail.scss';
import { ViewItem } from '../../view/item.js';
import './details.js';
import './feature/feature.js';
import './feature/thumbnail.js';

@customElement('advanced-camera-card-thumbnail')
export class AdvancedCameraCardThumbnail extends LitElement {
  // Performance: During timeline scrubbing, hass may be updated continuously.
  // As it is not needed for the thumbnail rendering itself, it does not trigger
  // a re-render. The HomeAssistant object may be required for thumbnail signing
  // (after initial signing the thumbnail is stored in a data URL, so the
  // signing will not expire).
  public hass?: HomeAssistant;

  // Performance: During timeline scrubbing, the view will be updated
  // continuously. As it is not needed for the thumbnail rendering itself, it
  // does not trigger a re-render.
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public viewItemManager?: ViewItemManager;

  @property({ attribute: false })
  public folderManager?: FoldersManager;

  @property({ attribute: false })
  public item?: ViewItem;

  @property({ attribute: true, type: Boolean })
  public details = false;

  @property({ attribute: true, type: Boolean })
  public show_favorite_control = false;

  @property({ attribute: true, type: Boolean })
  public show_timeline_control = false;

  @property({ attribute: true, type: Boolean })
  public show_download_control = false;

  @property({ attribute: true, type: Boolean })
  public show_review_control = false;

  @property({ attribute: true, type: Boolean })
  public show_info_control = false;

  @property({ attribute: false })
  public filterReviewed?: boolean;

  @property({ attribute: false })
  public seek?: Date;

  /**
   * Render the element.
   * @returns A template to display to the user.
   */
  protected render(): TemplateResult | void {
    if (!this.item) {
      return;
    }

    return html`
      <advanced-camera-card-thumbnail-feature
        .cameraManager=${this.cameraManager}
        .hasDetails=${this.details}
        .hass=${this.hass}
        .item=${this.item}
        .viewItemManager=${this.viewItemManager}
        .viewManagerEpoch=${this.viewManagerEpoch}
        .show_favorite_control=${this.show_favorite_control}
        .show_timeline_control=${this.show_timeline_control}
        .show_download_control=${this.show_download_control}
        .show_review_control=${this.show_review_control}
        .show_info_control=${this.show_info_control}
        .filterReviewed=${this.filterReviewed}
      >
      </advanced-camera-card-thumbnail-feature>
      ${this.details
        ? html`<advanced-camera-card-thumbnail-details
            .hass=${this.hass}
            .item=${this.item ?? undefined}
            .cameraManager=${this.cameraManager}
            .seek=${this.seek}
          ></advanced-camera-card-thumbnail-details>`
        : ''}
    `;
  }

  static get styles(): CSSResult {
    return unsafeCSS(thumbnailStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-thumbnail': AdvancedCameraCardThumbnail;
  }
}
