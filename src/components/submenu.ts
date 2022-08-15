import { HomeAssistant } from 'custom-card-helpers';
import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { actionHandler } from '../action-handler-directive.js';
import submenuStyle from '../scss/submenu.scss';
import {
  MenuSubmenu,
  MenuSubmenuItem,
  MenuSubmenuSelect,
  StateParameters,
} from '../types.js';
import {
  frigateCardHasAction,
  stopEventFromActivatingCardWideActions,
} from '../utils/action.js';
import { isHassDifferent, refreshDynamicStateParameters } from '../utils/ha';
import { domainIcon } from '../utils/icons/domain-icon.js';
import './hover-styler.js';

@customElement('frigate-card-submenu')
export class FrigateCardSubmenu extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public submenu?: MenuSubmenu;

  protected _renderItem(item: MenuSubmenuItem): TemplateResult | void {
    if (!this.hass) {
      return;
    }
    const stateParameters = refreshDynamicStateParameters(this.hass, { ...item });
    const getIcon = (stateParameters: StateParameters): TemplateResult => {
      if (stateParameters.icon) {
        return html` <ha-icon
          data-domain=${ifDefined(stateParameters.data_domain)}
          data-state=${ifDefined(stateParameters.data_state)}
          slot="graphic"
          icon="${stateParameters.icon || ''}"
        >
        </ha-icon>`;
      }
      return html``;
    };

    return html`
      <frigate-card-hover-styler
        .baseStyle=${stateParameters.style}
        .hoverStyle=${stateParameters['style:hover']}
        .selector=${'mwc-list-item *'}
      >
        <mwc-list-item
          graphic=${ifDefined(stateParameters.icon ? 'icon' : undefined)}
          ?twoline=${!!item.subtitle}
          ?selected=${item.selected}
          ?activated=${item.selected}
          ?disabled=${item.enabled === false}
          aria-label="${stateParameters.title || ''}"
          @action=${(ev) => {
            // Attach the action config so ascendants have access to it.
            ev.detail.config = item;
          }}
          .actionHandler=${actionHandler({
            hasHold: frigateCardHasAction(item.hold_action),
            hasDoubleClick: frigateCardHasAction(item.double_tap_action),
          })}
        >
          <span>${stateParameters.title || ''}</span>
          ${item.subtitle ? html`<span slot="secondary">${item.subtitle}</span>` : ''}
          ${getIcon(stateParameters)}
        </mwc-list-item>
      </frigate-card-hover-styler>
    `;
  }

  protected render(): TemplateResult {
    if (!this.submenu) {
      return html``;
    }
    return html`
      <ha-button-menu
        corner=${'BOTTOM_LEFT'}
        @closed=${
          // Prevent the submenu closing from closing anything upstream (e.g.
          // selecting a submenu in the editor dialog should not close the
          // editor, see https://github.com/dermotduffy/frigate-hass-card/issues/377).
          (ev) => ev.stopPropagation()
        }
        @click=${(ev) => stopEventFromActivatingCardWideActions(ev)}
      >
        <frigate-card-hover-styler
          .baseStyle=${this.submenu.style}
          .hoverStyle=${this.submenu['style:hover']}
          slot="trigger"
        >
          <ha-icon-button
            class="button"
            .label=${this.submenu.title || ''}
            .actionHandler=${actionHandler({
              // Need to allow event to propagate upwards, as it's caught by the
              // <ha-button-menu> trigger slot to open/close the menu. Further
              // propagation is forbidden by the @click handler on
              // <ha-button-menu>.
              allowPropagation: true,
              hasHold: frigateCardHasAction(this.submenu.hold_action),
              hasDoubleClick: frigateCardHasAction(this.submenu.double_tap_action),
            })}
          >
            <ha-icon icon="${this.submenu.icon}"></ha-icon>
          </ha-icon-button>
        </frigate-card-hover-styler>
        ${this.submenu.items.map(this._renderItem.bind(this))}
      </ha-button-menu>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(submenuStyle);
  }
}

@customElement('frigate-card-submenu-select')
export class FrigateCardSubmenuSelect extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public submenuSelect?: MenuSubmenuSelect;

  protected _generatedSubmenu?: MenuSubmenu;

  /**
   * Called to determine if the update should proceed.
   * @param changedProps
   * @returns `true` if the update should proceed, `false` otherwise.
   */
  protected shouldUpdate(changedProps: PropertyValues): boolean {
    // No need to update the submenu unless the select entity has changed.
    const oldHass = changedProps.get('hass') as HomeAssistant | undefined;
    return (
      changedProps.size != 1 ||
      !this.submenuSelect ||
      (!!oldHass && isHassDifferent(this.hass, oldHass, [this.submenuSelect.entity]))
    );
  }

  /**
   * Called when the render function will be called.
   */
  protected willUpdate(): void {
    if (!this.submenuSelect || !this.hass) {
      return;
    }
    const entity = this.submenuSelect.entity;
    const stateObj = this.hass.states[entity];
    const options = stateObj?.attributes?.options;
    if (!stateObj || !options) {
      return;
    }

    const submenu: MenuSubmenu = {
      // Default icon. It should be impossible for this to be used, since
      // this.submenuSelect will always have an entity, which means
      // refreshDynamicStateParameters will always return an icon.
      icon: domainIcon('select'),

      // Pull out the dynamic properties (like icon, and title) from the state.
      ...refreshDynamicStateParameters(this.hass, this.submenuSelect),

      // Override it with anything explicitly set in the submenuSelect.
      ...this.submenuSelect,

      type: 'custom:frigate-card-menu-submenu',
      items: [],
    };

    // For cleanliness remove the options parameter which is unused by the
    // submenu rendering itself (above). It is only in this method to populate
    // the items correctly (below).
    delete submenu['options'];

    for (const option of options) {
      // If there's a device_class there may be a localized translation of the
      // select title available via HASS.
      const title = stateObj.attributes.device_class
        ? this.hass.localize(
            `component.select.state.${stateObj.attributes.device_class}.${option}`,
          )
        : option;
      submenu.items.push({
        state_color: true,
        selected: stateObj.state === option,
        enabled: true,
        title: title || option,
        ...((entity.startsWith('select.') || entity.startsWith('input_select.')) && {
          tap_action: {
            action: 'call-service',
            service: entity.startsWith('select.')
              ? 'select.select_option'
              : 'input_select.select_option',
            service_data: {
              entity_id: entity,
              option: option,
            },
          },
        }),
        // Apply overrides the user may have specified for a given option.
        ...(this.submenuSelect.options && this.submenuSelect.options[option]),
      });
    }

    this._generatedSubmenu = submenu;
  }

  protected render(): TemplateResult {
    return html` <frigate-card-submenu
      .hass=${this.hass}
      .submenu=${this._generatedSubmenu}
    ></frigate-card-submenu>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-submenu': FrigateCardSubmenu;
    'frigate-card-submenu-select': FrigateCardSubmenuSelect;
  }
}
