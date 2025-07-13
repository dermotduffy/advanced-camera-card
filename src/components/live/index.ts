import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CameraManager } from '../../camera-manager/manager.js';
import { MicrophoneState } from '../../card-controller/types.js';
import { ViewManagerEpoch } from '../../card-controller/view/types.js';
import { LiveController } from '../../components-lib/live/live-controller.js';
import { LiveConfig } from '../../config/schema/live.js';
import { CardWideConfig } from '../../config/schema/types.js';
import { HomeAssistant } from '../../ha/types.js';
import basicBlockStyle from '../../scss/basic-block.scss';
import './grid.js';

@customElement('advanced-camera-card-live')
export class AdvancedCameraCardLive extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public liveConfig?: LiveConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: false })
  public microphoneState?: MicrophoneState;

  @property({ attribute: false })
  public triggeredCameraIDs?: Set<string>;

  protected _controller = new LiveController(this);

  protected render(): TemplateResult | void {
    if (!this.hass || !this.cameraManager) {
      return;
    }

    return html`
      <advanced-camera-card-live-grid
        .hass=${this.hass}
        .viewManagerEpoch=${this.viewManagerEpoch}
        .liveConfig=${this.liveConfig}
        .inBackground=${this._controller.isInBackground()}
        .cardWideConfig=${this.cardWideConfig}
        .cameraManager=${this.cameraManager}
        .microphoneState=${this.microphoneState}
        .triggeredCameraIDs=${this.triggeredCameraIDs}
      >
      </advanced-camera-card-live-grid>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(basicBlockStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-live': AdvancedCameraCardLive;
  }
}
