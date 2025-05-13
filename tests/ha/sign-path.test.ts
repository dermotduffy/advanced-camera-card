import { afterEach, describe, expect, it, vi } from 'vitest';
import { homeAssistantSignPath } from '../../src/ha/sign-path';
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
