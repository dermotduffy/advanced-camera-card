import { describe, expect, it, vi } from 'vitest';

import { createBrowserPeerConnection } from '../../src/utils/peer-connection';

describe('createBrowserPeerConnection', () => {
  it('should construct a real peer connection', () => {
    const RTCPeerConnectionMock = vi.fn();
    vi.stubGlobal('RTCPeerConnection', RTCPeerConnectionMock);
    const config = { iceServers: [{ urls: 'stun:stun.example.com:3478' }] };

    createBrowserPeerConnection(config);

    expect(RTCPeerConnectionMock).toHaveBeenCalledWith(config);
    vi.unstubAllGlobals();
  });
});
