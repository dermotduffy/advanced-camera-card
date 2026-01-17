import { CreatePluginType, LoosePluginType } from 'embla-carousel/components/Plugins';
import {
  CSSResultGroup,
  LitElement,
  PropertyValues,
  TemplateResult,
  html,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Ref, createRef, ref } from 'lit/directives/ref.js';
import { TransitionEffect } from '../config/schema/common/transition-effect';
import carouselStyle from '../scss/carousel.scss';
import {
  CarouselController,
  CarouselDirection,
} from '../utils/embla/carousel-controller';
import { getTextDirection } from '../utils/text-direction';

export type EmblaCarouselPlugins = CreatePluginType<
  LoosePluginType,
  Record<string, unknown>
>[];

@customElement('advanced-camera-card-carousel')
export class AdvancedCameraCardCarousel extends LitElement {
  @property({ attribute: true, reflect: true })
  public direction: CarouselDirection = 'horizontal';

  @property({ attribute: true })
  public transitionEffect?: TransitionEffect;

  @property({ attribute: false })
  public loop?: boolean;

  @property({ attribute: false })
  public dragFree?: boolean;

  @property({ attribute: false })
  public dragEnabled = true;

  @property({ attribute: false })
  public plugins?: EmblaCarouselPlugins;

  @property({ attribute: false })
  public wheelScrolling?: boolean;

  @property({ attribute: false })
  public selected = 0;

  protected _refParent: Ref<HTMLSlotElement> = createRef();
  protected _refRoot: Ref<HTMLElement> = createRef();
  protected _carousel: CarouselController | null = null;

  // Track slide count to distinguish user-navigation from content changes.
  protected _previousSlideCount: number | null = null;

  connectedCallback(): void {
    super.connectedCallback();

    // Guarantee recreation of carousel if the component is reconnected.
    this.requestUpdate();
  }

  disconnectedCallback(): void {
    // Destroy the carousel when the component is disconnected, which forces the
    // plugins (which may have registered event handlers) to also be destroyed.
    // The carousel will automatically reconstruct if the component is re-rendered.
    this._carousel?.destroy();
    this._carousel = null;
    super.disconnectedCallback();
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('direction')) {
      this.setAttribute('direction', this.direction);
    }

    const destroyProperties = [
      'direction',
      'dragEnabled',
      'dragFree',
      'loop',
      'plugins',
      'transitionEffect',
    ] as const;
    if (destroyProperties.some((prop) => changedProps.has(prop))) {
      this._carousel?.destroy();
      this._carousel = null;
    }
  }

  protected render(): TemplateResult | void {
    return html` <div class="embla">
      <slot name="left"></slot>
      <div ${ref(this._refRoot)} class="embla__viewport">
        <div class="embla__container">
          <slot ${ref(this._refParent)}></slot>
        </div>
      </div>
      <slot name="right"></slot>
    </div>`;
  }

  protected updated(changedProps: PropertyValues): void {
    const currentSlideCount = this._refParent.value?.assignedElements().length ?? 0;

    if (
      !this._carousel &&
      this._refRoot.value &&
      this._refParent.value &&
      // Never construct a carousel if the node is not connected. There can be a
      // race condition between the Lit update lifecycle, and the
      // disconnect/connect callbacks, causing a carousel to potentially be
      // created after the node is disconnected. This could cause a dangling
      // carousel and hold open connections that should have been closed.
      // See: https://github.com/dermotduffy/advanced-camera-card/issues/1992
      this.isConnected
    ) {
      this._carousel = new CarouselController(
        this._refRoot.value,
        this._refParent.value,
        {
          direction: this.direction,
          dragEnabled: this.dragEnabled,
          dragFree: this.dragFree,
          startIndex: this.selected,
          transitionEffect: this.transitionEffect,
          loop: this.loop,
          plugins: this.plugins,
          textDirection: getTextDirection(this),
          wheelScrolling: this.wheelScrolling,
        },
      );
      this._previousSlideCount = currentSlideCount;
    } else if (changedProps.has('selected') && this._carousel) {
      // Only scroll to selection if the slide count hasn't changed.
      // This distinguishes between:
      // - Navigation (next/prev): count same → scroll to selection
      // - Content change (item removed): count changed → preserve position
      const contentChanged =
        this._previousSlideCount !== null &&
        this._previousSlideCount !== currentSlideCount;

      if (!contentChanged && this.selected !== this._carousel.getSelectedIndex()) {
        this._carousel.selectSlide(this.selected);
      }
    }
    this._previousSlideCount = currentSlideCount;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(carouselStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-carousel': AdvancedCameraCardCarousel;
  }
}
