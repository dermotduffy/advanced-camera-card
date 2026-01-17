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
import { RemoveContextViewModifier } from '../../../card-controller/view/modifiers/remove-context';
import { ViewManagerEpoch } from '../../../card-controller/view/types';
import { dispatchAdvancedCameraCardErrorEvent } from '../../../components-lib/message/dispatch';
import { ThumbnailFeatureController } from '../../../components-lib/thumbnail/feature/controller';
import { HomeAssistant } from '../../../ha/types';
import { localize } from '../../../localize/localize';
import thumbnailFeatureStyle from '../../../scss/thumbnail-feature.scss';
import { stopEventFromActivatingCardWideActions } from '../../../utils/action';
import { errorToConsole } from '../../../utils/basic';
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

  private _controller = new ThumbnailFeatureController();

  protected willUpdate(changedProperties: PropertyValues): void {
    if (
      ['item', 'hasDetails', 'cameraManager'].some((prop) => changedProperties.has(prop))
    ) {
      this._controller.calculate(this.cameraManager, this.item, this.hasDetails);
    }
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
      this.show_timeline_control &&
      ((ViewItemClassifier.isEvent(this.item) && this.item.getStartTime()) ||
        (ViewItemClassifier.isReview(this.item) && this.item.getStartTime()) ||
        (ViewItemClassifier.isRecording(this.item) &&
          this.item.getStartTime() &&
          this.item.getEndTime()));

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

    const shouldShowInfoControl = this.show_info_control && this.item.getDescription();

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
              if (this.hass && this.item && ViewItemClassifier.isReview(this.item)) {
                const newReviewedState = !isReviewed;
                try {
                  await this.viewItemManager?.reviewMedia(this.item, newReviewedState);
                } catch (e) {
                  errorToConsole(e as Error);
                  return;
                }

                // Update local state so the icon reflects the change
                this.item.setReviewed(newReviewedState);

                // Remove this item from the view's queryResults
                const view = this.viewManagerEpoch?.manager.getView();
                if (view?.queryResults) {
                  this.viewManagerEpoch?.manager.setViewByParameters({
                    params: {
                      queryResults: view.queryResults.clone().removeItem(this.item),
                    },
                  });
                }
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
                if (this.hass && this.item) {
                  try {
                    await this.viewItemManager?.favorite(
                      this.item,
                      !this.item.isFavorite(),
                    );
                  } catch (e) {
                    errorToConsole(e as Error);
                    return;
                  }
                  this.requestUpdate();
                }
              }}
            ></advanced-camera-card-icon>`
          : ``}
      ${shouldShowInfoControl
        ? html`<advanced-camera-card-icon
            class="info"
            .icon=${{ icon: 'mdi:information-outline' }}
            title=${this.item.getDescription()}
            @click=${(ev: Event) => {
              stopEventFromActivatingCardWideActions(ev);
              const description = this.item?.getDescription();
              if (description) {
                dispatchShowOverlayMessageEvent(this, {
                  message: description,
                  icon: 'mdi:information-outline',
                });
              }
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
              if (!this.viewManagerEpoch || !this.item) {
                return;
              }
              this.viewManagerEpoch.manager.setViewByParameters({
                params: {
                  view: 'timeline',
                  queryResults: this.viewManagerEpoch?.manager
                    .getView()
                    ?.queryResults?.clone()
                    .selectResultIfFound((media) => media === this.item),
                },
                modifiers: [new RemoveContextViewModifier(['timeline'])],
              });
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
              if (this.hass && this.item) {
                try {
                  this.viewItemManager?.download(this.item);
                } catch (error: unknown) {
                  dispatchAdvancedCameraCardErrorEvent(this, error);
                }
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
