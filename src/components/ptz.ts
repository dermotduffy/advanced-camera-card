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
import { CameraManager } from '../camera-manager/manager.js';
import { PTZController } from '../components-lib/ptz/ptz-controller.js';
import { PTZControllerActions } from '../components-lib/ptz/types.js';
import { Actions } from '../config/schema/actions/types.js';
import { PTZControlsConfig } from '../config/schema/common/controls/ptz.js';
import { HomeAssistant } from '../ha/types.js';
import { localize } from '../localize/localize.js';
import ptzStyle from '../scss/ptz.scss';
import { Interaction } from '../types.js';
import { hasAction } from '../utils/action.js';
import { prettifyTitle } from '../utils/basic.js';
import './icon.js';
import './submenu';
import { SubmenuInteraction, SubmenuItem } from './submenu/types.js';

@customElement('advanced-camera-card-ptz')
export class AdvancedCameraCardPTZ extends LitElement {
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public config?: PTZControlsConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public cameraID?: string;

  @property({ attribute: false })
  public forceVisibility?: boolean;

  protected _controller = new PTZController(this);
  protected _actions: PTZControllerActions | null = null;

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('config')) {
      this._controller.setConfig(this.config);
    }
    if (changedProps.has('cameraManager') || changedProps.has('cameraID')) {
      this._controller.setCamera(this.cameraManager, this.cameraID);
    }
    if (changedProps.has('forceVisibility')) {
      this._controller.setForceVisibility(this.forceVisibility);
    }
    if (changedProps.has('cameraID') || changedProps.has('cameraManager')) {
      this._actions = this._controller.getPTZActions();
    }
  }

  protected render(): TemplateResult | void {
    if (!this._controller.shouldDisplay()) {
      return;
    }

    const renderIcon = (
      name: string,
      icon: string,
      options?: {
        actions?: Actions | null;
        renderWithoutAction?: boolean;
      },
    ): TemplateResult => {
      const classes = {
        [name]: true,
        disabled: !options?.actions && !options?.renderWithoutAction,
      };

      return options?.actions || options?.renderWithoutAction
        ? html`<advanced-camera-card-icon
            class=${classMap(classes)}
            .icon=${{ icon: icon }}
            .title=${localize(`elements.ptz.${name}`)}
            .actionHandler=${options.actions
              ? actionHandler({
                  hasHold: hasAction(options.actions?.hold_action),
                  hasDoubleClick: hasAction(options.actions?.double_tap_action),
                })
              : undefined}
            @action=${(ev: CustomEvent<Interaction>) =>
              options.actions && this._controller.handleAction(ev, options.actions)}
          ></advanced-camera-card-icon>`
        : html``;
    };

    const presetSubmenuItems: SubmenuItem[] | null = this._actions?.presets?.length
      ? this._actions.presets.map((preset) => ({
          title: prettifyTitle(preset.preset),
          icon: 'mdi:cctv',
          ...preset.actions,
          hold_action: {
            action: 'perform-action',
            perform_action: 'camera.preset_recall',
          },
        }))
      : null;

    const config = this._controller.getConfig();
    return html` <div class="ptz">
      ${!config?.hide_pan_tilt &&
      (this._actions?.left ||
        this._actions?.right ||
        this._actions?.up ||
        this._actions?.down)
        ? html`<div class="ptz-move">
            ${renderIcon('right', 'mdi:arrow-right', { actions: this._actions?.right })}
            ${renderIcon('left', 'mdi:arrow-left', { actions: this._actions?.left })}
            ${renderIcon('up', 'mdi:arrow-up', { actions: this._actions?.up })}
            ${renderIcon('down', 'mdi:arrow-down', { actions: this._actions?.down })}
          </div>`
        : ''}
      ${!config?.hide_zoom && (this._actions?.zoom_in || this._actions?.zoom_out)
        ? html` <div class="ptz-zoom">
            ${renderIcon('zoom_in', 'mdi:plus', { actions: this._actions.zoom_in })}
            ${renderIcon('zoom_out', 'mdi:minus', { actions: this._actions.zoom_out })}
          </div>`
        : html``}
      ${!config?.hide_home && (this._actions?.home || presetSubmenuItems?.length)
        ? html`<div class="ptz-presets">
            ${renderIcon('home', 'mdi:home', { actions: this._actions?.home })}
            ${presetSubmenuItems?.length
              ? html`<advanced-camera-card-submenu
                  class="presets"
                  .hass=${this.hass}
                  .items=${presetSubmenuItems}
                  @action=${(ev: CustomEvent<SubmenuInteraction>) =>
                    this._controller.handleAction(ev)}
                >
                  ${renderIcon(
                    'presets',
                    config?.orientation === 'vertical'
                      ? 'mdi:dots-vertical'
                      : 'mdi:dots-horizontal',
                    {
                      renderWithoutAction: true,
                    },
                  )}
                </advanced-camera-card-submenu>`
              : ''}
          </div>`
        : ''}
    </div>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(ptzStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-ptz': AdvancedCameraCardPTZ;
  }
}
