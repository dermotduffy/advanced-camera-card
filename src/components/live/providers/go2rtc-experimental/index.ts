import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';

import type { Camera } from '../../../../camera-manager/camera.js';
import {
  MEDIA_UNAVAILABLE_REASONS,
  type MediaUnavailableIssueReason,
} from '../../../../card-controller/issues/issues/media-unavailable.js';
import { ImageSurfaceController } from '../../../../components-lib/live/providers/go2rtc-experimental/image-surface-controller.js';
import {
  Go2RTCSessionController,
  type SessionSurfaces,
  type VideoSurface,
} from '../../../../components-lib/live/providers/go2rtc-experimental/session-controller.js';
import type { SurfaceKind } from '../../../../components-lib/live/providers/go2rtc-experimental/types.js';
import { mapFailureReasonToIssueReason } from '../../../../components-lib/live/providers/go2rtc-experimental/utils/failure-reason.js';
import { dispatchLiveErrorEvent } from '../../../../components-lib/live/utils/dispatch-live-error.js';
import { MediaLoadedInfoSourceController } from '../../../../components-lib/media-loaded-info-source-controller.js';
import { VideoMediaPlayerController } from '../../../../components-lib/media-player/video.js';
import {
  getSignedURLErrorText,
  SignedURLController,
} from '../../../../components-lib/signed-url-controller.js';
import type { MicrophoneConfig } from '../../../../config/schema/live.js';
import type { CardWideConfig } from '../../../../config/schema/types.js';
import type { HomeAssistant } from '../../../../ha/types.js';
import { localize } from '../../../../localize/localize.js';
import liveGo2RTCExperimentalStyle from '../../../../scss/live-go2rtc-experimental.scss';
import type { MediaPlayer, MediaPlayerController } from '../../../../types.js';
import {
  dispatchMediaPauseEvent,
  dispatchMediaPlayEvent,
  dispatchMediaVolumeChangeEvent,
} from '../../../../utils/media-info.js';
import { renderMediaNotification } from '../../../notification/media.js';

