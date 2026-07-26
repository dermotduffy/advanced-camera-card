import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  homeAssistantGetSignedURLIfNecessary,
  homeAssistantSignPath,
} from '../../src/ha/sign-path';
import { AdvancedCameraCardError } from '../../src/types';
import { createHASS } from '../test-utils';

describe('homeAssistantSignPath', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should sign path', async () => {
    const hass = createHASS();
    const unsignedPath = 'unsigned/path';
    const expires = 42;

    vi.mocked(hass.callWS).mockResolvedValue({
      path: 'signed/path',
    });
    vi.mocked(hass.hassUrl).mockImplementation((url) => 'hass:' + url);

    expect(await homeAssistantSignPath(hass, unsignedPath, expires)).toEqual(
      'hass:signed/path',
    );
    expect(hass.callWS).toBeCalledWith({
      type: 'auth/sign_path',
      path: unsignedPath,
      expires,
    });
  });

  it('should throw for empty response', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS).mockResolvedValue(null);

    await expect(homeAssistantSignPath(hass, 'unsigned/path', 42)).rejects.toThrowError(
      AdvancedCameraCardError,
    );
  });
});

describe('homeAssistantSignEndpoint', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return endpoint URL without signing when sign is false', async () => {
    const hass = createHASS();
    const endpoint = { endpoint: 'http://example.com', sign: false };
    expect(await homeAssistantGetSignedURLIfNecessary(hass, endpoint)).toBe(
      'http://example.com',
    );
    expect(hass.callWS).not.toHaveBeenCalled();
  });

  it('should return endpoint URL without signing when sign is undefined', async () => {
    const hass = createHASS();
    const endpoint = { endpoint: 'http://example.com' };
    expect(await homeAssistantGetSignedURLIfNecessary(hass, endpoint)).toBe(
      'http://example.com',
    );
    expect(hass.callWS).not.toHaveBeenCalled();
  });

  it('should sign endpoint when sign is true', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS).mockResolvedValue({
      path: 'signed/path',
    });
    vi.mocked(hass.hassUrl).mockImplementation((url) => 'hass:' + url);

    const endpoint = { endpoint: 'http://example.com', sign: true };
    expect(await homeAssistantGetSignedURLIfNecessary(hass, endpoint, 60)).toBe(
      'hass:signed/path',
    );
    expect(hass.callWS).toHaveBeenCalledWith({
      type: 'auth/sign_path',
      path: 'http://example.com',
      expires: 60,
    });
  });

  it('should throw when signing fails', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS).mockRejectedValue(new Error('connection lost'));

    const endpoint = { endpoint: 'http://example.com', sign: true };
    await expect(
      homeAssistantGetSignedURLIfNecessary(hass, endpoint),
    ).rejects.toThrowError(AdvancedCameraCardError);
  });
});
