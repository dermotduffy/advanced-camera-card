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
import { guard } from 'lit/directives/guard.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import { Camera } from '../../camera-manager/camera.js';
import { MicrophoneState } from '../../card-controller/types.js';
import { LazyLoadController } from '../../components-lib/lazy-load-controller.js';
import { dispatchLiveErrorEvent } from '../../components-lib/live/utils/dispatch-live-error.js';
import { MediaLoadedInfoSinkController } from '../../components-lib/media-loaded-info-sink-controller.js';
import { PartialZoomSettings } from '../../components-lib/zoom/types.js';
import { LiveConfig } from '../../config/schema/live.js';
import { CardWideConfig } from '../../config/schema/types.js';
import { HomeAssistant } from '../../ha/types.js';
import { localize } from '../../localize/localize.js';
import liveProviderStyle from '../../scss/live-provider.scss';
import { MediaPlayer, MediaPlayerController, MediaPlayerElement } from '../../types.js';
import { fireAdvancedCameraCardEvent } from '../../utils/fire-advanced-camera-card-event.js';
import { getResolvedLiveProvider } from '../../utils/live-provider.js';
import '../icon.js';
import { renderNotificationBlockFromText } from '../notification/block.js';
import './../media-dimensions-container';

@customElement('advanced-camera-card-live-provider')
export class AdvancedCameraCardLiveProvider extends LitElement implements MediaPlayer {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public camera?: Camera;

  // The BASE camera ID (camera property may be a substream)
  @property({ attribute: false })
  public targetID?: string;

  @property({ attribute: false })
  public liveConfig?: LiveConfig;

  // Label that is used for ARIA support and as tooltip.
  @property({ attribute: false })
  public label = '';

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: false })
  public microphoneState?: MicrophoneState;

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

  private _mediaLoadedInfoSinkController = new MediaLoadedInfoSinkController(this, {
    getTargetID: () => this.targetID ?? null,
  });

  @state()
  private _zoomed = false;

  @state()
  private _hasProviderError = false;

  // Whether the camera entity has ever been in a non-unavailable state. Used
  // to suppress transient unavailability errors for entities that were
  // previously working (e.g. during PTZ operations).
  // See: https://github.com/dermotduffy/advanced-camera-card/issues/2124
  private _entityHasBeenAvailable = false;

  private _refProvider: Ref<MediaPlayerElement> = createRef();

  private _lazyLoadController: LazyLoadController = new LazyLoadController(this);

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
      !this._mediaLoadedInfoSinkController.has() &&
      !!this.camera?.getConfig()?.camera_entity &&
      !!this.hass &&
      !!this.liveConfig?.show_image_during_load &&
      !this._hasProviderError
    );
  }

  public disconnectedCallback(): void {
    this._entityHasBeenAvailable = false;
    super.disconnectedCallback();
  }

  private _providerErrorHandler(ev: Event): void {
    ev.stopPropagation();
    this._hasProviderError = true;

    if (this.targetID) {
      fireAdvancedCameraCardEvent(this, 'issue:trigger', {
        key: 'media_load' as const,
        targetID: this.targetID,
      });
    }
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
      this._hasProviderError = false;
      this._entityHasBeenAvailable = false;

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
      }
    }
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
      !this._lazyLoadController?.isLoaded() ||
      !this.hass ||
      !this.liveConfig ||
      !this.camera ||
      !cameraConfig
    ) {
      return;
    }

    // Set title and ariaLabel from the provided label property.
    this.title = this.label;
    this.ariaLabel = this.label;

    const provider = getResolvedLiveProvider(this.camera?.getConfig());

    if (
      provider === 'ha' ||
      provider === 'image' ||
      (cameraConfig?.camera_entity && cameraConfig.always_error_if_entity_unavailable)
    ) {
      if (!cameraConfig?.camera_entity) {
        dispatchLiveErrorEvent(this);
        return renderNotificationBlockFromText(localize('error.no_live_camera'), {
          icon: 'mdi:camera',
          context: cameraConfig,
        });
      }

      const stateObj = this.hass.states[cameraConfig.camera_entity];
      if (!stateObj) {
        dispatchLiveErrorEvent(this);
        return renderNotificationBlockFromText(localize('error.live_camera_not_found'), {
          icon: 'mdi:camera',
          context: cameraConfig,
        });
      }

      if (stateObj.state === 'unavailable') {
        if (
          !this._entityHasBeenAvailable ||
          cameraConfig.always_error_if_entity_unavailable
        ) {
          dispatchLiveErrorEvent(this);
          return renderNotificationBlockFromText(
            `${localize('error.live_camera_unavailable')}${
              this.label ? `: ${this.label}` : ''
            }`,
            { icon: 'mdi:cctv-off', in_progress: true },
          );
        }
      } else {
        this._entityHasBeenAvailable = true;
      }
    }

    const showImageDuringLoading = this._shouldShowImageDuringLoading();
    const showLoadingIcon = !this._mediaLoadedInfoSinkController.has();

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
            class=${classMap({
              ...classes,
              // The image provider is providing the temporary loading image,
              // so it should not be hidden.
              hidden: false,
            })}
            @advanced-camera-card:live:error=${(ev: Event) =>
              this._providerErrorHandler(ev)}
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
            ?controls=${this._getEffectiveBuiltinControls()}
            @advanced-camera-card:live:error=${(ev: Event) =>
              this._providerErrorHandler(ev)}
          >
          </advanced-camera-card-live-ha>`
        : provider === 'go2rtc'
          ? html`<advanced-camera-card-live-go2rtc
              ${ref(this._refProvider)}
              class=${classMap(classes)}
              .hass=${this.hass}
              .camera=${this.camera}
              .targetID=${this.targetID}
              .microphoneState=${this.microphoneState}
              .microphoneConfig=${this.liveConfig.microphone}
              ?controls=${this._getEffectiveBuiltinControls()}
              @advanced-camera-card:live:error=${(ev: Event) =>
                this._providerErrorHandler(ev)}
            >
            </advanced-camera-card-live-go2rtc>`
          : provider === 'webrtc-card'
            ? html`<advanced-camera-card-live-webrtc-card
                ${ref(this._refProvider)}
                class=${classMap(classes)}
                .hass=${this.hass}
                .camera=${this.camera}
                .targetID=${this.targetID}
                .cardWideConfig=${this.cardWideConfig}
                ?controls=${this._getEffectiveBuiltinControls()}
                @advanced-camera-card:live:error=${(ev: Event) =>
                  this._providerErrorHandler(ev)}
              >
              </advanced-camera-card-live-webrtc-card>`
            : provider === 'jsmpeg'
              ? html` <advanced-camera-card-live-jsmpeg
                  ${ref(this._refProvider)}
                  class=${classMap(classes)}
                  .hass=${this.hass}
                  .camera=${this.camera}
                  .targetID=${this.targetID}
                  .cardWideConfig=${this.cardWideConfig}
                  @advanced-camera-card:live:error=${(ev: Event) =>
                    this._providerErrorHandler(ev)}
                >
                </advanced-camera-card-live-jsmpeg>`
              : html``}
    `)}
    ${showLoadingIcon
      ? html`<advanced-camera-card-icon
          title=${localize('error.awaiting_live')}
          .icon=${{ icon: 'mdi:progress-helper' }}
          @click=${() => fireAdvancedCameraCardEvent(this, 'issue:notify', 'media_load')}
        ></advanced-camera-card-icon>`
      : ''}`;
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
