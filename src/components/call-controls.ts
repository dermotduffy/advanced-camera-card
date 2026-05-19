import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { dispatchActionExecutionRequest } from '../card-controller/actions/utils/execution-request.js';
import { MicrophoneState } from '../card-controller/types.js';
import { ActionConfig } from '../config/schema/actions/types.js';
import { localize } from '../localize/localize.js';
import callControlsStyle from '../scss/call-controls.scss';
import {
  createCallEndAction,
  createGeneralAction,
  stopEventFromActivatingCardWideActions,
} from '../utils/action.js';
import { hasPopOutAnimationEnded } from '../utils/animation.js';
import { fireAdvancedCameraCardEvent } from '../utils/fire-advanced-camera-card-event.js';

/**
 * The on-screen overlay shown during an active two-way audio call: a centered
 * pill with end-call, microphone-toggle, and mute-toggle buttons.
 *
 * This is a purely presentational control showing state and emitting intents.
 * The end-call and microphone buttons dispatch actions; the audio-out button
 * fires an `advanced-camera-card:call:mute-toggle` event for the host to act on.
 */
@customElement('advanced-camera-card-call-controls')
export class AdvancedCameraCardCallControls extends LitElement {
  // Whether a call is in progress.
  @property({ attribute: false })
  public active = false;

  @property({ attribute: false })
  public microphoneState?: MicrophoneState;

  @property({ attribute: false })
  public muted?: boolean;

  // The size, in pixels, of the control buttons.
  @property({ attribute: false })
  public buttonSize?: number;

  // True while the exit animation plays after `active` turns false.
  @state()
  private _exiting = false;

  public connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('keydown', this._handleKeyDown);
  }

  public disconnectedCallback(): void {
    window.removeEventListener('keydown', this._handleKeyDown);
    super.disconnectedCallback();
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('buttonSize') && this.buttonSize) {
      this.style.setProperty(
        '--advanced-camera-card-call-controls-button-size',
        `${this.buttonSize}px`,
      );
    }

    if (changedProps.has('active')) {
      // Keep the pill visible through its exit animation when a call ends; a
      // call (re)starting cancels any in-progress exit.
      this._exiting = !this.active && !!changedProps.get('active');
    }
  }

  protected render(): TemplateResult | void {
    if (!this.active && !this._exiting) {
      return;
    }

    const microphoneMuted = this.microphoneState?.muted ?? true;
    const audioAvailable = this.muted !== undefined;
    const audioMuted = this.muted ?? true;

    return html`<div class="overlay">
      <div
        class=${classMap({ panel: true, exiting: this._exiting })}
        @click=${(ev: Event) => stopEventFromActivatingCardWideActions(ev)}
        @animationend=${this._handleAnimationEnd}
      >
        ${this._renderButton(
          'mdi:phone-hangup',
          localize('config.live.controls.call.end'),
          {
            emphasis: 'critical',
            action: createCallEndAction(),
          },
        )}
        ${this._renderButton(
          microphoneMuted ? 'mdi:microphone-off' : 'mdi:microphone',
          microphoneMuted
            ? localize('config.live.controls.call.unmute_microphone')
            : localize('config.live.controls.call.mute_microphone'),
          {
            emphasis: microphoneMuted ? undefined : 'critical',
            action: createGeneralAction(
              microphoneMuted ? 'microphone_unmute' : 'microphone_mute',
            ),
          },
        )}
        ${this._renderButton(
          audioMuted ? 'mdi:volume-off' : 'mdi:volume-high',
          audioMuted
            ? localize('config.live.controls.call.unmute_audio')
            : localize('config.live.controls.call.mute_audio'),
          {
            disabled: !audioAvailable,
            handler: () => fireAdvancedCameraCardEvent(this, 'call:mute-toggle'),
          },
        )}
      </div>
    </div>`;
  }

  private _handleKeyDown = (ev: KeyboardEvent): void => {
    if (this.active && ev.key === 'Escape') {
      dispatchActionExecutionRequest(this, { actions: createCallEndAction() });
      ev.stopPropagation();
      ev.preventDefault();
    }
  };

  private _handleAnimationEnd = (ev: AnimationEvent): void => {
    if (hasPopOutAnimationEnded(ev)) {
      this._exiting = false;
    }
  };

  private _renderButton(
    icon: string,
    label: string,
    options?: {
      disabled?: boolean;
      emphasis?: 'critical';
      action?: ActionConfig;
      handler?: () => void;
    },
  ): TemplateResult {
    return html`
      <ha-icon-button
        .label=${label}
        title=${label}
        ?disabled=${!!options?.disabled}
        class=${options?.emphasis === 'critical' ? 'critical' : ''}
        @click=${() => {
          if (options?.handler) {
            options.handler();
          } else if (options?.action) {
            dispatchActionExecutionRequest(this, { actions: options.action });
          }
        }}
      >
        <ha-icon icon=${icon}></ha-icon>
      </ha-icon-button>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(callControlsStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-call-controls': AdvancedCameraCardCallControls;
  }
}
