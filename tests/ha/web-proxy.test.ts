import { describe, expect, it } from 'vitest';
import { CameraProxyConfig } from '../../src/camera-manager/types.js';
import {
  addDynamicProxyURL,
  createProxiedEndpointIfNecessary,
  getWebProxiedURL,
  shouldUseWebProxy,
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

describe('shouldUseWebProxy', () => {
  const createProxyConfig = (
    config: Partial<CameraProxyConfig> = {},
  ): CameraProxyConfig => ({
    media: true,
    live: true,
    ssl_verification: true,
    ssl_ciphers: 'default',
    dynamic: true,
    ...config,
  });

  it('should return false without a the proxy installed', () => {
    const hass = createHASS();
    hass.config.components = [];

    expect(shouldUseWebProxy(hass, createProxyConfig())).toBe(false);
  });

  it('should return when proxy config does not want proxying', () => {
    const hass = createHASS();
    hass.config.components = ['hass_web_proxy'];

    const proxyConfig = createProxyConfig({ media: false });
    expect(shouldUseWebProxy(hass, proxyConfig, 'media')).toBe(false);
  });

  it('should return when proxy config does want proxying', () => {
    const hass = createHASS();
    hass.config.components = ['hass_web_proxy'];

    const proxyConfig = createProxyConfig({ media: true });
    expect(shouldUseWebProxy(hass, proxyConfig, 'media')).toBe(true);
  });
});

describe('addDynamicProxyURL', () => {
  it('should add dynamic proxy URL', async () => {
    const hass = createHASS();

    await addDynamicProxyURL(hass, 'http://example.com', {
      urlID: 'id',
      sslVerification: true,
      sslCiphers: 'modern',
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

  it('should add dynamic proxy URL using config defaults', async () => {
    const hass = createHASS();
    const proxyConfig: CameraProxyConfig = {
      media: true,
      live: true,
      ssl_verification: false,
      ssl_ciphers: 'insecure',
      dynamic: true,
    };

    await addDynamicProxyURL(hass, 'http://example.com', {
      proxyConfig: proxyConfig,
    });

    expect(hass.callService).toHaveBeenCalledWith(
      'hass_web_proxy',
      'create_proxied_url',
      expect.objectContaining({
        ssl_verification: false,
        ssl_ciphers: 'insecure',
      }),
    );
  });
});

describe('createProxiedEndpointIfNecessary', () => {
  const createProxyConfig = (
    config: Partial<CameraProxyConfig> = {},
  ): CameraProxyConfig => ({
    media: true,
    live: true,
    ssl_verification: true,
    ssl_ciphers: 'default',
    dynamic: true,
    ...config,
  });

  const testEndpoint = { endpoint: 'http://example.com/stream', sign: false };

  it('should return original endpoint when proxyConfig is undefined', async () => {
    const hass = createHASS();
    hass.config.components = ['hass_web_proxy'];

    const result = await createProxiedEndpointIfNecessary(hass, testEndpoint);
    expect(result).toBe(testEndpoint);
  });

  it('should return original endpoint when proxy is not available', async () => {
    const hass = createHASS();
    hass.config.components = [];

    const result = await createProxiedEndpointIfNecessary(
      hass,
      testEndpoint,
      createProxyConfig(),
    );
    expect(result).toBe(testEndpoint);
  });

  it('should return original endpoint when context is not enabled', async () => {
    const hass = createHASS();
    hass.config.components = ['hass_web_proxy'];

    const result = await createProxiedEndpointIfNecessary(
      hass,
      testEndpoint,
      createProxyConfig({ media: false }),
      { context: 'media' },
    );
    expect(result).toBe(testEndpoint);
  });

  it('should return proxied endpoint with dynamic registration', async () => {
    const hass = createHASS();
    hass.config.components = ['hass_web_proxy'];

    const result = await createProxiedEndpointIfNecessary(
      hass,
      testEndpoint,
      createProxyConfig(),
      { context: 'media', ttl: 300, openLimit: 5 },
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

    await createProxiedEndpointIfNecessary(hass, endpointWithHash, createProxyConfig());

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
      createProxyConfig({ dynamic: false }),
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
      createProxyConfig({ dynamic: false }),
      { websocket: true },
    );

    expect(result).toEqual({
      endpoint: '/api/hass_web_proxy/v0/ws?url=http%3A%2F%2Fexample.com%2Fstream',
      sign: true,
    });
  });

  it('should use live context when specified', async () => {
    const hass = createHASS();
    hass.config.components = ['hass_web_proxy'];

    const result = await createProxiedEndpointIfNecessary(
      hass,
      testEndpoint,
      createProxyConfig({ media: false, live: true }),
      { context: 'live' },
    );

    expect(result.endpoint).toContain('/api/hass_web_proxy/');
  });

  it('should default openLimit to 0 when not specified', async () => {
    const hass = createHASS();
    hass.config.components = ['hass_web_proxy'];

    await createProxiedEndpointIfNecessary(hass, testEndpoint, createProxyConfig());

    expect(hass.callService).toHaveBeenCalledWith(
      'hass_web_proxy',
      'create_proxied_url',
      expect.objectContaining({
        open_limit: 0,
      }),
    );
  });
});
