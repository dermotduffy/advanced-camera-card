import { CSSResult, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CameraManager } from '../../camera-manager/manager.js';
import { FoldersManager } from '../../card-controller/folders/manager.js';
import { ViewItemManager } from '../../card-controller/view/item-manager.js';
import { RemoveContextViewModifier } from '../../card-controller/view/modifiers/remove-context.js';
import { ViewManagerEpoch } from '../../card-controller/view/types.js';
import { dispatchAdvancedCameraCardErrorEvent } from '../../components-lib/message/dispatch.js';
import { HomeAssistant } from '../../ha/types.js';
import { localize } from '../../localize/localize.js';
import thumbnailStyle from '../../scss/thumbnail.scss';
import { stopEventFromActivatingCardWideActions } from '../../utils/action.js';
import { errorToConsole } from '../../utils/basic.js';
import { ViewItemClassifier } from '../../view/item-classifier.js';
import { ViewItem } from '../../view/item.js';
import './details/event.js';
import './details/folder';
import './details/recording.js';
import './feature/folder.js';
import './feature/text.js';
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

    const thumbnail = this.item.getThumbnail();
    const title = this.item.getTitle() ?? '';

    const starClasses = {
      star: true,
      starred: ViewItemClassifier.isMedia(this.item) && !!this.item?.isFavorite(),
    };

    const shouldShowTimelineControl =
      this.show_timeline_control &&
      ((ViewItemClassifier.isEvent(this.item) && this.item.getStartTime()) ||
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

    const cameraID = ViewItemClassifier.isMedia(this.item)
      ? this.item.getCameraID()
      : null;
    const cameraMetadata = cameraID
      ? this.cameraManager?.getCameraMetadata(cameraID) ?? null
      : null;

    return html`
      ${ViewItemClassifier.isEvent(this.item) && thumbnail
        ? html`<advanced-camera-card-thumbnail-feature-thumbnail
            aria-label="${title ?? ''}"
            title=${title}
            .hass=${this.hass}
            .thumbnail=${thumbnail ?? undefined}
          ></advanced-camera-card-thumbnail-feature-thumbnail>`
        : ViewItemClassifier.isEvent(this.item) ||
            ViewItemClassifier.isRecording(this.item)
          ? html`<advanced-camera-card-thumbnail-feature-text
              aria-label="${title ?? ''}"
              title="${title ?? ''}"
              .cameraMetadata=${cameraMetadata}
              .showCameraTitle=${!this.details}
              .date=${this.item.getStartTime() ?? undefined}
            ></advanced-camera-card-thumbnail-feature-text>`
          : ViewItemClassifier.isFolder(this.item)
            ? html`<advanced-camera-card-thumbnail-feature-folder
                .hass=${this.hass}
                .folder=${this.item}
                .showName=${!this.details}
              >
              </advanced-camera-card-thumbnail-feature-folder>`
            : html``}
      ${shouldShowFavoriteControl
        ? html` <advanced-camera-card-icon
            class="${classMap(starClasses)}"
            title=${localize('thumbnail.retain_indefinitely')}
            .icon=${{ icon: this.item.isFavorite() ? 'mdi:star' : 'mdi:star-outline' }}
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
          /></advanced-camera-card-icon>`
        : ``}
      ${this.details && ViewItemClassifier.isEvent(this.item)
        ? html`<advanced-camera-card-thumbnail-details-event
            .media=${this.item ?? undefined}
            .cameraTitle=${cameraMetadata?.title}
            .seek=${this.seek}
          ></advanced-camera-card-thumbnail-details-event>`
        : this.details && ViewItemClassifier.isRecording(this.item)
          ? html`<advanced-camera-card-thumbnail-details-recording
              .media=${this.item ?? undefined}
              .cameraTitle=${cameraMetadata?.title}
              .seek=${this.seek}
            ></advanced-camera-card-thumbnail-details-recording>`
          : this.details && ViewItemClassifier.isFolder(this.item)
            ? html`<advanced-camera-card-thumbnail-details-folder
                .folder=${this.item}
              ></advanced-camera-card-thumbnail-details-folder>`
            : html``}
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
