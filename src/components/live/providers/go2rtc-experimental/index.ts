import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';

import type { Camera } from '../../../../camera-manager/camera.js';
import { Go2RTCSessionController } from '../../../../components-lib/live/providers/go2rtc-experimental/session-controller.js';
import { mapFailureReasonToIssueReason } from '../../../../components-lib/live/providers/go2rtc-experimental/utils/failure-reason.js';
import { dispatchLiveErrorEvent } from '../../../../components-lib/live/utils/dispatch-live-error.js';
import { MediaLoadedInfoSourceController } from '../../../../components-lib/media-loaded-info-source-controller.js';
import { VideoMediaPlayerController } from '../../../../components-lib/media-player/video.js';
import { SignedURLController } from '../../../../components-lib/signed-url-controller.js';
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
import { renderNotificationBlockFromText } from '../../../notification/block.js';

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

  @property({ attribute: true, type: Boolean })
  public controls = false;

  private _hasLiveError = false;

  private _refVideo: Ref<HTMLVideoElement> = createRef();

  private _mediaPlayerController = new VideoMediaPlayerController(
    this,
    () => this._refVideo.value ?? null,
    () => this.controls,
  );

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
    getMediaPlayerController: () => this._mediaPlayerController,
    getCardWideConfig: () => this.cardWideConfig ?? null,
    mediaLoadedCallback: (info) => this._mediaLoadedInfoSourceController.set(info),

    // The session could not recover the stream on its own; surface it (with the
    // failure's user-facing cause) so the card's media-load retry (reconnecting
    // indicator, backoff, give-up) runs and can name why.
    errorCallback: (reason) =>
      dispatchLiveErrorEvent(this, mapFailureReasonToIssueReason(reason)),
  });

  public async getMediaPlayerController(): Promise<MediaPlayerController | null> {
    return this._mediaPlayerController;
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
    super.disconnectedCallback();
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('camera')) {
      // The session is re-established by `updated()` once the new camera's
      // signed URL resolves.
      this._session.reset();
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
      this._mediaPlayerController.setControls(this.controls).catch(() => {});
    }

    if (changedProps.has('microphoneStream')) {
      // The WebRTC lane swaps the outbound track in place; no visible reload.
      this._session.setMicrophoneStream(this.microphoneStream ?? null);
    }
  }

  protected updated(): void {
    const video = this._refVideo.value ?? null;
    const url = this._signedURLController.getValue();
    if (video && url) {
      this._session.connect(url, video, this.camera?.getConfig()?.go2rtc?.modes);
    }
  }

  protected render(): TemplateResult | void {
    const error = this._signedURLController.getError();
    if (error) {
      return renderNotificationBlockFromText(
        localize(error === 'proxy' ? 'error.failed_proxy' : 'error.failed_sign'),
        { context: this.camera?.getConfig() },
      );
    }
    if (!this.camera?.getEndpoints()?.go2rtc) {
      return renderNotificationBlockFromText(localize('error.live_camera_no_endpoint'), {
        context: this.camera?.getConfig(),
      });
    }

    // Muted is bound as a property: Chrome ignores the `muted` content
    // attribute on videos instantiated from cloned templates (as Lit does), so
    // an attribute would not actually start the video muted. Media may be
    // unmuted later in accordance with user configuration.
    return html`<video
      ${ref(this._refVideo)}
      .muted=${true}
      playsinline
      preload="auto"
      @play=${() => dispatchMediaPlayEvent(this)}
      @pause=${() => dispatchMediaPauseEvent(this)}
      @volumechange=${() => dispatchMediaVolumeChangeEvent(this)}
    ></video>`;
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
