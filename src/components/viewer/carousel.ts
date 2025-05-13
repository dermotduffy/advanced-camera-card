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
import { TransitionEffect } from '../../config/schema/common/transition-effect.js';
import { CardWideConfig, configDefaults } from '../../config/schema/types.js';
import { ViewerConfig } from '../../config/schema/viewer.js';
import { ResolvedMediaCache } from '../../ha/resolved-media.js';
import { HomeAssistant } from '../../ha/types.js';
import { localize } from '../../localize/localize.js';
import '../../patches/ha-hls-player.js';
import viewerCarouselStyle from '../../scss/viewer-carousel.scss';
import { MediaLoadedInfo, MediaPlayerController } from '../../types.js';
import { stopEventFromActivatingCardWideActions } from '../../utils/action.js';
import { contentsChanged, setOrRemoveAttribute } from '../../utils/basic.js';
import { CarouselSelected } from '../../utils/embla/carousel-controller.js';
import AutoMediaLoadedInfo from '../../utils/embla/plugins/auto-media-loaded-info/auto-media-loaded-info.js';
import AutoSize from '../../utils/embla/plugins/auto-size/auto-size.js';
import { getTextDirection } from '../../utils/text-direction.js';
import { ViewItemClassifier } from '../../view/item-classifier.js';
import { ViewMedia } from '../../view/item.js';
import '../carousel';
import type { EmblaCarouselPlugins } from '../carousel.js';
import { renderMessage } from '../message.js';
import '../next-prev-control.js';
import '../ptz.js';
import './provider.js';

interface MediaNeighbor {
  index: number;
  media: ViewMedia;
}

interface MediaNeighbors {
  previous?: MediaNeighbor;
  next?: MediaNeighbor;
}

const ADVANCED_CAMERA_CARD_VIEWER_PROVIDER = 'advanced-camera-card-viewer-provider';

