import { assert, describe, expect, it, onTestFinished, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { VideoRTC } from '../../../../src/components/live/providers/go2rtc/video-rtc';
import type { RawAdvancedCameraCardConfig } from '../../../../src/config/types';
import type { FakeHASS } from '../../../browser/fake-hass';
import { MountedCardFactory, type MountedCard } from '../../../browser/mounted-card';
import {
  CAMERA_ENTITY,
  createGenericCameraHASS,
  flushPromises,
} from '../../../browser/test-utils';
import { createPromiseWithResolvers } from '../../../utils/test-utils';

const PLAYER_SELECTOR = 'advanced-camera-card-live-go2rtc-player';

const mount = async (
  camera: RawAdvancedCameraCardConfig,
  hass?: FakeHASS,
): Promise<MountedCard> =>
  await MountedCardFactory.createFromSource(
    {
      type: 'custom:advanced-camera-card',
      cameras: [{ camera_entity: CAMERA_ENTITY, live_provider: 'go2rtc', ...camera }],
      performance: { features: { card_loading_indicator: false } },
    },
    hass ?? createGenericCameraHASS(),
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

  describe('ICE servers', () => {
    const ICE_SERVERS = [{ urls: ['stun:127.0.0.1:3478'] }];

    const mountWebRTC = async (hass?: FakeHASS): Promise<VideoRTC> => {
      const card = await mount(
        {
          go2rtc: { url: 'http://localhost:1984', stream: 'office', modes: ['webrtc'] },
          proxy: { live: false },
        },
        hass,
      );
      const player = await card.waitForSelector<VideoRTC>(PLAYER_SELECTOR);
      onTestFinished(() => player.reset());

      // No go2rtc server is listening, so the socket is opened by hand.
      player.ws = mock<WebSocket>();
      return player;
    };

    it("should negotiate WebRTC with Home Assistant's ICE servers", async () => {
      const hass = createGenericCameraHASS();
      hass.registerCommand('web_rtc/ice_servers', () => ICE_SERVERS);
      const player = await mountWebRTC(hass);

      player.onopen();

      const pc = await vi.waitFor(() => {
        assert(player.pc);
        return player.pc;
      });
      expect(pc.getConfiguration().iceServers?.map((server) => server.urls)).toEqual(
        ICE_SERVERS.map((server) => server.urls),
      );
    });

    it('should negotiate WebRTC with the player defaults without an ICE servers callback', async () => {
      const player = await mountWebRTC();
      player.getICEServers = null;

      player.onopen();

      const pc = await vi.waitFor(() => {
        assert(player.pc);
        return player.pc;
      });
      expect(pc.getConfiguration().iceServers?.map((server) => server.urls)).toEqual(
        // The browser reports each server's `urls` as an array.
        player.pcConfig.iceServers?.map((server) => [server.urls].flat()),
      );
    });

    it('should give up on WebRTC when the ICE servers are rejected', async () => {
      // A TURN server without credentials is refused by the peer connection.
      const hass = createGenericCameraHASS();
      hass.registerCommand('web_rtc/ice_servers', () => [
        { urls: ['turn:127.0.0.1:3478'] },
      ]);
      const player = await mountWebRTC(hass);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      onTestFinished(() => warn.mockRestore());

      player.onopen();

      await vi.waitFor(() => expect(player.pcState).toBe(WebSocket.CLOSED));
      expect(player.pc).toBeNull();
      expect(warn).toHaveBeenCalled();
    });

    it('should not negotiate WebRTC for a socket replaced while ICE servers are requested', async () => {
      const hass = createGenericCameraHASS();
      const reply = createPromiseWithResolvers<RTCIceServer[]>();
      hass.registerCommand('web_rtc/ice_servers', () => reply.promise);
      const player = await mountWebRTC(hass);

      player.onopen();
      player.ws = mock<WebSocket>();
      reply.resolve(ICE_SERVERS);

      await flushPromises();

      expect(player.pc).toBeNull();
    });
  });

  describe('MSE', () => {
    // A media segment with no initialization segment before it, which the
    // parser rejects: the MediaSource fails, and every append after it throws.
    const createFragment = (): ArrayBuffer => {
      const fragment = new Uint8Array(64 * 1024);
      fragment.set([0, 0, 0x01, 0x00, 0x6d, 0x64, 0x61, 0x74]);
      return fragment.buffer;
    };

    const startMSE = async (): Promise<{
      player: VideoRTC;
      ondata: (data: ArrayBuffer) => void;
      sourceBuffer: SourceBuffer;
    }> => {
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

      // Not every browser build plays H.264, so take whichever container the
      // browser supports. The MP4 and WebM parsers both reject the fragment data.
      const type = ['video/mp4; codecs="avc1.42E01E"', 'video/webm; codecs="vp8"'].find(
        (candidate) => MediaSource.isTypeSupported(candidate),
      );
      assert(type);
      player.onmessage['mse']({ type: 'mse', value: type });

      const ondata = player.ondata;
      assert(ondata);

      const [result] = addSourceBuffer.mock.results;
      assert(result?.type === 'return');

      return { player, ondata, sourceBuffer: result.value };
    };

    it('should append directly again after a staged append fails', async () => {
      // A fragment that arrives while an append is in flight is staged, and
      // `updateend` appends it. When that append throws, the staged data has
      // to go, or every later fragment is staged behind it forever.
      const { player, ondata, sourceBuffer } = await startMSE();
      const fragment = createFragment();

      const nextUpdateEnd = (): Promise<Event> =>
        new Promise((resolve) =>
          sourceBuffer.addEventListener('updateend', resolve, { once: true }),
        );

      // Firefox and WebKit reject the first append, but Chromium accepts it and
      // rejects a later one. Each pass stages a fragment behind the in-flight
      // append, so a staged append is waiting whenever the rejection comes.
      ondata(fragment);
      for (let i = 0; i < 10 && !player.video?.error; i++) {
        ondata(fragment);
        await nextUpdateEnd();
      }
      expect(player.video?.error).not.toBeNull();
      expect(sourceBuffer.updating).toBe(false);

      const appendBuffer = vi.spyOn(sourceBuffer, 'appendBuffer');
      ondata(fragment);
      expect(appendBuffer).toHaveBeenCalled();
    });

    it('should not throw when a burst overflows the staging buffer', async () => {
      const { ondata } = await startMSE();
      const fragment = createFragment();

      // Appended, after which every fragment is staged while it is in flight.
      ondata(fragment);

      // Well past the 2MB staging buffer.
      for (let i = 0; i < 64; i++) {
        expect(() => ondata(fragment)).not.toThrow();
      }
    });
  });
});
