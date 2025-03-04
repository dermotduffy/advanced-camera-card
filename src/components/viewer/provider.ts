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
import { ViewManagerEpoch } from '../../card-controller/view/types.js';
import { ZoomSettingsObserved } from '../../components-lib/zoom/types.js';
import { handleZoomSettingsObservedEvent } from '../../components-lib/zoom/zoom-view-context.js';
import { CardWideConfig, ViewerConfig } from '../../config/types.js';
import '../../patches/ha-hls-player.js';
import viewerProviderStyle from '../../scss/viewer-provider.scss';
import {
  ExtendedHomeAssistant,
  MediaPlayer,
  MediaPlayerController,
  MediaPlayerElement,
  ResolvedMedia,
} from '../../types.js';
import { aspectRatioToString, errorToConsole } from '../../utils/basic.js';
import {
  canonicalizeHAURL,
  homeAssistantSignPath,
  isHARelativeURL,
} from '../../utils/ha/index.js';
import { ResolvedMediaCache, resolveMedia } from '../../utils/ha/resolved-media.js';
import {
  addDynamicProxyURL,
  getWebProxiedURL,
  shouldUseWebProxy,
} from '../../utils/ha/web-proxy.js';
import { updateElementStyleFromMediaLayoutConfig } from '../../utils/media-layout.js';
import { ViewMediaClassifier } from '../../view/media-classifier.js';
import { MediaQueriesClassifier } from '../../view/media-queries-classifier.js';
import { VideoContentType, ViewMedia } from '../../view/media.js';
import '../image-player.js';
import { renderProgressIndicator } from '../progress-indicator.js';
import '../video-player.js';

@customElement('advanced-camera-card-viewer-provider')
export class AdvancedCameraCardViewerProvider extends LitElement implements MediaPlayer {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public media?: ViewMedia;

  @property({ attribute: false })
  public viewerConfig?: ViewerConfig;

  @property({ attribute: false })
  public resolvedMediaCache?: ResolvedMediaCache;

  // Whether or not to load the viewer media. If `false`, no contents are
  // rendered until this attribute is set to `true` (this is useful for lazy
  // loading).
  @property({ attribute: false })
  public load = false;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  protected _refProvider: Ref<MediaPlayerElement> = createRef();

  @state()
  protected _url: string | null = null;

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
      !ViewMediaClassifier.isEvent(this.media) ||
      !MediaQueriesClassifier.areEventQueries(view.query)
    ) {
      return;
    }

    // Convert the query to a clips equivalent.
    const clipQuery = view.query.clone();
    clipQuery.convertToClipsQueries();

    const queries = clipQuery.getQueries();
    if (!queries) {
      return;
    }

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
      (this.viewerConfig?.lazy_load && !this.load)
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

    const camera = this.cameraManager?.getStore().getCamera(this.media.getCameraID());
    const proxyConfig = camera?.getProxyConfig();

    if (proxyConfig && shouldUseWebProxy(this.hass, proxyConfig, 'media')) {
      if (proxyConfig.dynamic) {
        // Don't use URL() parsing, since that will strip the port number if
        // it's the default, just need to strip any hash part of the URL.
        const urlWithoutQSorHash = unsignedURL.split(/#/)[0];
        await addDynamicProxyURL(this.hass, urlWithoutQSorHash, {
          sslVerification: proxyConfig.ssl_verification,
          sslCiphers: proxyConfig.ssl_ciphers,

          // The link may need to be opened multiple times.
          openLimit: 0,
        });
      }

      try {
        this._url = await homeAssistantSignPath(
          this.hass,
          getWebProxiedURL(unsignedURL),
        );
      } catch (e) {
        errorToConsole(e as Error);
      }
    } else {
      this._url = unsignedURL;
    }
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (
      changedProps.has('load') ||
      changedProps.has('media') ||
      changedProps.has('viewerConfig') ||
      changedProps.has('resolvedMediaCache') ||
      changedProps.has('hass')
    ) {
      this._setURL().then(() => {
        this.requestUpdate();
      });
    }

    if (changedProps.has('viewerConfig') && this.viewerConfig?.zoomable) {
      import('../zoomer.js');
    }

    if (changedProps.has('media') || changedProps.has('cameraManager')) {
      const cameraID = this.media?.getCameraID();
      const cameraConfig = cameraID
        ? this.cameraManager?.getStore().getCameraConfig(cameraID)
        : null;
      updateElementStyleFromMediaLayoutConfig(this, cameraConfig?.dimensions?.layout);

      this.style.aspectRatio = aspectRatioToString({
        ratio: cameraConfig?.dimensions?.aspect_ratio,
      });
    }
  }

  protected _useZoomIfRequired(template: TemplateResult): TemplateResult {
    if (!this.media) {
      return template;
    }
    const cameraID = this.media.getCameraID();
    const mediaID = this.media.getID() ?? undefined;
    const cameraConfig = this.cameraManager?.getStore().getCameraConfig(cameraID);
    const view = this.viewManagerEpoch?.manager.getView();

    return this.viewerConfig?.zoomable
      ? html` <advanced-camera-card-zoomer
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
          @advanced-camera-card:zoom:change=${(ev: CustomEvent<ZoomSettingsObserved>) =>
            handleZoomSettingsObservedEvent(ev, this.viewManagerEpoch?.manager, mediaID)}
        >
          ${template}
        </advanced-camera-card-zoomer>`
      : template;
  }

  protected render(): TemplateResult | void {
    if (!this.load || !this.media || !this.hass || !this.viewerConfig) {
      return;
    }

    if (!this._url) {
      return renderProgressIndicator({
        cardWideConfig: this.cardWideConfig,
      });
    }

    // Note: crossorigin="anonymous" is required on <video> below in order to
    // allow screenshot of motionEye videos which currently go cross-origin.
    return this._useZoomIfRequired(html`
      ${ViewMediaClassifier.isVideo(this.media)
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
