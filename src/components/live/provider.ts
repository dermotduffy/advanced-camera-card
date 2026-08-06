import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { guard } from 'lit/directives/guard.js';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';

import type { Camera } from '../../camera-manager/camera.js';
import type { StateWatcherSubscriptionInterface } from '../../card-controller/hass/state-watcher.js';
import { MEDIA_UNAVAILABLE_REASONS } from '../../card-controller/issues/issues/media-unavailable.js';
import { LazyLoadController } from '../../components-lib/lazy-load-controller.js';
import { isAudioIntendedOnLoad } from '../../components-lib/live/audio-intent.js';
import { StreamLivenessController } from '../../components-lib/live/liveness/stream-liveness-controller.js';
import { MediaLoadWatchdogController } from '../../components-lib/media-load-watchdog-controller.js';
import { MediaLoadedInfoSinkController } from '../../components-lib/media-loaded-info-sink-controller.js';
import type { PartialZoomSettings } from '../../components-lib/zoom/types.js';
import type { LiveConfig } from '../../config/schema/live.js';
import type { CardWideConfig } from '../../config/schema/types.js';
import type { HomeAssistant } from '../../ha/types.js';
import { localize } from '../../localize/localize.js';
import liveProviderStyle from '../../scss/live-provider.scss?inline';
import type {
  MediaPlayer,
  MediaPlayerController,
  MediaPlayerElement,
} from '../../types.js';
import { fireAdvancedCameraCardEvent } from '../../utils/fire-advanced-camera-card-event.js';
import { getResolvedLiveProvider } from '../../utils/live-provider.js';

import '../icon.js';

import { renderMediaNotification } from '../notification/media.js';

import './../media-dimensions-container';

@customElement('advanced-camera-card-live-provider')
export class AdvancedCameraCardLiveProvider extends LitElement implements MediaPlayer {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public camera?: Camera;

  @property({ attribute: false })
  public stateWatcher?: StateWatcherSubscriptionInterface;

  // The BASE camera ID (camera property may be a substream)
  @property({ attribute: false })
  public targetID?: string;

  @property({ attribute: false })
  public liveConfig?: LiveConfig;

