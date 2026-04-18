import { ReactiveController, ReactiveControllerHost } from 'lit';
import { isEqual } from 'lodash-es';
import { EnabledProxyConfig } from '../config/schema/common/proxy.js';
import { homeAssistantGetSignedURLIfNecessary } from '../ha/sign-path.js';
import { HomeAssistant } from '../ha/types.js';
import {
  CreateProxiedEndpointOptions,
  createProxiedEndpointIfNecessary,
} from '../ha/web-proxy.js';
import { Endpoint } from '../types.js';
import { errorToConsole } from '../utils/basic.js';

const PROXY_URL_SIGN_EXPIRY_SECONDS = 24 * 60 * 60;

// Re-register and re-sign well before the signed URL expires.
const PROXY_CACHE_TTL_SECONDS = PROXY_URL_SIGN_EXPIRY_SECONDS / 2;

interface SignedURLControllerOptions {
  // The endpoint to resolve. The `sign` flag on the endpoint controls whether
  // the URL requires HA authentication even when proxying is disabled (e.g.
  // HA-relative API paths like go2rtc streams served through Frigate).
  endpoint?: Endpoint;

  hass?: HomeAssistant;
  proxyConfig?: EnabledProxyConfig | null;
  proxyEndpointOptions?: CreateProxiedEndpointOptions;
}

type SignedURLErrorType = 'sign' | 'proxy';

export class SignedURLController implements ReactiveController {
  private _host: ReactiveControllerHost;
  private _getOptionsCallback: () => SignedURLControllerOptions;
  private _valueChangeCallback: (() => void) | undefined;

  private _value: string | null = null;
  private _error: SignedURLErrorType | null = null;
  private _cachedAt: Date | null = null;

  // Caching and race-condition state.
  // The targetURL and proxy config are tracked to detect when inputs change and
  // invalidate the cache. The requestID tracks the most recent valid fetch, to
  // ensure that older, slower in-flight requests do not overwrite newer ones.
  private _targetURL: string | null = null;
  private _targetProxyConfig: EnabledProxyConfig | null = null;
  private _requestID = 0;

  constructor(
    host: ReactiveControllerHost,
    getOptionsCallback: () => SignedURLControllerOptions,
    valueChangeCallback?: () => void,
  ) {
    (this._host = host).addController(this);
    this._getOptionsCallback = getOptionsCallback;
    this._valueChangeCallback = valueChangeCallback;
  }

  public getError(): SignedURLErrorType | null {
    return this._error;
  }

  public getValue(): string | null {
    const options = this._getOptionsCallback();

    // When the endpoint requires signing or proxying, the URL must go through
    // the async resolution path. For proxied URLs, under no circumstances
    // should we fall back to returning the unproxied URL — doing so risks
    // leaking traffic or causing mixed-content errors.
    if (options.proxyConfig?.enabled || options.endpoint?.sign) {
      return this._value;
    }
    return options.endpoint?.endpoint ?? null;
  }

  public hostDisconnected(): void {
    ++this._requestID;
    this._value = null;
    this._error = null;
    this._cachedAt = null;
    this._targetURL = null;
    this._targetProxyConfig = null;
  }

  public async hostUpdate(): Promise<void> {
    const { hass, endpoint, proxyConfig, proxyEndpointOptions } =
      this._getOptionsCallback();
    if (!hass || !endpoint || (!proxyConfig?.enabled && !endpoint.sign)) {
      // Invalidate any in-flight async work so a stale proxy/sign result cannot
      // repopulate the controller after inputs have been cleared or disabled.
      ++this._requestID;
      this._value = null;
      this._error = null;
      this._targetURL = null;
      this._targetProxyConfig = null;
      this._cachedAt = null;
      return;
    }

    const targetURL = new URL(endpoint.endpoint, document.baseURI).toString();

    // Pick only the EnabledProxyConfig fields so that extraneous properties
    // (e.g. `live`/`media` from CameraProxyConfig spreads) don't cause
    // spurious cache invalidations. When only signing (no proxy), the config
    // is null.
    const comparableConfig: EnabledProxyConfig | null = proxyConfig?.enabled
      ? {
          dynamic: proxyConfig.dynamic,
          ssl_verification: proxyConfig.ssl_verification,
          ssl_ciphers: proxyConfig.ssl_ciphers,
          enabled: proxyConfig.enabled,
          enforce: proxyConfig.enforce,
        }
      : null;

    if (
      targetURL !== this._targetURL ||
      !isEqual(comparableConfig, this._targetProxyConfig)
    ) {
      this._targetURL = targetURL;
      this._targetProxyConfig = comparableConfig;
      this._cachedAt = null;
      this._error = null;
      this._value = null;
    } else if (
      this._cachedAt &&
      new Date().getTime() - this._cachedAt.getTime() < PROXY_CACHE_TTL_SECONDS * 1000
    ) {
      return;
    } else if (!this._cachedAt) {
      // Either async work for these exact inputs is already in flight, or
      // we already failed for these exact inputs. Either way, don't
      // restart: inputs must change before we retry.
      return;
    }

    // Mark as in-flight so the `!this._cachedAt` guard above prevents
    // subsequent hostUpdate() calls from restarting the async work.
    this._cachedAt = null;
    const requestID = ++this._requestID;

    const resolvedEndpoint = await this._proxy(
      hass,
      targetURL,
      endpoint,
      proxyConfig,
      proxyEndpointOptions,
    );
    if (this._isStale(requestID)) {
      return;
    }
    if (!resolvedEndpoint) {
      this._applyError('proxy');
      return;
    }

    const signedURL = await this._sign(hass, resolvedEndpoint);
    if (this._isStale(requestID)) {
      return;
    }
    if (!signedURL) {
      this._applyError('sign');
      return;
    }

    this._applySuccess(signedURL);
  }

  /**
   * Proxy the endpoint if proxying is enabled, otherwise return it as-is.
   */
  private async _proxy(
    hass: HomeAssistant,
    targetURL: string,
    endpoint: Endpoint,
    proxyConfig: EnabledProxyConfig | null | undefined,
    proxyEndpointOptions: CreateProxiedEndpointOptions | undefined,
  ): Promise<Endpoint | null> {
    if (!proxyConfig?.enabled) {
      return { endpoint: targetURL, sign: endpoint.sign };
    }

    try {
      return await createProxiedEndpointIfNecessary(
        hass,
        { endpoint: targetURL, sign: false },
        proxyConfig,
        {
          ttl: PROXY_URL_SIGN_EXPIRY_SECONDS,
          openLimit: 0,
          ...proxyEndpointOptions,
        },
      );
    } catch (e: unknown) {
      errorToConsole(e as Error);
      return null;
    }
  }

  /**
   * Sign the endpoint if it requires signing, otherwise return the URL as-is.
   */
  private async _sign(hass: HomeAssistant, endpoint: Endpoint): Promise<string | null> {
    try {
      return await homeAssistantGetSignedURLIfNecessary(
        hass,
        endpoint,
        PROXY_URL_SIGN_EXPIRY_SECONDS,
      );
    } catch (e: unknown) {
      errorToConsole(e as Error);
      return null;
    }
  }

  private _isStale(requestID: number): boolean {
    return this._requestID !== requestID;
  }

  private _applySuccess(url: string): void {
    this._value = url;
    this._error = null;
    this._valueChangeCallback?.();
    this._cachedAt = new Date();
    this._host.requestUpdate();
  }

  private _applyError(error: SignedURLErrorType): void {
    this._value = null;
    this._error = error;
    this._host.requestUpdate();
  }
}
