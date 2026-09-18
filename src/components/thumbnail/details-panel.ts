import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResult,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { CameraManager } from '../../camera-manager/manager';
import type { ViewItemManager } from '../../card-controller/view/item-manager';
import type { ViewManagerEpoch } from '../../card-controller/view/types';
import { isMediaReviewed } from '../../components-lib/media/format';
import { ThumbnailDetailsPanelController } from '../../components-lib/thumbnail/details-panel/controller';
import type { HomeAssistant } from '../../ha/types';
import { localize } from '../../localize/localize';
import thumbnailDetailsPanelStyle from '../../scss/thumbnail-details-panel.scss?inline';
import { stopEventFromActivatingCardWideActions } from '../../utils/action';
import { setOrRemoveAttribute } from '../../utils/basic';
import { showMediaInfoNotification } from '../../utils/media-actions';
import type { ViewItem } from '../../view/item';

import '../icon';

@customElement('advanced-camera-card-thumbnail-details-panel')
export class AdvancedCameraCardThumbnailDetailsPanel extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public item?: ViewItem;

  @property({ attribute: false })
  public seek?: Date;

  @property({ attribute: false })
  public viewItemManager?: ViewItemManager;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public filterReviewed?: boolean;

  @property({ attribute: false })
  public size?: number;

  @property({ attribute: false })
  public filterFavorite?: boolean;

  private _controller = new ThumbnailDetailsPanelController();

  protected willUpdate(changedProperties: PropertyValues): void {
    if (
      ['item', 'seek', 'cameraManager', 'size'].some((prop) =>
        changedProperties.has(prop),
      )
    ) {
      this._controller.calculate({
        cameraManager: this.cameraManager,
        item: this.item,
        seek: this.seek,
        size: this.size,
      });
      this.setAttribute('tier', this._controller.getTier());

      const isReviewed = isMediaReviewed(this.item);
      setOrRemoveAttribute(
        this,
        isReviewed !== null,
        'review',
        isReviewed ? 'reviewed' : 'unreviewed',
      );
    }
  }

  private _showInfo(ev: Event): void {
    stopEventFromActivatingCardWideActions(ev);
    if (!this.item) {
      return;
    }

    showMediaInfoNotification(this, this.item, this);
  }

  protected render(): TemplateResult | void {
    const label = this._controller.getLabel();
    const time = this._controller.getTime();
    const isInProgress = this._controller.isInProgress();
    const details = this._controller.getDetails();
    const seekTime = this._controller.getSeekTime();
    const hiddenDetailCount = this._controller.getHiddenDetailCount();

    return html`
      ${isInProgress
        ? html`<span class="in-progress" title=${localize('common.in_progress')}
            ><span class="dot"></span
            ><span class="label"
              >${localize('thumbnail.in_progress')}</span
            ></span
          >`
        : ''}
      ${label || time
        ? html`<div class="heading">
            ${label ? html`<span title=${label}>${label}</span>` : ''}
            ${time
              ? html`<span class="time" dir="ltr"
                  >${time.hoursMinutes}<span class="seconds">${time.seconds}</span></span
                >`
              : ''}
          </div>`
        : ''}
      ${details.map((detail) => html`<div><span title=${detail}>${detail}</span></div>`)}
      ${seekTime
        ? html`<div class="seek">
            <advanced-camera-card-icon
              title=${localize('thumbnail.seek')}
              .icon=${{ icon: 'mdi:clock-fast' }}
            ></advanced-camera-card-icon>
            <span title=${seekTime}>${seekTime}</span>
          </div>`
        : ''}
      ${hiddenDetailCount
        ? html`<ha-assist-chip
            class="more"
            filled
            .label=${localize(
              'thumbnail.more_details',
              '{count}',
              String(hiddenDetailCount),
            )}
            @click=${(ev: Event) => this._showInfo(ev)}
          ></ha-assist-chip>`
        : ''}
    `;
  }

  static get styles(): CSSResult {
    return unsafeCSS(thumbnailDetailsPanelStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-thumbnail-details-panel': AdvancedCameraCardThumbnailDetailsPanel;
  }
}
