import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResultGroup,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';

import type { Camera } from '../../../camera-manager/camera.js';
import { HAStreamMuteController } from '../../../components-lib/live/ha-stream-mute-controller.js';
import type { HomeAssistant } from '../../../ha/types';

import '../../../patches/ha-camera-stream';
import '../../../patches/ha-hls-player.js';
import '../../../patches/ha-web-rtc-player.js';

import liveHAStyle from '../../../scss/live-ha.scss?inline';
import type {
  MediaPlayer,
  MediaPlayerController,
  MediaPlayerElement,
} from '../../../types.js';

@customElement('advanced-camera-card-live-ha')
export class AdvancedCameraCardLiveHA extends LitElement implements MediaPlayer {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public camera?: Camera;

  // The BASE camera ID (camera property may be a substream)
  @property({ attribute: false })
  public targetID?: string;

  @property({ attribute: true, type: Boolean })
  public controls = false;

  @property({ attribute: false })
  public preferAudioStream = false;

  private _playerRef: Ref<MediaPlayerElement> = createRef();

  // Owns the mute state for the underlying ha-camera-stream: it feeds `muted`
  // (which is surprisingly used by HA to select WebRTC vs HLS streams) and
  // `outputMute` (the actual player's audio output) into the element, seeded
  // from the audio intent.
  private _muteController = new HAStreamMuteController(this, {
    getCameraEntityID: () => this.camera?.getConfig()?.camera_entity ?? null,
    getPreferAudioStream: () => this.preferAudioStream,
  });

  public async getMediaPlayerController(): Promise<MediaPlayerController | null> {
    await this.updateComplete;
    return (await this._playerRef.value?.getMediaPlayerController()) ?? null;
  }

  protected render(): TemplateResult | void {
    if (!this.hass) {
      return;
    }

    const cameraEntity = this.camera?.getConfig()?.camera_entity;
    return html` <advanced-camera-card-ha-camera-stream
      ${ref(this._playerRef)}
      .hass=${this.hass}
      .stateObj=${cameraEntity ? this.hass.states[cameraEntity] : undefined}
      .controls=${this.controls}
      .targetID=${this.targetID}
      .muted=${this._muteController.getIntendedMute()}
      .outputMute=${this._muteController.getOutputMute()}
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
