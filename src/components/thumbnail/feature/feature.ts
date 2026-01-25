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
import { ViewItemManager } from '../../../card-controller/view/item-manager';
import { ViewManagerEpoch } from '../../../card-controller/view/types';
import {
  MediaDetailsController,
  OverlayControlsContext,
} from '../../../components-lib/media/details-controller';
import { ThumbnailFeatureController } from '../../../components-lib/thumbnail/feature/controller';
import { HomeAssistant } from '../../../ha/types';
import { localize } from '../../../localize/localize';
import thumbnailFeatureStyle from '../../../scss/thumbnail-feature.scss';
import { stopEventFromActivatingCardWideActions } from '../../../utils/action';
import {
  downloadMedia,
  navigateToTimeline,
  toggleFavorite,
  toggleReviewed,
} from '../../../utils/media-actions';
import { dispatchShowOverlayMessageEvent } from '../../../utils/overlay-message';
import { ViewItem } from '../../../view/item';
import { ViewItemClassifier } from '../../../view/item-classifier';
import '../../icon.js';
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
  public hasDetails?: boolean;

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

  private _controller = new ThumbnailFeatureController();

  protected willUpdate(changedProperties: PropertyValues): void {
    if (
      ['item', 'hasDetails', 'cameraManager'].some((prop) => changedProperties.has(prop))
    ) {
      this._controller.calculate(this.cameraManager, this.item, this.hasDetails);
    }
  }

  private _getControlContext(): OverlayControlsContext {
    return {
      hass: this.hass,
      viewItemManager: this.viewItemManager,
      viewManagerEpoch: this.viewManagerEpoch,
      capabilities: this.item ? this.viewItemManager?.getCapabilities(this.item) : null,
      filterReviewed: this.filterReviewed,
    };
  }

  protected render(): TemplateResult | void {
    if (!this.item) {
      return;
    }

    const starClasses = {
      star: true,
      starred: ViewItemClassifier.isMedia(this.item) && !!this.item?.isFavorite(),
    };

    const shouldShowTimelineControl =
      this.show_timeline_control && ViewItemClassifier.supportsTimeline(this.item);

    const mediaCapabilities = this.viewItemManager?.getCapabilities(this.item) ?? null;

    const shouldShowFavoriteControl =
      this.show_favorite_control &&
      this.item &&
      this.hass &&
      mediaCapabilities?.canFavorite;

    const shouldShowDownloadControl =
      this.show_download_control &&
      this.hass &&
      this.item.getID() &&
      mediaCapabilities?.canDownload;

    const isReviewed = ViewItemClassifier.isReview(this.item)
      ? this.item.isReviewed()
      : null;
    const shouldShowReviewControl = this.show_review_control && isReviewed !== null;

    const shouldShowInfoControl =
      this.show_info_control && ViewItemClassifier.isMedia(this.item);

    const title = this._controller.getTitle();
    const subtitles = this._controller.getSubtitles();
    const hasText = !!title || !!subtitles.length;

    const mainIconClasses = {
      placeholder: true,
    };

    const thumbnailClass = this._controller.getThumbnailClass();
    const thumbnailClasses = classMap({
      ...(thumbnailClass && { [thumbnailClass]: true }),
      'has-text': hasText,
    });

    return html`
      <div class=${classMap({ media: true, 'has-text': hasText })}>
        ${this._controller.getThumbnail()
          ? html` <advanced-camera-card-thumbnail-feature-thumbnail
              class="${thumbnailClasses}"
              .hass=${this.hass}
              .thumbnail=${this._controller.getThumbnail()}
              aria-label=${this.item?.getTitle() ?? ''}
              title=${this.item?.getTitle() ?? ''}
            ></advanced-camera-card-thumbnail-feature-thumbnail>`
          : this._controller.getIcon()
            ? html`<advanced-camera-card-icon
                class=${classMap(mainIconClasses)}
                .icon=${{ icon: this._controller.getIcon() }}
              ></advanced-camera-card-icon>`
            : ''}
      </div>
      ${shouldShowReviewControl
        ? html`<advanced-camera-card-icon
            class="review"
            title=${isReviewed
              ? localize('common.set_reviews.unreviewed')
              : localize('common.set_reviews.reviewed')}
            .icon=${{
              icon: isReviewed ? 'mdi:check-circle' : 'mdi:check-circle-outline',
            }}
            @click=${async (ev: Event) => {
              stopEventFromActivatingCardWideActions(ev);
              if (this.item) {
                await toggleReviewed(
                  this.item,
                  this.viewItemManager,
                  this.viewManagerEpoch,
                  this.filterReviewed,
                );
              }
            }}
          ></advanced-camera-card-icon>`
        : shouldShowFavoriteControl
          ? html` <advanced-camera-card-icon
              class="${classMap(starClasses)}"
              title=${localize('thumbnail.retain_indefinitely')}
              .icon=${{
                icon: this.item.isFavorite() ? 'mdi:star' : 'mdi:star-outline',
              }}
              @click=${async (ev: Event) => {
                stopEventFromActivatingCardWideActions(ev);
                if (
                  this.item &&
                  (await toggleFavorite(this.item, this.viewItemManager))
                ) {
                  this.requestUpdate();
                }
              }}
            ></advanced-camera-card-icon>`
          : ``}
      ${shouldShowInfoControl
        ? html`<advanced-camera-card-icon
            class="info"
            .icon=${{ icon: 'mdi:information-outline' }}
            title=${this.item?.getDescription() ?? ''}
            @click=${(ev: Event) => {
              stopEventFromActivatingCardWideActions(ev);
              const detailsController = new MediaDetailsController();
              detailsController.calculate(this.cameraManager, this.item);
              dispatchShowOverlayMessageEvent(
                this,
                detailsController.getMessage(this._getControlContext()),
              );
            }}
          ></advanced-camera-card-icon>`
        : ''}
      ${shouldShowTimelineControl
        ? html`<advanced-camera-card-icon
            class="timeline"
            .icon=${{ icon: 'mdi:target' }}
            title=${localize('thumbnail.timeline')}
            @click=${(ev: Event) => {
              stopEventFromActivatingCardWideActions(ev);
              if (this.item) {
                navigateToTimeline(this.item, this.viewManagerEpoch);
              }
            }}
          ></advanced-camera-card-icon>`
        : ''}
      ${shouldShowDownloadControl
        ? html` <advanced-camera-card-icon
            class="download"
            .icon=${{ icon: 'mdi:download' }}
            title=${localize('thumbnail.download')}
            @click=${async (ev: Event) => {
              stopEventFromActivatingCardWideActions(ev);
              if (this.item) {
                await downloadMedia(this.item, this.viewItemManager);
              }
            }}
          ></advanced-camera-card-icon>`
        : ``}
      ${hasText
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
