import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getICEServers } from '../../src/ha/webrtc';
import { createHASS, flushPromises } from '../test-utils';
import { createPromiseWithResolvers } from '../utils/test-utils';

const HA_DEFAULT_ICE_SERVERS = [
  { urls: ['stun:stun.home-assistant.io:3478', 'stun:stun.home-assistant.io:80'] },
];

// @vitest-environment jsdom
describe('getICEServers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return the ICE servers Home Assistant gives browsers', async () => {
    const iceServers = [
      { urls: 'stun:stun.example.com:3478' },
      { urls: 'turn:turn.example.com:3478', username: 'user', credential: 'pass' },
    ];
    const hass = createHASS();
    vi.mocked(hass.callWS).mockResolvedValue(iceServers);

    expect(await getICEServers(hass)).toEqual(iceServers);
    expect(hass.callWS).toHaveBeenCalledWith({ type: 'web_rtc/ice_servers' });
  });

  it("should return Home Assistant's default STUN server without Home Assistant", async () => {
    expect(await getICEServers()).toEqual(HA_DEFAULT_ICE_SERVERS);
  });

  it("should return Home Assistant's default STUN server when Home Assistant refuses the request", async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS).mockRejectedValue(new Error('unknown_command'));

    expect(await getICEServers(hass)).toEqual(HA_DEFAULT_ICE_SERVERS);
  });

  it("should return Home Assistant's default STUN server on a malformed response", async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS).mockResolvedValue([{ username: 'no-urls' }]);

    expect(await getICEServers(hass)).toEqual(HA_DEFAULT_ICE_SERVERS);
  });

  it("should return Home Assistant's default STUN server when Home Assistant does not answer in time", async () => {
    const hass = createHASS();
    const reply = createPromiseWithResolvers<unknown>();
    vi.mocked(hass.callWS).mockReturnValue(reply.promise);

    let result: RTCIceServer[] | null = null;
    getICEServers(hass).then((value) => {
      result = value;
    });

    vi.advanceTimersByTime(2 * 1000 - 1);
    await flushPromises();
    expect(result).toBeNull();

    vi.advanceTimersByTime(1);
    await flushPromises();
    expect(result).toEqual(HA_DEFAULT_ICE_SERVERS);

    reply.resolve([{ urls: 'stun:late.example.com:3478' }]);
    await flushPromises();
    expect(result).toEqual(HA_DEFAULT_ICE_SERVERS);
  });
});
