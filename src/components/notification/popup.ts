import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResultGroup,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';

import { handleControlAction } from '../../components-lib/notification/action.js';
import { NotificationContextController } from '../../components-lib/notification/notification-context-controller.js';
import { NotificationPopupController } from '../../components-lib/notification/notification-popup-controller.js';
import { NotificationPopupViewportController } from '../../components-lib/notification/notification-popup-viewport-controller.js';
import type { Notification } from '../../config/schema/actions/types.js';
import { localize } from '../../localize/localize.js';
import notificationPopupStyle from '../../scss/notification-popup.scss?inline';
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
  private _popupController = new NotificationPopupController(
    this,
    () => this._refNotification.value ?? null,
  );
  private _contextController = new NotificationContextController(this);

  constructor() {
    super();

    // Controller automatically registers itself with this element.
    new NotificationPopupViewportController(this);
  }

  protected render(): TemplateResult | void {
    if (!this.notification) {
      return;
    }

    const context = this._contextController.getContext(this.notification);
    const { heading, in_progress } = this.notification;
    const controls = this.notification.controls ?? [];

    return html`
      <div class="backdrop" @click=${this._popupController.dismiss}></div>
      <div
        class="notification"
        tabindex="-1"
        ${ref(this._refNotification)}
        @animationend=${this._popupController.handleAnimationEnd}
      >
        ${controls.length || in_progress
          ? html`<div
              class=${classMap({ controls: true, 'spinner-only': !controls.length })}
            >
              ${in_progress
                ? html`<div class="spinner" title=${localize('common.in_progress')}>
                    <ha-spinner indeterminate size="tiny"></ha-spinner>
                  </div>`
                : ''}
              ${controls.map((control) =>
                renderControl(control, (ev, c) =>
                  handleControlAction(ev, c, this, this._popupController.dismiss),
                ),
              )}
            </div>`
          : ''}
        <button
          class="close"
          title=${localize('common.close')}
          aria-label=${localize('common.close')}
          @click=${this._popupController.dismiss}
        >
          <advanced-camera-card-icon
            .icon=${{ icon: 'mdi:close' }}
          ></advanced-camera-card-icon>
        </button>
        <div class="details">
          ${heading ? renderDetail(heading, 'heading') : ''}
          ${renderNotificationBody(this.notification, context)}
        </div>
      </div>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(notificationPopupStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-notification': AdvancedCameraCardNotification;
  }
}
