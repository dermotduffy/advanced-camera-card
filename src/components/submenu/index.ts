import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { actionHandler } from '../../action-handler-directive.js';
import { getEntityTitle } from '../../ha/get-entity-title.js';
import { HomeAssistant } from '../../ha/types.js';
import submenuStyle from '../../scss/submenu.scss';
import {
  hasAction,
  stopEventFromActivatingCardWideActions,
} from '../../utils/action.js';
import '../icon.js';
import { SubmenuInteraction, SubmenuItem } from './types.js';

@customElement('advanced-camera-card-submenu')
export class AdvancedCameraCardSubmenu extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public items?: SubmenuItem[];

  protected _renderItem(item: SubmenuItem): TemplateResult | void {
    if (!this.hass) {
      return;
    }

    const title = item.title ?? getEntityTitle(this.hass, item.entity);
    const style = styleMap(item.style || {});
    const disabled = item.enabled === false;

    return html`
      <ha-dropdown-item
        class=${item.selected ? 'selected' : ''}
        ?disabled=${disabled}
        aria-label="${title ?? ''}"
        @action=${(ev: CustomEvent<SubmenuInteraction>) => {
          // Attach the item so ascendants have access to it.
          ev.detail.item = item;
        }}
        .actionHandler=${disabled
          ? undefined
          : actionHandler({
              allowPropagation: true,
              hasHold: hasAction(item.hold_action),
              hasDoubleClick: hasAction(item.double_tap_action),
            })}
      >
        <span style="${style}">${title ?? ''}</span>
        ${item.subtitle
          ? html`<span slot="details" style="${style}">${item.subtitle}</span>`
          : ''}
        <advanced-camera-card-icon
          slot="icon"
          .hass=${this.hass}
          .icon=${{
            icon: item.icon,
            entity: item.entity,
          }}
          style="${style}"
        ></advanced-camera-card-icon>
      </ha-dropdown-item>
    `;
  }

  protected render(): TemplateResult {
    return html`
      <ha-dropdown @click=${(ev: Event) => stopEventFromActivatingCardWideActions(ev)}>
        <slot slot="trigger"></slot>
        ${this.items?.map(this._renderItem.bind(this))}
      </ha-dropdown>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(submenuStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-submenu': AdvancedCameraCardSubmenu;
  }
}
