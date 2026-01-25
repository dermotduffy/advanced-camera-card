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
import { CameraManager } from '../camera-manager/manager.js';
import { FoldersManager } from '../card-controller/folders/manager.js';
import { ViewItemManager } from '../card-controller/view/item-manager.js';
import { RemoveContextViewModifier } from '../card-controller/view/modifiers/remove-context.js';
import { ViewManagerEpoch } from '../card-controller/view/types.js';
import {
  FolderNavigationParamaters,
  getUpFolderItem,
  navigateToFolder,
  navigateToMedia,
  navigateUp,
} from '../components-lib/navigation.js';
import { ThumbnailsControlConfig } from '../config/schema/common/controls/thumbnails.js';
import { CardWideConfig } from '../config/schema/types.js';
import { MEDIA_CHUNK_SIZE_DEFAULT } from '../const.js';
import { HomeAssistant } from '../ha/types.js';
import thumbnailCarouselStyle from '../scss/thumbnail-carousel.scss';
import { stopEventFromActivatingCardWideActions } from '../utils/action.js';
import { CarouselDirection } from '../utils/embla/carousel-controller.js';
import { fireAdvancedCameraCardEvent } from '../utils/fire-advanced-camera-card-event.js';
import { ViewItemClassifier } from '../view/item-classifier.js';
import { ViewItem, ViewMedia } from '../view/item.js';
import { UnifiedQueryBuilder } from '../view/unified-query-builder.js';
import { getReviewedQueryFilterFromQuery } from '../view/utils/query-filter.js';
import './carousel.js';
import './thumbnail/thumbnail.js';

export interface ThumbnailMediaSelect {
  media: ViewMedia;
}

