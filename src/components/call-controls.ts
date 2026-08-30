import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import { dispatchActionExecutionRequest } from '../card-controller/actions/utils/execution-request.js';
import type { MicrophoneState } from '../card-controller/types.js';
import type { ActionConfig } from '../config/schema/actions/types.js';
import { localize } from '../localize/localize.js';
import callControlsStyle from '../scss/call-controls.scss?inline';
import {
  createCallAnswerAction,
  createCallEndAction,
  createGeneralAction,
  stopEventFromActivatingCardWideActions,
} from '../utils/action.js';
import { hasPopOutAnimationEnded } from '../utils/animation.js';
import { fireAdvancedCameraCardEvent } from '../utils/fire-advanced-camera-card-event.js';

import './icon.js';

/**
 * The on-screen overlay shown during a two-way audio call: a centered pill
 * whose contents depend on call state. Pre-answer (inbound ringing) shows
 * reject + answer; post-answer (or outbound) shows end-call + microphone
 * toggle + audio-out toggle.
 *
 * This is a purely presentational control showing state and emitting intents.
 * Button taps dispatch actions; the audio-out button fires an
 * `advanced-camera-card:call:mute-toggle` event for the host to act on.
 */
@customElement('advanced-camera-card-call-controls')
export class AdvancedCameraCardCallControls extends LitElement {
  // Whether a call exists on this carousel's camera, in either the unanswered
  // or answered state. Drives whether the overlay renders at all.
  @property({ attribute: false })
  public active = false;

  // Whether that call has been answered. Selects between the pre-answer (reject
  // + answer) and post-answer (end + mic + audio) button sets.
  @property({ attribute: false })
  public answered = true;

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

  // Tracks which controls are rendered. Synced from `answered` only while
  // the controls are actually showing (`active`), so it keeps its last value
  // through the exit animation (as the parent's `answered` prop may otherwise
  // change mid-exit when the call session disappears).
  @state()
  private _type: 'answered' | 'unanswered' = 'answered';

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

    // Only mirror `answered` while the pill is actually showing: this leaves
    // `_type` frozen through the exit animation, so the outgoing pill keeps the
    // same button set it had pre-exit even if the parent's `answered` prop
    // changes after the call session disappears.
    if (this.active) {
      this._type = this.answered ? 'answered' : 'unanswered';
    }
  }

  protected render(): TemplateResult | void {
    if (!this.active && !this._exiting) {
      return;
    }

    return html`<div class="overlay">
      <div
        class=${classMap({ panel: true, exiting: this._exiting })}
        @click=${(ev: Event) => stopEventFromActivatingCardWideActions(ev)}
        @animationend=${this._handleAnimationEnd}
      >
        ${this._type === 'answered'
          ? this._renderPostAnswerButtons()
          : this._renderPreAnswerButtons()}
      </div>
    </div>`;
  }

  private _renderPreAnswerButtons(): TemplateResult {
    return html`
      <div class="buttons">
        ${this._renderButton(
          'mdi:phone-hangup',
          localize('config.live.controls.call.reject'),
          {
            emphasis: 'negative',
            action: createCallEndAction(),
          },
        )}
        ${this._renderButton('mdi:phone', localize('config.live.controls.call.answer'), {
          emphasis: 'positive',
          action: createCallAnswerAction(),
        })}
      </div>
    `;
  }

  private _renderPostAnswerButtons(): TemplateResult {
    const microphoneMuted = this.microphoneState?.muted ?? true;
    const audioAvailable = this.muted !== undefined;
    const audioMuted = this.muted ?? true;

    return html`
      <div class="buttons">
        ${this._renderButton(
          'mdi:phone-hangup',
          localize('config.live.controls.call.end'),
          {
            emphasis: 'negative',
            action: createCallEndAction(),
          },
        )}
        ${this._renderButton(
          microphoneMuted ? 'mdi:microphone-off' : 'mdi:microphone',
          microphoneMuted
            ? localize('config.live.controls.call.unmute_microphone')
            : localize('config.live.controls.call.mute_microphone'),
          {
            emphasis: microphoneMuted ? undefined : 'negative',
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
    `;
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
      emphasis?: 'negative' | 'positive';
      action?: ActionConfig;
      handler?: () => void;
    },
  ): TemplateResult {
    return html`
      <ha-icon-button
        .label=${label}
        title=${label}
        ?disabled=${!!options?.disabled}
        class=${options?.emphasis ?? ''}
        @click=${() => {
          if (options?.handler) {
            options.handler();
          } else if (options?.action) {
            dispatchActionExecutionRequest(this, { actions: options.action });
          }
        }}
      >
        <advanced-camera-card-icon .icon=${{ icon }}></advanced-camera-card-icon>
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
