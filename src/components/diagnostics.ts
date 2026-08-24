import {
  html,
  LitElement,
  unsafeCSS,
  type CSSResultGroup,
  type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { until } from 'lit/directives/until.js';

import type { IssuePresence } from '../card-controller/issues/types';
import type { MicrophoneDiagnostics } from '../card-controller/types';
import type { RawAdvancedCameraCardConfig } from '../config/types';
import type { DeviceRegistryManager } from '../ha/registry/device';
import type { HomeAssistant } from '../ha/types';
import { localize } from '../localize/localize';
import basicBlockStyle from '../scss/basic-block.scss?inline';
import { getDiagnostics } from '../utils/diagnostics';
import { renderNotificationBlockFromText } from './notification/block';

@customElement('advanced-camera-card-diagnostics')
export class AdvancedCameraCardDiagnostics extends LitElement {
  // Not a reactive property to avoid multiple diagnostics fetches.
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public deviceRegistryManager?: DeviceRegistryManager;

  @property({ attribute: false })
  public rawConfig?: RawAdvancedCameraCardConfig;

  @property({ attribute: false })
  public issues?: IssuePresence;

  @property({ attribute: false })
  public microphoneDiagnostics?: MicrophoneDiagnostics;

  private async _renderDiagnostics(): Promise<TemplateResult> {
    const diagnostics = await getDiagnostics({
      hass: this.hass,
      deviceRegistryManager: this.deviceRegistryManager,
      rawConfig: this.rawConfig,
      issues: this.issues,
      microphoneDiagnostics: this.microphoneDiagnostics,
    });

    return renderNotificationBlockFromText(localize('error.diagnostics'), {
      icon: 'mdi:cogs',
      context: diagnostics,
    });
  }

  protected render(): TemplateResult | void {
    return html`${until(
      this._renderDiagnostics(),
      renderNotificationBlockFromText(localize('error.fetching_diagnostics'), {
        icon: 'mdi:cogs',
        in_progress: true,
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
