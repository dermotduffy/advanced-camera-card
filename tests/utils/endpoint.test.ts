import { afterEach, describe, expect, it, vi } from 'vitest';
import { homeAssistantSignPath } from '../../src/ha/sign-path.js';
import { convertEndpointAddressToSignedWebsocket } from '../../src/utils/endpoint';
import { createHASS } from '../test-utils';

vi.mock('../../src/ha/sign-path.js');

describe('convertEndpointAddressToSignedWebsocket', () => {
  it('without signing', async () => {
    expect(
      await convertEndpointAddressToSignedWebsocket(createHASS(), {
        endpoint: 'http://example.com',
        sign: false,
      }),
    ).toBe('http://example.com');
  });

  describe('with signing', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    it('successful', async () => {
      vi.mocked(homeAssistantSignPath).mockResolvedValue('http://signed.com');

      expect(
        await convertEndpointAddressToSignedWebsocket(createHASS(), {
          endpoint: 'http://example.com',
          sign: true,
        }),
      ).toBe('ws://signed.com');
    });

    it('with null response', async () => {
      vi.mocked(homeAssistantSignPath).mockResolvedValue(null);

      expect(
        await convertEndpointAddressToSignedWebsocket(createHASS(), {
          endpoint: 'http://example.com',
          sign: true,
        }),
      ).toBeNull();
    });

    it('with exception on signing', async () => {
      const consoleSpy = vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

      vi.mocked(homeAssistantSignPath).mockRejectedValue(new Error());

      expect(
        await convertEndpointAddressToSignedWebsocket(createHASS(), {
          endpoint: 'http://example.com',
          sign: true,
        }),
      ).toBeNull();

      expect(consoleSpy).toBeCalled();
    });
  });
});
