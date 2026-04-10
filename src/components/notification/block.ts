import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { handleControlAction } from '../../components-lib/notification/action.js';
import { localize } from '../../localize/localize.js';
import {
  createNotificationFromText,
  NotificationOptions,
} from '../../components-lib/notification/factory.js';
import { Notification } from '../../config/schema/actions/types.js';
import notificationBlockStyle from '../../scss/notification-block.scss';
import {
  renderControl,
  renderDetail,
  renderNotificationBody,
} from './common-rendering.js';

export function renderNotificationBlock(
  notification: Notification | null,
): TemplateResult {
  return html`<advanced-camera-card-notification-block
    .notification=${notification}
  ></advanced-camera-card-notification-block>`;
}

export function renderNotificationBlockFromText(
  text: string,
  options?: NotificationOptions,
): TemplateResult {
  return renderNotificationBlock(createNotificationFromText(text, options));
}

@customElement('advanced-camera-card-notification-block')
export class AdvancedCameraCardNotificationBlock extends LitElement {
  @property({ attribute: false })
  public notification: Notification | null = null;

  protected render(): TemplateResult | void {
    if (!this.notification) {
      return;
    }

    const { heading, in_progress } = this.notification;
    const controls = this.notification.controls ?? [];

    return html`
      <div class="content">
        ${heading || in_progress || controls.length
          ? html`<div class="heading-row">
              ${heading ? renderDetail(heading, 'heading') : ''}
              ${in_progress || controls.length
                ? html`<div class="controls">
                    ${in_progress
                      ? html`<div
                          class="spinner"
                          title=${localize('common.in_progress')}
                        >
                          <ha-spinner indeterminate size="tiny"></ha-spinner>
                        </div>`
                      : ''}
                    ${controls.map((control) =>
                      renderControl(control, (ev, c) =>
                        handleControlAction(ev, c, this),
                      ),
                    )}
                  </div>`
                : ''}
            </div>`
          : ''}
        ${renderNotificationBody(this.notification)}
      </div>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(notificationBlockStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-notification-block': AdvancedCameraCardNotificationBlock;
  }
}
