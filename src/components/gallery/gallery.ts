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
import { FoldersManager } from '../../card-controller/folders/manager.js';
import { ViewItemManager } from '../../card-controller/view/item-manager.js';
import { MergeContextViewModifier } from '../../card-controller/view/modifiers/merge-context.js';
import { RemoveContextViewModifier } from '../../card-controller/view/modifiers/remove-context.js';
import { ViewManagerEpoch } from '../../card-controller/view/types.js';
import { GalleryController } from '../../components-lib/gallery/controller.js';
import {
  FolderNavigationParamaters,
  getUpFolderItem,
  navigateToFolder,
  navigateToMedia,
  navigateUp,
} from '../../components-lib/navigation.js';
import { ConditionStateManagerReadonlyInterface } from '../../conditions/types.js';
import { MediaGalleryConfig } from '../../config/schema/media-gallery.js';
import { CardWideConfig } from '../../config/schema/types.js';
import { MEDIA_CHUNK_SIZE_DEFAULT } from '../../const.js';
import { HomeAssistant } from '../../ha/types.js';
import { localize } from '../../localize/localize.js';
import galleryStyle from '../../scss/media-gallery.scss';
import { stopEventFromActivatingCardWideActions } from '../../utils/action.js';
import { ViewItemClassifier } from '../../view/item-classifier.js';
import { ViewFolder, ViewItem } from '../../view/item.js';
import { UnifiedQueryBuilder } from '../../view/unified-query-builder.js';
import { UnifiedQueryRunner } from '../../view/unified-query-runner.js';
import '../media-filter.js';
import '../message.js';
import { renderMessage } from '../message.js';
import '../surround-basic.js';
import '../thumbnail/thumbnail.js';
import './gallery-core.js';
import { GalleryExtendEvent } from './types.js';

const GALLERY_FILTER_MENU_ICONS = {
  closed: 'mdi:filter-cog-outline',
  open: 'mdi:filter-cog',
};

@customElement('advanced-camera-card-gallery')
export class AdvancedCameraCardGallery extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public galleryConfig?: MediaGalleryConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public foldersManager?: FoldersManager;

  @property({ attribute: false })
  public viewItemManager?: ViewItemManager;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: false })
  public conditionStateManager?: ConditionStateManagerReadonlyInterface;

  protected _controller = new GalleryController(this);
  protected _upFolderItem: ViewFolder | null = null;
  protected _builder: UnifiedQueryBuilder | null = null;

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('cameraManager') && this.cameraManager) {
      this._builder = new UnifiedQueryBuilder(this.cameraManager);
    }

    if (changedProps.has('viewManagerEpoch')) {
      const view = this.viewManagerEpoch?.manager.getView();
      this._controller.setItemsFromView(view, this.viewManagerEpoch?.oldView);
      this._upFolderItem = getUpFolderItem(view?.query);
    }

    if (changedProps.has('galleryConfig')) {
      this._controller.setThumbnailSize(this.galleryConfig?.controls.thumbnails.size);
    }
  }

  protected _getLimit(): number {
    return (
      this.cardWideConfig?.performance?.features?.media_chunk_size ??
      MEDIA_CHUNK_SIZE_DEFAULT
    );
  }

  protected _getFolderNavigationParameters(): FolderNavigationParamaters | null {
    return this._builder && this.viewManagerEpoch
      ? {
          builder: this._builder,
          viewManagerEpoch: this.viewManagerEpoch,
          limit: this._getLimit(),
        }
      : null;
  }

  protected _renderUpFolder(): TemplateResult | void {
    if (!this._upFolderItem) {
      return;
    }

    return html`<advanced-camera-card-thumbnail
      .hass=${this.hass}
      .item=${this._upFolderItem}
      .viewManagerEpoch=${this.viewManagerEpoch}
      ?details=${!!this.galleryConfig?.controls.thumbnails.show_details}
      @click=${(ev: Event) => {
        stopEventFromActivatingCardWideActions(ev);
        navigateUp(this._getFolderNavigationParameters());
      }}
    >
    </advanced-camera-card-thumbnail>`;
  }

  protected _renderThumbnails(): TemplateResult | void {
    const selected = this.viewManagerEpoch?.manager
      .getView()
      ?.queryResults?.getSelectedResult();

    return html`
      ${this._controller.getItems()?.map(
        (item) =>
          html`<advanced-camera-card-thumbnail
            class=${classMap({
              selected: item === selected,
            })}
            .hass=${this.hass}
            .cameraManager=${this.cameraManager}
            .viewItemManager=${this.viewItemManager}
            .item=${item}
            .viewManagerEpoch=${this.viewManagerEpoch}
            ?selected=${item === selected}
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
              stopEventFromActivatingCardWideActions(ev);
              if (ViewItemClassifier.isMedia(item) && this.viewManagerEpoch) {
                navigateToMedia(item, {
                  viewManagerEpoch: this.viewManagerEpoch,
                  modifiers: [
                    new RemoveContextViewModifier(['timeline', 'mediaViewer']),
                    new MergeContextViewModifier({
                      gallery: {
                        originView: this.viewManagerEpoch.manager.getView()?.view,
                      },
                    }),
                  ],
                });
              } else if (ViewItemClassifier.isFolder(item)) {
                navigateToFolder(item, this._getFolderNavigationParameters());
              }
            }}
          >
          </advanced-camera-card-thumbnail>`,
      )}
    `;
  }

  protected render(): TemplateResult | void {
    const isLoading =
      !!this.viewManagerEpoch?.manager.getView()?.context?.loading?.query;

    const hasItems =
      (this._controller.getItems()?.length ?? 0) > 0 || !!this._upFolderItem;

    const showFilter =
      this.galleryConfig && this.galleryConfig.controls.filter.mode !== 'none';

    return html`
      <advanced-camera-card-surround-basic
        .drawerIcons=${{
          ...(showFilter && {
            [this.galleryConfig!.controls.filter.mode]: GALLERY_FILTER_MENU_ICONS,
          }),
        }}
      >
        ${showFilter && this.galleryConfig
          ? html` <advanced-camera-card-media-filter
              .hass=${this.hass}
              .cameraManager=${this.cameraManager}
              .viewManagerEpoch=${this.viewManagerEpoch}
              .cardWideConfig=${this.cardWideConfig}
              slot=${this.galleryConfig.controls.filter.mode}
            >
            </advanced-camera-card-media-filter>`
          : ''}
        ${!hasItems
          ? renderMessage({
              type: 'info',
              message: isLoading
                ? localize('error.awaiting_media')
                : localize('common.no_media'),
              icon: 'mdi:multimedia',
              dotdotdot: isLoading,
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
              ${this._renderUpFolder()} ${this._renderThumbnails()}
            </advanced-camera-card-gallery-core>`}
      </advanced-camera-card-surround-basic>
    `;
  }

  protected async _extendGallery(
    ev: CustomEvent<GalleryExtendEvent>,
    direction: 'earlier' | 'later',
    useCache = true,
  ): Promise<void> {
    if (
      !this.cameraManager ||
      !this.foldersManager ||
      !this.viewManagerEpoch ||
      !this.conditionStateManager
    ) {
      ev.detail.resolve();
      return;
    }

    const runner = new UnifiedQueryRunner(
      this.cameraManager,
      this.foldersManager,
      this.conditionStateManager,
    );

    await this._controller.extend(runner, this.viewManagerEpoch, direction, useCache);
    ev.detail.resolve();
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(galleryStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-gallery': AdvancedCameraCardGallery;
  }
  interface HTMLElementEventMap {
    'advanced-camera-card:media:reviewed': CustomEvent<ViewItem>;
  }
}
