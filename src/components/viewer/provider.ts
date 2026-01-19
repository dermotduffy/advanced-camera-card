import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import { CameraManager } from '../../camera-manager/manager.js';
import { QueryType } from '../../camera-manager/types.js';
import { ViewManagerEpoch } from '../../card-controller/view/types.js';
import { LazyLoadController } from '../../components-lib/lazy-load-controller.js';
import { ZoomSettingsObserved } from '../../components-lib/zoom/types.js';
import { handleZoomSettingsObservedEvent } from '../../components-lib/zoom/zoom-view-context.js';
import { CameraConfig } from '../../config/schema/cameras.js';
import { CardWideConfig } from '../../config/schema/types.js';
import { ViewerConfig } from '../../config/schema/viewer.js';
import { canonicalizeHAURL } from '../../ha/canonical-url.js';
import { isHARelativeURL } from '../../ha/is-ha-relative-url.js';
import { ResolvedMediaCache, resolveMedia } from '../../ha/resolved-media.js';
import { homeAssistantSignPath } from '../../ha/sign-path.js';
import { HomeAssistant, ResolvedMedia } from '../../ha/types.js';
import { createProxiedEndpointIfNecessary } from '../../ha/web-proxy.js';
import '../../patches/ha-hls-player.js';
import viewerProviderStyle from '../../scss/viewer-provider.scss';
import { MediaPlayer, MediaPlayerController, MediaPlayerElement } from '../../types.js';
import { errorToConsole } from '../../utils/basic.js';
import { ViewItemClassifier } from '../../view/item-classifier.js';
import { VideoContentType, ViewMedia } from '../../view/item.js';
import { UnifiedQueryTransformer } from '../../view/unified-query-transformer.js';
import '../image-player.js';
import { renderProgressIndicator } from '../progress-indicator.js';
import '../video-player.js';
import './../media-dimensions-container';

@customElement('advanced-camera-card-viewer-provider')
export class AdvancedCameraCardViewerProvider extends LitElement implements MediaPlayer {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public media?: ViewMedia;

  @property({ attribute: false })
  public viewerConfig?: ViewerConfig;

  @property({ attribute: false })
  public resolvedMediaCache?: ResolvedMediaCache;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  protected _refProvider: Ref<MediaPlayerElement> = createRef();
  protected _refContainer: Ref<HTMLElement> = createRef();
  protected _lazyLoadController: LazyLoadController = new LazyLoadController(this);

  @state()
  protected _url: string | null = null;

  constructor() {
    super();
    this._lazyLoadController.addListener((loaded) => loaded && this._setURL());
  }

  public async getMediaPlayerController(): Promise<MediaPlayerController | null> {
    await this.updateComplete;
    return (await this._refProvider.value?.getMediaPlayerController()) ?? null;
  }

  protected async _switchToRelatedClipView(): Promise<void> {
    const view = this.viewManagerEpoch?.manager.getView();
    if (
      !this.hass ||
      !view ||
      !this.cameraManager ||
      !this.media ||
      // If this specific media item has no clip, then do nothing (even if all
      // the other media items do).
      !ViewItemClassifier.isEvent(this.media) ||
      !view.query?.hasMediaQueriesOfType(QueryType.Event)
    ) {
      return;
    }

    // Convert the query to a clips equivalent.
    const clipQuery = UnifiedQueryTransformer.convertToClips(view.query);

    await this.viewManagerEpoch?.manager.setViewByParametersWithExistingQuery({
      params: {
        view: 'media',
        query: clipQuery,
      },
      queryExecutorOptions: {
        selectResult: {
          id: this.media.getID() ?? undefined,
        },
        rejectResults: (results) => !results.hasSelectedResult(),
      },
    });
  }

  protected async _setURL(): Promise<void> {
    const mediaContentID = this.media?.getContentID();
    if (
      !this.media ||
      !mediaContentID ||
      !this.hass ||
      !this._lazyLoadController?.isLoaded()
    ) {
      return;
    }

    let resolvedMedia: ResolvedMedia | null =
      this.resolvedMediaCache?.get(mediaContentID) ?? null;
    if (!resolvedMedia) {
      resolvedMedia = await resolveMedia(
        this.hass,
        mediaContentID,
        this.resolvedMediaCache,
      );
    }

    if (!resolvedMedia) {
      return;
    }

    const unsignedURL = resolvedMedia.url;
    if (isHARelativeURL(unsignedURL)) {
      // No need to proxy or sign local resolved URLs.
      this._url = canonicalizeHAURL(this.hass, unsignedURL);
      return;
    }

    const cameraID = this.media.getCameraID();
    const camera = cameraID ? this.cameraManager?.getStore().getCamera(cameraID) : null;
    const proxyConfig = camera?.getProxyConfig();

    if (!proxyConfig) {
      this._url = unsignedURL;
      return;
    }

    try {
      // Create endpoint from unsigned URL - it doesn't need signing initially
      const unsignedEndpoint = { endpoint: unsignedURL, sign: false };
      const proxiedEndpoint = await createProxiedEndpointIfNecessary(
        this.hass,
        unsignedEndpoint,
        proxyConfig,
        {
          context: 'media',
          // The link may need to be opened multiple times.
          openLimit: 0,
        },
      );

      if (proxiedEndpoint.sign) {
        this._url = await homeAssistantSignPath(this.hass, proxiedEndpoint.endpoint);
      } else {
        this._url = proxiedEndpoint.endpoint;
      }
    } catch (e) {
      errorToConsole(e as Error);
    }
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (
      changedProps.has('viewerConfig') ||
      (!this._lazyLoadController && this.viewerConfig)
    ) {
      this._lazyLoadController.setConfiguration(this.viewerConfig?.lazy_load);
    }

    if (
      changedProps.has('media') ||
      changedProps.has('viewerConfig') ||
      changedProps.has('resolvedMediaCache') ||
      changedProps.has('hass')
    ) {
      this._setURL();
    }

    if (changedProps.has('viewerConfig') && this.viewerConfig?.zoomable) {
      import('../zoomer.js');
    }
  }