  // The camera's title, used for ARIA support, as tooltip, and to identify the
  // camera in error messages.
  @property({ attribute: false })
  public cameraTitle?: string;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: false })
  public microphoneStream?: MediaStream | null;

  @property({ attribute: false })
  public zoomSettings?: PartialZoomSettings | null;

  @property({ attribute: false })
  public zoom = true;

  // Whether to force this slide to behave as if it is selected and
  // intersecting. Set by the carousel on its currently-selected slide so
  // `live.preload` actually warms up the active stream. See
  // `LazyLoadConfiguration.forceSelected`.
  @property({ attribute: false })
  public forceSelected = false;

  // When true the UI lock is active and the native video controls must be
  // suppressed: those controls expose pause/play/cast/etc. directly on the
  // media element.
  @property({ attribute: false })
  public locked?: boolean;

  // When true, suppress the loading snapshot (show_image_during_load). Set on a
  // media reload after a failure so the snapshot doesn't flash back in on every
  // retry; a first load still shows it.
  @property({ attribute: false })
  public suppressLoadingImage = false;

  private _mediaLoadedInfoSinkController = new MediaLoadedInfoSinkController(this, {
    getTargetID: () => this.targetID ?? null,
  });

  private _streamLivenessController = new StreamLivenessController(this, {
    getTargetID: () => this.targetID ?? null,
    getHASS: () => this.hass ?? null,
    getCamera: () => this.camera ?? null,
    getStateWatcher: () => this.stateWatcher ?? null,
  });

  @state()
  private _zoomed = false;

  private _refProvider: Ref<MediaPlayerElement> = createRef();

  private _lazyLoadController: LazyLoadController = new LazyLoadController(this);

  constructor() {
    super();

    // Watch for media that fails to load. The constructor registers it as a
    // controller on this host.
    new MediaLoadWatchdogController(this, {
      getTargetID: () => this.targetID ?? null,
      isLoadExpected: () =>
        this._shouldLoad() &&
        // Don't report media unavailable for configuration errors as retries
        // cannot possible help, and a message is already rendered.
        !this._getConfigurationError() &&
        // Specific > generic: Don't replace existing failures flagged with
        // liveness detectors.
        !this._streamLivenessController.getFailure(),
    });
  }

  // A note on dynamic imports:
  //
  // We gather the dynamic live provider import promises and do not consider the
  // update of the element complete until these imports have returned. Without
  // this behavior calls to the media methods (e.g. `mute()`) may throw if the
  // underlying code is not yet loaded.
  //
  // Test case: A card with a non-live view, but live pre-loaded, attempts to
  // call mute() when the <advanced-camera-card-live> element first renders in
  // the background. These calls fail without waiting for loading here.
  private _importPromises: Promise<unknown>[] = [];

  public async getMediaPlayerController(): Promise<MediaPlayerController | null> {
    await this.updateComplete;
    return (await this._refProvider.value?.getMediaPlayerController()) ?? null;
  }

  /**
   * Determine if a camera image should be shown in lieu of the real stream
   * whilst loading.
   * @returns`true` if an image should be shown.
   */
  private _shouldShowImageDuringLoading(): boolean {
    return (
      !this.suppressLoadingImage &&
      !this._mediaLoadedInfoSinkController.has() &&
      !!this.camera?.getConfig()?.camera_entity &&
      !!this.hass &&
      !!this.liveConfig?.show_image_during_load &&
      this._streamLivenessController.isLive()
    );
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('liveConfig') || changedProps.has('forceSelected')) {
      this._lazyLoadController.setConfiguration({
        lazyLoad: this.liveConfig?.lazy_load,
        lazyUnloadConditions: this.liveConfig?.lazy_unload,
        forceSelected: this.forceSelected,
      });
    }

    if (changedProps.has('liveConfig')) {
      if (this.liveConfig?.show_image_during_load) {
        this._importPromises.push(import('./providers/image.js'));
      }
      if (this.liveConfig?.zoomable) {
        this._importPromises.push(import('../zoomer.js'));
      }
    }

    if (changedProps.has('camera')) {
      this._streamLivenessController.reset();

      const provider = getResolvedLiveProvider(this.camera?.getConfig());
      if (provider === 'jsmpeg') {
        this._importPromises.push(import('./providers/jsmpeg.js'));
      } else if (provider === 'ha') {
        this._importPromises.push(import('./providers/ha.js'));
      } else if (provider === 'webrtc-card') {
        this._importPromises.push(import('./providers/webrtc-card.js'));
      } else if (provider === 'image') {
        this._importPromises.push(import('./providers/image.js'));
      } else if (provider === 'go2rtc') {
        this._importPromises.push(import('./providers/go2rtc/index.js'));
      } else if (provider === 'go2rtc-experimental') {
        this._importPromises.push(import('./providers/go2rtc-experimental/index.js'));
      }
    }
  }

  // Whether this provider should be loading media at all.
  private _shouldLoad(): boolean {
    return this._lazyLoadController.isLoaded();
  }

  // Returns the reason this camera cannot stream at all, or null when it can.
  private _getConfigurationError(): string | null {
    const cameraConfig = this.camera?.getConfig();
    const provider = getResolvedLiveProvider(cameraConfig);

    if (
      provider !== 'ha' &&
      provider !== 'image' &&
      !(cameraConfig?.camera_entity && cameraConfig.always_error_if_entity_unavailable)
    ) {
      return null;
    }

    if (!cameraConfig?.camera_entity) {
      return localize('error.no_live_camera');
    }
    if (!this.hass?.states[cameraConfig.camera_entity]) {
      return localize('error.live_camera_not_found');
    }
    return null;
  }

  override async getUpdateComplete(): Promise<boolean> {
    // See 'A note on dynamic imports' above for explanation of why this is
    // necessary.
    const result = await super.getUpdateComplete();
    await Promise.all(this._importPromises);
    this._importPromises = [];
    return result;
  }

  // Builtin (native) video controls require all four conditions:
  // - controls.builtin: user config enables native controls.
  // - zoom: Whether digital zoom/panning is allowed (this will be false when a
  //   'gesture' type PTZ control is active).
  // - !_zoomed: the user has not actually digital zoomed in (when zoomed, we
  //   want to hide the controls).
  // - !locked: the UI lock is not active.
  private _getEffectiveBuiltinControls(): boolean {
    return (
      !!this.liveConfig?.controls.builtin && this.zoom && !this._zoomed && !this.locked
    );
  }

  private _renderContainer(template: TemplateResult): TemplateResult {
    const config = this.camera?.getConfig();
    const intermediateTemplate = html` <advanced-camera-card-media-dimensions-container
      .dimensionsConfig=${config?.dimensions}
    >
      ${template}
    </advanced-camera-card-media-dimensions-container>`;

    return html` ${this.liveConfig?.zoomable
      ? html` <advanced-camera-card-zoomer
          .defaultSettings=${guard([config?.dimensions?.layout], () =>
            config?.dimensions?.layout
              ? {
                  pan: config.dimensions.layout.pan,
                  zoom: config.dimensions.layout.zoom,
                }
              : undefined,
          )}
          .settings=${this.zoomSettings}
          .zoom=${this.zoom}
          @advanced-camera-card:zoom:zoomed=${() => (this._zoomed = true)}
          @advanced-camera-card:zoom:unzoomed=${() => (this._zoomed = false)}
        >
          ${intermediateTemplate}
        </advanced-camera-card-zoomer>`
      : intermediateTemplate}`;
  }

  protected render(): TemplateResult | void {
    const cameraConfig = this.camera?.getConfig();
    if (
      !this._shouldLoad() ||
      !this.hass ||
      !this.liveConfig ||
      !this.camera ||
      !cameraConfig
    ) {
      return;
    }

    // If a card *re*-initializes (e.g. was already initialized and then there's
    // a use of the editor to change the config), cameras will re-initialize in
    // place, which means they might be asked to render (here) whilst not yet
    // being initialized. This can cause spurious errors (e.g. lack of resolved
    // endpoints). Instead, simply never render uninitialized cameras.
    if (!this.camera.isInitialized()) {
      return renderMediaNotification({
        icon: 'mdi:progress-helper',
        title: localize('error.awaiting_live'),
        targetTitle: this.cameraTitle,
      });
    }

    // Set title and ariaLabel from the provided label property.
    this.title = this.cameraTitle ?? '';
    this.ariaLabel = this.cameraTitle ?? '';

    const provider = getResolvedLiveProvider(this.camera?.getConfig());

    const configurationError = this._getConfigurationError();
    if (configurationError) {
      return renderMediaNotification({
        icon: 'mdi:camera',
        title: localize('error.configuration_error'),
        detail: configurationError,
        targetTitle: this.cameraTitle,
      });
    }

    const failure = this._streamLivenessController.getFailure();

    // A detector reports the stream is silently lost (the camera entity is
    // unavailable, or the stream stalled): render a reconnecting placeholder,
    // which unmounts the provider and unloads it via the existing media-loaded
    // abort. The message names the specific cause.
    if (failure?.renderPlaceholder) {
      const { localizationKey: textKey, icon } =
        MEDIA_UNAVAILABLE_REASONS[failure.reason];
      return renderMediaNotification({
        icon,
        title: localize(textKey),
        targetTitle: this.cameraTitle,
      });
    }

    const showImageDuringLoading = this._shouldShowImageDuringLoading();
    const mediaLoaded = this._mediaLoadedInfoSinkController.has();

    // Loaded media or a snapshot gives the frame a size; mark the host `sized`
    // when one is present. In its absence CSS reserves an aspect ratio so the
    // frame (whose loading/error fill is absolutely positioned) doesn't
    // collapse.
    this.toggleAttribute('sized', mediaLoaded || showImageDuringLoading);

    const classes = {
      hidden: showImageDuringLoading,
    };

    return html`${this._renderContainer(html`
      ${showImageDuringLoading || provider === 'image'
        ? html` <advanced-camera-card-live-image
            ${ref(this._refProvider)}
            .hass=${this.hass}
            .camera=${this.camera}
            .targetID=${this.targetID}
            .cameraTitle=${this.cameraTitle}
            class=${classMap({
              ...classes,
              // The image provider is providing the temporary loading image,
              // so it should not be hidden.
              hidden: false,
            })}
            @advanced-camera-card:media:loaded=${(ev: Event) => {
              // When the image is rendered as a placeholder behind another
              // provider, suppress its load event so it doesn't reach the
              // card-root listener and clobber the real provider's
              // registration. The real provider's load event will arrive
              // afterwards.
              if (provider !== 'image') {
                ev.stopPropagation();
              }
            }}
          >
          </advanced-camera-card-live-image>`
        : html``}
      ${provider === 'ha'
        ? html` <advanced-camera-card-live-ha
            ${ref(this._refProvider)}
            class=${classMap(classes)}
            .hass=${this.hass}
            .camera=${this.camera}
            .targetID=${this.targetID}
            .preferAudioStream=${this.forceSelected &&
            isAudioIntendedOnLoad(this.liveConfig?.auto_unmute ?? [])}
            ?controls=${this._getEffectiveBuiltinControls()}
          >
          </advanced-camera-card-live-ha>`
        : provider === 'go2rtc'
          ? html`<advanced-camera-card-live-go2rtc
              ${ref(this._refProvider)}
              class=${classMap(classes)}
              .hass=${this.hass}
              .camera=${this.camera}
              .targetID=${this.targetID}
              .cameraTitle=${this.cameraTitle}
              .microphoneStream=${this.microphoneStream}
              .microphoneConfig=${this.liveConfig.microphone}
              ?controls=${this._getEffectiveBuiltinControls()}
            >
            </advanced-camera-card-live-go2rtc>`
          : provider === 'go2rtc-experimental'
            ? html`<advanced-camera-card-live-go2rtc-experimental
                ${ref(this._refProvider)}
                class=${classMap(classes)}
                .hass=${this.hass}
                .camera=${this.camera}
                .targetID=${this.targetID}
                .cameraTitle=${this.cameraTitle}
                .microphoneStream=${this.microphoneStream}
                .microphoneConfig=${this.liveConfig.microphone}
                .cardWideConfig=${this.cardWideConfig}
                ?controls=${this._getEffectiveBuiltinControls()}
              >
              </advanced-camera-card-live-go2rtc-experimental>`
            : provider === 'webrtc-card'
              ? html`<advanced-camera-card-live-webrtc-card
                  ${ref(this._refProvider)}
                  class=${classMap(classes)}
                  .hass=${this.hass}
                  .camera=${this.camera}
                  .targetID=${this.targetID}
                  .cameraTitle=${this.cameraTitle}
                  .cardWideConfig=${this.cardWideConfig}
                  ?controls=${this._getEffectiveBuiltinControls()}
                >
                </advanced-camera-card-live-webrtc-card>`
              : provider === 'jsmpeg'
                ? html` <advanced-camera-card-live-jsmpeg
                    ${ref(this._refProvider)}
                    class=${classMap(classes)}
                    .hass=${this.hass}
                    .camera=${this.camera}
                    .targetID=${this.targetID}
                    .cameraTitle=${this.cameraTitle}
                    .cardWideConfig=${this.cardWideConfig}
                  >
                  </advanced-camera-card-live-jsmpeg>`
                : html``}
    `)}
    ${failure || mediaLoaded ? '' : this._renderLoadingOverlay(showImageDuringLoading)}`;
  }

  // The loading status drawn on top of the mounted provider while its media has
  // not loaded: a subtle corner spinner over a snapshot that is already filling
  // the frame, or a full "waiting for live" state. The cases that render nothing
  // (a failure, or media already loaded) are handled at the call site.
  private _renderLoadingOverlay(showImageDuringLoading: boolean): TemplateResult {
    if (showImageDuringLoading) {
      return html`<advanced-camera-card-icon
        title=${localize('error.awaiting_live')}
        .icon=${{ icon: 'mdi:progress-helper' }}
        @click=${() =>
          fireAdvancedCameraCardEvent(this, 'issue:notify', 'media_unavailable')}
      ></advanced-camera-card-icon>`;
    }

    return html`<div class="fill">
      ${renderMediaNotification({
        icon: 'mdi:progress-helper',
        title: localize('error.awaiting_live'),
        targetTitle: this.cameraTitle,
      })}
    </div>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(liveProviderStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-live-provider': AdvancedCameraCardLiveProvider;
  }
}
