import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EnabledProxyConfig } from '../../src/config/schema/common/proxy.js';
import {
  PROXY_URL_SIGN_EXPIRY_SECONDS,
  resolveEndpointURL,
} from '../../src/ha/resolve-endpoint.js';
import { homeAssistantGetSignedURLIfNecessary } from '../../src/ha/sign-path.js';
import { createProxiedEndpointIfNecessary } from '../../src/ha/web-proxy.js';
import { createHASS } from '../test-utils.js';

vi.mock('../../src/ha/sign-path.js');
vi.mock('../../src/ha/web-proxy.js');

const createEnabledProxyConfig = (
  config: Partial<EnabledProxyConfig> = {},
): EnabledProxyConfig => ({
  ssl_verification: true,
  ssl_ciphers: 'default',
  dynamic: true,
  enabled: true,
  ...config,
});

// @vitest-environment jsdom
describe('resolveEndpointURL', () => {
  beforeEach(() => {
    vi.mocked(createProxiedEndpointIfNecessary).mockImplementation(
      async (_hass, endpoint) => endpoint,
    );
    vi.mocked(homeAssistantGetSignedURLIfNecessary).mockImplementation(
      async (_hass, endpoint) => endpoint.endpoint,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should resolve an absolute endpoint', async () => {
    expect(
      await resolveEndpointURL(createHASS(), {
        endpoint: 'http://go2rtc/api/ws',
        sign: false,
      }),
    ).toEqual({ success: true, url: 'http://go2rtc/api/ws' });
  });

  it('should make a relative endpoint absolute before using it', async () => {
    // Proxy registration and signing both reject a relative URL.
    await resolveEndpointURL(createHASS(), { endpoint: '/api/ws', sign: true });

    expect(homeAssistantGetSignedURLIfNecessary).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        endpoint: new URL('/api/ws', document.baseURI).toString(),
      }),
      PROXY_URL_SIGN_EXPIRY_SECONDS,
    );
  });

  it('should not proxy when proxying is disabled', async () => {
    await resolveEndpointURL(
      createHASS(),
      { endpoint: 'http://go2rtc/api/ws', sign: false },
      { proxyConfig: createEnabledProxyConfig({ enabled: false }) },
    );

    expect(createProxiedEndpointIfNecessary).not.toHaveBeenCalled();
  });

  it('should proxy when proxying is enabled', async () => {
    await resolveEndpointURL(
      createHASS(),
      { endpoint: 'http://go2rtc/api/ws', sign: false },
      {
        proxyConfig: createEnabledProxyConfig(),
        proxyEndpointOptions: { websocket: true },
      },
    );

    expect(createProxiedEndpointIfNecessary).toHaveBeenCalledWith(
      expect.anything(),
      // Signing is applied afterwards, to whatever the proxy returns.
      { endpoint: 'http://go2rtc/api/ws', sign: false },
      expect.objectContaining({ enabled: true }),
      { ttl: PROXY_URL_SIGN_EXPIRY_SECONDS, openLimit: 0, websocket: true },
    );
  });

  it('should sign whatever the proxy returned', async () => {
    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue({
      endpoint: 'http://ha/api/hass_web_proxy/v0/ws?url=go2rtc',
      sign: true,
    });

    expect(
      await resolveEndpointURL(
        createHASS(),
        { endpoint: 'http://go2rtc/api/ws', sign: false },
        { proxyConfig: createEnabledProxyConfig() },
      ),
    ).toEqual({
      success: true,
      url: 'http://ha/api/hass_web_proxy/v0/ws?url=go2rtc',
    });
  });

  it('should report a proxy that is unavailable', async () => {
    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue(null);

    expect(
      await resolveEndpointURL(
        createHASS(),
        { endpoint: 'http://go2rtc/api/ws', sign: false },
        { proxyConfig: createEnabledProxyConfig() },
      ),
    ).toEqual({ success: false, error: 'proxy' });
  });

  it('should report a proxy that throws', async () => {
    vi.mocked(createProxiedEndpointIfNecessary).mockRejectedValue(new Error('nope'));

    expect(
      await resolveEndpointURL(
        createHASS(),
        { endpoint: 'http://go2rtc/api/ws', sign: false },
        { proxyConfig: createEnabledProxyConfig() },
      ),
    ).toEqual({ success: false, error: 'proxy' });
  });

  it('should report signing that fails', async () => {
    vi.mocked(homeAssistantGetSignedURLIfNecessary).mockResolvedValue(null);

    expect(
      await resolveEndpointURL(createHASS(), { endpoint: '/api/ws', sign: true }),
    ).toEqual({ success: false, error: 'sign' });
  });

  it('should report signing that throws', async () => {
    vi.mocked(homeAssistantGetSignedURLIfNecessary).mockRejectedValue(new Error('nope'));

    expect(
      await resolveEndpointURL(createHASS(), { endpoint: '/api/ws', sign: true }),
    ).toEqual({ success: false, error: 'sign' });
  });
});
