import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResultGroup,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { IconController } from '../components-lib/icon-controller';
import type { InternalIcon } from '../config/schema/common/icon.js';
import type { HomeAssistant } from '../ha/types';
import iconStyle from '../scss/icon.scss';
import { contentsChanged } from '../utils/basic.js';

@customElement('advanced-camera-card-icon')
export class AdvancedCameraCardIcon extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false, hasChanged: contentsChanged })
  public icon?: InternalIcon;

  // Note: This attribute will allow non-active entity state styles (e.g. 'off',
  // 'unavailable') to be overriden from outside the icon itself. This is useful
  // in the menu / submenus where we want icons to follow menu theming, unless
  // they are 'active'. This attribute is not used in code, but matched in
  // icon.scss .
  @property({ attribute: 'allow-override-non-active-styles', type: Boolean })
  public allowOverrideNonActiveStyles = false;

  private _controller = new IconController();

  protected render(): TemplateResult {
    const iconName = this._controller.getIconName(this.icon);
    if (this.hass && this.icon?.entity) {
      const stateObj = this._controller.createStateObjectForStateBadge(
        this.hass,
        this.icon.entity,
      );
      if (stateObj) {
        // As a special case, need to pass in a color in order for the state
        // color to be overridden.
        return html`<state-badge
          .color="${this.style.color ?? undefined}"
          .stateColor=${this.icon.stateColor ?? true}
          .hass=${this.hass}
          .stateObj=${stateObj}
          .overrideIcon=${iconName ?? undefined}
        ></state-badge>`;
      }
    }
    if (iconName) {
      return html`<ha-icon icon="${iconName}"></ha-icon>`;
    }
    if (this.icon?.fallback) {
      return html`<ha-icon icon="${this.icon.fallback}"></ha-icon>`;
    }
    return html``;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(iconStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-icon': AdvancedCameraCardIcon;
  }
}