@customElement('advanced-camera-card-thumbnail-carousel')
export class AdvancedCameraCardThumbnailCarousel extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public foldersManager?: FoldersManager;

  @property({ attribute: false })
  public viewItemManager?: ViewItemManager;

  @property({ attribute: false })
  public config?: ThumbnailsControlConfig;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: false })
  public fadeThumbnails = false;

  protected _thumbnails: TemplateResult[] = [];
  protected _builder: UnifiedQueryBuilder | null = null;

  protected _getLimit(): number {
    return (
      this.cardWideConfig?.performance?.features?.media_chunk_size ??
      MEDIA_CHUNK_SIZE_DEFAULT
    );
  }

  protected _getFolderNavOptions(): FolderNavigationParamaters | undefined {
    return this._builder && this.viewManagerEpoch
      ? {
          builder: this._builder,
          viewManagerEpoch: this.viewManagerEpoch,
          limit: this._getLimit(),
        }
      : undefined;
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (
      (changedProps.has('cameraManager') || changedProps.has('foldersManager')) &&
      this.cameraManager &&
      this.foldersManager
    ) {
      this._builder = new UnifiedQueryBuilder(this.cameraManager, this.foldersManager);
    }

    if (changedProps.has('config')) {
      if (this.config?.size) {
        this.style.setProperty(
          '--advanced-camera-card-thumbnail-size',
          `${this.config.size}px`,
        );
      }
      const direction = this._getDirection();
      if (direction) {
        this.setAttribute('direction', direction);
      } else {
        this.removeAttribute('direction');
      }
    }

    const renderProperties = [
      'cameraManager',
      'config',
      'transitionEffect',
      'viewManagerEpoch',
    ] as const;
    if (renderProperties.some((prop) => changedProps.has(prop))) {
      this._thumbnails = this._renderThumbnails();
    }

    if (changedProps.has('viewManagerEpoch')) {
      this.style.setProperty(
        '--advanced-camera-card-carousel-thumbnail-opacity',
        !this.fadeThumbnails || this._getSelectedSlide() === null ? '1.0' : '0.4',
      );
    }
  }

  protected _getSelectedSlide(): number | null {
    return (
      this.viewManagerEpoch?.manager.getView()?.queryResults?.getSelectedIndex() ?? null
    );
  }

  protected _handleMediaClick(item: ViewMedia): void {
    fireAdvancedCameraCardEvent<ThumbnailMediaSelect>(
      this,
      'thumbnails-carousel:media-select',
      { media: item },
    );
    if (this.viewManagerEpoch) {
      navigateToMedia(item, {
        viewManagerEpoch: this.viewManagerEpoch,
        modifiers: [new RemoveContextViewModifier(['timeline', 'mediaViewer'])],
      });
    }
  }

  protected _renderThumbnail(
    item: ViewItem,
    selected: boolean,
    clickCallback: (item: ViewItem, ev: Event) => void,
    seekTarget?: Date,
    filterReviewed?: boolean,
  ): TemplateResult {
    const classes = {
      embla__slide: true,
      'slide-selected': selected,
    };

    return html` <advanced-camera-card-thumbnail
      class="${classMap(classes)}"
      .cameraManager=${this.cameraManager}
      .hass=${this.hass}
      .filterReviewed=${filterReviewed}
      .item=${item}
      .viewManagerEpoch=${this.viewManagerEpoch}
      .viewItemManager=${this.viewItemManager}
      .seek=${seekTarget &&
      ViewItemClassifier.isMedia(item) &&
      item.includesTime(seekTarget)
        ? seekTarget
        : undefined}
      ?details=${!!this.config?.show_details}
      ?show_favorite_control=${this.config?.show_favorite_control}
      ?show_timeline_control=${this.config?.show_timeline_control}
      ?show_download_control=${this.config?.show_download_control}
      ?show_review_control=${this.config?.show_review_control}
      ?show_info_control=${this.config?.show_info_control}
      @click=${(ev: Event) => clickCallback(item, ev)}
    >
    </advanced-camera-card-thumbnail>`;
  }

  protected _renderThumbnails(): TemplateResult[] {
    const upFolderItem = getUpFolderItem(
      this.viewManagerEpoch?.manager.getView()?.query,
    );
    const thumbnails: TemplateResult[] = upFolderItem
      ? [
          this._renderThumbnail(upFolderItem, false, (_item: ViewItem, ev: Event) => {
            stopEventFromActivatingCardWideActions(ev);
            navigateUp(this._getFolderNavOptions());
          }),
        ]
      : [];
    const view = this.viewManagerEpoch?.manager.getView();
    const selectedIndex = this._getSelectedSlide();

    for (const item of view?.queryResults?.getResults() ?? []) {
      const clickHandler = (item: ViewItem, ev: Event) => {
        stopEventFromActivatingCardWideActions(ev);
        if (ViewItemClassifier.isMedia(item)) {
          this._handleMediaClick(item);
        } else if (ViewItemClassifier.isFolder(item)) {
          navigateToFolder(item, this._getFolderNavOptions());
        }
      };
      thumbnails.push(
        this._renderThumbnail(
          item,
          selectedIndex === thumbnails.length,
          clickHandler,
          view?.context?.mediaViewer?.seek,
          getReviewedQueryFilterFromQuery(view?.query, item),
        ),
      );
    }

    return thumbnails;
  }

  protected _getDirection(): CarouselDirection | null {
    if (this.config?.mode === 'left' || this.config?.mode === 'right') {
      return 'vertical';
    } else if (this.config?.mode === 'above' || this.config?.mode === 'below') {
      return 'horizontal';
    }
    return null;
  }

  protected render(): TemplateResult | void {
    if (!this._thumbnails.length || !this.config?.mode || this.config.mode === 'none') {
      return;
    }

    return html`<advanced-camera-card-carousel
      class="${classMap({ fade: this.fadeThumbnails })}"
      direction=${this._getDirection() ?? 'horizontal'}
      .selected=${this._getSelectedSlide()}
      .dragFree=${true}
    >
      ${this._thumbnails}
    </advanced-camera-card-carousel> `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(thumbnailCarouselStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-thumbnail-carousel': AdvancedCameraCardThumbnailCarousel;
  }
}
