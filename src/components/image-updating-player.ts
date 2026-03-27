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
import { isEqual } from 'lodash-es';
import { getCameraEntityFromConfig } from '../camera-manager/utils/camera-entity-from-config.js';
import { CachedValueController } from '../components-lib/cached-value-controller.js';
import { UpdatingImageMediaPlayerController } from '../components-lib/media-player/updating-image.js';
import { SignedURLController } from '../components-lib/signed-url-controller.js';
import { CameraConfig } from '../config/schema/cameras.js';
import { type ImageBaseConfig, ImageMode } from '../config/schema/common/image.js';
import { EnabledProxyConfig } from '../config/schema/common/proxy.js';
import { isHassDifferent } from '../ha/is-hass-different.js';
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
  imageConfig?: ImageBaseConfig;
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
 * A media player to wrap an image that updates continuously.
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

  @property({ attribute: false, hasChanged: contentsChanged })
  public proxyConfig?: EnabledProxyConfig;

  // Using contentsChanged to ensure overridden configs (e.g. when the
  // 'show_image_during_load' option is true for live views, an overridden
  // config may be used here).
  @property({ attribute: false, hasChanged: contentsChanged })
  public imageConfig?: ImageBaseConfig;

  @state()
  private _imageLoadError = false;

  private _refImage: Ref<HTMLImageElement> = createRef();

  private _cachedValueController = new CachedValueController(
    this,
    () => this.imageConfig?.refresh_seconds ?? null,
    () => this._getImageSource(),
    () => dispatchMediaPlayEvent(this),
    () => dispatchMediaPauseEvent(this),
    // Clear image load errors on each timer tick so the next render retries the
    // <img>. Retries are bounded by refresh_seconds, not a tight loop.
    () => {
      this._imageLoadError = false;
    },
  );

  private _signedURLController = new SignedURLController(
    this,
    () => ({
      hass: this.hass,
      endpoint: this.imageConfig?.url ? { endpoint: this.imageConfig.url } : undefined,
      proxyConfig: this.proxyConfig,
    }),
    () => {
      this._cachedValueController.clearValue();
      this._imageLoadError = false;
    },
  );

  private _boundVisibilityHandler = this._visibilityHandler.bind(this);

  private _mediaLoadedInfo: MediaLoadedInfo | null = null;

  private _mediaPlayerController = new UpdatingImageMediaPlayerController(
    this,
    () => this._refImage.value ?? null,
    () => this._cachedValueController,
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
      changedProps.has('imageConfig') ||
      changedProps.has('cameraConfig') ||
      changedProps.has('proxyConfig') ||
      changedProps.has('view') ||
      (relevantEntity && !this._getAcceptableState(relevantEntity))
    ) {
      this._cachedValueController?.clearValue();
      this._imageLoadError = false;
    }

    if (!this._cachedValueController?.getValue()) {
      this._cachedValueController?.updateValue();
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
  private _getAcceptableState(entity: string | null): HassEntity | null {
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
    this._imageLoadError = false;
    document.removeEventListener('visibilitychange', this._boundVisibilityHandler);
    super.disconnectedCallback();
  }

  /**
   * Handle document visibility changes.
   */
  private _visibilityHandler(): void {
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
   * Build an image URL that the browser will not cache. Supports two modes:
   * - 'query-string': Appends a `_t` parameter. This is the most robust way to
   *   defeat caching (it bypasses HTTP caches) but it changes the path sent to
   *   the server and so can invalidate signed URLs.
   * - 'fragment': Appends a `_t` fragment. This is less robust (the browser
   *   might still serve from its HTTP cache) but it does not change the URL
   *   sent to the server so it is safe for signed URLs.
   * @param url The input URL.
   * @param mode The cache-busting mode.
   * @returns The cache-busted URL string.
   */
  private _buildCacheBustURL(url: URL, mode: 'query-string' | 'fragment'): string {
    if (mode === 'query-string') {
      url.searchParams.append('_t', String(Date.now()));
    } else {
      url.hash = `_t=${Date.now()}`;
    }
    return url.toString();
  }

  private _addQueryParametersToURL(url: URL, parameters?: string): URL {
    if (parameters) {
      const searchParams = new URLSearchParams(parameters);
      for (const [key, value] of searchParams.entries()) {
        url.searchParams.append(key, value);
      }
    }
    return url;
  }

  private _getRelevantEntityForMode(mode: Exclude<ImageMode, 'auto'>): string | null {
    return mode === 'camera'
      ? getCameraEntityFromConfig(this.cameraConfig)
      : mode === 'entity'
        ? this.imageConfig?.entity ?? null
        : null;
  }

  private _getImageSource(): string {
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
        return this._buildCacheBustURL(urlObj, 'query-string');
      }
    }

    if (this.hass && mode === 'entity' && this.imageConfig?.entity) {
      const state = this._getAcceptableState(this.imageConfig?.entity);
      if (state?.attributes.entity_picture) {
        const urlObj = new URL(state.attributes.entity_picture, document.baseURI);
        this._addQueryParametersToURL(urlObj, this.imageConfig?.entity_parameters);
        return this._buildCacheBustURL(urlObj, 'query-string');
      }
    }

    if (mode === 'url' && this.imageConfig?.url) {
      const url = this._signedURLController.getValue();
      if (url) {
        const urlObj = new URL(url, document.baseURI);
        if (this.proxyConfig?.enabled) {
          // Use a fragment for cache-busting proxied URLs, as this does not
          // change the path and thus preserves the validity of the signed URL.
          return this._buildCacheBustURL(urlObj, 'fragment');
        }
        return this._buildCacheBustURL(urlObj, 'query-string');
      }
    }

    return defaultImage;
  }

  /**
   * Force the img element to a safe image.
   */
  private _forceSafeImage(stockOnly?: boolean): void {
    if (this._refImage.value) {
      // Avoid restoring the raw configured URL when proxying is enabled, since
      // that would bypass the proxied/signed URL path on visibility changes.
      const configuredURL =
        !stockOnly && !this.proxyConfig?.enabled ? this.imageConfig?.url ?? null : null;
      this._refImage.value.src = configuredURL ?? defaultImage;
    }
  }

  private _getDisplayMessage(): Message | null {
    const error = this._signedURLController.getError();
    if (error) {
      return {
        type: 'error',
        message: localize(
          error === 'proxy' ? 'error.failed_proxy' : 'error.failed_sign',
        ),
        context: this.proxyConfig,
      };
    }
    if (this._imageLoadError) {
      return {
        type: 'error',
        message: localize('error.image_load_error'),
        context: this.imageConfig,
      };
    }
    return null;
  }

  protected render(): TemplateResult | void {
    const message = this._getDisplayMessage();
    if (message) {
      return renderMessage(message);
    }

    const src = this._cachedValueController?.getValue();

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
                this._imageLoadError = true;
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
