import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { styleMap } from 'lit/directives/style-map.js';
import { actionHandler } from '../../action-handler-directive.js';
import { HomeAssistant } from '../../ha/types.js';
import submenuStyle from '../../scss/submenu.scss';
import {
  hasAction,
  stopEventFromActivatingCardWideActions,
} from '../../utils/action.js';
import { getEntityTitle } from '../../utils/ha';
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

    return html`
      <mwc-list-item
        graphic=${ifDefined(item.icon || item.entity ? 'icon' : undefined)}
        ?twoline=${!!item.subtitle}
        ?selected=${item.selected}
        ?activated=${item.selected}
        ?disabled=${item.enabled === false}
        aria-label="${title ?? ''}"
        @action=${(ev: CustomEvent<SubmenuInteraction>) => {
          // Attach the item so ascendants have access to it.
          ev.detail.item = item;
        }}
        .actionHandler=${actionHandler({
          allowPropagation: true,
          hasHold: hasAction(item.hold_action),
          hasDoubleClick: hasAction(item.double_tap_action),
        })}
      >
        <span style="${style}">${title ?? ''}</span>
        ${item.subtitle
          ? html`<span slot="secondary" style="${style}">${item.subtitle}</span>`
          : ''}
        <advanced-camera-card-icon
          slot="graphic"
          .hass=${this.hass}
          .icon=${{
            icon: item.icon,
            entity: item.entity,
          }}
          style="${style}"
        ></advanced-camera-card-icon>
      </mwc-list-item>
    `;
  }

  protected render(): TemplateResult {
    return html`
      <ha-button-menu
        fixed
        corner=${'BOTTOM_LEFT'}
        @closed=${
          // Prevent the submenu closing from closing anything upstream (e.g.
          // selecting a submenu in the editor dialog should not close the
          // editor, see https://github.com/dermotduffy/advanced-camera-card/issues/377).
          (ev) => ev.stopPropagation()
        }
        @click=${(ev: Event) => stopEventFromActivatingCardWideActions(ev)}
      >
        <slot slot="trigger"></slot>
        ${this.items?.map(this._renderItem.bind(this))}
      </ha-button-menu>
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
