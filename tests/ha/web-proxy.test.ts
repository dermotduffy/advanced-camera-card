import { describe, expect, it } from 'vitest';
import { CameraProxyConfig } from '../../src/camera-manager/types.js';
import {
  addDynamicProxyURL,
  getWebProxiedURL,
  shouldUseWebProxy,
} from '../../src/ha/web-proxy.js';
import { createHASS } from '../test-utils.js';

describe('getWebProxiedURL', () => {
  it('should return proxied URL with v != 0', () => {
    expect(getWebProxiedURL('http://example.com', 2)).toBe(
      '/api/hass_web_proxy/v2/?url=http%3A%2F%2Fexample.com',
    );
  });

  it('should return proxied URL with default v', () => {
    expect(getWebProxiedURL('http://example.com')).toBe(
      '/api/hass_web_proxy/v0/?url=http%3A%2F%2Fexample.com',
    );
  });
});

describe('shouldUseWebProxy', () => {
  const createProxyConfig = (
    config: Partial<CameraProxyConfig> = {},
  ): CameraProxyConfig => ({
    media: true,
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
});
