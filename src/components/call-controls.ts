import { CSSResultGroup, LitElement, TemplateResult, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { dispatchActionExecutionRequest } from '../card-controller/actions/utils/execution-request.js';
import { CallSessionState } from '../card-controller/call-manager.js';
import { MicrophoneState } from '../card-controller/types.js';
import { CardWideConfig } from '../config/schema/types.js';
import { localize } from '../localize/localize.js';
import { MediaLoadedInfo } from '../types.js';
import { createGeneralAction } from '../utils/action.js';
import { renderProgressIndicator } from './progress-indicator.js';

@customElement('advanced-camera-card-call-controls')
export class AdvancedCameraCardCallControls extends LitElement {
  @property({ attribute: false })
  public callState?: CallSessionState;

  @property({ attribute: false })
  public microphoneState?: MicrophoneState;

  @property({ attribute: false })
  public mediaLoadedInfo?: MediaLoadedInfo | null;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig | null;

  protected _dispatchAction(action: ReturnType<typeof createGeneralAction>): void {
    dispatchActionExecutionRequest(this, { actions: action });
  }

  protected async _toggleSpeaker(): Promise<void> {
    const mediaPlayerController = this.mediaLoadedInfo?.mediaPlayerController;
    if (!mediaPlayerController) {
      return;
    }

    if (mediaPlayerController.isMuted()) {
      await mediaPlayerController.unmute();
    } else {
      await mediaPlayerController.mute();
    }
    this.requestUpdate();
  }

  protected _renderActionButton(options: {
    action: ReturnType<typeof createGeneralAction>;
    icon: string;
    label: string;
    disabled?: boolean;
    emphasis?: 'critical';
    handler?: () => void | Promise<void>;
  }): TemplateResult {
    return html`
      <ha-icon-button
        .label=${options.label}
        title=${options.label}
        ?disabled=${!!options.disabled}
        class=${options.emphasis === 'critical' ? 'critical' : ''}
        @click=${() =>
          options.handler ? options.handler() : this._dispatchAction(options.action)}
      >
        <ha-icon icon=${options.icon}></ha-icon>
      </ha-icon-button>
    `;
  }

  protected render(): TemplateResult | void {
    if (!this.callState || this.callState.state === 'idle') {
      return;
    }

    if (this.callState.state === 'connecting_call') {
      return html`<div class="overlay">
        <div class="panel loading">
          ${renderProgressIndicator({
            message: localize('call.connecting'),
            cardWideConfig: this.cardWideConfig,
            size: 'small',
          })}
          ${this._renderActionButton({
            action: createGeneralAction('call_end'),
            icon: 'mdi:phone-hangup',
            label: localize('call.end'),
            emphasis: 'critical',
          })}
        </div>
      </div>`;
    }

    if (this.callState.state === 'ending_call') {
      return html`<div class="overlay">
        <div class="panel loading">
          ${renderProgressIndicator({
            message: localize('call.ending'),
            cardWideConfig: this.cardWideConfig,
            size: 'small',
          })}
        </div>
      </div>`;
    }

    const microphoneMuted = this.microphoneState?.muted ?? true;
    const speakerMuted = this.mediaLoadedInfo?.mediaPlayerController?.isMuted() ?? true;
    const hasSpeaker = !!this.mediaLoadedInfo?.mediaPlayerController;

    return html`<div class="overlay">
      <div class="panel controls">
        <span class="title">${localize('call.active')}</span>
        <div class="buttons">
          ${this._renderActionButton({
            action: createGeneralAction('call_end'),
            icon: 'mdi:phone-hangup',
            label: localize('call.end'),
            emphasis: 'critical',
          })}
          ${this._renderActionButton({
            action: createGeneralAction(
              microphoneMuted ? 'microphone_unmute' : 'microphone_mute',
            ),
            icon: microphoneMuted ? 'mdi:microphone-off' : 'mdi:microphone',
            label: microphoneMuted
              ? localize('call.unmute_microphone')
              : localize('call.mute_microphone'),
          })}
          ${this._renderActionButton({
            action: createGeneralAction('none'),
            icon: speakerMuted ? 'mdi:volume-off' : 'mdi:volume-high',
            label: speakerMuted
              ? localize('call.unmute_speaker')
              : localize('call.mute_speaker'),
            disabled: !hasSpeaker,
            handler: this._toggleSpeaker.bind(this),
          })}
        </div>
      </div>
    </div>`;
  }

  static get styles(): CSSResultGroup {
    return css`
      :host {
        position: absolute;
        inset-inline: 0;
        bottom: 16px;
        display: block;
        pointer-events: none;
        z-index: 20;
      }

      .overlay {
        display: flex;
        justify-content: center;
        padding: 0 16px;
      }

      .panel {
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 56px;
        padding: 10px 14px;
        border-radius: 999px;
        background: color-mix(
          in srgb,
          var(--card-background-color, black) 85%,
          transparent
        );
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
        backdrop-filter: blur(10px);
      }

      .panel.controls {
        flex-wrap: nowrap;
      }

      .loading {
        justify-content: center;
      }

      .title {
        font-size: 0.95rem;
        font-weight: 600;
        padding-inline-end: 4px;
        white-space: nowrap;
      }

      .buttons {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
      }

      ha-icon-button {
        color: var(--primary-text-color);
        background: rgba(255, 255, 255, 0.08);
        border-radius: 999px;
      }

      ha-icon-button.critical {
        color: var(--error-color, #db4437);
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-call-controls': AdvancedCameraCardCallControls;
  }
}
