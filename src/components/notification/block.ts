import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResultGroup,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import { handleControlAction } from '../../components-lib/notification/action.js';
import {
  createNotificationFromText,
  type NotificationOptions,
} from '../../components-lib/notification/factory.js';
import { NotificationContextController } from '../../components-lib/notification/notification-context-controller.js';
import type { Notification } from '../../config/schema/actions/types.js';
import { localize } from '../../localize/localize.js';
import notificationBlockStyle from '../../scss/notification-block.scss?inline';
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

  private _contextController = new NotificationContextController(this);

  protected render(): TemplateResult | void {
    if (!this.notification) {
      return;
    }

    const context = this._contextController.getContext(this.notification);
    const { heading, in_progress } = this.notification;
    const controls = this.notification.controls ?? [];

    // Anchor the spinner to whichever status element is most prominent: the
    // heading if present, the body icon otherwise. Never render it orphaned
    // on its own row (which would float it to the left with no visual tie to
    // the text).
    const spinner = in_progress
      ? html`<div class="spinner" title=${localize('common.in_progress')}>
          <ha-spinner indeterminate size="tiny"></ha-spinner>
        </div>`
      : null;
    const spinnerInHeadingRow = spinner && (heading || controls.length);
    const spinnerInBody = spinner && !spinnerInHeadingRow;

    return html`
      <div class="content">
        ${heading || spinnerInHeadingRow || controls.length
          ? html`<div class="heading-row">
              ${heading ? renderDetail(heading, 'heading') : ''}
              ${spinnerInHeadingRow || controls.length
                ? html`<div
                    class=${classMap({
                      controls: true,
                      'spinner-only': !controls.length,
                    })}
                  >
                    ${spinnerInHeadingRow ? spinner : ''}
                    ${controls.map((control) =>
                      renderControl(control, (ev, c) =>
                        handleControlAction(ev, c, this),
                      ),
                    )}
                  </div>`
                : ''}
            </div>`
          : ''}
        ${renderNotificationBody(
          this.notification,
          context,
          spinnerInBody ? spinner : undefined,
        )}
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
