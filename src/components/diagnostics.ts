import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { until } from 'lit/directives/until.js';
import { RawAdvancedCameraCardConfig } from '../config/types';
import { HomeAssistant } from '../ha/types';
import { localize } from '../localize/localize';
import basicBlockStyle from '../scss/basic-block.scss';
import { getDiagnostics } from '../utils/diagnostics';
import { DeviceRegistryManager } from '../utils/ha/registry/device';
import { renderMessage } from './message';

@customElement('advanced-camera-card-diagnostics')
export class AdvancedCameraCardDiagnostics extends LitElement {
  // Not a reactive property to avoid multiple diagnostics fetches.
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public deviceRegistryManager?: DeviceRegistryManager;

  @property({ attribute: false })
  public rawConfig?: RawAdvancedCameraCardConfig;

  protected async _renderDiagnostics(): Promise<TemplateResult> {
    const diagnostics = await getDiagnostics(
      this.hass,
      this.deviceRegistryManager,
      this.rawConfig,
    );

    return renderMessage({
      message: localize('error.diagnostics'),
      icon: 'mdi:cogs',
      context: diagnostics,
    });
  }

  protected render(): TemplateResult | void {
    return html`${until(
      this._renderDiagnostics(),
      renderMessage({
        message: localize('error.fetching_diagnostics'),
        dotdotdot: true,
        icon: 'mdi:cogs',
      }),
    )}`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(basicBlockStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-diagnostics': AdvancedCameraCardDiagnostics;
  }
}
