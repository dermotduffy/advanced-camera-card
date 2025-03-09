import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import throttle from 'lodash-es/throttle';
import { CameraManager, ExtendedMediaQueryResult } from '../camera-manager/manager.js';
import { EventQuery, MediaQuery, RecordingQuery } from '../camera-manager/types';
import { ViewManagerEpoch } from '../card-controller/view/types.js';
import { CardWideConfig, configDefaults, GalleryConfig } from '../config/types';
import { HomeAssistant } from '../ha/types.js';
import { localize } from '../localize/localize';
import galleryCoreStyle from '../scss/gallery-core.scss';
import galleryStyle from '../scss/gallery.scss';
import { stopEventFromActivatingCardWideActions } from '../utils/action.js';
import { errorToConsole, sleep } from '../utils/basic';
import { scrollIntoView } from '../utils/scroll.js';
import { ViewMedia } from '../view/media';
import { EventMediaQueries, RecordingMediaQueries } from '../view/media-queries';
import { MediaQueriesClassifier } from '../view/media-queries-classifier';
import { MediaQueriesResults } from '../view/media-queries-results';
import './media-filter';
import './message.js';
import { renderMessage } from './message.js';
import './progress-indicator.js';
import { renderProgressIndicator } from './progress-indicator.js';
import './surround-basic';
import './thumbnail.js';
import { THUMBNAIL_DETAILS_WIDTH_MIN } from './thumbnail.js';

const GALLERY_MEDIA_FILTER_MENU_ICONS = {
  closed: 'mdi:filter-cog-outline',
  open: 'mdi:filter-cog',
};

const MIN_GALLERY_EXTENSION_SECONDS = 0.5;

