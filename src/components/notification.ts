import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import { actionHandler } from '../action-handler-directive.js';
import { dispatchActionExecutionRequest } from '../card-controller/actions/utils/execution-request';
import {
  Notification,
  NotificationControl,
  NotificationDetail,
} from '../config/schema/actions/types.js';
import notificationStyle from '../scss/notification.scss';
import {
  getActionConfigGivenAction,
  hasAction,
  stopEventFromActivatingCardWideActions,
} from '../utils/action.js';
import { arrayify } from '../utils/basic.js';
import { dispatchDismissNotificationEvent } from '../utils/notification.js';
import './icon.js';

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

    const heading = this.notification.heading;
    const details = this.notification.details ?? [];
    const text = this.notification.text;
    const controls = this.notification.controls ?? [];

    return html`
      <div class="backdrop" @click=${this._dismiss}></div>
      <div
        class="notification"
        ${ref(this._refNotification)}
        @animationend=${this._handleAnimationEnd}
      >
        <div class="details">
          ${heading ? this._renderDetail(heading, true) : ''}
          ${details.map((detail) => this._renderDetail(detail))}
          ${text ? html`<div class="description">${text}</div>` : ''}
          ${this.notification.link
            ? html`<div class="url">
                <a
                  href=${this.notification.link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  @click=${stopEventFromActivatingCardWideActions}
                  >${this.notification.link.title}</a
                >
              </div>`
            : ''}
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

  private _renderControl(control: NotificationControl): TemplateResult {
    const severityClass = control.severity ? `severity-${control.severity}` : '';
    return html`
      <div
        class="control ${severityClass}"
        title=${control.tooltip ?? ''}
        .actionHandler=${actionHandler({
          hasHold: hasAction(control.actions?.hold_action),
          hasDoubleClick: hasAction(control.actions?.double_tap_action),
        })}
        @action=${(ev: CustomEvent) => this._handleControlAction(ev, control)}
      >
        ${control.icon
          ? html`<advanced-camera-card-icon
              .icon=${{ icon: control.icon }}
            ></advanced-camera-card-icon>`
          : ''}
      </div>
    `;
  }

  private _handleControlAction(
    ev: CustomEvent<{ action: string }>,
    control: NotificationControl,
  ): void {
    stopEventFromActivatingCardWideActions(ev);

    const action = getActionConfigGivenAction(ev.detail.action, control.actions);
    if (action) {
      dispatchActionExecutionRequest(this, {
        actions: arrayify(action),
      });
    }
    if (control.dismiss !== false) {
      this._dismiss();
    }
  }

  private _renderDetail(detail: NotificationDetail, isHeading = false): TemplateResult {
    const classes = {
      detail: true,
      heading: isHeading,
      [`severity-${detail.severity}`]: !!detail.severity,
    };
    return html`
      <div class="${classMap(classes)}">
        ${detail.icon
          ? html`<advanced-camera-card-icon
              title=${detail.tooltip ?? ''}
              .icon=${{ icon: detail.icon }}
            ></advanced-camera-card-icon>`
          : ''}
        <span title=${detail.text}>${detail.text}</span>
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
    return unsafeCSS(notificationStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-notification': AdvancedCameraCardNotification;
  }
}
