import { html, TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { actionHandler } from '../../action-handler-directive.js';
import {
  Notification,
  NotificationControl,
  NotificationDetail,
} from '../../config/schema/actions/types.js';
import {
  hasAction,
  stopEventFromActivatingCardWideActions,
} from '../../utils/action.js';
import '../icon.js';

export function renderDetail(
  detail: NotificationDetail,
  role: 'heading' | 'body' | 'metadata' = 'metadata',
  iconOverride?: TemplateResult,
): TemplateResult {
  const classes = {
    detail: true,
    heading: role === 'heading',
    body: role === 'body',
    [`severity-${detail.severity}`]: !!detail.severity,
  };
  return html`
    <div class="${classMap(classes)}">
      ${iconOverride ??
      (detail.icon
        ? html`<advanced-camera-card-icon
            title=${detail.tooltip ?? ''}
            .icon=${{ icon: detail.icon }}
          ></advanced-camera-card-icon>`
        : '')}
      <span title=${detail.text}>${detail.text}</span>
    </div>
  `;
}

export function renderControl(
  control: NotificationControl,
  onAction: (ev: CustomEvent<{ action: string }>, control: NotificationControl) => void,
): TemplateResult {
  return html`
    <div
      class="control ${control.severity ? `severity-${control.severity}` : ''}"
      title=${control.tooltip ?? ''}
      .actionHandler=${actionHandler({
        hasHold: hasAction(control.actions?.hold_action),
        hasDoubleClick: hasAction(control.actions?.double_tap_action),
      })}
      @action=${(ev: CustomEvent) => onAction(ev, control)}
    >
      ${control.icon
        ? html`<advanced-camera-card-icon
            .icon=${{ icon: control.icon }}
          ></advanced-camera-card-icon>`
        : ''}
    </div>
  `;
}

export function renderNotificationBody(
  notification: Notification,
  bodyIconOverride?: TemplateResult,
): TemplateResult {
  const { body, link } = notification;
  const context = notification.context ?? [];
  const metadata = notification.metadata ?? [];
  return html`
    ${metadata.map((detail) => renderDetail(detail, 'metadata'))}
    ${body ? renderDetail(body, 'body', bodyIconOverride) : ''}
    ${link
      ? html`<div class="url">
          <a
            href=${link.url}
            target="_blank"
            rel="noopener noreferrer"
            @click=${stopEventFromActivatingCardWideActions}
            >${link.title}</a
          >
        </div>`
      : ''}
    ${context.length
      ? html`<div class="context">
          ${context.map((item) => html`<pre>${item}</pre>`)}
        </div>`
      : ''}
  `;
}
