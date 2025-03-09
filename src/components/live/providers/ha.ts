import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import { CameraConfig } from '../../../config/types';
import { HomeAssistant } from '../../../ha/types';
import '../../../patches/ha-camera-stream';
import '../../../patches/ha-hls-player.js';
import '../../../patches/ha-web-rtc-player.js';
import liveHAStyle from '../../../scss/live-ha.scss';
import {
  MediaPlayer,
  MediaPlayerController,
  MediaPlayerElement,
} from '../../../types.js';

@customElement('advanced-camera-card-live-ha')
export class AdvancedCameraCardLiveHA extends LitElement implements MediaPlayer {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  @property({ attribute: true, type: Boolean })
  public controls = false;

  protected _playerRef: Ref<MediaPlayerElement> = createRef();

  public async getMediaPlayerController(): Promise<MediaPlayerController | null> {
    await this.updateComplete;
    return (await this._playerRef.value?.getMediaPlayerController()) ?? null;
  }

  protected render(): TemplateResult | void {
    if (!this.hass) {
      return;
    }

    return html` <advanced-camera-card-ha-camera-stream
      ${ref(this._playerRef)}
      .hass=${this.hass}
      .stateObj=${this.cameraConfig?.camera_entity
        ? this.hass.states[this.cameraConfig.camera_entity]
        : undefined}
      .controls=${this.controls}
      .muted=${true}
    >
    </advanced-camera-card-ha-camera-stream>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(liveHAStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-live-ha': AdvancedCameraCardLiveHA;
  }
}
