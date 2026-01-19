import {
  CSSResultGroup,
  LitElement,
  PropertyValues,
  TemplateResult,
  html,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { actionHandler } from '../action-handler-directive.js';
import { StatusBarController } from '../components-lib/status-bar-controller';
import { StatusBarItem } from '../config/schema/actions/types.js';
import { StatusBarConfig } from '../config/schema/status-bar.js';
import statusStyle from '../scss/status.scss';
import { hasAction } from '../utils/action';
import './icon.js';

@customElement('advanced-camera-card-status-bar')
export class AdvancedCameraCardStatusBar extends LitElement {
  protected _controller = new StatusBarController(this);

  @property({ attribute: false })
  public items?: StatusBarItem[];

  @property({ attribute: false })
  public config?: StatusBarConfig;

  protected willUpdate(changedProperties: PropertyValues): void {
    // Always set config before items.
    if (changedProperties.has('config') && this.config) {
      this._controller.setConfig(this.config);
    }

    if (changedProperties.has('items')) {
      this._controller.setItems(this.items ?? []);
    }
  }

  /** Theme-related styling is dynamically injected into the status bar depending on
   * the configured position and style to allow precise theming.
   *
   * Each rule uses 'var' values that have nested fallbacks of decreasing
   * specificity, so the most specific theme variable will match, followed by
   * the next most specific, etc.
   */
  protected _renderPerInstanceStyle(): TemplateResult | void {
    const config = this._controller.getConfig();
    if (!config) {
      return;
    }

    const position = config.position;
    const style = config.style;

    const generateValue = (suffix: string): string => {
      return `
        var(--advanced-camera-card-status-bar-override-${suffix},
        var(--advanced-camera-card-status-bar-position-${position}-style-${style}-${suffix},
        var(--advanced-camera-card-status-bar-position-${position}-${suffix},
        var(--advanced-camera-card-status-bar-style-${style}-${suffix},
        var(--advanced-camera-card-status-bar-${suffix})))))`;
    };

    const rule = `[data-position='${position}']` + `[data-style='${style}']`;

    return html`<style>
      :host(${rule}) {
        color: ${generateValue('color')};
        background: ${generateValue('background')};
      }
    </style>`;
  }

  protected render(): TemplateResult | void {
    if (!this._controller.shouldRender()) {
      return;
    }

    return html`
      ${this._renderPerInstanceStyle()}
      <div class="status">
        ${this._controller.getRenderItems().map((item): TemplateResult | void => {
          if (item.enabled === false) {
            return;
          }

          const classes = classMap({
            item: true,
            expand: !!item.expand,
            action: !!Object.keys(item.actions ?? {}).length,
          });

          const handler = actionHandler({
            hasHold: hasAction(item.actions?.hold_action),
            hasDoubleClick: hasAction(item.actions?.double_tap_action),
          });

          if (item.type === 'custom:advanced-camera-card-status-bar-string') {
            return html`<div
              .actionHandler=${handler}
              class="${classes}"
              data-severity=${item.severity ?? ''}
              @action=${(ev) => this._controller.actionHandler(ev, item.actions)}
            >
              ${item.string}
            </div>`;
          } else if (item.type === 'custom:advanced-camera-card-status-bar-icon') {
            return html`<advanced-camera-card-icon
              .actionHandler=${handler}
              .icon=${{ icon: item.icon }}
              class="${classes}"
              data-severity=${item.severity ?? ''}
              @action=${(ev) => this._controller.actionHandler(ev, item.actions)}
            ></advanced-camera-card-icon>`;
          } else if (item.type === 'custom:advanced-camera-card-status-bar-image') {
            return html`<img
              .actionHandler=${handler}
              class="${classes}"
              src="${item.image}"
              data-severity=${item.severity ?? ''}
              @action=${(ev) => this._controller.actionHandler(ev, item.actions)}
            />`;
          }
        })}
      </div>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(statusStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-status-bar': AdvancedCameraCardStatusBar;
  }
}
