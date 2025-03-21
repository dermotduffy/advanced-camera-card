import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CameraManager } from '../camera-manager/manager.js';
import { ViewManagerEpoch } from '../card-controller/view/types.js';
import { ThumbnailsControlConfig } from '../config/schema/common/controls/thumbnails.js';
import { HomeAssistant } from '../ha/types.js';
import thumbnailCarouselStyle from '../scss/thumbnail-carousel.scss';
import { stopEventFromActivatingCardWideActions } from '../utils/action.js';
import { CarouselDirection } from '../utils/embla/carousel-controller.js';
import { fireAdvancedCameraCardEvent } from '../utils/fire-advanced-camera-card-event.js';
import { MediaQueriesResults } from '../view/media-queries-results';
import './carousel.js';
import './thumbnail.js';

export interface ThumbnailCarouselTap {
  queryResults: MediaQueriesResults;
}

@customElement('advanced-camera-card-thumbnail-carousel')
export class AdvancedCameraCardThumbnailCarousel extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public config?: ThumbnailsControlConfig;

  @property({ attribute: false })
  public fadeThumbnails = false;

  protected _thumbnailSlides: TemplateResult[] = [];

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('config')) {
      if (this.config?.size) {
        this.style.setProperty(
          '--advanced-camera-card-thumbnail-size',
          `${this.config.size}px`,
        );
      }
      const direction = this._getDirection();
      if (direction) {
        this.setAttribute('direction', direction);
      } else {
        this.removeAttribute('direction');
      }
    }

    const renderProperties = [
      'cameraManager',
      'config',
      'transitionEffect',
      'viewManagerEpoch',
    ] as const;
    if (renderProperties.some((prop) => changedProps.has(prop))) {
      this._thumbnailSlides = this._renderSlides();
    }

    if (changedProps.has('viewManagerEpoch')) {
      this.style.setProperty(
        '--advanced-camera-card-carousel-thumbnail-opacity',
        !this.fadeThumbnails || this._getSelectedSlide() === null ? '1.0' : '0.4',
      );
    }
  }

  protected _getSelectedSlide(): number | null {
    return (
      this.viewManagerEpoch?.manager.getView()?.queryResults?.getSelectedIndex() ?? null
    );
  }

  protected _renderSlides(): TemplateResult[] {
    const slides: TemplateResult[] = [];
    const view = this.viewManagerEpoch?.manager.getView();
    const seekTarget = view?.context?.mediaViewer?.seek;
    const selectedIndex = this._getSelectedSlide();

    for (const media of view?.queryResults?.getResults() ?? []) {
      const index = slides.length;
      const classes = {
        embla__slide: true,
        'slide-selected': selectedIndex === index,
      };

      slides.push(
        html` <advanced-camera-card-thumbnail
          class="${classMap(classes)}"
          .cameraManager=${this.cameraManager}
          .hass=${this.hass}
          .media=${media}
          .viewManagerEpoch=${this.viewManagerEpoch}
          .seek=${seekTarget && media.includesTime(seekTarget) ? seekTarget : undefined}
          ?details=${!!this.config?.show_details}
          ?show_favorite_control=${this.config?.show_favorite_control}
          ?show_timeline_control=${this.config?.show_timeline_control}
          ?show_download_control=${this.config?.show_download_control}
          @click=${(ev: Event) => {
            const view = this.viewManagerEpoch?.manager.getView();
            if (view && view.queryResults) {
              fireAdvancedCameraCardEvent<ThumbnailCarouselTap>(
                this,
                'thumbnail-carousel:tap',
                {
                  queryResults: view.queryResults.clone().selectIndex(index),
                },
              );
            }
            stopEventFromActivatingCardWideActions(ev);
          }}
        >
        </advanced-camera-card-thumbnail>`,
      );
    }
    return slides;
  }

  protected _getDirection(): CarouselDirection | null {
    if (this.config?.mode === 'left' || this.config?.mode === 'right') {
      return 'vertical';
    } else if (this.config?.mode === 'above' || this.config?.mode === 'below') {
      return 'horizontal';
    }
    return null;
  }

  protected render(): TemplateResult | void {
    const direction = this._getDirection();
    if (!this._thumbnailSlides.length || !this.config || !direction) {
      return;
    }

    return html`<advanced-camera-card-carousel
      direction=${direction}
      .selected=${this._getSelectedSlide() ?? 0}
      .dragFree=${true}
    >
      ${this._thumbnailSlides}
    </advanced-camera-card-carousel>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(thumbnailCarouselStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-thumbnail-carousel': AdvancedCameraCardThumbnailCarousel;
  }
}
