import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { actionHandler } from '../../action-handler-directive.js';
import { MenuSubmenu } from '../../config/types.js';
import { hasAction } from '../../ha/has-action.js';
import { HomeAssistant } from '../../ha/types.js';
import menuButtonStyle from '../../scss/menu-button.scss';
import '../icon.js';
import './index.js';

@customElement('advanced-camera-card-submenu-button')
export class AdvancedCameraCardSubmenuButton extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public submenu?: MenuSubmenu;

  protected render(): TemplateResult {
    if (!this.submenu) {
      return html``;
    }

    const style = styleMap(this.submenu.style || {});
    return html` <advanced-camera-card-submenu
      .hass=${this.hass}
      .items=${this.submenu?.items}
    >
      <ha-icon-button style="${style}" .label=${this.submenu.title || ''}>
        <advanced-camera-card-icon
          ?allow-override-non-active-styles=${true}
          style="${style}"
          title=${this.submenu.title || ''}
          .hass=${this.hass}
          .icon=${{ icon: this.submenu.icon }}
          .actionHandler=${actionHandler({
            // Need to allow event to propagate upwards, as it's caught by the
            // <ha-button-menu> trigger slot to open/close the menu. Further
            // propagation is forbidden by the @click handler on
            // <ha-button-menu>.
            allowPropagation: true,
            hasHold: hasAction(this.submenu.hold_action),
            hasDoubleClick: hasAction(this.submenu.double_tap_action),
          })}
        ></advanced-camera-card-icon>
      </ha-icon-button>
    </advanced-camera-card-submenu>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(menuButtonStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-submenu-button': AdvancedCameraCardSubmenuButton;
  }
}