  private _getRelevantCameraConfig(): CameraConfig | null {
    const cameraID = this.media?.getCameraID();
    return cameraID
      ? this.cameraManager?.getStore().getCameraConfig(cameraID) ?? null
      : null;
  }

  protected _renderContainer(template: TemplateResult): TemplateResult {
    if (!this.media) {
      return template;
    }
    const cameraID = this.media.getCameraID();
    const mediaID = this.media.getID() ?? undefined;
    const cameraConfig = cameraID
      ? this.cameraManager?.getStore().getCameraConfig(cameraID) ?? null
      : null;
    const view = this.viewManagerEpoch?.manager.getView();

    const intermediateTemplate = html` <advanced-camera-card-media-dimensions-container
      .dimensionsConfig=${this._getRelevantCameraConfig()?.dimensions}
    >
      ${template}
    </advanced-camera-card-media-dimensions-container>`;

    return html`
      ${this.viewerConfig?.zoomable
        ? html`<advanced-camera-card-zoomer
            .defaultSettings=${guard([cameraConfig?.dimensions?.layout], () =>
              cameraConfig?.dimensions?.layout
                ? {
                    pan: cameraConfig.dimensions.layout.pan,
                    zoom: cameraConfig.dimensions.layout.zoom,
                  }
                : undefined,
            )}
            .settings=${mediaID ? view?.context?.zoom?.[mediaID]?.requested : undefined}
            @advanced-camera-card:zoom:zoomed=${async () =>
              (await this.getMediaPlayerController())?.setControls(false)}
            @advanced-camera-card:zoom:unzoomed=${async () =>
              (await this.getMediaPlayerController())?.setControls()}
            @advanced-camera-card:zoom:change=${(
              ev: CustomEvent<ZoomSettingsObserved>,
            ) =>
              handleZoomSettingsObservedEvent(
                ev,
                this.viewManagerEpoch?.manager,
                mediaID,
              )}
          >
            ${intermediateTemplate}
          </advanced-camera-card-zoomer>`
        : intermediateTemplate}
    `;
  }

  protected render(): TemplateResult | void {
    if (
      !this._lazyLoadController?.isLoaded() ||
      !this.media ||
      !this.hass ||
      !this.viewerConfig
    ) {
      return;
    }

    if (!this._url) {
      return renderProgressIndicator({
        cardWideConfig: this.cardWideConfig,
      });
    }

    // Note: crossorigin="anonymous" is required on <video> below in order to
    // allow screenshot of motionEye videos which currently go cross-origin.
    return this._renderContainer(html`
      ${ViewItemClassifier.isVideo(this.media)
        ? this.media.getVideoContentType() === VideoContentType.HLS
          ? html`<advanced-camera-card-ha-hls-player
              ${ref(this._refProvider)}
              allow-exoplayer
              aria-label="${this.media.getTitle() ?? ''}"
              ?autoplay=${false}
              controls
              muted
              playsinline
              title="${this.media.getTitle() ?? ''}"
              url=${this._url}
              .hass=${this.hass}
              ?controls=${this.viewerConfig.controls.builtin}
            >
            </advanced-camera-card-ha-hls-player>`
          : html`
              <advanced-camera-card-video-player
                ${ref(this._refProvider)}
                url=${this._url}
                aria-label="${this.media.getTitle() ?? ''}"
                title="${this.media.getTitle() ?? ''}"
                ?controls=${this.viewerConfig.controls.builtin}
              >
              </advanced-camera-card-video-player>
            `
        : html`<advanced-camera-card-image-player
            ${ref(this._refProvider)}
            url="${this._url}"
            aria-label="${this.media.getTitle() ?? ''}"
            title="${this.media.getTitle() ?? ''}"
            @click=${() => {
              if (this.viewerConfig?.snapshot_click_plays_clip) {
                this._switchToRelatedClipView();
              }
            }}
          ></advanced-camera-card-image-player>`}
    `);
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(viewerProviderStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-viewer-provider': AdvancedCameraCardViewerProvider;
  }
}
