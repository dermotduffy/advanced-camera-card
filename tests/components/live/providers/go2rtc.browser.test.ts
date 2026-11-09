import { assert, describe, expect, it, onTestFinished, vi } from 'vitest';
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

  it('should drop the staged MSE data when an append fails', async () => {
    // A fragment that arrives while an append is in flight is staged, and
    // `updateend` appends it. When that append throws, the staged data has to
    // go, or every later fragment is staged behind it until the staging buffer
    // overflows with `RangeError: offset is out of bounds` on every message.
    const card = await mount({
      go2rtc: { url: 'http://localhost:1984', stream: 'office', modes: ['mse'] },
      proxy: { live: false },
    });

    const player = await card.waitForSelector<VideoRTC>(PLAYER_SELECTOR);

    const ws = mock<WebSocket>();
    player.ws = ws;

    const addSourceBuffer = vi.spyOn(MediaSource.prototype, 'addSourceBuffer');
    onTestFinished(() => addSourceBuffer.mockRestore());

    expect(player.onopen()).toEqual(['mse']);
    await vi.waitFor(() =>
      expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"type":"mse"')),
    );

    // Playwright's Chromium has no H.264, so take whichever container the
    // browser has. The data below is rejected by either parser.
    const type = ['video/mp4; codecs="avc1.42E01E"', 'video/webm; codecs="vp8"'].find(
      (candidate) => MediaSource.isTypeSupported(candidate),
    );
    assert(type);
    player.onmessage['mse']({ type: 'mse', value: type });

    const ondata = player.ondata;
    assert(ondata);

    const sourceBuffer = addSourceBuffer.mock.results[0].value as SourceBuffer;
    const updateEnd = new Promise((resolve) =>
      sourceBuffer.addEventListener('updateend', resolve, { once: true }),
    );

    // A media segment with no initialization segment before it, which the
    // parser rejects: the MediaSource fails, and every append after it throws.
    const fragment = new Uint8Array(64 * 1024);
    fragment.set([0, 0, 0x01, 0x00, 0x6d, 0x64, 0x61, 0x74]);

    ondata(fragment.buffer); // Appended, then rejected.
    ondata(fragment.buffer); // Staged while that append is in flight.
    await updateEnd;

    // Well past the 2MB staging buffer.
    for (let i = 0; i < 64; i++) {
      expect(() => ondata(fragment.buffer)).not.toThrow();
    }
  });
});
