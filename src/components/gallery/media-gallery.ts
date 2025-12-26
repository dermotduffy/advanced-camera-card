import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CameraManager } from '../../camera-manager/manager.js';
import { ViewItemManager } from '../../card-controller/view/item-manager.js';
import { ViewManagerEpoch } from '../../card-controller/view/types.js';
import { MediaGalleryController } from '../../components-lib/gallery/media-gallery-controller.js';
import { MediaGalleryConfig } from '../../config/schema/media-gallery.js';
import { CardWideConfig } from '../../config/schema/types.js';
import { HomeAssistant } from '../../ha/types.js';
import { localize } from '../../localize/localize';
import mediaGalleryStyle from '../../scss/media-gallery.scss';
import { ViewItem } from '../../view/item.js';
import '../media-filter';
import '../message.js';
import { renderMessage } from '../message.js';
import '../surround-basic';
import '../thumbnail/thumbnail.js';
import './gallery-core.js';
import { GalleryExtendEvent } from './types.js';

const MEDIA_GALLERY_FILTER_MENU_ICONS = {
  closed: 'mdi:filter-cog-outline',
  open: 'mdi:filter-cog',
};

@customElement('advanced-camera-card-media-gallery')
export class AdvancedCameraCardMediaGallery extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public galleryConfig?: MediaGalleryConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public viewItemManager?: ViewItemManager;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  protected _controller = new MediaGalleryController(this);

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('viewManagerEpoch')) {
      this._controller.setMediaFromView(
        this.viewManagerEpoch?.manager.getView(),
        this.viewManagerEpoch?.oldView,
      );
    }

    if (changedProps.has('galleryConfig')) {
      this._controller.setThumbnailSize(this.galleryConfig?.controls.thumbnails.size);
    }
  }

  protected _renderThumbnails(): TemplateResult | void {
    const selected = this.viewManagerEpoch?.manager
      .getView()
      ?.queryResults?.getSelectedResult();

    return html`
      ${this._controller.getMedia()?.map(
        (media, index) =>
          html`<advanced-camera-card-thumbnail
            class=${classMap({
              selected: media === selected,
            })}
            .hass=${this.hass}
            .cameraManager=${this.cameraManager}
            .viewItemManager=${this.viewItemManager}
            .item=${media}
            .viewManagerEpoch=${this.viewManagerEpoch}
            ?selected=${media === selected}
            ?details=${!!this.galleryConfig?.controls.thumbnails.show_details}
            ?show_favorite_control=${!!this.galleryConfig?.controls.thumbnails
              .show_favorite_control}
            ?show_timeline_control=${!!this.galleryConfig?.controls.thumbnails
              .show_timeline_control}
            ?show_download_control=${!!this.galleryConfig?.controls.thumbnails
              .show_download_control}
            ?show_review_control=${!!this.galleryConfig?.controls.thumbnails
              .show_review_control}
            @click=${(ev: Event) => {
              const manager = this.viewManagerEpoch?.manager;
              if (manager) {
                this._controller.itemClickHandler(manager, index, ev);
              }
            }}
          >
          </advanced-camera-card-thumbnail>`,
      )}
    `;
  }

  protected render(): TemplateResult | void {
    const mediaIsLoading =
      !!this.viewManagerEpoch?.manager.getView()?.context?.loading?.query;

    return html`
      <advanced-camera-card-surround-basic
        .drawerIcons=${{
          ...(this.galleryConfig &&
            this.galleryConfig.controls.filter.mode !== 'none' && {
              [this.galleryConfig.controls.filter.mode]: MEDIA_GALLERY_FILTER_MENU_ICONS,
            }),
        }}
      >
        ${this.galleryConfig && this.galleryConfig.controls.filter.mode !== 'none'
          ? html` <advanced-camera-card-media-filter
              .hass=${this.hass}
              .cameraManager=${this.cameraManager}
              .viewManagerEpoch=${this.viewManagerEpoch}
              .cardWideConfig=${this.cardWideConfig}
              slot=${this.galleryConfig.controls.filter.mode}
            >
            </advanced-camera-card-media-filter>`
          : ''}
        ${!this._controller.getMedia()?.length
          ? renderMessage({
              type: 'info',
              message: mediaIsLoading
                ? localize('error.awaiting_media')
                : localize('common.no_media'),
              icon: 'mdi:multimedia',
              dotdotdot: mediaIsLoading,
            })
          : html`<advanced-camera-card-gallery-core
              .hass=${this.hass}
              .columnWidth=${this._controller.getColumnWidth(
                this.galleryConfig?.controls.thumbnails,
              )}
              .columnCountRoundMethod=${this._controller.getColumnCountRoundMethod(
                this.galleryConfig?.controls.thumbnails,
              )}
              .cardWideConfig=${this.cardWideConfig}
              .extendUp=${true}
              .extendDown=${true}
              @advanced-camera-card:gallery:extend:up=${(
                ev: CustomEvent<GalleryExtendEvent>,
              ) =>
                this._extendGallery(
                  ev,
                  'later',
                  // Avoid use of cache since the user is explicitly looking for
                  // the freshest possible data.
                  false,
                )}
              @advanced-camera-card:gallery:extend:down=${(
                ev: CustomEvent<GalleryExtendEvent>,
              ) => this._extendGallery(ev, 'earlier')}
            >
              ${this._renderThumbnails()}
            </advanced-camera-card-gallery-core>`}
      </advanced-camera-card-surround-basic>
    `;
  }

  protected async _extendGallery(
    ev: CustomEvent<GalleryExtendEvent>,
    direction: 'earlier' | 'later',
    useCache = true,
  ): Promise<void> {
    if (!this.cameraManager || !this.viewManagerEpoch) {
      return;
    }
    await this._controller.extendMediaGallery(
      this.cameraManager,
      this.viewManagerEpoch,
      direction,
      useCache,
    );
    ev.detail.resolve();
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(mediaGalleryStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-media-gallery': AdvancedCameraCardMediaGallery;
  }
  interface HTMLElementEventMap {
    'advanced-camera-card:media:reviewed': CustomEvent<ViewItem>;
  }
}
