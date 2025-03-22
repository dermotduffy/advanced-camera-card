import { HassEntity } from 'home-assistant-js-websocket';
import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import isEqual from 'lodash-es/isEqual';
import { CameraManager } from '../camera-manager/manager.js';
import { getCameraEntityFromConfig } from '../camera-manager/utils/camera-entity-from-config.js';
import { CachedValueController } from '../components-lib/cached-value-controller.js';
import { UpdatingImageMediaPlayerController } from '../components-lib/media-player/updating-image.js';
import { CameraConfig } from '../config/schema/cameras.js';
import { ImageMode } from '../config/schema/common/image.js';
import { ImageViewConfig } from '../config/schema/image.js';
import { HomeAssistant } from '../ha/types.js';
import defaultImage from '../images/iris-screensaver.jpg';
import { localize } from '../localize/localize.js';
import imageUpdatingPlayerStyle from '../scss/image-updating-player.scss';
import {
  MediaLoadedInfo,
  MediaPlayer,
  MediaPlayerController,
  Message,
} from '../types.js';
import { contentsChanged } from '../utils/basic.js';
import { isHassDifferent } from '../utils/ha/index.js';
import {
  createMediaLoadedInfo,
  dispatchExistingMediaLoadedInfoAsEvent,
  dispatchMediaPauseEvent,
  dispatchMediaPlayEvent,
} from '../utils/media-info.js';
import { View } from '../view/view.js';
import { renderMessage } from './message.js';

// See TOKEN_CHANGE_INTERVAL in https://github.com/home-assistant/core/blob/dev/homeassistant/components/camera/__init__.py .
const HASS_REJECTION_CUTOFF_MS = 5 * 60 * 1000;

export const resolveImageMode = (options?: {
  imageConfig?: ImageViewConfig;
  cameraConfig?: CameraConfig;
}): Exclude<ImageMode, 'auto'> => {
  if (!options?.imageConfig?.mode) {
    return 'screensaver';
  } else if (options?.imageConfig?.mode !== 'auto') {
    return options.imageConfig.mode;
  }

  if (options?.imageConfig?.entity) {
    return 'entity';
  } else if (options?.imageConfig?.url) {
    return 'url';
  } else if (getCameraEntityFromConfig(options.cameraConfig)) {
    return 'camera';
  }

  return 'screensaver';
};

/**
 * A media player to wrap a image that updates continuously.
 */
