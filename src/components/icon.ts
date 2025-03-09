import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { IconController } from '../components-lib/icon-controller';
import { HomeAssistant } from '../ha/types';
import iconStyle from '../scss/icon.scss';
import { Icon } from '../types';

@customElement('advanced-camera-card-icon')
export class AdvancedCameraCardIcon extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public icon?: Icon;

  // Note: This attribute will allow non-active entity state styles (e.g. 'off',
  // 'unavailable') to be overriden from outside the icon itself. This is useful
  // in the menu / submenus where we want icons to follow menu theming, unless
  // they are 'active'. This attribute is not used in code, but matched in
  // icon.scss .
  @property({ attribute: 'allow-override-non-active-styles', type: Boolean })
  public allowOverrideNonActiveStyles = false;

  private _controller = new IconController();
  private _svg: HTMLElement | null = null;

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('icon')) {
      const customIcon = this._controller.getCustomIcon(this.icon);
      if (customIcon) {
        const svgElement = document.createElement('svg');
        svgElement.innerHTML = customIcon;
        this._svg = svgElement;
      } else {
        this._svg = null;
      }
    }
  }

  protected render(): TemplateResult {
    if (this._svg) {
      // Use SVG objects (rather than <img>) to ensure styling applies
      // correctly.
      return html`${this._svg}`;
    }
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
          .overrideIcon=${this.icon.icon}
        ></state-badge>`;
      }
    }
    if (this.icon?.icon) {
      return html`<ha-icon icon="${this.icon.icon}"></ha-icon>`;
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