@customElement('advanced-camera-card-live-go2rtc-experimental')
export class AdvancedCameraCardGo2RTCExperimental
  extends LitElement
  implements MediaPlayer
{
  // Not a reactive property to avoid resetting the video.
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public camera?: Camera;

  // The BASE camera ID (camera property may be a substream)
  @property({ attribute: false })
  public targetID?: string;

  @property({ attribute: false })
  public microphoneStream?: MediaStream | null;

  @property({ attribute: false })
  public microphoneConfig?: MicrophoneConfig;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  // The camera's title, shown in error messages to identify the camera.
  @property({ attribute: false })
  public cameraTitle?: string;

  @property({ attribute: true, type: Boolean })
  public controls = false;

  private _hasLiveError = false;

  // ===========================================================================
  // Surface: Video
  // ===========================================================================
  private _refVideo: Ref<HTMLVideoElement> = createRef();

  private _videoMediaPlayerController = new VideoMediaPlayerController(
    this,
    () => this._refVideo.value ?? null,
    () => this.controls,
  );

  private _videoSurface: VideoSurface = {
    getElement: () => this._refVideo.value ?? null,
    getMediaPlayer: () => this._videoMediaPlayerController,
  };

  // ===========================================================================
  // Surface: Image
  // ===========================================================================

  private _refImage: Ref<HTMLImageElement> = createRef();

  // A controller rather than a plain object (unlike the video surface): the
  // image surface owns state, the object-URL lifecycle -- each frame's
  // createObjectURL and revoking the previous one.
  private _imageSurface = new ImageSurfaceController(
    this,
    () => this._refImage.value ?? null,
    {
      livenessOptions: {
        isFrameExpected: () => true,
      },
    },
  );

  // ===========================================================================
  // Surface Management
  // ===========================================================================

  // The surface currently showing committed media, or null before anything has
  // committed (both surfaces hidden). Driven by the session's
  // surfaceCommittedCallback.
  @state()
  private _activeSurface: SurfaceKind | null = null;

  @state()
  private _streamError: MediaUnavailableIssueReason | null = null;

  // Built once and kept stable: the session compares this object by identity,
  // so handing it a new one will trigger a reconnect.
  private _surfaces: SessionSurfaces = {
    video: this._videoSurface,
    image: this._imageSurface,
  };

  private _signedURLController = new SignedURLController(this, () => {
    const endpoint = this.camera?.getEndpoints()?.go2rtc;
    if (!this.hass || !endpoint) {
      return {};
    }
    return {
      hass: this.hass,
      endpoint,
      proxyConfig: this.camera?.getLiveProxyConfig(),
      proxyEndpointOptions: { websocket: true },
    };
  });

  private _mediaLoadedInfoSourceController = new MediaLoadedInfoSourceController(this, {
    getTargetID: () => this.targetID ?? null,
  });

  private _session = new Go2RTCSessionController({
    getControls: () => this.controls,
    getCardWideConfig: () => this.cardWideConfig ?? null,
    mediaLoadedCallback: (info) => this._mediaLoadedInfoSourceController.set(info),

    surfaceCommittedCallback: (surface) => {
      this._activeSurface = surface;

      // A commit means the stream recovered: drop any prior error.
      this._streamError = null;
    },

    // The session could not recover the stream on its own; surface it (with the
    // failure's user-facing cause) so the card's media-load retry (reconnecting
    // indicator, backoff, give-up) runs and can name why. The provider renders
    // the error itself (below); the event drives the liveness verdict + retry.
    errorCallback: (reason) => {
      this._streamError = mapFailureReasonToIssueReason(reason);
      dispatchLiveErrorEvent(this, { reason: this._streamError });
    },
  });

  public async getMediaPlayerController(): Promise<MediaPlayerController | null> {
    return this._activeSurface === 'image'
      ? this._imageSurface.getMediaPlayer()
      : this._videoMediaPlayerController;
  }

  connectedCallback(): void {
    super.connectedCallback();

    // Re-render (and thus re-establish the session) when reconnected to the
    // DOM. https://github.com/dermotduffy/advanced-camera-card/issues/996
    this.requestUpdate();
  }

  disconnectedCallback(): void {
    // Tear down synchronously so streams (e.g. 2-way audio backchannels)
    // release immediately.
    this._session.reset();
    this._activeSurface = null;
    super.disconnectedCallback();
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('camera')) {
      // The session is re-established by `updated()` once the new camera's
      // signed URL resolves; the next commit picks the live surface. Blank the
      // view meanwhile so the previous camera's last frame is not shown.
      this._session.reset();
      this._activeSurface = null;
      this._streamError = null;
    }

    // Only treat a missing go2rtc endpoint as an error after the camera's
    // endpoints have been explicitly set (not undefined / still loading).
    const endpoints = this.camera?.getEndpoints();
    const hasLiveError =
      !!this._signedURLController.getError() || (!!endpoints && !endpoints.go2rtc);

    if (hasLiveError && !this._hasLiveError) {
      dispatchLiveErrorEvent(this);
    }
    this._hasLiveError = hasLiveError;

    if (changedProps.has('controls')) {
      // Only the video surface has native controls; the image surface has none.
      this._videoMediaPlayerController.setControls(this.controls).catch(() => {});
    }

    if (changedProps.has('microphoneStream')) {
      // The WebRTC lane swaps the outbound track in place; no visible reload.
      this._session.setMicrophoneStream(this.microphoneStream ?? null);
    }
  }

  protected updated(): void {
    const url = this._signedURLController.getValue();
    if (url) {
      this._session.connect(
        url,
        this._surfaces,
        this.camera?.getConfig()?.go2rtc?.modes,
      );
    } else {
      // No usable URL: a signing/proxy error, or no go2rtc endpoint (which
      // includes endpoints still loading). The render omits the surfaces, so
      // drop the session -- otherwise a later URL, even an identical unsigned
      // endpoint, would be skipped by connect()'s identity check and leave the
      // session bound to the removed elements.
      this._session.reset();
      this._activeSurface = null;
    }
  }

  protected render(): TemplateResult | void {
    const error = this._signedURLController.getError();
    if (error) {
      return renderMediaNotification({
        title: getSignedURLErrorText(error),
        targetTitle: this.cameraTitle,
      });
    }
    if (!this.camera?.getEndpoints()?.go2rtc) {
      return renderMediaNotification({
        title: localize('error.configuration_error'),
        detail: localize('error.live_camera_no_endpoint'),
        targetTitle: this.cameraTitle,
      });
    }
    if (this._streamError) {
      // A stream-level failure the session gave up on: the provider must render
      // its own error (marked in-progress, since the card keeps retrying).
      return renderMediaNotification({
        icon: MEDIA_UNAVAILABLE_REASONS[this._streamError].icon,
        title: localize(MEDIA_UNAVAILABLE_REASONS[this._streamError].localizationKey),
        targetTitle: this.cameraTitle,
      });
    }

    // Both image and video surfaces are always rendered; only the committed one
    // is shown (the other, and both before anything commits, are hidden). MSE
    // and WebRTC play on the <video>; MP4 and MJPEG show frames on the <img>.
    //
    // Muted is bound as a property: Chrome ignores the `muted` content
    // attribute on videos instantiated from cloned templates (as Lit does), so
    // an attribute would not actually start the video muted. Media may be
    // unmuted later in accordance with user configuration.
    return html`
      <video
        ${ref(this._refVideo)}
        .muted=${true}
        ?hidden=${this._activeSurface !== 'video'}
        playsinline
        preload="auto"
        @play=${() => dispatchMediaPlayEvent(this)}
        @pause=${() => dispatchMediaPauseEvent(this)}
        @volumechange=${() => dispatchMediaVolumeChangeEvent(this)}
      ></video>
      <img ${ref(this._refImage)} ?hidden=${this._activeSurface !== 'image'} alt="" />
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(liveGo2RTCExperimentalStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-live-go2rtc-experimental': AdvancedCameraCardGo2RTCExperimental;
  }
}
