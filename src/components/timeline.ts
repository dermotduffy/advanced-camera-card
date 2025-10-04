import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CameraManager } from '../camera-manager/manager';
import { ViewItemManager } from '../card-controller/view/item-manager';
import { ViewManagerEpoch } from '../card-controller/view/types';
import { TimelineKey } from '../components-lib/timeline/types';
import { TimelineConfig } from '../config/schema/timeline';
import { CardWideConfig } from '../config/schema/types';
import { HomeAssistant } from '../ha/types';
import basicBlockStyle from '../scss/basic-block.scss';
import './surround.js';
import './timeline-core.js';

@customElement('advanced-camera-card-timeline')
export class AdvancedCameraCardTimeline extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public timelineConfig?: TimelineConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public viewItemManager?: ViewItemManager;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  protected _getKeys(): TimelineKey[] {
    const keys: TimelineKey[] = [];
    for (const camera of this.cameraManager?.getStore().getCameraIDsWithCapability({
      anyCapabilities: ['clips', 'snapshots', 'recordings'],
    }) ?? []) {
      keys.push({ type: 'camera', cameraID: camera });
    }
    return keys;
  }

  protected render(): TemplateResult | void {
    if (!this.timelineConfig) {
      return html``;
    }

    return html`
      <advanced-camera-card-timeline-core
        .hass=${this.hass}
        .viewManagerEpoch=${this.viewManagerEpoch}
        .timelineConfig=${this.timelineConfig}
        .thumbnailConfig=${this.timelineConfig.controls.thumbnails}
        .cameraManager=${this.cameraManager}
        .viewItemManager=${this.viewItemManager}
        .keys=${this._getKeys()}
        .cardWideConfig=${this.cardWideConfig}
        .itemClickAction=${this.timelineConfig.controls.thumbnails.mode === 'none'
          ? 'play'
          : 'select'}
      >
      </advanced-camera-card-timeline-core>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(basicBlockStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-timeline': AdvancedCameraCardTimeline;
  }
}
