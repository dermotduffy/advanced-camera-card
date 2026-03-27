import { ReactiveControllerHost } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { SignedURLController } from '../../src/components-lib/signed-url-controller';
import { homeAssistantGetSignedURLIfNecessary } from '../../src/ha/sign-path';
import { createProxiedEndpointIfNecessary } from '../../src/ha/web-proxy';
import { Endpoint } from '../../src/types';
import { createHASS, flushPromises } from '../test-utils';

vi.mock('../../src/ha/sign-path');
vi.mock('../../src/ha/web-proxy');

const createEndpoint = (url: string, sign?: boolean): Endpoint => ({
  endpoint: url,
  ...(sign !== undefined && { sign }),
});

// @vitest-environment jsdom
describe('SignedURLController', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize correctly', () => {
    const host = mock<ReactiveControllerHost>();
    const controller = new SignedURLController(host, () => ({}));

    expect(host.addController).toBeCalledWith(controller);
    expect(controller.getValue()).toBeNull();
  });

  it('should fetch proxied url successfully', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();
    const proxyConfig = {
      enabled: true,
      dynamic: true,
      ssl_verification: true,
      ssl_ciphers: 'default' as const,
      live: true,
      media: true,
    };

    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue({
      endpoint: 'http://proxied-url.com',
      sign: true,
    });

    vi.mocked(homeAssistantGetSignedURLIfNecessary).mockResolvedValue(
      'http://signed-proxied-url.com',
    );

    const controller = new SignedURLController(host, () => ({
      hass,
      endpoint: createEndpoint('http://test-url.com'),
      proxyConfig,
    }));

    controller.hostUpdate();

    expect(controller.getValue()).toBeNull();

    expect(createProxiedEndpointIfNecessary).toBeCalledWith(
      hass,
      { endpoint: 'http://test-url.com/', sign: false },
      proxyConfig,
      { ttl: 86400, openLimit: 0 },
    );

    await flushPromises();

    expect(homeAssistantGetSignedURLIfNecessary).toBeCalled();
    expect(controller.getValue()).toBe('http://signed-proxied-url.com');
    expect(host.requestUpdate).toBeCalled();
  });

  it('should not fetch if inputs are missing', async () => {
    const host = mock<ReactiveControllerHost>();
    const controller = new SignedURLController(host, () => ({}));

    controller.hostUpdate();
    await flushPromises();

    expect(createProxiedEndpointIfNecessary).not.toBeCalled();
    expect(controller.getValue()).toBeNull();
  });

  it('should return unproxied url if proxy is disabled', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();

    const controller = new SignedURLController(host, () => ({
      hass,
      endpoint: createEndpoint('http://test-url.com'),
    }));

    controller.hostUpdate();
    await flushPromises();

    expect(createProxiedEndpointIfNecessary).not.toBeCalled();
    expect(controller.getValue()).toBe('http://test-url.com');
  });

  it('should clear value if inputs turn invalid', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();
    let endpoint: Endpoint | undefined = createEndpoint('http://test-url.com');

    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue({
      endpoint: 'http://proxied-url.com',
      sign: false,
    });
    vi.mocked(homeAssistantGetSignedURLIfNecessary).mockResolvedValue(
      'http://signed-proxied-url.com',
    );

    const controller = new SignedURLController(host, () => ({
      hass,
      endpoint,
      proxyConfig: {
        enabled: true,
        dynamic: true,
        ssl_verification: true,
        ssl_ciphers: 'default' as const,
        live: true,
        media: true,
      },
    }));

    controller.hostUpdate();
    await flushPromises();
    expect(controller.getValue()).toBe('http://signed-proxied-url.com');

    // Make endpoint invalid
    endpoint = undefined;
    controller.hostUpdate();

    expect(controller.getValue()).toBeNull();
  });

  it('should call valueChangeCallback when a new URL is successfully resolved', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();
    const valueChangeCallback = vi.fn();

    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue({
      endpoint: 'http://proxied-url.com',
      sign: false,
    });
    vi.mocked(homeAssistantGetSignedURLIfNecessary).mockResolvedValue(
      'http://signed-proxied-url.com',
    );

    const controller = new SignedURLController(
      host,
      () => ({
        hass,
        endpoint: createEndpoint('http://test-url.com'),
        proxyConfig: {
          enabled: true,
          dynamic: true,
          ssl_verification: true,
          ssl_ciphers: 'default' as const,
          live: true,
          media: true,
        },
      }),
      valueChangeCallback,
    );

    controller.hostUpdate();
    await flushPromises();

    expect(controller.getValue()).toBe('http://signed-proxied-url.com');
    expect(valueChangeCallback).toHaveBeenCalledTimes(1);
  });

  it('should not call valueChangeCallback on null proxy endpoint', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();
    const valueChangeCallback = vi.fn();

    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue(null);

    const controller = new SignedURLController(
      host,
      () => ({
        hass,
        endpoint: createEndpoint('http://test-url.com'),
        proxyConfig: {
          enabled: true,
          dynamic: true,
          ssl_verification: true,
          ssl_ciphers: 'default' as const,
          live: true,
          media: true,
        },
      }),
      valueChangeCallback,
    );

    controller.hostUpdate();
    await flushPromises();

    expect(controller.getValue()).toBeNull();
    expect(valueChangeCallback).not.toBeCalled();
  });

  it('should not call valueChangeCallback on null signed URL', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();
    const valueChangeCallback = vi.fn();

    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue({
      endpoint: 'http://proxied-url.com',
      sign: true,
    });
    vi.mocked(homeAssistantGetSignedURLIfNecessary).mockResolvedValue(null);

    const controller = new SignedURLController(
      host,
      () => ({
        hass,
        endpoint: createEndpoint('http://test-url.com'),
        proxyConfig: {
          enabled: true,
          dynamic: true,
          ssl_verification: true,
          ssl_ciphers: 'default' as const,
          live: true,
          media: true,
        },
      }),
      valueChangeCallback,
    );

    controller.hostUpdate();
    await flushPromises();

    expect(controller.getValue()).toBeNull();
    expect(valueChangeCallback).not.toBeCalled();
  });

  it('should ignore successful fetch if inputs become invalid', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();
    let endpoint: Endpoint | undefined = createEndpoint('http://test-url.com');

    let resolveProxy: ((value: Endpoint) => void) | undefined;
    vi.mocked(createProxiedEndpointIfNecessary).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveProxy = resolve;
      }),
    );
    vi.mocked(homeAssistantGetSignedURLIfNecessary).mockResolvedValue('stale');

    const controller = new SignedURLController(host, () => ({
      hass,
      endpoint,
      proxyConfig: {
        enabled: true,
        dynamic: true,
        ssl_verification: true,
        ssl_ciphers: 'default' as const,
        live: true,
        media: true,
      },
    }));

    controller.hostUpdate();

    endpoint = undefined;
    controller.hostUpdate();

    resolveProxy?.({ endpoint: 'old', sign: false });
    await flushPromises();

    expect(controller.getValue()).toBeNull();
    expect(host.requestUpdate).not.toBeCalled();
  });

  it('should invalidate cache if input changes', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();
    let url = 'http://test-url.com';

    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue({
      endpoint: 'http://proxied-url.com',
      sign: false,
    });
    vi.mocked(homeAssistantGetSignedURLIfNecessary).mockResolvedValue(
      'http://signed-proxied-url.com',
    );

    const proxyConfig = {
      enabled: true,
      dynamic: true,
      ssl_verification: true,
      ssl_ciphers: 'default' as const,
      live: true,
      media: true,
    };

    const controller = new SignedURLController(host, () => ({
      hass,
      endpoint: createEndpoint(url),
      proxyConfig,
    }));

    controller.hostUpdate();
    await flushPromises();
    expect(controller.getValue()).toBe('http://signed-proxied-url.com');

    // Change url
    url = 'http://new-url.com';
    vi.mocked(homeAssistantGetSignedURLIfNecessary).mockResolvedValue(
      'http://new-signed-proxied-url.com',
    );

    controller.hostUpdate();

    expect(controller.getValue()).toBeNull();

    await flushPromises();

    expect(controller.getValue()).toBe('http://new-signed-proxied-url.com');
  });

  it('should invalidate cache if proxy config changes', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();

    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue({
      endpoint: 'http://proxied-url.com',
      sign: false,
    });
    vi.mocked(homeAssistantGetSignedURLIfNecessary).mockResolvedValue(
      'http://signed-proxied-url.com',
    );

    let proxyConfig = {
      enabled: true,
      dynamic: true,
      ssl_verification: true,
      ssl_ciphers: 'default' as const,
      live: true,
      media: true,
    };

    const controller = new SignedURLController(host, () => ({
      hass,
      endpoint: createEndpoint('http://test-url.com'),
      proxyConfig,
    }));

    controller.hostUpdate();
    await flushPromises();
    expect(controller.getValue()).toBe('http://signed-proxied-url.com');

    // Change a relevant proxy config field.
    proxyConfig = { ...proxyConfig, dynamic: false };

    vi.mocked(homeAssistantGetSignedURLIfNecessary).mockResolvedValue(
      'http://new-signed-proxied-url.com',
    );

    controller.hostUpdate();
    expect(controller.getValue()).toBeNull();

    await flushPromises();
    expect(controller.getValue()).toBe('http://new-signed-proxied-url.com');
  });

  it('should handle errors gracefully', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();
    const consoleSpy = vi.spyOn(console, 'warn').mockReturnValue();

    vi.mocked(createProxiedEndpointIfNecessary).mockRejectedValue(
      new Error('test-error'),
    );

    const controller = new SignedURLController(host, () => ({
      hass,
      endpoint: createEndpoint('http://test-url.com'),
      proxyConfig: {
        enabled: true,
        dynamic: true,
        ssl_verification: true,
        ssl_ciphers: 'default' as const,
        live: true,
        media: true,
      },
    }));

    controller.hostUpdate();
    await flushPromises();

    expect(controller.getValue()).toBeNull();
    expect(controller.getError()).toBe('proxy');
    expect(host.requestUpdate).toBeCalledTimes(1);
    consoleSpy.mockRestore();
  });

  it('should not retry after sign error with same inputs', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();

    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue({
      endpoint: 'http://proxied-url.com',
      sign: true,
    });
    vi.mocked(homeAssistantGetSignedURLIfNecessary).mockResolvedValue(null);

    const controller = new SignedURLController(host, () => ({
      hass,
      endpoint: createEndpoint('http://test-url.com'),
      proxyConfig: {
        enabled: true,
        dynamic: true,
        ssl_verification: true,
        ssl_ciphers: 'default' as const,
      },
    }));

    await controller.hostUpdate();

    expect(controller.getValue()).toBeNull();
    expect(controller.getError()).toBe('sign');
    expect(homeAssistantGetSignedURLIfNecessary).toHaveBeenCalledTimes(1);

    // Re-render with same inputs should NOT retry.
    await controller.hostUpdate();
    expect(homeAssistantGetSignedURLIfNecessary).toHaveBeenCalledTimes(1);
  });

  it('should set sign error when signing throws', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();
    const consoleSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);

    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue({
      endpoint: 'http://proxied-url.com',
      sign: true,
    });
    vi.mocked(homeAssistantGetSignedURLIfNecessary).mockRejectedValue(
      new Error('sign failure'),
    );

    const controller = new SignedURLController(host, () => ({
      hass,
      endpoint: createEndpoint('http://test-url.com'),
      proxyConfig: {
        enabled: true,
        dynamic: true,
        ssl_verification: true,
        ssl_ciphers: 'default' as const,
      },
    }));

    await controller.hostUpdate();

    expect(controller.getValue()).toBeNull();
    expect(controller.getError()).toBe('sign');
    consoleSpy.mockRestore();
  });

  it('should not fetch again if within cache TTL', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();

    vi.useFakeTimers();

    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue({
      endpoint: 'http://proxied-url.com',
      sign: false,
    });
    vi.mocked(homeAssistantGetSignedURLIfNecessary).mockResolvedValue(
      'http://signed-proxied-url.com',
    );

    const controller = new SignedURLController(host, () => ({
      hass,
      endpoint: createEndpoint('http://test-url.com'),
      proxyConfig: {
        enabled: true,
        dynamic: true,
        ssl_verification: true,
        ssl_ciphers: 'default',
        live: true,
        media: true,
      },
    }));

    controller.hostUpdate();
    await flushPromises();
    expect(createProxiedEndpointIfNecessary).toHaveBeenCalledTimes(1);

    // Call again within TTL, inputs unchanged
    controller.hostUpdate();
    await flushPromises();
    expect(createProxiedEndpointIfNecessary).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('should re-fetch after cache TTL expires', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();

    vi.useFakeTimers();

    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue({
      endpoint: 'http://proxied-url.com',
      sign: false,
    });
    vi.mocked(homeAssistantGetSignedURLIfNecessary).mockResolvedValue(
      'http://signed-proxied-url.com',
    );

    const controller = new SignedURLController(host, () => ({
      hass,
      endpoint: createEndpoint('http://test-url.com'),
      proxyConfig: {
        enabled: true,
        dynamic: true,
        ssl_verification: true,
        ssl_ciphers: 'default' as const,
        live: true,
        media: true,
      },
    }));

    controller.hostUpdate();
    await flushPromises();
    expect(createProxiedEndpointIfNecessary).toHaveBeenCalledTimes(1);

    // Advance time past the TTL (12 hours + 1 second).
    vi.advanceTimersByTime(12 * 60 * 60 * 1000 + 1000);

    controller.hostUpdate();
    await flushPromises();
    expect(createProxiedEndpointIfNecessary).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('should not re-enter while re-signing after cache expiry', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();

    vi.useFakeTimers();

    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue({
      endpoint: 'http://proxied-url.com',
      sign: false,
    });
    vi.mocked(homeAssistantGetSignedURLIfNecessary).mockResolvedValue(
      'http://signed-proxied-url.com',
    );

    const controller = new SignedURLController(host, () => ({
      hass,
      endpoint: createEndpoint('http://test-url.com'),
      proxyConfig: {
        enabled: true,
        dynamic: true,
        ssl_verification: true,
        ssl_ciphers: 'default' as const,
      },
    }));

    controller.hostUpdate();
    await flushPromises();
    expect(createProxiedEndpointIfNecessary).toHaveBeenCalledTimes(1);

    // Advance past the default TTL.
    vi.advanceTimersByTime(12 * 60 * 60 * 1000 + 1000);

    // First call after expiry starts a re-sign.
    controller.hostUpdate();
    expect(createProxiedEndpointIfNecessary).toHaveBeenCalledTimes(2);

    // Subsequent calls while in-flight should NOT start another re-sign.
    controller.hostUpdate();
    controller.hostUpdate();
    expect(createProxiedEndpointIfNecessary).toHaveBeenCalledTimes(2);

    await flushPromises();
    expect(controller.getValue()).toBe('http://signed-proxied-url.com');

    vi.useRealTimers();
  });

  it('should ignore successful fetch if request ID changed', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();
    let url = 'http://test-url.com';

    let resolveProxy: ((value: Endpoint) => void) | undefined;
    vi.mocked(createProxiedEndpointIfNecessary)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveProxy = resolve;
        }),
      )
      .mockReturnValue(
        // Request 2 pending forever.
        new Promise(() => {}),
      );
    vi.mocked(homeAssistantGetSignedURLIfNecessary).mockResolvedValue('ok');

    const controller = new SignedURLController(host, () => ({
      hass,
      endpoint: createEndpoint(url),
      proxyConfig: {
        enabled: true,
        dynamic: true,
        ssl_verification: true,
        ssl_ciphers: 'default',
        live: true,
        media: true,
      },
    }));

    // Request 1 starts.
    controller.hostUpdate();

    url = 'http://new-url.com';
    // Request 2 starts
    controller.hostUpdate();

    resolveProxy?.({ endpoint: 'old', sign: false });
    await flushPromises();

    expect(controller.getValue()).toBeNull();
  });

  it('should ignore failed fetch if request ID changed', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();
    let url = 'http://test-url.com';

    let rejectProxy: ((error: Error) => void) | undefined;
    vi.mocked(createProxiedEndpointIfNecessary)
      .mockReturnValueOnce(
        new Promise((_, reject) => {
          rejectProxy = reject;
        }),
      )
      .mockReturnValue(
        // Pending forever for request 2.
        new Promise(() => {}),
      );
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const controller = new SignedURLController(host, () => ({
      hass,
      endpoint: createEndpoint(url),
      proxyConfig: {
        enabled: true,
        dynamic: true,
        ssl_verification: true,
        ssl_ciphers: 'default',
        live: true,
        media: true,
      },
    }));

    // Request 1 starts.
    controller.hostUpdate();

    url = 'http://new-url.com';

    // Request 2 starts.
    controller.hostUpdate();

    rejectProxy?.(new Error('fail'));
    await flushPromises();

    expect(host.requestUpdate).not.toBeCalled();
  });

  it('should clear value if proxy endpoint is null', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();

    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue(null);

    const controller = new SignedURLController(host, () => ({
      hass,
      endpoint: createEndpoint('http://test-url.com'),
      proxyConfig: {
        enabled: true,
        dynamic: true,
        ssl_verification: true,
        ssl_ciphers: 'default' as const,
        live: true,
        media: true,
      },
    }));

    controller.hostUpdate();
    await flushPromises();

    expect(controller.getValue()).toBeNull();
    expect(controller.getError()).toBe('proxy');
    expect(host.requestUpdate).toBeCalled();
  });

  it('should not retry after proxy error with same inputs', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();

    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue(null);

    const controller = new SignedURLController(host, () => ({
      hass,
      endpoint: createEndpoint('http://test-url.com'),
      proxyConfig: {
        enabled: true,
        dynamic: true,
        ssl_verification: true,
        ssl_ciphers: 'default' as const,
      },
    }));

    await controller.hostUpdate();
    expect(controller.getError()).toBe('proxy');
    expect(createProxiedEndpointIfNecessary).toHaveBeenCalledTimes(1);

    // Re-render with same inputs should NOT retry.
    await controller.hostUpdate();
    expect(createProxiedEndpointIfNecessary).toHaveBeenCalledTimes(1);
  });

  it('should not restart in-flight work on re-render with same inputs', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();

    let resolveProxy: ((value: Endpoint) => void) | undefined;
    vi.mocked(createProxiedEndpointIfNecessary).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveProxy = resolve;
      }),
    );
    vi.mocked(homeAssistantGetSignedURLIfNecessary).mockResolvedValue(
      'http://signed-proxied-url.com',
    );

    const proxyConfig = {
      enabled: true,
      dynamic: true,
      ssl_verification: true,
      ssl_ciphers: 'default' as const,
      live: true,
      media: true,
    };

    const controller = new SignedURLController(host, () => ({
      hass,
      endpoint: createEndpoint('http://test-url.com'),
      proxyConfig,
    }));

    // First call starts async work.
    controller.hostUpdate();
    expect(createProxiedEndpointIfNecessary).toHaveBeenCalledTimes(1);

    // Second call with identical inputs should be a no-op (in-flight guard).
    controller.hostUpdate();
    expect(createProxiedEndpointIfNecessary).toHaveBeenCalledTimes(1);

    // Resolve the original request — should still succeed.
    resolveProxy?.({ endpoint: 'http://proxied-url.com', sign: false });
    await flushPromises();

    expect(controller.getValue()).toBe('http://signed-proxied-url.com');
    expect(host.requestUpdate).toHaveBeenCalledTimes(1);
  });

  it('should not invalidate cache when extraneous proxy config fields change', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();

    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue({
      endpoint: 'http://proxied.com',
      sign: false,
    });
    vi.mocked(homeAssistantGetSignedURLIfNecessary).mockResolvedValue(
      'http://signed.com',
    );

    // Start with extraneous `live: true`.
    let extraneous = true;
    const controller = new SignedURLController(host, () => ({
      hass,
      endpoint: createEndpoint('http://test-url.com'),
      proxyConfig: {
        enabled: true,
        dynamic: true,
        ssl_verification: true,
        ssl_ciphers: 'default' as const,
        live: extraneous,
      },
    }));

    await controller.hostUpdate();
    expect(createProxiedEndpointIfNecessary).toHaveBeenCalledTimes(1);
    expect(controller.getValue()).toBe('http://signed.com');

    // Change only the extraneous field — should hit the cache, not re-fetch.
    extraneous = false;
    await controller.hostUpdate();
    expect(createProxiedEndpointIfNecessary).toHaveBeenCalledTimes(1);
  });

  it('should reset all state on hostDisconnected', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();

    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue({
      endpoint: 'http://proxied-url.com',
      sign: false,
    });
    vi.mocked(homeAssistantGetSignedURLIfNecessary).mockResolvedValue(
      'http://signed-proxied-url.com',
    );

    const controller = new SignedURLController(host, () => ({
      hass,
      endpoint: createEndpoint('http://test-url.com'),
      proxyConfig: {
        enabled: true,
        dynamic: true,
        ssl_verification: true,
        ssl_ciphers: 'default' as const,
      },
    }));

    controller.hostUpdate();
    await flushPromises();
    expect(controller.getValue()).toBe('http://signed-proxied-url.com');
    expect(controller.getError()).toBeNull();

    controller.hostDisconnected();

    expect(controller.getValue()).toBeNull();
    expect(controller.getError()).toBeNull();
  });

  it('should discard in-flight result after hostDisconnected', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();

    let resolveProxy: ((value: Endpoint) => void) | undefined;
    vi.mocked(createProxiedEndpointIfNecessary).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveProxy = resolve;
      }),
    );
    vi.mocked(homeAssistantGetSignedURLIfNecessary).mockResolvedValue(
      'http://signed.com',
    );

    const controller = new SignedURLController(host, () => ({
      hass,
      endpoint: createEndpoint('http://test-url.com'),
      proxyConfig: {
        enabled: true,
        dynamic: true,
        ssl_verification: true,
        ssl_ciphers: 'default' as const,
      },
    }));

    controller.hostUpdate();

    controller.hostDisconnected();

    resolveProxy?.({ endpoint: 'http://proxied.com', sign: false });
    await flushPromises();

    expect(controller.getValue()).toBeNull();
    expect(host.requestUpdate).not.toBeCalled();
  });

  it('should ignore stale null signed URL after request ID changed', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();
    let url = 'http://test-url.com';

    let resolveSign: ((value: string | null) => void) | undefined;
    vi.mocked(createProxiedEndpointIfNecessary).mockResolvedValue({
      endpoint: 'http://proxied.com',
      sign: true,
    });
    vi.mocked(homeAssistantGetSignedURLIfNecessary)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSign = resolve;
        }),
      )
      .mockReturnValue(new Promise(() => {}));

    const controller = new SignedURLController(host, () => ({
      hass,
      endpoint: createEndpoint(url),
      proxyConfig: {
        enabled: true,
        dynamic: true,
        ssl_verification: true,
        ssl_ciphers: 'default' as const,
      },
    }));

    controller.hostUpdate();
    await flushPromises();

    // Change URL to start a new request.
    url = 'http://new-url.com';
    controller.hostUpdate();

    // Resolve the first signing request with null (stale).
    resolveSign?.(null);
    await flushPromises();

    // Stale result should be discarded.
    expect(host.requestUpdate).not.toBeCalled();
  });

  it('should sign endpoint without proxying when sign is set', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();

    vi.mocked(homeAssistantGetSignedURLIfNecessary).mockResolvedValue(
      'http://ha.local/api/some/endpoint?authSig=abc',
    );

    const controller = new SignedURLController(host, () => ({
      hass,
      endpoint: createEndpoint('/api/some/endpoint', true),
    }));

    expect(controller.getValue()).toBeNull();

    controller.hostUpdate();
    await flushPromises();

    expect(createProxiedEndpointIfNecessary).not.toBeCalled();
    expect(homeAssistantGetSignedURLIfNecessary).toBeCalled();
    expect(controller.getValue()).toBe('http://ha.local/api/some/endpoint?authSig=abc');
    expect(host.requestUpdate).toBeCalled();
  });

  it('should return url directly when sign is false and proxy is disabled', () => {
    const host = mock<ReactiveControllerHost>();

    const controller = new SignedURLController(host, () => ({
      hass: createHASS(),
      endpoint: createEndpoint('http://example.com/stream'),
    }));

    expect(controller.getValue()).toBe('http://example.com/stream');
  });

  it('should ignore null proxy endpoint if request ID changed', async () => {
    const host = mock<ReactiveControllerHost>();
    const hass = createHASS();
    let url = 'http://test-url.com';

    let resolveProxy: ((value: Endpoint | null) => void) | undefined;
    vi.mocked(createProxiedEndpointIfNecessary)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveProxy = resolve;
        }),
      )
      .mockReturnValue(new Promise(() => {}));

    const controller = new SignedURLController(host, () => ({
      hass,
      endpoint: createEndpoint(url),
      proxyConfig: {
        enabled: true,
        dynamic: true,
        ssl_verification: true,
        ssl_ciphers: 'default' as const,
        live: true,
        media: true,
      },
    }));

    controller.hostUpdate();

    url = 'http://new-url.com';
    controller.hostUpdate();

    resolveProxy?.(null);
    await flushPromises();

    expect(host.requestUpdate).not.toBeCalled();
  });
});
