import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { isEqual } from 'lodash-es';

import type { Camera } from '../../../../camera-manager/camera';
import type {
  HomeAssistant,
  LovelaceCard,
  LovelaceCardConfig,
} from '../../../../ha/types';

// The custom element name AlexxIT's WebRTC Card registers itself under.
export const WEBRTC_CARD_ELEMENT_NAME = 'webrtc-camera';

interface WebRTCCardControllerOptions {
  // Called when an element that was handed out is discarded.
  destroyCallback: () => void;
}

interface WebRTCCardElementRequest {
  camera?: Camera;
  hass?: HomeAssistant;
}

/**
 * Owns the lifetime of the `webrtc-camera` element for
 * `advanced-camera-card-live-webrtc-card`.
 *
 * The element is a stateful player: it negotiates a peer connection on
 * construction and tears it down when removed from the DOM. A LIT child binding
 * compares nodes by identity, so returning a fresh instance for an unrelated
 * render (e.g. a zoom, a controls toggle) would restart the stream. The same
 * element is therefore returned until the config changes.
 *
 * See: https://github.com/dermotduffy/advanced-camera-card/issues/2625
 */
export class WebRTCCardController implements ReactiveController {
  private _options: WebRTCCardControllerOptions;

  private _element: LovelaceCard | null = null;
  private _config: LovelaceCardConfig | null = null;

  constructor(host: ReactiveControllerHost, options: WebRTCCardControllerOptions) {
    this._options = options;
    host.addController(this);
  }

  public hostDisconnected(): void {
    // The player is not reused across a detach.
    // See: https://github.com/dermotduffy/advanced-camera-card/issues/996
    this._destroy();
  }

  /**
   * Wait for the WebRTC Card to register its custom element. Must be awaited
   * before an element is requested.
   */
  public async awaitRegistration(): Promise<void> {
    await customElements.whenDefined(WEBRTC_CARD_ELEMENT_NAME);
  }

  /**
   * Get the element for the given inputs, constructing it if necessary.
   * @returns The element, or `null` if it cannot yet be constructed.
   * @throws If the WebRTC card rejects the configuration.
   */
  public getElement(request: WebRTCCardElementRequest): HTMLElement | null {
    const config = this._createConfig(request.camera);
    const hass = request.hass;

    if (!config || !hass) {
      this._destroy();
      return null;
    }

    if (this._element && isEqual(this._config, config)) {
      this._element.hass = hass;
      return this._element;
    }

    // Discard the outgoing element before the replacement is built, so a
    // configuration the WebRTC card rejects leaves no element behind rather
    // than a stale one.
    this._destroy();

    const element = document.createElement(WEBRTC_CARD_ELEMENT_NAME);

    element.setConfig(config);
    element.hass = hass;

    this._element = element;
    this._config = config;

    return element;
  }

  private _createConfig(camera?: Camera): LovelaceCardConfig | null {
    if (!camera) {
      return null;
    }

    const cameraConfig = camera.getConfig();
    const config: LovelaceCardConfig = {
      type: `custom:${WEBRTC_CARD_ELEMENT_NAME}`,

      // By default, webrtc-card will stop the video when 50% of the video is
      // hidden. This is incompatible with the card zoom support, since the
      // video will easily stop if the user zooms in too much. Disable this
      // feature by default.
      // See: https://github.com/dermotduffy/advanced-camera-card/issues/1614
      intersection: 0,

      // Advanced Camera Card always starts muted (unlike webrtc-card).
      // See: https://github.com/dermotduffy/advanced-camera-card/issues/1654
      muted: true,

      ...cameraConfig.webrtc_card,
    };

    const webrtcCardEndpoint = camera.getEndpoints()?.webrtcCard;
    if (!config.url && !config.entity && webrtcCardEndpoint) {
      config.entity = webrtcCardEndpoint.endpoint;
    }

    return config;
  }

  private _destroy(): void {
    if (!this._element) {
      return;
    }

    this._element = null;
    this._config = null;

    this._options.destroyCallback();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'webrtc-camera': LovelaceCard;
  }
}
