import { html, nothing, type TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';

import { actionHandler } from '../../action-handler-directive.js';
import type {
  InternalNotificationControl,
  Notification,
  NotificationControl,
  NotificationDetail,
} from '../../config/schema/actions/types.js';
import {
  hasAction,
  stopEventFromActivatingCardWideActions,
} from '../../utils/action.js';

import '../icon.js';

// A screen reader announces the popup by name, and the name is its visible
// heading. `aria-labelledby` can only refer to that heading by id, so the
// heading is given this id.
export const HEADING_ID = 'heading';

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
    <div id=${role === 'heading' ? HEADING_ID : nothing} class="${classMap(classes)}">
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
  control: InternalNotificationControl,
  onAction: (ev: CustomEvent<{ action: string }>, control: NotificationControl) => void,
): TemplateResult {
  const classes = {
    control: true,
    [`severity-${control.severity}`]: !!control.severity,
    ...(control.className && { [control.className]: true }),
  };
  return html`
    <div
      class="${classMap(classes)}"
      role="button"
      tabindex="0"
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
  notification: Omit<Notification, 'context'>,
  context: string[],
  bodyIconOverride?: TemplateResult,
): TemplateResult {
  const { body, link } = notification;
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
