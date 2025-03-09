import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { actionHandler } from '../action-handler-directive.js';
import { MenuController } from '../components-lib/menu-controller.js';
import type { MenuConfig, MenuItem } from '../config/types.js';
import { HomeAssistant } from '../ha/types.js';
import menuStyle from '../scss/menu.scss';
import { hasAction } from '../utils/action.js';
import { getEntityTitle } from '../utils/ha/index.js';
import { EntityRegistryManager } from '../utils/ha/registry/entity/index.js';
import './icon.js';
import './submenu/select-button.js';
import './submenu/submenu-button';

@customElement('advanced-camera-card-menu')
export class AdvancedCameraCardMenu extends LitElement {
  protected _controller = new MenuController(this);

  @property({ attribute: false })
  public entityRegistryManager?: EntityRegistryManager;

  @property({ attribute: false })
  public hass?: HomeAssistant;

  set menuConfig(menuConfig: MenuConfig) {
    this._controller.setMenuConfig(menuConfig);
  }

  set buttons(buttons: MenuItem[]) {
    this._controller.setButtons(buttons);
  }

  set expanded(expanded: boolean) {
    this._controller.setExpanded(expanded);
  }

  public toggleMenu(): void {
    this._controller.toggleExpanded();
  }

  protected _renderButton(button: MenuItem): TemplateResult | void {
    if (!this.hass) {
      return;
    }

    if (button.type === 'custom:advanced-camera-card-menu-submenu') {
      return html` <advanced-camera-card-submenu-button
        .hass=${this.hass}
        .submenu=${button}
        @action=${(ev) => this._controller.handleAction(ev)}
      >
      </advanced-camera-card-submenu-button>`;
    } else if (button.type === 'custom:advanced-camera-card-menu-submenu-select') {
      return html` <advanced-camera-card-submenu-select-button
        .hass=${this.hass}
        .submenuSelect=${button}
        .entityRegistryManager=${this.entityRegistryManager}
        @action=${(ev) => this._controller.handleAction(ev)}
      >
      </advanced-camera-card-submenu-select-button>`;
    }

    const title =
      this.hass &&
      button.type === 'custom:advanced-camera-card-menu-state-icon' &&
      !button.title
        ? getEntityTitle(this.hass, button.entity)
        : button.title;

    return html` <ha-icon-button
      .actionHandler=${actionHandler({
        hasHold: hasAction(button.hold_action),
        hasDoubleClick: hasAction(button.double_tap_action),
      })}
      .label=${title ?? ''}
      @action=${(ev) => this._controller.handleAction(ev, button)}
    >
      <advanced-camera-card-icon
        ?allow-override-non-active-styles=${true}
        style="${styleMap(button.style || {})}"
        .hass=${this.hass}
        .icon=${{
          icon: button.icon,
          entity: button.entity,
          stateColor: button.state_color,
          fallback: 'mdi:gesture-tap-button',
        }}
      ></advanced-camera-card-icon>
    </ha-icon-button>`;
  }

  /** Theme-related styling is dynamically injected into the menu depending on
   * the configured position, style and alignment to allow precise theming.
   * The alternative is a massive (post-sass processing) CSS file would need to
   * be shipped to account for every possible combination.
   *
   * Each rule uses 'var' values that have nested fallbacks of decreasing
   * specificity, so the most specific theme variable will match, followed by
   * the next most specific, etc.
   */
  protected _renderPerInstanceStyle(): TemplateResult | void {
    const config = this._controller.getMenuConfig();
    if (!config) {
      return;
    }

    const position = config.position;
    const style = config.style;
    const alignment = config.alignment;

    const generateValue = (suffix: string): string => {
      return `
        var(--advanced-camera-card-menu-override-${suffix},
        var(--advanced-camera-card-menu-position-${position}-alignment-${alignment}-style-${style}-${suffix},
        var(--advanced-camera-card-menu-position-${position}-alignment-${alignment}-${suffix},
        var(--advanced-camera-card-menu-position-${position}-${suffix},
        var(--advanced-camera-card-menu-style-${style}-${suffix},
        var(--advanced-camera-card-menu-alignment-${alignment}-${suffix},
        var(--advanced-camera-card-menu-${suffix})))))))`;
    };

    // By definition `rule` will match the current configuration, the choice is
    // actually which of the var(...) variables will be used after the match.
    const expandedRule = style === 'hidden' ? '[expanded]' : '';
    const rule =
      `[data-position='${position}']` +
      `[data-style='${style}']` +
      `[data-alignment='${alignment}']` +
      expandedRule;

    return html`<style>
      :host(${rule}) {
        background: ${generateValue('background')};

        ha-icon-button {
          color: ${generateValue('button-inactive-color')};
          background: ${generateValue('button-background')};
        }
      }
    </style>`;
  }

  protected render(): TemplateResult | void {
    const config = this._controller.getMenuConfig();
    const style = config?.style;
    if (!config || style === 'none') {
      return;
    }
    const matchingButtons = this._controller.getButtons('matching');
    const opposingButtons = this._controller.getButtons('opposing');

    return html` ${this._renderPerInstanceStyle()}
      <div
        class="matching"
        style="${styleMap({ flex: String(matchingButtons.length) })}"
      >
        ${matchingButtons.map((button) => this._renderButton(button))}
      </div>
      <div
        class="opposing"
        style="${styleMap({ flex: String(opposingButtons.length) })}"
      >
        ${opposingButtons.map((button) => this._renderButton(button))}
      </div>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(menuStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-menu': AdvancedCameraCardMenu;
  }
}
