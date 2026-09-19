import { html, LitElement, unsafeCSS, type CSSResult, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { CameraManager } from '../../camera-manager/manager';
import type { ViewItemManager } from '../../card-controller/view/item-manager';
import type { ViewManagerEpoch } from '../../card-controller/view/types';
import {
  ThumbnailControlsController,
  type ThumbnailControl,
} from '../../components-lib/thumbnail/controls/controller';
import type { ResolvedThumbnailDetailsStyle } from '../../components-lib/thumbnail/resolve-details-style';
import type { HomeAssistant } from '../../ha/types';
import thumbnailControlsStyle from '../../scss/thumbnail-controls.scss?inline';
import { stopEventFromActivatingCardWideActions } from '../../utils/action';
import {
  downloadMedia,
  navigateToTimeline,
  showMediaInfoNotification,
  toggleFavorite,
  toggleReviewed,
} from '../../utils/media-actions';
import type { ViewItem } from '../../view/item';

import '../icon.js';

@customElement('advanced-camera-card-thumbnail-controls')
export class AdvancedCameraCardThumbnailControls extends LitElement {
  // These are read only when a control is activated, never to decide what to
  // render, so they are not reactive / do not trigger a re-render.
  public hass?: HomeAssistant;
  public cameraManager?: CameraManager;
  public viewManagerEpoch?: ViewManagerEpoch;
  public filterReviewed?: boolean;
  public filterFavorite?: boolean;

  @property({ attribute: false })
  public viewItemManager?: ViewItemManager;

  @property({ attribute: false })
  public item?: ViewItem;

  @property({ attribute: false })
  public size?: number;

  @property({ attribute: false })
  public detailsStyle?: ResolvedThumbnailDetailsStyle;

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

  private _controller = new ThumbnailControlsController();

  protected willUpdate(): void {
    this._controller.calculate({
      item: this.item,
      size: this.size,
      capabilities: this.item
        ? this.viewItemManager?.getCapabilities(this.item) ?? undefined
        : undefined,
      showFavoriteControl: this.show_favorite_control,
      showTimelineControl: this.show_timeline_control,
      showDownloadControl: this.show_download_control,
      showReviewControl: this.show_review_control,
      showInfoControl: this.show_info_control,
      detailsStyle: this.detailsStyle,
    });

    this.toggleAttribute('touch', this._controller.isTouch());
    this.setAttribute('tier', this._controller.getTier());
  }

  private async _activate(control: ThumbnailControl): Promise<void> {
    const item = this.item;
    if (!item) {
      return;
    }

    switch (control.name) {
      case 'review':
        await toggleReviewed(
          this,
          item,
          this.viewItemManager,
          this.viewManagerEpoch,
          this.filterReviewed,
        );
        break;
      case 'favorite':
        await toggleFavorite(
          item,
          this.viewItemManager,
          this.viewManagerEpoch,
          this.filterFavorite,
        );
        break;
      case 'info':
        showMediaInfoNotification(this, item, this);
        break;
      case 'timeline':
        navigateToTimeline(item, this.viewManagerEpoch);
        break;
      case 'download':
        await downloadMedia(item, this.viewItemManager);
        break;
    }
  }

  protected render(): TemplateResult {
    const controls = this._controller.getControls();
    if (!controls.length) {
      return html``;
    }

    return html`<div class="controls">
      ${controls.map(
        (control) =>
          html`<advanced-camera-card-icon
            class="${control.name} ${control.active ? 'active' : ''}"
            title=${control.title}
            tabindex="0"
            role="button"
            .icon=${{ icon: control.icon }}
            @mousedown=${(ev: Event) =>
              // Prevent click-focus so the pill hides when the pointer leaves.
              ev.preventDefault()}
            @click=${async (ev: Event) => {
              stopEventFromActivatingCardWideActions(ev);
              await this._activate(control);
            }}
            @keydown=${async (ev: KeyboardEvent) => {
              if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                stopEventFromActivatingCardWideActions(ev);
                await this._activate(control);
              }
            }}
          ></advanced-camera-card-icon>`,
      )}
    </div>`;
  }

  static get styles(): CSSResult {
    return unsafeCSS(thumbnailControlsStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-thumbnail-controls': AdvancedCameraCardThumbnailControls;
  }
}
