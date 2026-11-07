import { describe, expect, it, vi } from 'vitest';

import {
  getHACameraCapabilities,
  getWebRTCClientConfiguration,
  supportsHA2WayAudio,
  webrtcOfferEventSchema,
} from '../../src/ha/camera-webrtc';
import { createHASS } from '../test-utils';

describe('getHACameraCapabilities', () => {
  it('should ask Home Assistant for the camera capabilities', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS).mockResolvedValue({
      frontend_stream_types: ['hls', 'web_rtc'],
      two_way_audio: true,
    });

    expect(await getHACameraCapabilities(hass, 'camera.office')).toEqual({
      frontend_stream_types: ['hls', 'web_rtc'],
      two_way_audio: true,
    });
    expect(hass.callWS).toHaveBeenCalledWith({
      type: 'camera/capabilities',
      entity_id: 'camera.office',
    });
  });
});

describe('supportsHA2WayAudio', () => {
  it.each([
    ['two-way audio over WebRTC', ['hls', 'web_rtc'], true, true],
    ['no two-way audio', ['hls', 'web_rtc'], false, false],
    ['a Home Assistant without the capability', ['web_rtc'], undefined, false],
  ])(
    'should report %s',
    async (_name: string, types: string[], twoWayAudio: boolean | undefined, want) => {
      const hass = createHASS();
      vi.mocked(hass.callWS).mockResolvedValue({
        frontend_stream_types: types,
        ...(twoWayAudio !== undefined && { two_way_audio: twoWayAudio }),
      });

      expect(await supportsHA2WayAudio(hass, 'camera.office')).toBe(want);
    },
  );

  it('should report no two-way audio when Home Assistant refuses', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS).mockRejectedValue(new Error('not_found'));

    expect(await supportsHA2WayAudio(hass, 'camera.office')).toBe(false);
  });
});

describe('getWebRTCClientConfiguration', () => {
  it('should return the peer connection configuration', async () => {
    const hass = createHASS();
    const iceServers = [{ urls: ['stun:stun.example.com:3478'] }];
    vi.mocked(hass.callWS).mockResolvedValue({
      configuration: { iceServers },
      dataChannel: 'unused',
    });

    expect(await getWebRTCClientConfiguration(hass, 'camera.office')).toEqual({
      iceServers,
    });
    expect(hass.callWS).toHaveBeenCalledWith({
      type: 'camera/webrtc/get_client_config',
      entity_id: 'camera.office',
    });
  });
});

describe('webrtcOfferEventSchema', () => {
  it.each([
    [{ type: 'session', session_id: '01J' }],
    [{ type: 'answer', answer: 'v=0' }],
    [{ type: 'candidate', candidate: { candidate: 'candidate:1', sdpMLineIndex: 0 } }],
    [{ type: 'error', code: 'webrtc_offer_failed', message: 'no stream' }],
  ])('should accept %j', (event: unknown) => {
    expect(webrtcOfferEventSchema.safeParse(event).success).toBe(true);
  });

  it('should refuse an event it does not know', () => {
    expect(webrtcOfferEventSchema.safeParse({ type: 'other' }).success).toBe(false);
  });
});
