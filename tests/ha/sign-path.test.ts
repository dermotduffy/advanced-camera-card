import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  homeAssistantGetSignedURLIfNecessary,
  homeAssistantSignPath,
} from '../../src/ha/sign-path';
import { homeAssistantWSRequest } from '../../src/ha/ws-request.js';
import { signedPathSchema } from '../../src/types';
import { createHASS } from '../test-utils';

vi.mock('../../src/ha/ws-request.js');

describe('homeAssistantSignPath', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should sign path', async () => {
    const hass = createHASS();
    const unsignedPath = 'unsigned/path';
    const expires = 42;

    vi.mocked(homeAssistantWSRequest).mockResolvedValue({
      path: 'signed/path',
    });
    vi.mocked(hass.hassUrl).mockImplementation((url) => 'hass:' + url);

    expect(await homeAssistantSignPath(hass, unsignedPath, expires)).toEqual(
      'hass:signed/path',
    );
    expect(homeAssistantWSRequest).toBeCalledWith(hass, signedPathSchema, {
      type: 'auth/sign_path',
      path: unsignedPath,
      expires,
    });
  });

  it('should return null for null response', async () => {
    vi.mocked(homeAssistantWSRequest).mockResolvedValue(null);
    expect(await homeAssistantSignPath(createHASS(), 'unsigned/path', 42)).toBeNull();
  });
});

describe('homeAssistantSignEndpoint', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return endpoint URL without signing when sign is false', async () => {
    const endpoint = { endpoint: 'http://example.com', sign: false };
    expect(await homeAssistantGetSignedURLIfNecessary(createHASS(), endpoint)).toBe(
      'http://example.com',
    );
    expect(homeAssistantWSRequest).not.toHaveBeenCalled();
  });

  it('should return endpoint URL without signing when sign is undefined', async () => {
    const endpoint = { endpoint: 'http://example.com' };
    expect(await homeAssistantGetSignedURLIfNecessary(createHASS(), endpoint)).toBe(
      'http://example.com',
    );
    expect(homeAssistantWSRequest).not.toHaveBeenCalled();
  });

  it('should sign endpoint when sign is true', async () => {
    const hass = createHASS();
    vi.mocked(homeAssistantWSRequest).mockResolvedValue({
      path: 'signed/path',
    });
    vi.mocked(hass.hassUrl).mockImplementation((url) => 'hass:' + url);

    const endpoint = { endpoint: 'http://example.com', sign: true };
    expect(await homeAssistantGetSignedURLIfNecessary(hass, endpoint, 60)).toBe(
      'hass:signed/path',
    );
    expect(homeAssistantWSRequest).toHaveBeenCalledWith(hass, signedPathSchema, {
      type: 'auth/sign_path',
      path: 'http://example.com',
      expires: 60,
    });
  });

  it('should return null when signing fails', async () => {
    vi.mocked(homeAssistantWSRequest).mockResolvedValue(null);

    const endpoint = { endpoint: 'http://example.com', sign: true };
    expect(
      await homeAssistantGetSignedURLIfNecessary(createHASS(), endpoint),
    ).toBeNull();
  });
});
