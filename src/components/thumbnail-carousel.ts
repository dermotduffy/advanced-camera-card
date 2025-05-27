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
import { ViewItemManager } from '../card-controller/view/item-manager.js';
import { RemoveContextViewModifier } from '../card-controller/view/modifiers/remove-context.js';
import { ViewManagerEpoch } from '../card-controller/view/types.js';
import {
  getUpFolderMediaItem,
  upFolderClickHandler,
} from '../components-lib/folder/up-folder.js';
import { ThumbnailsControlConfig } from '../config/schema/common/controls/thumbnails.js';
import { HomeAssistant } from '../ha/types.js';
import thumbnailCarouselStyle from '../scss/thumbnail-carousel.scss';
import { stopEventFromActivatingCardWideActions } from '../utils/action.js';
import { CarouselDirection } from '../utils/embla/carousel-controller.js';
import { fireAdvancedCameraCardEvent } from '../utils/fire-advanced-camera-card-event.js';
import { ViewItemClassifier } from '../view/item-classifier.js';
import { ViewItem, ViewMedia } from '../view/item.js';
import { QueryClassifier } from '../view/query-classifier.js';
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
  public viewItemManager?: ViewItemManager;

  @property({ attribute: false })
  public config?: ThumbnailsControlConfig;

  @property({ attribute: false })
  public fadeThumbnails = false;

  protected _thumbnails: TemplateResult[] = [];

  protected willUpdate(changedProps: PropertyValues): void {
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

  protected _itemClickCallback(item: ViewItem, ev: Event): void {
    stopEventFromActivatingCardWideActions(ev);

    const view = this.viewManagerEpoch?.manager.getView();
    const query = view?.query;
    const results = view?.queryResults;

    if (!view || !query || !results) {
      return;
    }

    if (ViewItemClassifier.isMedia(item)) {
      const newResults = results
        .clone()
        .selectResultIfFound((result) => result === item);
      const cameraID = item.getCameraID();

      fireAdvancedCameraCardEvent<ThumbnailMediaSelect>(
        this,
        'thumbnails-carousel:media-select',
        { media: item },
      );
      this.viewManagerEpoch?.manager.setViewByParameters({
        params: {
          view: 'media',
          queryResults: newResults,
          ...(cameraID && { camera: cameraID }),
        },
        modifiers: [new RemoveContextViewModifier(['timeline', 'mediaViewer'])],
      });
    } else if (
      QueryClassifier.isFolderQuery(query) &&
      ViewItemClassifier.isFolder(item)
    ) {
      const rawQuery = query.getQuery();
      if (!rawQuery) {
        return;
      }

      this.viewManagerEpoch?.manager.setViewByParametersWithExistingQuery({
        params: {
          query: query.clone().setQuery({
            folder: rawQuery.folder,
            path: [...(rawQuery.path ?? []), { folder: item }],
          }),
        },
      });
    }
  }

  protected _renderThumbnail(
    item: ViewItem,
    selected: boolean,
    clickCallback: (item: ViewItem, ev: Event) => void,
    seekTarget?: Date,
  ): TemplateResult {
    const classes = {
      embla__slide: true,
      'slide-selected': selected,
    };

    return html` <advanced-camera-card-thumbnail
      class="${classMap(classes)}"
      .cameraManager=${this.cameraManager}
      .hass=${this.hass}
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
      @click=${(ev: Event) => clickCallback(item, ev)}
    >
    </advanced-camera-card-thumbnail>`;
  }

  protected _renderThumbnails(): TemplateResult[] {
    const upThumbnail = getUpFolderMediaItem(this.viewManagerEpoch?.manager.getView());
    const thumbnails: TemplateResult[] = [
      ...(upThumbnail
        ? [
            this._renderThumbnail(upThumbnail, false, (item: ViewItem, ev: Event) =>
              upFolderClickHandler(item, ev, this.viewManagerEpoch),
            ),
          ]
        : []),
    ];
    const view = this.viewManagerEpoch?.manager.getView();
    const selectedIndex = this._getSelectedSlide();

    for (const item of view?.queryResults?.getResults() ?? []) {
      thumbnails.push(
        this._renderThumbnail(
          item,
          selectedIndex === thumbnails.length,
          (item: ViewItem, ev: Event) => this._itemClickCallback(item, ev),
          view?.context?.mediaViewer?.seek,
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
    const direction = this._getDirection();
    if (!this._thumbnails.length || !this.config || !direction) {
      return;
    }

    return html`<advanced-camera-card-carousel
      direction=${direction}
      .selected=${this._getSelectedSlide() ?? 0}
      .dragFree=${true}
    >
      ${this._thumbnails}
    </advanced-camera-card-carousel>`;
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
