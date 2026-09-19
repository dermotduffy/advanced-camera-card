import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResult,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import type { CameraManager } from '../../../camera-manager/manager';
import type { ViewItemManager } from '../../../card-controller/view/item-manager';
import type { ViewManagerEpoch } from '../../../card-controller/view/types';
import { getMediaSeverity, isMediaReviewed } from '../../../components-lib/media/format';
import { ThumbnailFeatureController } from '../../../components-lib/thumbnail/feature/controller';
import type { ResolvedThumbnailDetailsStyle } from '../../../components-lib/thumbnail/resolve-details-style';
import type { HomeAssistant } from '../../../ha/types';
import thumbnailFeatureStyle from '../../../scss/thumbnail-feature.scss?inline';
import { setOrRemoveAttribute } from '../../../utils/basic';
import type { ViewItem } from '../../../view/item';
import { ViewItemClassifier } from '../../../view/item-classifier';

import '../controls.js';
import './thumbnail.js';

@customElement('advanced-camera-card-thumbnail-feature')
export class AdvancedCameraCardThumbnailFeature extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public viewItemManager?: ViewItemManager;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public item?: ViewItem;

  @property({ attribute: false })
  public detailsStyle?: ResolvedThumbnailDetailsStyle;

  @property({ attribute: false })
  public size?: number;

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
  public filterFavorite?: boolean;

  private _controller = new ThumbnailFeatureController();

  protected willUpdate(changedProperties: PropertyValues): void {
    if (['item', 'cameraManager'].some((prop) => changedProperties.has(prop))) {
      this._controller.calculate({
        cameraManager: this.cameraManager,
        item: this.item,
      });
    }

    const severity = getMediaSeverity(this.item);
    setOrRemoveAttribute(this, !!severity, 'severity', severity);

    const isReviewed = isMediaReviewed(this.item);
    setOrRemoveAttribute(
      this,
      isReviewed !== null,
      'review',
      isReviewed ? 'reviewed' : 'unreviewed',
    );

    this.toggleAttribute(
      'favorite',
      ViewItemClassifier.isMedia(this.item) && this.item.isFavorite() === true,
    );
  }

  protected render(): TemplateResult | void {
    if (!this.item) {
      return;
    }

    const mainIconClasses = {
      placeholder: true,
    };

    const thumbnail = this._controller.getThumbnail();
    const thumbnailClass = this._controller.getThumbnailClass();
    const thumbnailClasses = classMap({
      ...(thumbnailClass && { [thumbnailClass]: true }),
    });

    return html`
      <div class="media">
        ${thumbnail
          ? html` <advanced-camera-card-thumbnail-feature-thumbnail
              class="${thumbnailClasses}"
              .hass=${this.hass}
              .thumbnail=${thumbnail}
              aria-label=${this.item?.getTitle() ?? ''}
              title=${this.item?.getTitle() ?? ''}
            ></advanced-camera-card-thumbnail-feature-thumbnail>`
          : this._controller.getIcon()
            ? html`<advanced-camera-card-icon
                class=${classMap(mainIconClasses)}
                .icon=${{ icon: this._controller.getIcon() }}
              ></advanced-camera-card-icon>`
            : ''}
        <div class="favorite"></div>
      </div>
      <advanced-camera-card-thumbnail-controls
        .hass=${this.hass}
        .cameraManager=${this.cameraManager}
        .viewItemManager=${this.viewItemManager}
        .viewManagerEpoch=${this.viewManagerEpoch}
        .item=${this.item}
        .size=${this.size}
        .detailsStyle=${this.detailsStyle}
        .filterReviewed=${this.filterReviewed}
        .filterFavorite=${this.filterFavorite}
        ?show_favorite_control=${this.show_favorite_control}
        ?show_timeline_control=${this.show_timeline_control}
        ?show_download_control=${this.show_download_control}
        ?show_review_control=${this.show_review_control}
        ?show_info_control=${this.show_info_control}
      ></advanced-camera-card-thumbnail-controls>
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
