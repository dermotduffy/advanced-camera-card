import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CameraManager } from '../../camera-manager/manager.js';
import { MicrophoneManager } from '../../card-controller/microphone-manager.js';
import { MicrophoneState } from '../../card-controller/types.js';
import { ViewManagerEpoch } from '../../card-controller/view/types.js';
import { MicrophoneActionsController } from '../../components-lib/live/microphone-actions-controller.js';
import '../../components-lib/live/types.js';
import { LiveConfig } from '../../config/schema/live.js';
import { CardWideConfig } from '../../config/schema/types.js';
import { HomeAssistant } from '../../ha/types.js';
import basicBlockStyle from '../../scss/basic-block.scss';
import { contentsChanged } from '../../utils/basic.js';
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
  public microphoneManager?: MicrophoneManager;

  @property({ attribute: false })
  public microphoneState?: MicrophoneState;

  @property({ attribute: false })
  public locked?: boolean;

  @property({ attribute: false, hasChanged: contentsChanged })
  public triggeredCameraIDs?: Set<string>;

  private _microphoneActionsController = new MicrophoneActionsController();

  public connectedCallback(): void {
    super.connectedCallback();
    this._microphoneActionsController.setRoot(this);
  }

  public disconnectedCallback(): void {
    this._microphoneActionsController.destroy();
    super.disconnectedCallback();
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('liveConfig') || changedProps.has('microphoneManager')) {
      this._microphoneActionsController.setOptions({
        microphoneManager: this.microphoneManager,
        autoMuteConditions: this.liveConfig?.microphone.auto_mute,
        autoUnmuteConditions: this.liveConfig?.microphone.auto_unmute,
      });
    }
    if (changedProps.has('viewManagerEpoch')) {
      // The live element is also rendered (and this willUpdate runs) when
      // `live.preload` is true even while the user is on gallery/viewer/
      // timeline. `view.camera` is set across all views, so without this gate
      // `auto_unmute: ['selected']` would prompt for / open the microphone
      // from a hidden live view. Treat the live view as having no selected
      // camera unless it is the active view.
      const view = this.viewManagerEpoch?.manager.getView();
      this._microphoneActionsController.setSelectedCamera(
        view?.is('live') ? view.camera ?? null : null,
      );
    }
  }

  protected render(): TemplateResult | void {
    if (!this.hass || !this.cameraManager) {
      return;
    }

    return html`
      <advanced-camera-card-live-grid
        .hass=${this.hass}
        .viewManagerEpoch=${this.viewManagerEpoch}
        .liveConfig=${this.liveConfig}
        .cardWideConfig=${this.cardWideConfig}
        .cameraManager=${this.cameraManager}
        .microphoneState=${this.microphoneState}
        .locked=${this.locked}
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
