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
import { CameraManagerCameraMetadata } from '../../camera-manager/types.js';
import { MicrophoneState } from '../../card-controller/types.js';
import { ViewManagerEpoch } from '../../card-controller/view/types.js';
import { MediaActionsController } from '../../components-lib/media-actions-controller.js';
import { MediaHeightController } from '../../components-lib/media-height-controller.js';
import { ZoomSettingsObserved } from '../../components-lib/zoom/types.js';
import { handleZoomSettingsObservedEvent } from '../../components-lib/zoom/zoom-view-context.js';
import { TransitionEffect } from '../../config/schema/common/transition-effect.js';
import { LiveConfig } from '../../config/schema/live.js';
import { CardWideConfig, configDefaults } from '../../config/schema/types.js';
import { HomeAssistant } from '../../ha/types.js';
import liveCarouselStyle from '../../scss/live-carousel.scss';
import { stopEventFromActivatingCardWideActions } from '../../utils/action.js';
import { CarouselSelected } from '../../utils/embla/carousel-controller.js';
import AutoMediaLoadedInfo from '../../utils/embla/plugins/auto-media-loaded-info/auto-media-loaded-info.js';
import { getStreamCameraID } from '../../utils/substream.js';
import { getTextDirection } from '../../utils/text-direction.js';
import { View } from '../../view/view.js';
import '../carousel';
import { EmblaCarouselPlugins } from '../carousel.js';
import '../next-prev-control.js';
import '../ptz.js';
import { AdvancedCameraCardPTZ } from '../ptz.js';
import './provider.js';

const ADVANCED_CAMERA_CARD_LIVE_PROVIDER = 'advanced-camera-card-live-provider';

interface CameraNeighbor {
  id: string;
  metadata?: CameraManagerCameraMetadata | null;
}

interface CameraNeighbors {
  previous?: CameraNeighbor;
  next?: CameraNeighbor;
}

