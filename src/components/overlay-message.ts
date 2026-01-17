import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import overlayMessageStyle from '../scss/overlay-message.scss';
import { OverlayMessage } from '../types.js';
import { dispatchDismissOverlayMessageEvent } from '../utils/overlay-message.js';
import './icon.js';

@customElement('advanced-camera-card-overlay-message')
export class AdvancedCameraCardOverlayMessage extends LitElement {
  @property({ attribute: false })
  public message: OverlayMessage | null = null;

  protected _refMessage: Ref<HTMLElement> = createRef();

  public connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('click', this._handleOutsideInteraction);
    window.addEventListener('focusin', this._handleOutsideInteraction);
  }

  public disconnectedCallback(): void {
    window.removeEventListener('click', this._handleOutsideInteraction);
    window.removeEventListener('focusin', this._handleOutsideInteraction);
    super.disconnectedCallback();
  }

  protected render(): TemplateResult | void {
    if (!this.message) {
      return;
    }

    return html`
      <div class="backdrop" @click=${this._dismiss}></div>
      <div
        class="message"
        ${ref(this._refMessage)}
        @animationend=${this._handleAnimationEnd}
      >
        ${this.message.icon
          ? html`<div class="icon">
              <advanced-camera-card-icon
                .icon=${{ icon: this.message.icon }}
              ></advanced-camera-card-icon>
            </div>`
          : ''}
        <div class="text">${this.message.message}</div>
        <div class="close" @click=${this._dismiss}>
          <advanced-camera-card-icon
            .icon=${{ icon: 'mdi:close' }}
          ></advanced-camera-card-icon>
        </div>
      </div>
    `;
  }

  protected _dismiss = (): void => {
    this._refMessage.value?.classList.add('exiting');
  };

  protected _handleAnimationEnd = (ev: AnimationEvent): void => {
    if (ev.animationName === 'slideDown') {
      dispatchDismissOverlayMessageEvent(this);
    }
  };

  protected _handleOutsideInteraction = (ev: Event): void => {
    if (!ev.composedPath().includes(this)) {
      this._dismiss();
    }
  };

  static get styles(): CSSResultGroup {
    return unsafeCSS(overlayMessageStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-overlay-message': AdvancedCameraCardOverlayMessage;
  }
}
