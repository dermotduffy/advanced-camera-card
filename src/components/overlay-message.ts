import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import overlayMessageStyle from '../scss/overlay-message.scss';
import { MetadataField, OverlayMessage, OverlayMessageControl } from '../types.js';
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

    const heading = this.message.heading;
    const details = this.message.details ?? [];
    const text = this.message.text;
    const controls = this.message.controls ?? [];

    return html`
      <div class="backdrop" @click=${this._dismiss}></div>
      <div
        class="message"
        ${ref(this._refMessage)}
        @animationend=${this._handleAnimationEnd}
      >
        <div class="details">
          ${heading ? this._renderDetail(heading, true) : ''}
          ${details.map((detail) => this._renderDetail(detail))}
          ${text ? html`<div class="description">${text}</div>` : ''}
        </div>
        ${controls.length
          ? html`<div class="controls">
              ${controls.map((control) => this._renderControl(control))}
            </div>`
          : ''}
        <div class="close" @click=${this._dismiss}>
          <advanced-camera-card-icon
            .icon=${{ icon: 'mdi:close' }}
          ></advanced-camera-card-icon>
        </div>
      </div>
    `;
  }

  protected _renderControl(control: OverlayMessageControl): TemplateResult {
    const emphasisClass = control.emphasis ? `emphasis-${control.emphasis}` : '';
    return html`
      <div
        class="control ${emphasisClass}"
        title=${control.title}
        @click=${async () => this._handleControlClick(control)}
      >
        ${control.icon
          ? html`<advanced-camera-card-icon
              .icon=${control.icon}
            ></advanced-camera-card-icon>`
          : ''}
      </div>
    `;
  }

  protected async _handleControlClick(control: OverlayMessageControl): Promise<void> {
    const result = await control.callback();
    if (result === null) {
      // null = close the message
      this._dismiss();
    } else {
      // Updated message = keep open and refresh
      this.message = result;
    }
  }

  protected _renderDetail(detail: MetadataField, isHeading = false): TemplateResult {
    const classes = {
      detail: true,
      heading: isHeading,
      [`emphasis-${detail.emphasis}`]: !!detail.emphasis,
    };
    return html`
      <div class="${classMap(classes)}">
        ${detail.icon
          ? html`<advanced-camera-card-icon
              title=${detail.hint ?? ''}
              .icon=${detail.icon}
            ></advanced-camera-card-icon>`
          : ''}
        <span title=${detail.title}>${detail.title}</span>
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
