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
import { FoldersManager } from '../../card-controller/folders/manager.js';
import { ViewItemManager } from '../../card-controller/view/item-manager.js';
import { ViewManagerEpoch } from '../../card-controller/view/types.js';
import {
  getUpFolderMediaItem,
  upFolderClickHandler,
} from '../../components-lib/folder/up-folder.js';
import { FolderGalleryController } from '../../components-lib/gallery/folder-gallery-controller.js';
import { MediaGalleryConfig } from '../../config/schema/media-gallery.js';
import { HomeAssistant } from '../../ha/types.js';
import { localize } from '../../localize/localize';
import folderGalleryStyle from '../../scss/folder-gallery.scss';
import { ViewItem } from '../../view/item.js';
import '../media-filter';
import '../message.js';
import { renderMessage } from '../message.js';
import '../surround-basic';
import '../thumbnail/thumbnail.js';
import './gallery-core.js';

@customElement('advanced-camera-card-folder-gallery')
export class AdvancedCameraCardFolderGallery extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public viewItemManager?: ViewItemManager;

  @property({ attribute: false })
  public galleryConfig?: MediaGalleryConfig;

  @property({ attribute: false })
  public foldersManager?: FoldersManager;

  protected _controller = new FolderGalleryController(this);

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('galleryConfig')) {
      this._controller.setThumbnailSize(this.galleryConfig?.controls.thumbnails.size);
    }
  }

  protected _renderThumbnail(
    item: ViewItem,
    selected: boolean,
    clickCallback: (item: ViewItem, ev: Event) => void,
  ): TemplateResult | void {
    return html`<advanced-camera-card-thumbnail
      class=${classMap({
        selected,
      })}
      .hass=${this.hass}
      .item=${item}
      .viewManagerEpoch=${this.viewManagerEpoch}
      .viewItemManager=${this.viewItemManager}
      ?selected=${selected}
      ?details=${!!this.galleryConfig?.controls.thumbnails.show_details}
      ?show_favorite_control=${!!this.galleryConfig?.controls.thumbnails
        .show_favorite_control}
      ?show_timeline_control=${!!this.galleryConfig?.controls.thumbnails
        .show_timeline_control}
      ?show_download_control=${!!this.galleryConfig?.controls.thumbnails
        .show_download_control}
      @click=${(ev: Event) => clickCallback(item, ev)}
    >
    </advanced-camera-card-thumbnail>`;
  }

  protected _renderThumbnails(): TemplateResult | void {
    const selected = this.viewManagerEpoch?.manager
      .getView()
      ?.queryResults?.getSelectedResult();

    return html`
      ${this.viewManagerEpoch?.manager
        .getView()
        ?.queryResults?.getResults()
        ?.map((item) =>
          this._renderThumbnail(item, item === selected, (item: ViewItem, ev: Event) => {
            const manager = this.viewManagerEpoch?.manager;
            if (manager) {
              this._controller.itemClickHandler(manager, item, ev, this.foldersManager);
            }
          }),
        )}
    `;
  }

  protected render(): TemplateResult | void {
    const folderIsLoading =
      !!this.viewManagerEpoch?.manager.getView()?.context?.loading?.query;
    const upThumbnail = getUpFolderMediaItem(this.viewManagerEpoch?.manager.getView());

    return html`
      <advanced-camera-card-surround-basic>
        ${!this.viewManagerEpoch?.manager.getView()?.queryResults?.hasResults() &&
        (folderIsLoading || !upThumbnail)
          ? renderMessage({
              type: 'info',
              message: folderIsLoading
                ? localize('error.awaiting_folder')
                : localize('common.no_folder'),
              icon: 'mdi:folder-play',
              dotdotdot: folderIsLoading,
            })
          : html`<advanced-camera-card-gallery-core
              .hass=${this.hass}
              .columnWidth=${this._controller.getColumnWidth(
                this.galleryConfig?.controls.thumbnails,
              )}
              .columnCountRoundMethod=${this._controller.getColumnCountRoundMethod(
                this.galleryConfig?.controls.thumbnails,
              )}
            >
              ${upThumbnail
                ? this._renderThumbnail(
                    upThumbnail,
                    false,
                    (item: ViewItem, ev: Event) =>
                      upFolderClickHandler(item, ev, this.viewManagerEpoch),
                  )
                : ''}
              ${this._renderThumbnails()}
            </advanced-camera-card-gallery-core>`}
      </advanced-camera-card-surround-basic>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(folderGalleryStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-folder-gallery': AdvancedCameraCardFolderGallery;
  }
}
