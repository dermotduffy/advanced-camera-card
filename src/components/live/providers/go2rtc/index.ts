import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { Camera } from '../../../../camera-manager/camera.js';
import { dispatchLiveErrorEvent } from '../../../../components-lib/live/utils/dispatch-live-error.js';
import { VideoMediaPlayerController } from '../../../../components-lib/media-player/video.js';
import {
  getSignedURLErrorText,
  SignedURLController,
} from '../../../../components-lib/signed-url-controller.js';
import type { HomeAssistant } from '../../../../ha/types.js';
import { localize } from '../../../../localize/localize.js';
import liveGo2RTCStyle from '../../../../scss/live-go2rtc.scss?inline';
import type { MediaPlayer, MediaPlayerController } from '../../../../types.js';
import { renderMediaNotification } from '../../../notification/media.js';
import { VideoRTC } from './video-rtc.js';

customElements.define('advanced-camera-card-live-go2rtc-player', VideoRTC);

@customElement('advanced-camera-card-live-go2rtc')
export class AdvancedCameraCardGo2RTC extends LitElement implements MediaPlayer {
  // Not a reactive property to avoid resetting the video.
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public camera?: Camera;

  // The BASE camera ID (camera property may be a substream)
  @property({ attribute: false })
  public targetID?: string;

  // The camera's title, shown in error messages to identify the camera.
  @property({ attribute: false })
  public cameraTitle?: string;

  @property({ attribute: true, type: Boolean })
  public controls = false;

  // The player and the URL it is built for.
  private _player?: VideoRTC;
  private _playerSource: string | null = null;

  private _hasLiveError = false;

  private _mediaPlayerController = new VideoMediaPlayerController(
    this,
    () => this._player?.video ?? null,
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

  public async getMediaPlayerController(): Promise<MediaPlayerController | null> {
    return this._mediaPlayerController;
  }

  disconnectedCallback(): void {
    this._destroyPlayer();
    super.disconnectedCallback();
  }

  connectedCallback(): void {
    super.connectedCallback();

    // Reset the player when reconnected to the DOM.
    // https://github.com/dermotduffy/advanced-camera-card/issues/996
    this.requestUpdate();
  }

  private _destroyPlayer(): void {
    // Tear down synchronously so backchannel-enabled streams (e.g. doorbell
    // 2-way audio) release immediately rather than waiting out
    // DISCONNECT_TIMEOUT.
    this._player?.reset();
    this._player = undefined;
    this._playerSource = null;
  }

  private _createPlayer(src: string): void {
    this._player = new VideoRTC();
    this._playerSource = src;
    this._player.targetID = this.targetID ?? null;
    this._player.mediaPlayerController = this._mediaPlayerController;
    this._player.src = src;
    this._player.visibilityCheck = false;
    this._player.setControls(this.controls);

    const cameraConfig = this.camera?.getConfig();
    if (cameraConfig?.go2rtc?.modes && cameraConfig.go2rtc.modes.length) {
      this._player.mode = cameraConfig.go2rtc.modes.join(',');
    }
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('camera')) {
      // Stop streaming the old camera immediately; `update` builds the new
      // player as soon as that camera's URL is known.
      this._destroyPlayer();
    }

    // Only treat a missing go2rtc endpoint as an error after the camera's
    // endpoints have been explicitly set (not undefined / still loading).
    const endpoints = this.camera?.getEndpoints();
    const hasError =
      !!this._signedURLController.getError() || (!!endpoints && !endpoints.go2rtc);
    if (hasError && !this._hasLiveError) {
      dispatchLiveErrorEvent(this);
    }
    this._hasLiveError = hasError;

    if (changedProps.has('controls') && this._player) {
      this._player.setControls(this.controls);
    }
  }

  // The signed URL controller announces only the URLs it resolves
  // asynchronously, so the player is built from whatever URL it currently
  // holds. Lit runs that controller's own update between `willUpdate` and
  // `update`, so this overrides the latter.
  protected update(changedProps: PropertyValues): void {
    const src = this._signedURLController.getValue();
    if (src !== this._playerSource) {
      this._destroyPlayer();
      if (src) {
        this._createPlayer(src);
      }
    }
    super.update(changedProps);
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
    return html`${this._player}`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(liveGo2RTCStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-live-go2rtc-player': VideoRTC;
    'advanced-camera-card-live-go2rtc': AdvancedCameraCardGo2RTC;
  }
}
