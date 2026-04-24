import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import { handleControlAction } from '../../components-lib/notification/action.js';
import { Notification } from '../../config/schema/actions/types.js';
import { localize } from '../../localize/localize.js';
import notificationPopupStyle from '../../scss/notification-popup.scss';
import { dispatchDismissNotificationEvent } from '../../utils/notification.js';
import {
  renderControl,
  renderDetail,
  renderNotificationBody,
} from './common-rendering.js';

@customElement('advanced-camera-card-notification')
export class AdvancedCameraCardNotification extends LitElement {
  @property({ attribute: false })
  public notification: Notification | null = null;

  private _refNotification: Ref<HTMLElement> = createRef();

  public connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('click', this._handleOutsideInteraction);
    window.addEventListener('focusin', this._handleOutsideInteraction);
    window.addEventListener('keydown', this._handleKeyDown);
  }

  public disconnectedCallback(): void {
    window.removeEventListener('click', this._handleOutsideInteraction);
    window.removeEventListener('focusin', this._handleOutsideInteraction);
    window.removeEventListener('keydown', this._handleKeyDown);
    super.disconnectedCallback();
  }

  protected render(): TemplateResult | void {
    if (!this.notification) {
      return;
    }

    const { heading, in_progress } = this.notification;
    const controls = this.notification.controls ?? [];

    return html`
      <div class="backdrop" @click=${this._dismiss}></div>
      <div
        class="notification"
        ${ref(this._refNotification)}
        @animationend=${this._handleAnimationEnd}
      >
        ${controls.length || in_progress
          ? html`<div class="controls">
              ${in_progress
                ? html`<div class="spinner" title=${localize('common.in_progress')}>
                    <ha-spinner indeterminate size="tiny"></ha-spinner>
                  </div>`
                : ''}
              ${controls.map((control) =>
                renderControl(control, (ev, c) =>
                  handleControlAction(ev, c, this, this._dismiss),
                ),
              )}
            </div>`
          : ''}
        <div class="close" @click=${this._dismiss}>
          <advanced-camera-card-icon
            .icon=${{ icon: 'mdi:close' }}
          ></advanced-camera-card-icon>
        </div>
        <div class="details">
          ${heading ? renderDetail(heading, 'heading') : ''}
          ${renderNotificationBody(this.notification)}
        </div>
      </div>
    `;
  }

  private _dismiss = (): void => {
    this._refNotification.value?.classList.add('exiting');
  };

  private _handleAnimationEnd = (ev: AnimationEvent): void => {
    if (ev.animationName === 'slideDown') {
      dispatchDismissNotificationEvent(this);
    }
  };

  private _handleOutsideInteraction = (ev: Event): void => {
    if (!ev.composedPath().includes(this)) {
      this._dismiss();
    }
  };

  private _handleKeyDown = (ev: KeyboardEvent): void => {
    if (ev.key === 'Escape') {
      this._dismiss();
      ev.stopPropagation();
      ev.preventDefault();
    }
  };

  static get styles(): CSSResultGroup {
    return unsafeCSS(notificationPopupStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-notification': AdvancedCameraCardNotification;
  }
}
