import { describe, expect, it, vi } from 'vitest';

import {
  createBrowserPeerConnection,
  GO2RTC_PEER_CONNECTION_CONFIG,
} from '../../../../../../src/components-lib/live/providers/go2rtc-experimental/adapters/peer-connection';

describe('peer-connection', () => {
  it('should configure two STUN servers with max-bundle', () => {
    expect(GO2RTC_PEER_CONNECTION_CONFIG).toEqual({
      bundlePolicy: 'max-bundle',
      iceServers: [
        {
          urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'],
        },
      ],
    });
  });

  it('should construct a real peer connection', () => {
    const RTCPeerConnectionMock = vi.fn();
    vi.stubGlobal('RTCPeerConnection', RTCPeerConnectionMock);

    createBrowserPeerConnection(GO2RTC_PEER_CONNECTION_CONFIG);

    expect(RTCPeerConnectionMock).toHaveBeenCalledWith(GO2RTC_PEER_CONNECTION_CONFIG);
    vi.unstubAllGlobals();
  });
});