@customElement('advanced-camera-card-viewer-carousel')
export class AdvancedCameraCardViewerCarousel extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

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
  protected _selected: number | null = null;

  protected _media: ViewMedia[] | null = null;
  protected _mediaActionsController = new MediaActionsController();
  protected _loadedMediaPlayerController: MediaPlayerController | null = null;
  protected _refCarousel: Ref<HTMLElement> = createRef();

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
      configDefaults.media_viewer.transition_effect
    );
  }

  /**
   * Get the Embla plugins to use.
   * @returns A list of EmblaOptionsTypes.
   */
  protected _getPlugins(): EmblaCarouselPlugins {
    return [AutoMediaLoadedInfo(), AutoSize()];
  }

  /**
   * Get the previous and next true media items from the current view.
   * @returns A BrowseMediaNeighbors with indices and objects of true media
   * neighbors.
   */
  protected _getMediaNeighbors(): MediaNeighbors | null {
    const mediaCount = this._media?.length ?? 0;
    if (!this._media || this._selected === null) {
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
      .selectResultIfFound((item) => item === this._media?.[index], {
        main: true,
        cameraID: this.viewFilterCameraID,
      });
    if (!newResults) {
      return;
    }

    const selectedItem = newResults.getSelectedResult(this.viewFilterCameraID);
    const cameraID = ViewItemClassifier.isMedia(selectedItem)
      ? selectedItem.getCameraID()
      : null;

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
        playerSelector: ADVANCED_CAMERA_CARD_VIEWER_PROVIDER,
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
      const newView = this.viewManagerEpoch?.manager.getView();

      if (!newView?.context?.mediaViewer?.seek) {
        setOrRemoveAttribute(this, false, 'unseekable');
      }

      const oldView = this.viewManagerEpoch?.oldView;
      const oldItems =
        oldView?.queryResults?.getResults(this.viewFilterCameraID) ?? null;
      const newItems =
        newView?.queryResults?.getResults(this.viewFilterCameraID) ?? null;
      let resetMedia = false;
      if (!this._media || oldItems !== newItems) {
        this._media =
          newItems?.filter((item) => ViewItemClassifier.isMedia(item)) ?? null;
        resetMedia = true;
      }

      const oldSelectedItem = oldView?.queryResults?.getSelectedResult(
        this.viewFilterCameraID,
      );
      const newSelectedItem = newView?.queryResults?.getSelectedResult(
        this.viewFilterCameraID,
      );

      // _selected is an index, it needs to be updated if either the selected
      // item or the media changes.
      if (oldSelectedItem !== newSelectedItem || resetMedia) {
        const newSelected =
          this._media?.findIndex((item) => item === newSelectedItem) ?? null;

        // If there's no selected item, just choose the last (most recent one) to
        // avoid rendering a blank. This could happen if the selected item was a
        // folder.
        this._selected =
          newSelected ??
          (this._media && this._media.length ? this._media.length - 1 : null);
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

    return html` <advanced-camera-card-next-previous-control
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
    ></advanced-camera-card-next-previous-control>`;
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

    if (!this.hass || !this.cameraManager || this._selected === null) {
      return;
    }

    const neighbors = this._getMediaNeighbors();
    const view = this.viewManagerEpoch?.manager.getView();

    return html`
      <advanced-camera-card-carousel
        ${ref(this._refCarousel)}
        .dragEnabled=${this.viewerConfig?.draggable ?? true}
        .plugins=${guard([this.viewerConfig, this._media], this._getPlugins.bind(this))}
        .selected=${this._selected}
        transitionEffect=${this._getTransitionEffect()}
        @advanced-camera-card:carousel:select=${(ev: CustomEvent<CarouselSelected>) => {
          this._setViewSelectedIndex(ev.detail.index);
        }}
        @advanced-camera-card:media:loaded=${(ev: CustomEvent<MediaLoadedInfo>) => {
          this._loadedMediaPlayerController = ev.detail.mediaPlayerController ?? null;
          this._seekHandler();
        }}
        @advanced-camera-card:media:unloaded=${() => {
          this._loadedMediaPlayerController = null;
        }}
      >
        ${this.showControls ? this._renderNextPrevious('left', neighbors) : ''}
        ${guard([this._media, view], () => this._getSlides())}
        ${this.showControls ? this._renderNextPrevious('right', neighbors) : ''}
      </advanced-camera-card-carousel>
      ${view
        ? html` <advanced-camera-card-ptz
            .hass=${this.hass}
            .config=${this.viewerConfig?.controls.ptz}
            .forceVisibility=${view?.context?.ptzControls?.enabled}
          >
          </advanced-camera-card-ptz>`
        : ''}
      <div class="seek-warning">
        <advanced-camera-card-icon
          title="${localize('media_viewer.unseekable')}"
          .icon=${{ icon: 'mdi:clock-remove' }}
        >
        </advanced-camera-card-icon>
      </div>
    `;
  }

  updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);

    const rootChanged = this._refCarousel.value
      ? this._mediaActionsController.setRoot(this._refCarousel.value)
      : false;

    // If the view has changed, or if the media actions controller has just been
    // initialized, then call the necessary media action.
    // See: https://github.com/dermotduffy/advanced-camera-card/issues/1626
    if (rootChanged || changedProperties.has('viewManagerEpoch')) {
      this._setMediaTarget();
    }

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
  }

  protected _setMediaTarget(): void {
    if (!this._media?.length || this._selected === null) {
      this._mediaActionsController.unsetTarget();
    } else {
      this._mediaActionsController.setTarget(
        this._selected,
        // Camera in this carousel is only selected if the camera from the view
        // matches the filtered camera.
        this.viewFilterCameraID
          ? this.viewManagerEpoch?.manager.getView()?.camera === this.viewFilterCameraID
          : true,
      );
    }
  }

  /**
   * Fire a media show event when a slide is selected.
   */
  protected async _seekHandler(): Promise<void> {
    const view = this.viewManagerEpoch?.manager.getView();
    const seek = view?.context?.mediaViewer?.seek;
    if (
      !this.hass ||
      !seek ||
      !this._media ||
      !this._loadedMediaPlayerController ||
      this._selected === null
    ) {
      return;
    }
    const selectedMedia = this._media[this._selected];
    if (!selectedMedia) {
      return;
    }

    const seekTimeInMedia = selectedMedia.includesTime(seek);
    setOrRemoveAttribute(this, !seekTimeInMedia, 'unseekable');
    if (!seekTimeInMedia && !this._loadedMediaPlayerController.isPaused()) {
      this._loadedMediaPlayerController.pause();
    } else if (seekTimeInMedia && this._loadedMediaPlayerController.isPaused()) {
      this._loadedMediaPlayerController.play();
    }

    const seekTime =
      (await this.cameraManager?.getMediaSeekTime(selectedMedia, seek)) ?? null;

    if (seekTime !== null) {
      this._loadedMediaPlayerController.seek(seekTime);
    }
  }

  protected _renderMediaItem(media: ViewMedia): TemplateResult | null {
    const view = this.viewManagerEpoch?.manager.getView();
    if (!this.hass || !view || !this.viewerConfig) {
      return null;
    }

    return html` <div class="embla__slide">
      <advanced-camera-card-viewer-provider
        .hass=${this.hass}
        .viewManagerEpoch=${this.viewManagerEpoch}
        .media=${media}
        .viewerConfig=${this.viewerConfig}
        .resolvedMediaCache=${this.resolvedMediaCache}
        .cameraManager=${this.cameraManager}
        .cardWideConfig=${this.cardWideConfig}
      ></advanced-camera-card-viewer-provider>
    </div>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(viewerCarouselStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-viewer-carousel': AdvancedCameraCardViewerCarousel;
  }
}
