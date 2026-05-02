import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { Camera } from '../../../camera-manager/camera.js';
import { HomeAssistant } from '../../../ha/types';
import basicBlockStyle from '../../../scss/basic-block.scss';
import {
  MediaPlayer,
  MediaPlayerController,
  MediaPlayerElement,
} from '../../../types.js';
import '../../image-updating-player.js';

@customElement('advanced-camera-card-live-image')
export class AdvancedCameraCardLiveImage extends LitElement implements MediaPlayer {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public camera?: Camera;

  // The BASE camera ID (camera property may be a substream)
  @property({ attribute: false })
  public targetID?: string;

  private _refImage: Ref<MediaPlayerElement> = createRef();

  public async getMediaPlayerController(): Promise<MediaPlayerController | null> {
    await this.updateComplete;
    return (await this._refImage.value?.getMediaPlayerController()) ?? null;
  }

  protected render(): TemplateResult | void {
    const cameraConfig = this.camera?.getConfig();
    if (!this.hass || !cameraConfig) {
      return;
    }

    return html`
      <advanced-camera-card-image-updating-player
        ${ref(this._refImage)}
        .hass=${this.hass}
        .imageConfig=${cameraConfig.image}
        .cameraConfig=${cameraConfig}
        .targetID=${this.targetID}
        .proxyConfig=${this.camera?.getLiveProxyConfig()}
      >
      </advanced-camera-card-image-updating-player>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(basicBlockStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-live-image': AdvancedCameraCardLiveImage;
  }
}
