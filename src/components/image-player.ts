import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { ImageMediaPlayerController } from '../components-lib/media-player/image';
import imagePlayerStyle from '../scss/image-player.scss';
import {
  MediaPlayer,
  MediaPlayerController,
  MediaPlayerElement,
  MediaTechnology,
} from '../types';
import { dispatchMediaLoadedEvent } from '../utils/media-info';

/**
 * A simple media player to wrap a single static image.
 */
@customElement('advanced-camera-card-image-player')
export class AdvancedCameraCardImagePlayer extends LitElement implements MediaPlayer {
  @property()
  public url?: string;

  @property()
  public technology?: MediaTechnology;

  protected _refImage: Ref<MediaPlayerElement<HTMLImageElement>> = createRef();
  protected _mediaPlayerController = new ImageMediaPlayerController(
    this,
    () => this._refImage.value ?? null,
  );

  public async getMediaPlayerController(): Promise<MediaPlayerController | null> {
    return this._mediaPlayerController;
  }

  protected render(): TemplateResult | void {
    return html`<img
      ${ref(this._refImage)}
      src="${ifDefined(this.url)}"
      @load=${(ev: Event) => {
        dispatchMediaLoadedEvent(this, ev, {
          ...(this._mediaPlayerController && {
            mediaPlayerController: this._mediaPlayerController,
          }),
          technology: [this.technology ?? ('jpg' as const)],
        });
      }}
    />`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(imagePlayerStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-image-player': AdvancedCameraCardImagePlayer;
  }
}
