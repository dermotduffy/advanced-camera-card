import { Task, TaskStatus } from '@lit-labs/task';
import {
  CSSResult,
  LitElement,
  PropertyValues,
  TemplateResult,
  html,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { HomeAssistant } from '../../../ha/types';
import { localize } from '../../../localize/localize';
import thumbnailFeatureThumbnailStyle from '../../../scss/thumbnail-feature-thumbnail.scss';
import { renderTask } from '../../../utils/task';
import {
  FetchThumbnailTaskArgs,
  createFetchThumbnailTask,
} from '../../../utils/thumbnail';

@customElement('advanced-camera-card-thumbnail-feature-thumbnail')
export class AdvancedCameraCardThumbnailFeatureThumbnail extends LitElement {
  @property({ attribute: false })
  public thumbnail?: string;

  @property({ attribute: false })
  public hass?: HomeAssistant;

  protected _embedThumbnailTask?: Task<FetchThumbnailTaskArgs, string | null>;

  // Only load thumbnails on view in case there is a very large number of them.
  protected _intersectionObserver = new IntersectionObserver(
    this._intersectionHandler.bind(this),
  );

  connectedCallback(): void {
    super.connectedCallback();
    this._intersectionObserver.observe(this);
  }

  disconnectedCallback(): void {
    this._intersectionObserver.disconnect();
    super.disconnectedCallback();
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('thumbnail')) {
      this._embedThumbnailTask = createFetchThumbnailTask(
        this,
        () => this.hass,
        () => this.thumbnail,
        false,
      );
      // Reset the observer so the initial intersection handler call will set
      // the visibility correctly.
      this._intersectionObserver.unobserve(this);
      this._intersectionObserver.observe(this);
    }
  }

  protected _intersectionHandler(entries: IntersectionObserverEntry[]): void {
    if (
      this._embedThumbnailTask?.status === TaskStatus.INITIAL &&
      entries.some((entry) => entry.isIntersecting)
    ) {
      this._embedThumbnailTask?.run();
    }
  }

  protected render(): TemplateResult | void {
    const imageOff = html`<advanced-camera-card-icon
      .icon=${{ icon: 'mdi:image-off' }}
      title=${localize('thumbnail.no_thumbnail')}
    ></advanced-camera-card-icon> `;

    if (!this._embedThumbnailTask) {
      return imageOff;
    }

    return html`${this.thumbnail
      ? renderTask(
          this._embedThumbnailTask,
          (embeddedThumbnail: string | null) =>
            embeddedThumbnail ? html`<img src="${embeddedThumbnail}" />` : html``,
          {
            inProgressFunc: () =>
              html`<advanced-camera-card-icon
                .icon=${{ icon: 'mdi:image-refresh' }}
                title=${localize('thumbnail.no_thumbnail')}
              ></advanced-camera-card-icon> `,
            errorFunc: () => imageOff,
          },
        )
      : imageOff} `;
  }

  static get styles(): CSSResult {
    return unsafeCSS(thumbnailFeatureThumbnailStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-thumbnail-feature-thumbnail': AdvancedCameraCardThumbnailFeatureThumbnail;
  }
}
