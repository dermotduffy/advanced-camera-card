import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { NextPreviousControlConfig } from '../config/schema/common/controls/next-previous.js';
import { HomeAssistant } from '../ha/types.js';
import controlStyle from '../scss/next-previous-control.scss';
import { Icon } from '../types.js';
import { renderTask } from '../utils/task.js';
import { createFetchThumbnailTask } from '../utils/thumbnail.js';

@customElement('advanced-camera-card-next-previous-control')
export class AdvancedCameraCardNextPreviousControl extends LitElement {
  @property({ attribute: false })
  public side?: 'left' | 'right';

  set controlConfig(controlConfig: NextPreviousControlConfig | undefined) {
    if (controlConfig?.size) {
      this.style.setProperty(
        '--advanced-camera-card-next-prev-size',
        `${controlConfig.size}px`,
      );
    }
    this._controlConfig = controlConfig;
  }

  @property({ attribute: false })
  public hass?: HomeAssistant;

  @state()
  protected _controlConfig?: NextPreviousControlConfig;

  @property({ attribute: false })
  public thumbnail?: string;

  @property({ attribute: false })
  public icon?: Icon;

  @property({ attribute: true, type: Boolean })
  public disabled = false;

  // Label that is used for ARIA support and as tooltip.
  @property() label = '';

  protected _embedThumbnailTask = createFetchThumbnailTask(
    this,
    () => this.hass,
    () => this.thumbnail,
  );

  protected render(): TemplateResult {
    if (this.disabled || !this._controlConfig || this._controlConfig.style == 'none') {
      return html``;
    }

    const shouldRenderIcon =
      !this.thumbnail || ['chevrons', 'icons'].includes(this._controlConfig.style);

    const classesBase = {
      controls: true,
      left: this.side === 'left',
      right: this.side === 'right',
    };

    const renderIcon = (): TemplateResult => {
      const icon =
        this.icon && this._controlConfig?.style !== 'chevrons'
          ? this.icon
          : this.side === 'left'
            ? { icon: 'mdi:chevron-left' }
            : { icon: 'mdi:chevron-right' };

      const classes = {
        ...classesBase,
        icons: true,
      };

      return html` <ha-icon-button class="${classMap(classes)}" .label=${this.label}>
        <advanced-camera-card-icon
          .hass=${this.hass}
          .icon=${icon}
        ></advanced-camera-card-icon>
      </ha-icon-button>`;
    };

    if (shouldRenderIcon) {
      return renderIcon();
    }

    const classes = {
      ...classesBase,
      thumbnails: true,
    };

    return renderTask(
      this._embedThumbnailTask,
      (embeddedThumbnail: string | null) =>
        embeddedThumbnail
          ? html`<img
              src="${embeddedThumbnail}"
              class="${classMap(classes)}"
              title="${this.label}"
              aria-label="${this.label}"
            />`
          : html``,
      {
        inProgressFunc: () => html`<div class=${classMap(classes)}></div>`,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        errorFunc: (_ev: Error) => renderIcon(),
      },
    );
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(controlStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-next-previous-control': AdvancedCameraCardNextPreviousControl;
  }
}
