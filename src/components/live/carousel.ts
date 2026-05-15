import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import { CameraManager } from '../../camera-manager/manager.js';
import { CameraManagerCameraMetadata } from '../../camera-manager/types.js';
import { MicrophoneState } from '../../card-controller/types.js';
import { ViewManagerEpoch } from '../../card-controller/view/types.js';
import { isCallActive } from '../../components-lib/live/call.js';
import { getStreamCameraID } from '../../components-lib/live/substream.js';
import { MediaActionsController } from '../../components-lib/media-actions-controller.js';
import { MediaHeightController } from '../../components-lib/media-height-controller.js';
import { MediaLoadedInfoSinkController } from '../../components-lib/media-loaded-info-sink-controller.js';
import { PTZDragController } from '../../components-lib/ptz/drag-controller.js';
import { ZoomSettingsObserved } from '../../components-lib/zoom/types.js';
import { handleZoomSettingsObservedEvent } from '../../components-lib/zoom/zoom-view-context.js';
import {
  ptzControlsDefaults,
  PTZControlType,
} from '../../config/schema/common/controls/ptz.js';
import { TransitionEffect } from '../../config/schema/common/transition-effect.js';
import { LiveConfig } from '../../config/schema/live.js';
import { CardWideConfig, configDefaults } from '../../config/schema/types.js';
import { HomeAssistant } from '../../ha/types.js';
import liveCarouselStyle from '../../scss/live-carousel.scss';
import { stopEventFromActivatingCardWideActions } from '../../utils/action.js';
import { CarouselSelected } from '../../utils/embla/carousel-controller.js';
import { getTextDirection } from '../../utils/text-direction.js';
import { View } from '../../view/view.js';
import '../carousel';
import '../next-prev-control.js';
import '../ptz.js';
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
  public locked?: boolean;

  @property({ attribute: false })
  public viewFilterCameraID?: string;

  private _refCarousel: Ref<HTMLElement> = createRef();

  private _mediaActionsController = new MediaActionsController();
  private _mediaHeightController = new MediaHeightController(this, '.embla__slide');

  private _ptzDragController = new PTZDragController(this);

  private _mediaLoadedInfoSinkController = new MediaLoadedInfoSinkController(this, {
    getTargetID: () =>
      this.viewFilterCameraID ??
      this.viewManagerEpoch?.manager.getView()?.camera ??
      null,
    callback: () => this._mediaHeightController.recalculate(),
  });

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

  private _getDisplayPTZType(cameraID: string | null): PTZControlType {
    if (
      !cameraID ||
      // For cameras without physical PTZ, always display buttons so the user
      // can control digital zoom. Gesture type controls have no effect on those
      // cameras.
      !this.cameraManager?.getCameraCapabilities(cameraID)?.hasPTZCapability()
    ) {
      return 'buttons';
    }
    return (
      this.viewManagerEpoch?.manager.getView()?.context?.ptzControls?.type ??
      this.liveConfig?.controls.ptz.type ??
      ptzControlsDefaults.type
    );
  }

  private _isGesturesPTZActive(
    view: View | null | undefined,
    cameraID: string | null,
  ): boolean {
    // _getDisplayPTZType returns 'buttons' for digital-only cameras, so this
    // implicitly guards against cameras without physical PTZ capability.
    return (
      this._getDisplayPTZType(cameraID) === 'gestures' &&
      view?.context?.ptzControls?.enabled !== false
    );
  }

  private _getTransitionEffect = (): TransitionEffect =>
    this.liveConfig?.transition_effect ?? configDefaults.live.transition_effect;

  private _getSelectedCameraIndex(): number {
    if (this.viewFilterCameraID) {
      // If the carousel is limited to a single cameraID, the first (only)
      // element is always the selected one.
      return 0;
    }

    const cameraIDs = this.cameraManager?.getStore().getCameraIDsWithCapability('live');
    const view = this.viewManagerEpoch?.manager.getView();
    if (!cameraIDs?.size || !view?.camera) {
      return 0;
    }
    return Math.max(0, Array.from(cameraIDs).indexOf(view.camera));
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('liveConfig')) {
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
        ...(this.liveConfig && {
          microphoneMuteSeconds:
            this.liveConfig.microphone.mute_after_microphone_mute_seconds,
        }),
      });
    }
    if (changedProps.has('microphoneState') && this.microphoneState) {
      this._mediaActionsController.setMicrophoneState(this.microphoneState);
    }
    if (changedProps.has('viewManagerEpoch')) {
      this._mediaActionsController.setCallActive(
        isCallActive(this.viewManagerEpoch?.manager.getView() ?? null),
      );
    }
  }

  private _getSlides(): TemplateResult[] {
    if (!this.cameraManager) {
      return [];
    }

    const cameraIDs = this.viewFilterCameraID
      ? new Set([this.viewFilterCameraID])
      : this.cameraManager?.getStore().getCameraIDsWithCapability('live');

    const slides: TemplateResult[] = [];
    for (const cameraID of cameraIDs ?? []) {
      const slide = this._renderLive(cameraID);
      if (slide) {
        slides.push(slide);
      }
    }
    return slides;
  }

  private _setViewHandler(ev: CustomEvent<CarouselSelected>): void {
    const cameraIDs = this.cameraManager?.getStore().getCameraIDsWithCapability('live');
    if (cameraIDs?.size && ev.detail.index !== this._getSelectedCameraIndex()) {
      this._setViewCameraID([...cameraIDs][ev.detail.index]);
    }
  }

  private _setViewCameraID(cameraID?: string | null): void {
    if (cameraID) {
      this.viewManagerEpoch?.manager.setViewByParametersWithNewQuery({
        params: {
          camera: cameraID,
        },
      });
    }
  }

  private _renderLive(cameraID: string): TemplateResult | void {
    const view = this.viewManagerEpoch?.manager.getView();

    // Resolve substream INTERNALLY: the substream is a playback-layer concern
    // (which `Camera` to actually stream), invisible above the provider. The
    // base `cameraID` flows up as the targetID; the substream `Camera` flows
    // down for playback.
    const resolvedCamera = this.cameraManager
      ?.getStore()
      .getCamera(this._getSubstreamCameraID(cameraID, view));
    if (!this.liveConfig || !this.hass || !this.cameraManager || !resolvedCamera) {
      return;
    }

    const cameraMetadata = this.cameraManager.getCameraMetadata(cameraID);
    const mediaEpoch = view?.context?.mediaEpoch?.[cameraID] ?? 0;

    const isSelectedSlide = !!view?.camera && cameraID === view.camera;

    // The microphone stream is only handed to the provider — and thus only
    // transmitted on the backchannel — while a call is active, and only for
    // the selected slide.
    const microphoneStream =
      isSelectedSlide && isCallActive(view)
        ? this.microphoneState?.stream ?? null
        : null;

    return html`
      <div class="embla__slide">
        ${keyed(
          mediaEpoch,
          html`<advanced-camera-card-live-provider
            .microphoneStream=${microphoneStream}
            .camera=${resolvedCamera}
            .targetID=${cameraID}
            .label=${cameraMetadata?.title ?? ''}
            .liveConfig=${this.liveConfig}
            .hass=${this.hass}
            .cardWideConfig=${this.cardWideConfig}
            .zoomSettings=${view?.context?.zoom?.[cameraID]?.requested}
            .zoom=${!this._isGesturesPTZActive(view, cameraID)}
            .forceSelected=${isSelectedSlide}
            .locked=${this.locked}
            @advanced-camera-card:zoom:change=${(
              ev: CustomEvent<ZoomSettingsObserved>,
            ) =>
              handleZoomSettingsObservedEvent(
                ev,
                this.viewManagerEpoch?.manager,
                cameraID,
              )}
          >
          </advanced-camera-card-live-provider>`,
        )}
      </div>
    `;
  }

  private _getSubstreamCameraID(cameraID: string, view?: View | null): string {
    return view?.context?.live?.overrides?.get(cameraID) ?? cameraID;
  }

  private _getCameraNeighbors(): CameraNeighbors | null {
    const cameraIDs = this.cameraManager
      ? [...this.cameraManager?.getStore().getCameraIDsWithCapability('live')]
      : [];
    const view = this.viewManagerEpoch?.manager.getView();

    if (this.viewFilterCameraID || cameraIDs.length <= 1 || !view || !this.hass) {
      return {};
    }

    const cameraID = this.viewFilterCameraID ?? view.camera;
    if (!cameraID) {
      return {};
    }
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

  private _renderNextPrevious(
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
      ?locked=${!!this.locked}
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

    const slides = this._getSlides();
    if (!slides.length) {
      return;
    }

    const hasMultipleCameras = slides.length > 1;
    const neighbors = this._getCameraNeighbors();

    const streamAwareCameraID = getStreamCameraID(view, this.viewFilterCameraID);
    const gesturesPTZActive = this._isGesturesPTZActive(view, streamAwareCameraID);

    const forcePTZVisibility =
      !this._mediaLoadedInfoSinkController.has() ||
      (!!this.viewFilterCameraID && this.viewFilterCameraID !== view.camera) ||
      view.context?.ptzControls?.enabled === false
        ? false
        : view.context?.ptzControls?.enabled;

    const dragEnabled =
      hasMultipleCameras &&
      this.liveConfig?.draggable &&
      !gesturesPTZActive &&
      !this.locked;

    return html`
      <advanced-camera-card-carousel
        ${ref(this._refCarousel)}
        .loop=${hasMultipleCameras}
        .dragEnabled=${dragEnabled}
        .selected=${this._getSelectedCameraIndex()}
        .wheelScrolling=${this.liveConfig?.controls.wheel}
        transitionEffect=${this._getTransitionEffect()}
        @advanced-camera-card:carousel:select=${this._setViewHandler.bind(this)}
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
        .cameraID=${streamAwareCameraID}
        .forceVisibility=${forcePTZVisibility}
        .type=${this._getDisplayPTZType(streamAwareCameraID)}
      >
      </advanced-camera-card-ptz>
    `;
  }

  private _setMediaTarget(): void {
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

    const carouselEl = this._refCarousel.value;
    const view = this.viewManagerEpoch?.manager.getView();
    const streamAwareCameraID = view
      ? getStreamCameraID(view, this.viewFilterCameraID)
      : null;

    if (this._isGesturesPTZActive(view, streamAwareCameraID) && carouselEl) {
      this._ptzDragController.activateIfNecessary(carouselEl);
    } else {
      this._ptzDragController.deactivateIfNecessary();
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
