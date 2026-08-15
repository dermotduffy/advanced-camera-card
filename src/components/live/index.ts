import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { CameraManager } from '../../camera-manager/manager.js';
import type { CallSession } from '../../card-controller/call/types.js';
import type { StateWatcherSubscriptionInterface } from '../../card-controller/hass/state-watcher.js';
import type { MicrophoneManager } from '../../card-controller/microphone-manager.js';
import type { MicrophoneState } from '../../card-controller/types.js';
import type { ViewManagerEpoch } from '../../card-controller/view/types.js';
import { MicrophoneActionsController } from '../../components-lib/live/microphone-actions-controller.js';

import '../../components-lib/live/types.js';

import type { LiveConfig } from '../../config/schema/live.js';
import type { CardWideConfig } from '../../config/schema/types.js';
import type { HomeAssistant } from '../../ha/types.js';
import basicBlockStyle from '../../scss/basic-block.scss?inline';
import { contentsChanged } from '../../utils/basic.js';

import './grid.js';

@customElement('advanced-camera-card-live')
export class AdvancedCameraCardLive extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public stateWatcher?: StateWatcherSubscriptionInterface;

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
  public call?: CallSession;

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
    if (changedProps.has('call')) {
      this._microphoneActionsController.setCall(this.call).catch(() => {});
    }
  }

  protected render(): TemplateResult | void {
    if (!this.hass || !this.cameraManager) {
      return;
    }

    return html`
      <advanced-camera-card-live-grid
        .hass=${this.hass}
        .stateWatcher=${this.stateWatcher}
        .viewManagerEpoch=${this.viewManagerEpoch}
        .liveConfig=${this.liveConfig}
        .cardWideConfig=${this.cardWideConfig}
        .cameraManager=${this.cameraManager}
        .microphoneState=${this.microphoneState}
        .call=${this.call}
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