@customElement('advanced-camera-card-gallery')
export class AdvancedCameraCardGallery extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public galleryConfig?: GalleryConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    const view = this.viewManagerEpoch?.manager.getView();
    if (
      !this.hass ||
      !view?.isGalleryView() ||
      !this.cameraManager ||
      !this.cardWideConfig
    ) {
      return;
    }

    return html`
      <advanced-camera-card-surround-basic
        .drawerIcons=${{
          ...(this.galleryConfig &&
            this.galleryConfig.controls.filter.mode !== 'none' && {
              [this.galleryConfig.controls.filter.mode]: GALLERY_MEDIA_FILTER_MENU_ICONS,
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
        <advanced-camera-card-gallery-core
          .hass=${this.hass}
          .viewManagerEpoch=${this.viewManagerEpoch}
          .galleryConfig=${this.galleryConfig}
          .cameraManager=${this.cameraManager}
          .cardWideConfig=${this.cardWideConfig}
        >
        </advanced-camera-card-gallery-core>
      </advanced-camera-card-surround-basic>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(galleryStyle);
  }
}

@customElement('advanced-camera-card-gallery-core')
export class AdvancedCameraCardGalleryCore extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public galleryConfig?: GalleryConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  protected _intersectionObserver: IntersectionObserver;
  protected _resizeObserver: ResizeObserver;
  protected _refLoaderBottom: Ref<HTMLElement> = createRef();
  protected _refSelected: Ref<HTMLElement> = createRef();

  // Bottom loader: A progress indicator shown in a "cell" (not across) at the
  // bottom of the gallery. Once visible this attempts to fetch new content from
  // "earlier" (less recently) than the current query. This is rendered by
  // default (and once visible, the fetch is triggered after which it is
  // re-hidden).
  @state()
  protected _showLoaderBottom = true;

  // Top loader: A progress indicator is shown across the top of the gallery if
  // the user is _already_ at the top of the gallery and scrolls upwards. This
  // attempts to fetch new content from "later" (more recently) than the current
  // query. This is hidden by default.
  @state()
  protected _showLoaderTop = false;

  protected _media?: ViewMedia[];

  protected _boundWheelHandler = this._wheelHandler.bind(this);
  protected _boundTouchStartHandler = this._touchStartHandler.bind(this);
  protected _boundTouchEndHandler = this._touchEndHandler.bind(this);

  // Wheel / touch events may be voluminous, throttle extension calls.
  protected _throttleExtendGalleryLater = throttle(
    this._extendGallery.bind(this),
    MIN_GALLERY_EXTENSION_SECONDS * 1000,
    {
      leading: true,
      trailing: false,
    },
  );

  protected _touchScrollYPosition: number | null = null;

  constructor() {
    super();
    this._resizeObserver = new ResizeObserver(this._resizeHandler.bind(this));
    this._intersectionObserver = new IntersectionObserver(
      this._intersectionHandler.bind(this),
    );
  }

  // Since the scroll event does not fire if the user is already at the top of
  // the container, instead we manually use the wheel and touchstart/end events
  // to detect "top upwards scrolling" (to trigger an extension of the gallery).

  protected _touchStartHandler(ev: TouchEvent): void {
    // Remember the Y touch position on touch start, so that we can calculate if
    // the user gestured upwards or downards on touchend.
    if (ev.touches.length === 1) {
      this._touchScrollYPosition = ev.touches[0].screenY;
    } else {
      this._touchScrollYPosition = null;
    }
  }

  protected async _touchEndHandler(ev: TouchEvent): Promise<void> {
    if (
      !this.scrollTop &&
      ev.changedTouches.length === 1 &&
      this._touchScrollYPosition
    ) {
      if (ev.changedTouches[0].screenY > this._touchScrollYPosition) {
        await this._extendLater();
      }
    }
    this._touchScrollYPosition = null;
  }

  protected async _wheelHandler(ev: WheelEvent): Promise<void> {
    if (!this.scrollTop && ev.deltaY < 0) {
      await this._extendLater();
    }
  }

  protected async _extendLater(): Promise<void> {
    const start = new Date();
    this._showLoaderTop = true;
    await this._throttleExtendGalleryLater(
      'later',
      // Ask the engine to avoid use of cache since the user is explicitly
      // looking for the freshest possible data.
      false,
    );
    const delta = new Date().getTime() - start.getTime();
    if (delta < MIN_GALLERY_EXTENSION_SECONDS * 1000) {
      // Hidden gem: "legitimate" (?!) use of sleep() :-)
      // These calls can return very quickly even with caching disabled since
      // the time window constraints on the query will usually be very narrow
      // and the backend can thus very quickly reply. It's often so fast it
      // actually looks like a rendering issue where the progress indictor
      // barely registers before it's gone again. This optional pause ensures
      // there is at least some visual feedback to the user that last long
      // enough they can 'feel' the fetch has happened.
      await sleep(MIN_GALLERY_EXTENSION_SECONDS - delta / 1000);
    }
    this._showLoaderTop = false;
  }

  /**
   * Component connected callback.
   */
  connectedCallback(): void {
    super.connectedCallback();
    this._resizeObserver.observe(this);
    this.addEventListener('wheel', this._boundWheelHandler, { passive: true });
    this.addEventListener('touchstart', this._boundTouchStartHandler, { passive: true });
    this.addEventListener('touchend', this._boundTouchEndHandler);

    // Request update in order to ensure the intersection observer reconnects
    // with the loader sentinel.
    this.requestUpdate();
  }

  /**
   * Component disconnected callback.
   */
  disconnectedCallback(): void {
    this.removeEventListener('wheel', this._boundWheelHandler);
    this.removeEventListener('touchstart', this._boundTouchStartHandler);
    this.removeEventListener('touchend', this._boundTouchEndHandler);
    this._resizeObserver.disconnect();
    this._intersectionObserver.disconnect();
    super.disconnectedCallback();
  }

  /**
   * Set gallery columns.
   */
  protected _setColumnCount(): void {
    const thumbnailSize =
      this.galleryConfig?.controls.thumbnails.size ??
      configDefaults.media_gallery.controls.thumbnails.size;
    const columns = this.galleryConfig?.controls.thumbnails.show_details
      ? Math.max(1, Math.floor(this.clientWidth / THUMBNAIL_DETAILS_WIDTH_MIN))
      : Math.max(1, Math.ceil(this.clientWidth / thumbnailSize));

    this.style.setProperty('--advanced-camera-card-gallery-columns', String(columns));
  }

  /**
   * Handle gallery resize.
   */
  protected _resizeHandler(): void {
    this._setColumnCount();
  }

  protected async _intersectionHandler(
    entries: IntersectionObserverEntry[],
  ): Promise<void> {
    if (entries.every((entry) => !entry.isIntersecting)) {
      return;
    }

    this._showLoaderBottom = false;
    await this._extendGallery('earlier');
  }

  protected async _extendGallery(
    direction: 'earlier' | 'later',
    useCache = true,
  ): Promise<void> {
    const view = this.viewManagerEpoch?.manager.getView();

    if (!this.cameraManager || !this.hass || !view) {
      return;
    }

    const query = view.query;
    const rawQueries = query?.getQueries() ?? null;
    const existingMedia = view.queryResults?.getResults();
    if (!query || !rawQueries || !existingMedia) {
      return;
    }

    let extension: ExtendedMediaQueryResult<MediaQuery> | null;
    try {
      extension = await this.cameraManager.extendMediaQueries<MediaQuery>(
        rawQueries,
        existingMedia,
        direction,
        {
          useCache: useCache,
        },
      );
    } catch (e) {
      errorToConsole(e as Error);
      return;
    }

    if (extension) {
      const newMediaQueries = MediaQueriesClassifier.areEventQueries(query)
        ? new EventMediaQueries(extension.queries as EventQuery[])
        : MediaQueriesClassifier.areRecordingQueries(query)
          ? new RecordingMediaQueries(extension.queries as RecordingQuery[])
          : null;

      if (newMediaQueries) {
        this.viewManagerEpoch?.manager.setViewByParameters({
          baseView: view,
          params: {
            query: newMediaQueries,
            queryResults: new MediaQueriesResults({
              results: extension.results,
            }).selectResultIfFound(
              (media) => media === view.queryResults?.getSelectedResult(),
            ),
          },
        });
      }
    }
  }

  /**
   * Called when an update will occur.
   * @param changedProps The changed properties
   */
  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('galleryConfig')) {
      if (this.galleryConfig?.controls.thumbnails.show_details) {
        this.setAttribute('details', '');
      } else {
        this.removeAttribute('details');
      }
      this._setColumnCount();
      if (this.galleryConfig?.controls.thumbnails.size) {
        this.style.setProperty(
          '--advanced-camera-card-thumbnail-size',
          `${this.galleryConfig.controls.thumbnails.size}px`,
        );
      }
    }
    if (changedProps.has('viewManagerEpoch')) {
      // If the view changes, always render the bottom loader to allow for the
      // view to be extended once the bottom loader becomes visible.
      this._showLoaderBottom = true;

      const view = this.viewManagerEpoch?.manager.getView();
      const oldView = this.viewManagerEpoch?.oldView;
      if (
        !this._media ||
        oldView?.queryResults?.getResults() !== view?.queryResults?.getResults()
      ) {
        // Gallery places the most recent media at the top (the query results place
        // the most recent media at the end for use in the viewer). This is copied
        // to a new array to avoid reversing the query results in place.
        this._media = [...(view?.queryResults?.getResults() ?? [])].reverse();
      }
    }
  }

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this._media || !this.hass) {
      return html``;
    }

    const view = this.viewManagerEpoch?.manager.getView();
    if (!view?.queryResults || view.queryResults.getResultsCount() === 0) {
      // Note that this is not throwing up an error message for the card to
      // handle (as typical), but rather directly rendering the message into the
      // gallery. This is to allow the filter to still be available when a given
      // filter selection returns no media.
      const loadingMedia = !!view?.context?.loading?.query;
      return renderMessage({
        type: 'info',
        message: loadingMedia
          ? localize('error.awaiting_media')
          : localize('common.no_media'),
        icon: 'mdi:multimedia',
        dotdotdot: loadingMedia,
      });
    }

    const selected = view.queryResults.getSelectedResult();
    return html` <div class="grid">
      ${this._showLoaderTop
        ? html`${renderProgressIndicator({
            cardWideConfig: this.cardWideConfig,
            classes: {
              top: true,
            },
            size: 'small',
          })}`
        : ''}
      ${this._media.map(
        (media, index) =>
          html`<advanced-camera-card-thumbnail
            ${media === selected ? ref(this._refSelected) : ''}
            class=${classMap({
              selected: media === selected,
            })}
            .hass=${this.hass}
            .cameraManager=${this.cameraManager}
            .media=${media}
            .viewManagerEpoch=${this.viewManagerEpoch}
            ?details=${!!this.galleryConfig?.controls.thumbnails.show_details}
            ?show_favorite_control=${!!this.galleryConfig?.controls.thumbnails
              .show_favorite_control}
            ?show_timeline_control=${!!this.galleryConfig?.controls.thumbnails
              .show_timeline_control}
            ?show_download_control=${!!this.galleryConfig?.controls.thumbnails
              .show_download_control}
            @click=${(ev: Event) => {
              if (this._media) {
                this.viewManagerEpoch?.manager.setViewByParameters({
                  params: {
                    view: 'media',
                    queryResults: view.queryResults?.clone().selectIndex(
                      // Media in the gallery is reversed vs the queryResults (see
                      // note above).
                      this._media.length - index - 1,
                    ),
                  },
                });
              }
              stopEventFromActivatingCardWideActions(ev);
            }}
          >
          </advanced-camera-card-thumbnail>`,
      )}
      ${this._showLoaderBottom
        ? html`${renderProgressIndicator({
            cardWideConfig: this.cardWideConfig,
            componentRef: this._refLoaderBottom,
          })}`
        : ''}
    </div>`;
  }

  public updated(changedProps: PropertyValues): void {
    if (this._refLoaderBottom.value) {
      this._intersectionObserver.disconnect();
      this._intersectionObserver.observe(this._refLoaderBottom.value);
    }

    // This wait for updateComplete is necessary for the scrolling to work
    // correctly.
    this.updateComplete.then(() => {
      // As a special case, if the view has changed and did not previously exist
      // (i.e. first setting of it), we intentionally scroll the gallery to the
      // selected element in that view (if any).
      // See: https://github.com/dermotduffy/advanced-camera-card/issues/885
      if (
        // If this update cycle updated the view ...
        changedProps.has('viewManagerEpoch') &&
        // ... and it wasn't set at all prior ...
        !changedProps.get('viewManagerEpoch') &&
        // ... and there is a thumbnail rendered that is selected.
        this._refSelected.value
      ) {
        scrollIntoView(this._refSelected.value, {
          boundary: this,
          block: 'center',
        });
      }
    });
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(galleryCoreStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-gallery-core': AdvancedCameraCardGalleryCore;
    'advanced-camera-card-gallery': AdvancedCameraCardGallery;
  }
}
