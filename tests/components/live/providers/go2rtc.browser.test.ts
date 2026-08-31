import { describe, expect, it, onTestFinished } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { VideoRTC } from '../../../../src/components/live/providers/go2rtc/video-rtc';
import type { RawAdvancedCameraCardConfig } from '../../../../src/config/types';
import { MountedCardFactory, type MountedCard } from '../../../browser/mounted-card';
import { CAMERA_ENTITY, createGenericCameraHASS } from '../../../browser/test-utils';

const PLAYER_SELECTOR = 'advanced-camera-card-live-go2rtc-player';

const mount = async (camera: RawAdvancedCameraCardConfig): Promise<MountedCard> =>
  await MountedCardFactory.createFromSource(
    {
      type: 'custom:advanced-camera-card',
      cameras: [{ camera_entity: CAMERA_ENTITY, live_provider: 'go2rtc', ...camera }],
      performance: { features: { card_loading_indicator: false } },
    },
    createGenericCameraHASS(),
  );

describe('AdvancedCameraCardGo2RTC', () => {
  it('should play a go2rtc server that is reached without signing or proxying', async () => {
    // An absolute URL is not Home Assistant's to sign, and proxying is off, so
    // the stream URL needs no resolving at all.
    const card = await mount({
      go2rtc: { url: 'http://localhost:1984', stream: 'office' },
      proxy: { live: false },
    });

    const player = await card.waitForSelector<VideoRTC>(PLAYER_SELECTOR);
    expect(player.wsURL).toBe('ws://localhost:1984/api/ws?src=office');
  });

  it('should start the modes that follow mp4', async () => {
    // See: https://github.com/dermotduffy/advanced-camera-card/issues/2721

    const card = await mount({
      go2rtc: {
        url: 'http://localhost:1984',
        stream: 'office',
        modes: ['mp4', 'webrtc'],
      },
      proxy: { live: false },
    });

    const player = await card.waitForSelector<VideoRTC>(PLAYER_SELECTOR);

    const ws = mock<WebSocket>();
    player.ws = ws;

    expect(player.onopen()).toEqual(['mp4', 'webrtc']);
    expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"type":"mp4"'));
  });

  it('should ignore video that arrives from a replaced peer connection', async () => {
    // See: https://github.com/dermotduffy/advanced-camera-card/issues/2726

    const card = await mount({
      go2rtc: { url: 'http://localhost:1984', stream: 'office', modes: ['webrtc'] },
      proxy: { live: false },
    });

    const player = await card.waitForSelector<VideoRTC>(PLAYER_SELECTOR);

    const original = new RTCPeerConnection();
    onTestFinished(() => original.close());

    // A reconnect closes the peer connection and negotiates another one, which
    // has no remote description of its own until its answer arrives.
    const replacement = new RTCPeerConnection();
    onTestFinished(() => replacement.close());
    player.pc = replacement;

    const canvas = document.createElement('canvas');
    const stream = canvas.captureStream();
    onTestFinished(() => stream.getTracks().forEach((track) => track.stop()));

    const video2 = document.createElement('video');
    video2.srcObject = stream;

    player.onpcvideo(video2, original);

    expect(player.video).not.toBeNull();
    expect(player.video?.srcObject).toBeNull();
    expect(video2.srcObject).toBeNull();
  });
});
