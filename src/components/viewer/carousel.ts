import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import { CameraManager } from '../../camera-manager/manager.js';
import { RemoveContextPropertyViewModifier } from '../../card-controller/view/modifiers/remove-context-property.js';
import { ViewManagerEpoch } from '../../card-controller/view/types.js';
import { MediaActionsController } from '../../components-lib/media-actions-controller.js';
import {
  CardWideConfig,
  frigateCardConfigDefaults,
  TransitionEffect,
  ViewerConfig,
} from '../../config/types.js';
import { localize } from '../../localize/localize.js';
import '../../patches/ha-hls-player.js';
import viewerCarouselStyle from '../../scss/viewer-carousel.scss';
import {
  ExtendedHomeAssistant,
  FrigateCardMediaPlayer,
  MediaLoadedInfo,
} from '../../types.js';
import { stopEventFromActivatingCardWideActions } from '../../utils/action.js';
import { contentsChanged, setOrRemoveAttribute } from '../../utils/basic.js';
import { CarouselSelected } from '../../utils/embla/carousel-controller.js';
import { AutoLazyLoad } from '../../utils/embla/plugins/auto-lazy-load/auto-lazy-load.js';
import AutoMediaLoadedInfo from '../../utils/embla/plugins/auto-media-loaded-info/auto-media-loaded-info.js';
import AutoSize from '../../utils/embla/plugins/auto-size/auto-size.js';
import { ResolvedMediaCache } from '../../utils/ha/resolved-media.js';
import { getTextDirection } from '../../utils/text-direction.js';
import { ViewMedia } from '../../view/media.js';
import '../carousel';
import type { EmblaCarouselPlugins } from '../carousel.js';
import { renderMessage } from '../message.js';
import '../next-prev-control.js';
import '../ptz.js';
import './provider.js';
import { FrigateCardViewerProvider } from './provider.js';

interface MediaNeighbor {
  index: number;
  media: ViewMedia;
}

interface MediaNeighbors {
  previous?: MediaNeighbor;
  next?: MediaNeighbor;
}

const FRIGATE_CARD_VIEWER_PROVIDER = 'frigate-card-viewer-provider';

@customElement('frigate-card-viewer-carousel')
export class FrigateCardViewerCarousel extends LitElement {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public viewFilterCameraID?: string;

  // Resetting the viewer configuration causes a full reset so ensure the config
  // has actually changed with a full comparison (dynamic configuration
  // overrides may causes changes elsewhere in the full card configuration that
  // could lead to the address of the viewerConfig changing without it being
  // semantically different).
  @property({ attribute: false, hasChanged: contentsChanged })
  public viewerConfig?: ViewerConfig;

  @property({ attribute: false })
  public resolvedMediaCache?: ResolvedMediaCache;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public showControls = true;

  @state()
  protected _selected = 0;

  protected _media: ViewMedia[] | null = null;
  protected _mediaActionsController = new MediaActionsController();
  protected _player: FrigateCardMediaPlayer | null = null;
  protected _refCarousel: Ref<HTMLElement> = createRef();

  updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);

    if (changedProperties.has('viewManagerEpoch')) {
      // Seek into the video if the seek time has changed (this is also called
      // on media load, since the media may or may not have been loaded at
      // this point).
      if (
        this.viewManagerEpoch?.manager.getView()?.context?.mediaViewer !==
        this.viewManagerEpoch?.oldView?.context?.mediaViewer
      ) {
        this._seekHandler();
      }
    }

    if (!this._mediaActionsController.hasRoot() && this._refCarousel.value) {
      this._mediaActionsController.initialize(this._refCarousel.value);
    }
  }

  public connectedCallback(): void {
    super.connectedCallback();

    // Request update in order to reinitialize the media action controller.
    this.requestUpdate();
  }

  public disconnectedCallback(): void {
    this._mediaActionsController.destroy();
    super.disconnectedCallback();
  }

  /**
   * Get the transition effect to use.
   * @returns An TransitionEffect object.
   */
  protected _getTransitionEffect(): TransitionEffect {
    return (
      this.viewerConfig?.transition_effect ??
      frigateCardConfigDefaults.media_viewer.transition_effect
    );
  }

  /**
   * Get the Embla plugins to use.
   * @returns A list of EmblaOptionsTypes.
   */
  protected _getPlugins(): EmblaCarouselPlugins {
    return [
      AutoLazyLoad({
        ...(this.viewerConfig?.lazy_load && {
          lazyLoadCallback: (_index, slide) => this._lazyloadSlide(slide),
        }),
      }),
      AutoMediaLoadedInfo(),
      AutoSize(),
    ];
  }

  /**
   * Get the previous and next true media items from the current view.
   * @returns A BrowseMediaNeighbors with indices and objects of true media
   * neighbors.
   */
  protected _getMediaNeighbors(): MediaNeighbors | null {
    const mediaCount = this._media?.length ?? 0;
    if (!this._media) {
      return null;
    }

    const prevIndex = this._selected > 0 ? this._selected - 1 : null;
    const nextIndex = this._selected + 1 < mediaCount ? this._selected + 1 : null;
    return {
      ...(prevIndex !== null && {
        previous: {
          index: prevIndex,
          media: this._media[prevIndex],
        },
      }),
      ...(nextIndex !== null && {
        next: {
          index: nextIndex,
          media: this._media[nextIndex],
        },
      }),
    };
  }

  protected _setViewSelectedIndex(index: number): void {
    const view = this.viewManagerEpoch?.manager.getView();

    if (!this._media || !view) {
      return;
    }

    if (this._selected === index) {
      // The slide may already be selected on load, so don't dispatch a new view
      // unless necessary (i.e. the new index is different from the current
      // index).
      return;
    }

    const newResults = view?.queryResults
      ?.clone()
      .selectIndex(index, this.viewFilterCameraID);
    if (!newResults) {
      return;
    }
    const cameraID = newResults
      .getSelectedResult(this.viewFilterCameraID)
      ?.getCameraID();

    this.viewManagerEpoch?.manager.setViewByParameters({
      params: {
        queryResults: newResults,
        // Always change the camera to the owner of the selected media.
        ...(cameraID && { camera: cameraID }),
      },
      modifiers: [new RemoveContextPropertyViewModifier('mediaViewer', 'seek')],
    });
  }

  /**
   * Lazy load a slide.
   * @param slide The slide to lazy load.
   */
  protected _lazyloadSlide(slide: Element): void {
    if (slide instanceof HTMLSlotElement) {
      slide = slide.assignedElements({ flatten: true })[0];
    }

    const viewerProvider = slide?.querySelector(
      'frigate-card-viewer-provider',
    ) as FrigateCardViewerProvider | null;
    if (viewerProvider) {
      viewerProvider.load = true;
    }
  }

  /**
   * Get slides to include in the render.
   * @returns The slides to include in the render.
   */
  protected _getSlides(): TemplateResult[] {
    if (!this._media) {
      return [];
    }

    const slides: TemplateResult[] = [];
    for (let i = 0; i < this._media.length; ++i) {
      const media = this._media[i];
      if (media) {
        const slide = this._renderMediaItem(media);
        if (slide) {
          slides[i] = slide;
        }
      }
    }
    return slides;
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('viewerConfig')) {
      this._mediaActionsController.setOptions({
        playerSelector: FRIGATE_CARD_VIEWER_PROVIDER,
        ...(this.viewerConfig?.auto_play && {
          autoPlayConditions: this.viewerConfig.auto_play,
        }),
        ...(this.viewerConfig?.auto_pause && {
          autoPauseConditions: this.viewerConfig.auto_pause,
        }),
        ...(this.viewerConfig?.auto_mute && {
          autoMuteConditions: this.viewerConfig.auto_mute,
        }),
        ...(this.viewerConfig?.auto_unmute && {
          autoUnmuteConditions: this.viewerConfig.auto_unmute,
        }),
      });
    }

    if (changedProps.has('viewManagerEpoch')) {
      const view = this.viewManagerEpoch?.manager.getView();
      const newMedia = view?.queryResults?.getResults(this.viewFilterCameraID) ?? null;
      const newSelected =
        view?.queryResults?.getSelectedIndex(this.viewFilterCameraID) ?? 0;
      const newSeek = view?.context?.mediaViewer?.seek;

      if (newMedia !== this._media || newSelected !== this._selected || !newSeek) {
        setOrRemoveAttribute(this, false, 'unseekable');
        this._media = newMedia;
        this._selected = newSelected;
      }

      if (!newMedia?.length) {
        // No media will be rendered.
        this._mediaActionsController.unsetTarget();
      } else {
        if (this.viewFilterCameraID) {
          this._mediaActionsController.setTarget(
            newSelected,
            // Camera in this carousel is only selected if the camera from the
            // view matches the filtered camera.
            view?.camera === this.viewFilterCameraID,
          );
        } else {
          // Carousel is not filtered, so the targeted camera is always selected.
          this._mediaActionsController.setTarget(newSelected, true);
        }
      }
    }
  }

  protected _renderNextPrevious(
    side: 'left' | 'right',
    neighbors?: MediaNeighbors | null,
  ): TemplateResult {
    const scroll = (direction: 'previous' | 'next'): void => {
      if (!neighbors || !this._media) {
        return;
      }
      const newIndex =
        (direction === 'previous' ? neighbors.previous?.index : neighbors.next?.index) ??
        null;
      if (newIndex !== null) {
        this._setViewSelectedIndex(newIndex);
      }
    };

    const textDirection = getTextDirection(this);
    const scrollDirection =
      (textDirection === 'ltr' && side === 'left') ||
      (textDirection === 'rtl' && side === 'right')
        ? 'previous'
        : 'next';

    return html` <frigate-card-next-previous-control
      slot=${side}
      .hass=${this.hass}
      .side=${side}
      .controlConfig=${this.viewerConfig?.controls.next_previous}
      .thumbnail=${neighbors?.[scrollDirection]?.media.getThumbnail() ?? undefined}
      .label=${neighbors?.[scrollDirection]?.media.getTitle() ?? ''}
      ?disabled=${!neighbors?.[scrollDirection]}
      @click=${(ev: Event) => {
        scroll(scrollDirection);
        stopEventFromActivatingCardWideActions(ev);
      }}
    ></frigate-card-next-previous-control>`;
  }

  protected render(): TemplateResult | void {
    const mediaCount = this._media?.length ?? 0;
    if (!this._media || !mediaCount) {
      return renderMessage({
        message: localize('common.no_media'),
        type: 'info',
        icon: 'mdi:multimedia',
        ...(this.viewFilterCameraID && {
          context: {
            camera_id: this.viewFilterCameraID,
          },
        }),
      });
    }

    // If there's no selected media, just choose the last (most recent one) to
    // avoid rendering a blank. This situation should not occur in practice, as
    // this view should not be called without a selected media.
    const selectedMedia = this._media[this._selected] ?? this._media[mediaCount - 1];

    if (!this.hass || !this.cameraManager || !selectedMedia) {
      return;
    }

    const neighbors = this._getMediaNeighbors();
    const view = this.viewManagerEpoch?.manager.getView();

    return html`
      <frigate-card-carousel
        ${ref(this._refCarousel)}
        .dragEnabled=${this.viewerConfig?.draggable ?? true}
        .plugins=${guard([this.viewerConfig, this._media], this._getPlugins.bind(this))}
        .selected=${this._selected}
        transitionEffect=${this._getTransitionEffect()}
        @frigate-card:carousel:select=${(ev: CustomEvent<CarouselSelected>) => {
          this._setViewSelectedIndex(ev.detail.index);
        }}
        @frigate-card:media:loaded=${(ev: CustomEvent<MediaLoadedInfo>) => {
          this._player = ev.detail.player ?? null;
          this._seekHandler();
        }}
        @frigate-card:media:unloaded=${() => {
          this._player = null;
        }}
      >
        ${this.showControls ? this._renderNextPrevious('left', neighbors) : ''}
        ${guard([this._media, view], () => this._getSlides())}
        ${this.showControls ? this._renderNextPrevious('right', neighbors) : ''}
      </frigate-card-carousel>
      ${view
        ? html` <frigate-card-ptz
            .config=${this.viewerConfig?.controls.ptz}
            .forceVisibility=${view?.context?.ptzControls?.enabled}
          >
          </frigate-card-ptz>`
        : ''}
      <div class="seek-warning">
        <ha-icon title="${localize('media_viewer.unseekable')}" icon="mdi:clock-remove">
        </ha-icon>
      </div>
    `;
  }

  /**
   * Fire a media show event when a slide is selected.
   */
  protected async _seekHandler(): Promise<void> {
    const view = this.viewManagerEpoch?.manager.getView();
    const seek = view?.context?.mediaViewer?.seek;
    if (!this.hass || !seek || !this._media || !this._player) {
      return;
    }
    const selectedMedia = this._media[this._selected];
    if (!selectedMedia) {
      return;
    }

    const seekTimeInMedia = selectedMedia.includesTime(seek);
    setOrRemoveAttribute(this, !seekTimeInMedia, 'unseekable');
    if (!seekTimeInMedia && !this._player.isPaused()) {
      this._player.pause();
    } else if (seekTimeInMedia && this._player.isPaused()) {
      this._player.play();
    }

    const seekTime =
      (await this.cameraManager?.getMediaSeekTime(selectedMedia, seek)) ?? null;

    if (seekTime !== null) {
      this._player.seek(seekTime);
    }
  }

  protected _renderMediaItem(media: ViewMedia): TemplateResult | null {
    const view = this.viewManagerEpoch?.manager.getView();
    if (!this.hass || !view || !this.viewerConfig) {
      return null;
    }

    return html` <div class="embla__slide">
      <frigate-card-viewer-provider
        .hass=${this.hass}
        .viewManagerEpoch=${this.viewManagerEpoch}
        .media=${media}
        .viewerConfig=${this.viewerConfig}
        .resolvedMediaCache=${this.resolvedMediaCache}
        .cameraManager=${this.cameraManager}
        .load=${!this.viewerConfig.lazy_load}
        .cardWideConfig=${this.cardWideConfig}
      ></frigate-card-viewer-provider>
    </div>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(viewerCarouselStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-viewer-carousel': FrigateCardViewerCarousel;
  }
}
