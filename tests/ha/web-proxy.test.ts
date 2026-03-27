import { describe, expect, it } from 'vitest';
import { EnabledProxyConfig } from '../../src/config/schema/common/proxy.js';
import {
  addDynamicProxyURL,
  createProxiedEndpointIfNecessary,
  getWebProxiedURL,
} from '../../src/ha/web-proxy.js';
import { createHASS } from '../test-utils.js';

describe('getWebProxiedURL', () => {
  it('should return proxied URL with default version', () => {
    expect(getWebProxiedURL('http://example.com')).toBe(
      '/api/hass_web_proxy/v0/?url=http%3A%2F%2Fexample.com',
    );
  });

  it('should return proxied URL with non-default version', () => {
    expect(getWebProxiedURL('http://example.com', { version: 2 })).toBe(
      '/api/hass_web_proxy/v2/?url=http%3A%2F%2Fexample.com',
    );
  });

  it('should return proxied URL with websocket', () => {
    expect(getWebProxiedURL('http://example.com', { websocket: true })).toBe(
      '/api/hass_web_proxy/v0/ws?url=http%3A%2F%2Fexample.com',
    );
  });
});

describe('addDynamicProxyURL', () => {
  it('should add dynamic proxy URL with proxy config', async () => {
    const hass = createHASS();
    const proxyConfig: EnabledProxyConfig = {
      dynamic: true,
      ssl_verification: true,
      ssl_ciphers: 'modern',
      enabled: true,
    };

    await addDynamicProxyURL(hass, 'http://example.com', {
      proxyConfig,
      urlID: 'id',
      openLimit: 5,
      ttl: 60,
      allowUnauthenticated: false,
    });

    expect(hass.callService).toHaveBeenCalledWith(
      'hass_web_proxy',
      'create_proxied_url',
      {
        url_pattern: 'http://example.com',
        url_id: 'id',
        ssl_verification: true,
        ssl_ciphers: 'modern',
        open_limit: 5,
        ttl: 60,
        allow_unauthenticated: false,
      },
    );
  });

  it('should add dynamic proxy URL without options', async () => {
    const hass = createHASS();

    await addDynamicProxyURL(hass, 'http://example.com');

    expect(hass.callService).toHaveBeenCalledWith(
      'hass_web_proxy',
      'create_proxied_url',
      {
        url_pattern: 'http://example.com',
      },
    );
  });
});

describe('createProxiedEndpointIfNecessary', () => {
  const createEnabledProxyConfig = (
    config: Partial<EnabledProxyConfig> = {},
  ): EnabledProxyConfig => ({
    ssl_verification: true,
    ssl_ciphers: 'default',
    dynamic: true,
    enabled: true,
    ...config,
  });

  const testEndpoint = { endpoint: 'http://example.com/stream', sign: false };

  it('should return original endpoint when proxyConfig is undefined', async () => {
    const hass = createHASS();

    const result = await createProxiedEndpointIfNecessary(hass, testEndpoint);
    expect(result).toBe(testEndpoint);
  });

  it('should return original endpoint when enabled is false', async () => {
    const hass = createHASS();
    hass.config.components = ['hass_web_proxy'];

    const result = await createProxiedEndpointIfNecessary(
      hass,
      testEndpoint,
      createEnabledProxyConfig({ enabled: false }),
    );
    expect(result).toBe(testEndpoint);
  });

  it('should return null when web proxy is not available and enforced', async () => {
    const hass = createHASS();

    const result = await createProxiedEndpointIfNecessary(
      hass,
      testEndpoint,
      createEnabledProxyConfig({ enforce: true }),
    );
    expect(result).toBeNull();
  });

  it('should return original endpoint when web proxy is not available but not enforced', async () => {
    const hass = createHASS();

    const result = await createProxiedEndpointIfNecessary(
      hass,
      testEndpoint,
      createEnabledProxyConfig(),
    );
    expect(result).toBe(testEndpoint);
  });

  it('should return proxied endpoint with dynamic registration', async () => {
    const hass = createHASS();
    hass.config.components = ['hass_web_proxy'];

    const result = await createProxiedEndpointIfNecessary(
      hass,
      testEndpoint,
      createEnabledProxyConfig(),
      { ttl: 300, openLimit: 5 },
    );

    expect(hass.callService).toHaveBeenCalledWith(
      'hass_web_proxy',
      'create_proxied_url',
      expect.objectContaining({
        url_pattern: 'http://example.com/stream',
        ttl: 300,
        open_limit: 5,
      }),
    );

    expect(result).toEqual({
      endpoint: '/api/hass_web_proxy/v0/?url=http%3A%2F%2Fexample.com%2Fstream',
      sign: true,
    });
  });

  it('should strip hash fragment when registering dynamic proxy', async () => {
    const hass = createHASS();
    hass.config.components = ['hass_web_proxy'];

    const endpointWithHash = {
      endpoint: 'http://example.com/stream#fragment',
      sign: false,
    };

    await createProxiedEndpointIfNecessary(
      hass,
      endpointWithHash,
      createEnabledProxyConfig(),
    );

    expect(hass.callService).toHaveBeenCalledWith(
      'hass_web_proxy',
      'create_proxied_url',
      expect.objectContaining({
        url_pattern: 'http://example.com/stream',
      }),
    );
  });

  it('should return proxied endpoint without dynamic registration', async () => {
    const hass = createHASS();
    hass.config.components = ['hass_web_proxy'];

    const result = await createProxiedEndpointIfNecessary(
      hass,
      testEndpoint,
      createEnabledProxyConfig({ dynamic: false }),
    );

    expect(hass.callService).not.toHaveBeenCalled();
    expect(result).toEqual({
      endpoint: '/api/hass_web_proxy/v0/?url=http%3A%2F%2Fexample.com%2Fstream',
      sign: true,
    });
  });

  it('should return websocket proxied endpoint', async () => {
    const hass = createHASS();
    hass.config.components = ['hass_web_proxy'];

    const result = await createProxiedEndpointIfNecessary(
      hass,
      testEndpoint,
      createEnabledProxyConfig({ dynamic: false }),
      { websocket: true },
    );

    expect(result).toEqual({
      endpoint: '/api/hass_web_proxy/v0/ws?url=http%3A%2F%2Fexample.com%2Fstream',
      sign: true,
    });
  });

  it('should default openLimit to 0 when not specified', async () => {
    const hass = createHASS();
    hass.config.components = ['hass_web_proxy'];

    await createProxiedEndpointIfNecessary(
      hass,
      testEndpoint,
      createEnabledProxyConfig(),
    );

    expect(hass.callService).toHaveBeenCalledWith(
      'hass_web_proxy',
      'create_proxied_url',
      expect.objectContaining({
        open_limit: 0,
      }),
    );
  });
});
