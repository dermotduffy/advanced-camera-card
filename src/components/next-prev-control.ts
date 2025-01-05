import { HomeAssistant } from '@dermotduffy/custom-card-helpers';
import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { NextPreviousControlConfig } from '../config/types.js';
import controlStyle from '../scss/next-previous-control.scss';
import { Icon } from '../types.js';
import { renderTask } from '../utils/task.js';
import { createFetchThumbnailTask } from '../utils/thumbnail.js';

@customElement('frigate-card-next-previous-control')
export class FrigateCardNextPreviousControl extends LitElement {
  @property({ attribute: false })
  public side?: 'left' | 'right';

  set controlConfig(controlConfig: NextPreviousControlConfig | undefined) {
    if (controlConfig?.size) {
      this.style.setProperty('--frigate-card-next-prev-size', `${controlConfig.size}px`);
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

  @state()
  protected _thumbnailError = false;

  protected _embedThumbnailTask = createFetchThumbnailTask(
    this,
    () => this.hass,
    () => this.thumbnail,
  );

  protected render(): TemplateResult {
    if (this.disabled || !this._controlConfig || this._controlConfig.style == 'none') {
      return html``;
    }

    const renderIcon =
      !this.thumbnail ||
      ['chevrons', 'icons'].includes(this._controlConfig.style) ||
      this._thumbnailError;

    const classes = {
      controls: true,
      left: this.side === 'left',
      right: this.side === 'right',
      thumbnails: !renderIcon,
      icons: renderIcon,
    };

    if (renderIcon) {
      const icon =
        this.icon && !this._thumbnailError && this._controlConfig.style !== 'chevrons'
          ? this.icon
          : this.side === 'left'
            ? { icon: 'mdi:chevron-left' }
            : { icon: 'mdi:chevron-right' };

      return html` <ha-icon-button class="${classMap(classes)}" .label=${this.label}>
        <frigate-card-icon .hass=${this.hass} .icon=${icon}></frigate-card-icon>
      </ha-icon-button>`;
    }

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
        errorFunc: (_e: Error) => {
          this._thumbnailError = true;
        },
      },
    );
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(controlStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-next-previous-control': FrigateCardNextPreviousControl;
  }
}