@customElement('advanced-camera-card-image-updating-player')
export class AdvancedCameraCardImageUpdatingPlayer
  extends LitElement
  implements MediaPlayer
{
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public view?: Readonly<View>;

  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  // Using contentsChanged to ensure overridden configs (e.g. when the
  // 'show_image_during_load' option is true for live views, an overridden
  // config may be used here).
  @property({ attribute: false, hasChanged: contentsChanged })
  public imageConfig?: ImageViewConfig;

  @state()
  protected _message: Message | null = null;

  protected _refImage: Ref<HTMLImageElement> = createRef();

  protected _cachedValueController?: CachedValueController<string>;
  protected _boundVisibilityHandler = this._visibilityHandler.bind(this);

  protected _mediaLoadedInfo: MediaLoadedInfo | null = null;

  protected _mediaPlayerController = new UpdatingImageMediaPlayerController(
    this,
    () => this._refImage.value ?? null,
    () => this._cachedValueController ?? null,
  );

  public async getMediaPlayerController(): Promise<MediaPlayerController | null> {
    return this._mediaPlayerController;
  }

  /**
   * Determine whether the element should be updated.
   * @param changedProps The changed properties if any.
   * @returns `true` if the element should be updated.
   */
  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (!this.hass || document.visibilityState !== 'visible') {
      return false;
    }

    const relevantEntity = this._getRelevantEntityForMode(
      resolveImageMode({
        imageConfig: this.imageConfig,
        cameraConfig: this.cameraConfig,
      }),
    );

    if (changedProps.has('hass') && changedProps.size == 1 && relevantEntity) {
      if (isHassDifferent(this.hass, changedProps.get('hass'), [relevantEntity])) {
        // If the state of the camera entity has changed, remove the cached
        // value (will be re-calculated in willUpdate). This is important to
        // ensure a changed access token is immediately used.
        this._cachedValueController?.clearValue();
        return true;
      }
      return !this.hasUpdated;
    }
    return true;
  }

  /**
   * Ensure there is a cached value before an update.
   * @param _changedProps The changed properties
   */
  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('imageConfig')) {
      if (this._cachedValueController) {
        this._cachedValueController.removeController();
      }
      if (this.imageConfig) {
        this._cachedValueController = new CachedValueController(
          this,
          this.imageConfig.refresh_seconds,
          this._getImageSource.bind(this),
          () => dispatchMediaPlayEvent(this),
          () => dispatchMediaPauseEvent(this),
        );
      }
    }

    const relevantEntity = this._getRelevantEntityForMode(
      resolveImageMode({
        imageConfig: this.imageConfig,
        cameraConfig: this.cameraConfig,
      }),
    );

    // If the camera or view changed, immediately discard the old value (view to
    // allow pressing of the image button to fetch a fresh image). Likewise, if
    // the state is not acceptable, discard the old value (to allow a stock or
    // backup image to be displayed).
    if (
      changedProps.has('cameraConfig') ||
      changedProps.has('view') ||
      (relevantEntity && !this._getAcceptableState(relevantEntity))
    ) {
      this._cachedValueController?.clearValue();
    }

    if (!this._cachedValueController?.value) {
      this._cachedValueController?.updateValue();
    }

    if (['imageConfig', 'view'].some((prop) => changedProps.has(prop))) {
      this._message = null;
    }
  }

  /**
   * Determine if a given entity is acceptable as the basis for an image render
   * (detects old or disconnected states). Using an old state is problematic as
   * it runs the risk that the JS has an old access token for the camera, and
   * that results in a notification on the HA UI about a failed login. See:
   * https://github.com/dermotduffy/advanced-camera-card/issues/398 .
   * @param entity The entity.
   * @returns The state or null if not acceptable.
   */
  protected _getAcceptableState(entity: string | null): HassEntity | null {
    const state = (entity ? this.hass?.states[entity] : null) ?? null;

    return !!this.hass &&
      this.hass.connected &&
      !!state &&
      Date.now() - Date.parse(state.last_updated) < HASS_REJECTION_CUTOFF_MS
      ? state
      : null;
  }

  /**
   * Component connected callback.
   */
  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('visibilitychange', this._boundVisibilityHandler);
    this._cachedValueController?.startTimer();
  }

  /**
   * Component disconnected callback.
   */
  disconnectedCallback(): void {
    this._cachedValueController?.stopTimer();
    this._message = null;
    document.removeEventListener('visibilitychange', this._boundVisibilityHandler);
    super.disconnectedCallback();
  }

  /**
   * Handle document visibility changes.
   */
  protected _visibilityHandler(): void {
    if (!this._refImage.value) {
      return;
    }
    if (document.visibilityState === 'hidden') {
      // Set the image to default when the document is hidden. This is to avoid
      // some browsers (e.g. Firefox) eagerly re-loading the old image when the
      // document regains visibility -- for some images (e.g. camera mode) the
      // image may be using an old-expired token and re-use prior to
      // re-generation of a new URL would generate an unauthorized request
      // (401), see:
      // https://github.com/dermotduffy/advanced-camera-card/issues/398
      this._cachedValueController?.stopTimer();
      this._cachedValueController?.clearValue();
      this._forceSafeImage();
    } else {
      // If the document is freshly re-visible, immediately re-render it to
      // restore the image src. If the HASS object is old (i.e. browser tab was
      // inactive for some time) this update request may be (correctly)
      // rejected.
      this._cachedValueController?.startTimer();
      this.requestUpdate();
    }
  }

  /**
   * Build a working absolute image URL that the browser will not cache.
   * @param url An input URL (may be relative to document origin)
   * @returns A new URL as a string (absolute, will not be browser cached).
   */
  protected _buildImageURL(url: URL): string {
    url.searchParams.append('_t', String(Date.now()));
    return url.toString();
  }

  protected _addQueryParametersToURL(url: URL, parameters?: string): URL {
    if (parameters) {
      const searchParams = new URLSearchParams(parameters);
      for (const [key, value] of searchParams.entries()) {
        url.searchParams.append(key, value);
      }
    }
    return url;
  }

  protected _getRelevantEntityForMode(mode: Exclude<ImageMode, 'auto'>): string | null {
    return mode === 'camera'
      ? getCameraEntityFromConfig(this.cameraConfig)
      : mode === 'entity'
        ? this.imageConfig?.entity ?? null
        : null;
  }

  protected _getImageSource(): string {
    const mode = resolveImageMode({
      imageConfig: this.imageConfig,
      cameraConfig: this.cameraConfig,
    });

    if (this.hass && mode === 'camera') {
      const state = this._getAcceptableState(
        getCameraEntityFromConfig(this.cameraConfig),
      );
      if (state?.attributes.entity_picture) {
        const urlObj = new URL(state.attributes.entity_picture, document.baseURI);
        this._addQueryParametersToURL(urlObj, this.imageConfig?.entity_parameters);
        return this._buildImageURL(urlObj);
      }
    }

    if (this.hass && mode === 'entity' && this.imageConfig?.entity) {
      const state = this._getAcceptableState(this.imageConfig?.entity);
      if (state?.attributes.entity_picture) {
        const urlObj = new URL(state.attributes.entity_picture, document.baseURI);
        this._addQueryParametersToURL(urlObj, this.imageConfig?.entity_parameters);
        return this._buildImageURL(urlObj);
      }
    }

    if (mode === 'url' && this.imageConfig?.url) {
      return this._buildImageURL(new URL(this.imageConfig.url, document.baseURI));
    }

    return defaultImage;
  }

  /**
   * Force the img element to a safe image.
   */
  protected _forceSafeImage(stockOnly?: boolean): void {
    if (this._refImage.value) {
      this._refImage.value.src =
        !stockOnly && this.imageConfig?.url ? this.imageConfig.url : defaultImage;
    }
  }

  protected render(): TemplateResult | void {
    if (this._message) {
      return renderMessage(this._message);
    }

    const src = this._cachedValueController?.value;
    // Note the use of live() below to ensure the update will restore the image
    // src if it's been changed via _forceSafeImage().
    return src
      ? html`
          <img
            ${ref(this._refImage)}
            src=${live(src)}
            @load=${(ev: Event) => {
              const mediaLoadedInfo = createMediaLoadedInfo(ev, {
                mediaPlayerController: this._mediaPlayerController,
                capabilities: {
                  supportsPause: !!this.imageConfig?.refresh_seconds,
                },
              });
              // Avoid the media being reported as repeatedly loading unless the
              // media info changes.
              if (mediaLoadedInfo && !isEqual(this._mediaLoadedInfo, mediaLoadedInfo)) {
                this._mediaLoadedInfo = mediaLoadedInfo;
                dispatchExistingMediaLoadedInfoAsEvent(this, mediaLoadedInfo);
              }
            }}
            @error=${() => {
              const mode = resolveImageMode({
                imageConfig: this.imageConfig,
                cameraConfig: this.cameraConfig,
              });
              if (mode === 'camera' || mode === 'entity') {
                // In camera or entity mode, the user has likely not made an
                // error, but HA may be unavailble, so show the stock image.
                // Don't let the URL override the stock image in this case, as
                // this could create an error loop if that URL subsequently
                // failed to load.
                this._forceSafeImage(true);
              } else if (mode === 'url') {
                // In url mode, the user likely specified a URL that cannot be
                // resolved. Show an error message.
                this._message = {
                  type: 'error',
                  message: localize('error.image_load_error'),
                  context: this.imageConfig,
                };
              }
            }}
          />
        `
      : html``;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(imageUpdatingPlayerStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-image-updating-player': AdvancedCameraCardImageUpdatingPlayer;
  }
}