@customElement('advanced-camera-card-live-carousel')
export class AdvancedCameraCardLiveCarousel extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public liveConfig?: LiveConfig;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public microphoneState?: MicrophoneState;

  @property({ attribute: false })
  public viewFilterCameraID?: string;

  // Index between camera name and slide number.
  protected _cameraToSlide: Record<string, number> = {};
  protected _refPTZControl: Ref<AdvancedCameraCardPTZ> = createRef();
  protected _refCarousel: Ref<HTMLElement> = createRef();

  protected _mediaActionsController = new MediaActionsController();
  protected _mediaHeightController = new MediaHeightController(this, '.embla__slide');

  @state()
  protected _mediaHasLoaded = false;

  public connectedCallback(): void {
    super.connectedCallback();

    this._mediaHeightController.setRoot(this.renderRoot);

    // Request update in order to reinitialize the media action controller.
    this.requestUpdate();
  }

  public disconnectedCallback(): void {
    this._mediaActionsController.destroy();
    this._mediaHeightController.destroy();
    super.disconnectedCallback();
  }

  protected _getTransitionEffect(): TransitionEffect {
    return this.liveConfig?.transition_effect ?? configDefaults.live.transition_effect;
  }

  protected _getSelectedCameraIndex(): number {
    if (this.viewFilterCameraID) {
      // If the carousel is limited to a single cameraID, the first (only)
      // element is always the selected one.
      return 0;
    }

    const cameraIDs = this.cameraManager?.getStore().getCameraIDsWithCapability('live');
    const view = this.viewManagerEpoch?.manager.getView();
    if (!cameraIDs?.size || !view) {
      return 0;
    }
    return Math.max(0, Array.from(cameraIDs).indexOf(view.camera));
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('microphoneState') || changedProps.has('liveConfig')) {
      this._mediaActionsController.setOptions({
        playerSelector: ADVANCED_CAMERA_CARD_LIVE_PROVIDER,
        ...(this.liveConfig?.auto_play && {
          autoPlayConditions: this.liveConfig.auto_play,
        }),
        ...(this.liveConfig?.auto_pause && {
          autoPauseConditions: this.liveConfig.auto_pause,
        }),
        ...(this.liveConfig?.auto_mute && {
          autoMuteConditions: this.liveConfig.auto_mute,
        }),
        ...(this.liveConfig?.auto_unmute && {
          autoUnmuteConditions: this.liveConfig.auto_unmute,
        }),
        ...((this.liveConfig?.auto_unmute || this.liveConfig?.auto_mute) && {
          microphoneState: this.microphoneState,
          microphoneMuteSeconds:
            this.liveConfig.microphone.mute_after_microphone_mute_seconds,
        }),
      });
    }
  }

  protected _getPlugins(): EmblaCarouselPlugins {
    return [AutoMediaLoadedInfo()];
  }

  /**
   * Returns the number of slides to lazily load. 0 means all slides are lazy
   * loaded, 1 means that 1 slide on each side of the currently selected slide
   * should lazy load, etc. `null` means lazy loading is disabled and everything
   * should load simultaneously.
   * @returns
   */
  protected _getLazyLoadCount(): number | null {
    // Defaults to fully-lazy loading.
    return this.liveConfig?.lazy_load === false ? null : 0;
  }

  protected _getSlides(): [TemplateResult[], Record<string, number>] {
    if (!this.cameraManager) {
      return [[], {}];
    }

    const view = this.viewManagerEpoch?.manager.getView();
    const cameraIDs = this.viewFilterCameraID
      ? new Set([this.viewFilterCameraID])
      : this.cameraManager?.getStore().getCameraIDsWithCapability('live');

    const slides: TemplateResult[] = [];
    const cameraToSlide: Record<string, number> = {};

    for (const cameraID of cameraIDs ?? []) {
      const slide = this._renderLive(this._getSubstreamCameraID(cameraID, view));
      if (slide) {
        cameraToSlide[cameraID] = slides.length;
        slides.push(slide);
      }
    }
    return [slides, cameraToSlide];
  }

  protected _setViewHandler(ev: CustomEvent<CarouselSelected>): void {
    const cameraIDs = this.cameraManager?.getStore().getCameraIDsWithCapability('live');
    if (cameraIDs?.size && ev.detail.index !== this._getSelectedCameraIndex()) {
      this._setViewCameraID([...cameraIDs][ev.detail.index]);
    }
  }

  protected _setViewCameraID(cameraID?: string | null): void {
    if (cameraID) {
      this.viewManagerEpoch?.manager.setViewByParametersWithNewQuery({
        params: {
          camera: cameraID,
        },
      });
    }
  }

  protected _renderLive(cameraID: string): TemplateResult | void {
    const camera = this.cameraManager?.getStore().getCamera(cameraID);
    if (!this.liveConfig || !this.hass || !this.cameraManager || !camera) {
      return;
    }

    const cameraMetadata = this.cameraManager.getCameraMetadata(cameraID);
    const view = this.viewManagerEpoch?.manager.getView();

    return html`
      <div class="embla__slide">
        <advanced-camera-card-live-provider
          .microphoneState=${view?.camera === cameraID
            ? this.microphoneState
            : undefined}
          .camera=${camera}
          .cameraEndpoints=${guard(
            [this.cameraManager, cameraID],
            () => this.cameraManager?.getCameraEndpoints(cameraID) ?? undefined,
          )}
          .label=${cameraMetadata?.title ?? ''}
          .liveConfig=${this.liveConfig}
          .hass=${this.hass}
          .cardWideConfig=${this.cardWideConfig}
          .zoomSettings=${view?.context?.zoom?.[cameraID]?.requested}
          @advanced-camera-card:zoom:change=${(ev: CustomEvent<ZoomSettingsObserved>) =>
            handleZoomSettingsObservedEvent(
              ev,
              this.viewManagerEpoch?.manager,
              cameraID,
            )}
        >
        </advanced-camera-card-live-provider>
      </div>
    `;
  }

  protected _getSubstreamCameraID(cameraID: string, view?: View | null): string {
    return view?.context?.live?.overrides?.get(cameraID) ?? cameraID;
  }

  protected _getCameraNeighbors(): CameraNeighbors | null {
    const cameraIDs = this.cameraManager
      ? [...this.cameraManager?.getStore().getCameraIDsWithCapability('live')]
      : [];
    const view = this.viewManagerEpoch?.manager.getView();

    if (this.viewFilterCameraID || cameraIDs.length <= 1 || !view || !this.hass) {
      return {};
    }

    const cameraID = this.viewFilterCameraID ?? view.camera;
    const currentIndex = cameraIDs.indexOf(cameraID);

    if (currentIndex < 0) {
      return {};
    }
    const prevID = cameraIDs[currentIndex > 0 ? currentIndex - 1 : cameraIDs.length - 1];
    const nextID = cameraIDs[currentIndex + 1 < cameraIDs.length ? currentIndex + 1 : 0];

    return {
      previous: {
        id: prevID,
        metadata: prevID
          ? this.cameraManager?.getCameraMetadata(
              this._getSubstreamCameraID(prevID, view),
            )
          : null,
      },
      next: {
        id: nextID,
        metadata: nextID
          ? this.cameraManager?.getCameraMetadata(
              this._getSubstreamCameraID(nextID, view),
            )
          : null,
      },
    };
  }

  protected _renderNextPrevious(
    side: 'left' | 'right',
    neighbors: CameraNeighbors | null,
  ): TemplateResult {
    const textDirection = getTextDirection(this);
    const neighbor =
      (textDirection === 'ltr' && side === 'left') ||
      (textDirection === 'rtl' && side === 'right')
        ? neighbors?.previous
        : neighbors?.next;

    return html`<advanced-camera-card-next-previous-control
      slot=${side}
      .hass=${this.hass}
      .side=${side}
      .controlConfig=${this.liveConfig?.controls.next_previous}
      .label=${neighbor?.metadata?.title ?? ''}
      .icon=${neighbor?.metadata?.icon}
      ?disabled=${!neighbor}
      @click=${(ev) => {
        this._setViewCameraID(neighbor?.id);
        stopEventFromActivatingCardWideActions(ev);
      }}
    >
    </advanced-camera-card-next-previous-control>`;
  }

  protected render(): TemplateResult | void {
    const view = this.viewManagerEpoch?.manager.getView();
    if (!this.liveConfig || !this.hass || !view || !this.cameraManager) {
      return;
    }

    const [slides, cameraToSlide] = this._getSlides();
    this._cameraToSlide = cameraToSlide;
    if (!slides.length) {
      return;
    }

    const hasMultipleCameras = slides.length > 1;
    const neighbors = this._getCameraNeighbors();

    const forcePTZVisibility =
      !this._mediaHasLoaded ||
      (!!this.viewFilterCameraID && this.viewFilterCameraID !== view.camera) ||
      view.context?.ptzControls?.enabled === false
        ? false
        : view.context?.ptzControls?.enabled;

    // Notes on the below:
    // - guard() is used to avoid reseting the carousel unless the
    //   options/plugins actually change.

    return html`
      <advanced-camera-card-carousel
        ${ref(this._refCarousel)}
        .loop=${hasMultipleCameras}
        .dragEnabled=${hasMultipleCameras && this.liveConfig?.draggable}
        .plugins=${guard(
          [this.cameraManager, this.liveConfig],
          this._getPlugins.bind(this),
        )}
        .selected=${this._getSelectedCameraIndex()}
        transitionEffect=${this._getTransitionEffect()}
        @advanced-camera-card:carousel:select=${this._setViewHandler.bind(this)}
        @advanced-camera-card:media:loaded=${() => {
          this._mediaHasLoaded = true;
        }}
        @advanced-camera-card:media:unloaded=${() => {
          this._mediaHasLoaded = false;
        }}
      >
        ${this._renderNextPrevious('left', neighbors)}
        <!-- -->
        ${slides}
        <!-- -->
        ${this._renderNextPrevious('right', neighbors)}
      </advanced-camera-card-carousel>
      <advanced-camera-card-ptz
        .hass=${this.hass}
        .config=${this.liveConfig.controls.ptz}
        .cameraManager=${this.cameraManager}
        .cameraID=${getStreamCameraID(view, this.viewFilterCameraID)}
        .forceVisibility=${forcePTZVisibility}
      >
      </advanced-camera-card-ptz>
    `;
  }

  protected _setMediaTarget(): void {
    const view = this.viewManagerEpoch?.manager.getView();
    const selectedCameraIndex = this._getSelectedCameraIndex();

    if (this.viewFilterCameraID) {
      this._mediaActionsController.setTarget(
        selectedCameraIndex,
        // Camera in this carousel is only selected if the camera from the
        // view matches the filtered camera.
        view?.camera === this.viewFilterCameraID,
      );
    } else {
      // Carousel is not filtered, so the targeted camera is always selected.
      this._mediaActionsController.setTarget(selectedCameraIndex, true);
    }

    this._mediaHeightController.setSelected(selectedCameraIndex);
  }

  public updated(changedProperties: PropertyValues): void {
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
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(liveCarouselStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-live-carousel': AdvancedCameraCardLiveCarousel;
  }
}
