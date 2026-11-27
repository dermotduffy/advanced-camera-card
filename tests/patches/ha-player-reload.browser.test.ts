import { afterEach, assert, describe, expect, it, vi } from 'vitest';

import '../../src/patches/ha-camera-stream';
import '../../src/patches/ha-hls-player';
import '../../src/patches/ha-web-rtc-player';

import type { MediaLoadedInfo, MediaLoadedInfoEventDetail } from '../../src/types';
import { defineHAElementStubs } from '../browser/ha-element-stubs';

// The members of the patched players these tests drive, which are protected or
// private in the patches.
interface PatchedPlayer extends HTMLElement {
  targetID?: string;
  updateComplete: Promise<boolean>;
  _cleanUp(): void;
}

interface PatchedCameraStream extends HTMLElement {
  targetID?: string;
  updateComplete: Promise<boolean>;
  _streams: () => { type: string; visible: boolean }[];
  _captureInnerLoad(stream: string, ev: CustomEvent<MediaLoadedInfoEventDetail>): void;
}

const mount = async <T extends HTMLElement & { targetID?: string }>(
  tag: string,
  setup?: (element: T) => void,
): Promise<T> => {
  defineHAElementStubs();
  await customElements.whenDefined(tag);

  const element = document.createElement(tag) as T;
  element.targetID = 'camera';
  setup?.(element);
  document.body.append(element);
  await (element as unknown as { updateComplete: Promise<boolean> }).updateComplete;
  return element;
};

const collectLoads = (element: HTMLElement): MediaLoadedInfoEventDetail[] => {
  const loads: MediaLoadedInfoEventDetail[] = [];
  element.addEventListener('advanced-camera-card:media:loaded', (ev) =>
    loads.push((ev as CustomEvent<MediaLoadedInfoEventDetail>).detail),
  );
  return loads;
};

describe('Home Assistant players restarting a stream in place', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it.each([
    ['WebRTC', 'advanced-camera-card-ha-web-rtc-player'],
    ['HLS', 'advanced-camera-card-ha-hls-player'],
  ])(
    'should announce the %s player media again after Home Assistant restarts its stream in place',
    async (_, tag) => {
      const player = await mount<PatchedPlayer>(tag);
      const loads = collectLoads(player);
      const video = player.shadowRoot?.querySelector('video');
      assert(video);

      video.dispatchEvent(new Event('loadeddata'));
      expect(loads).toHaveLength(1);

      // The media is retired before Home Assistant tears it down, so that a
      // listener on the signal (e.g. a preserved frame) can still read it.
      const patched = customElements.get(tag);
      assert(patched);
      const baseCleanUp = vi.spyOn(Object.getPrototypeOf(patched.prototype), '_cleanUp');
      let tornDownBeforeRetired: boolean | null = null;
      loads[0].signal.addEventListener('abort', () => {
        tornDownBeforeRetired = baseCleanUp.mock.calls.length > 0;
      });

      // Home Assistant cleans up and starts a new stream on the same element,
      // e.g. when the page is shown again.
      player._cleanUp();
      expect(loads[0].signal.aborted).toBe(true);
      expect(tornDownBeforeRetired).toBe(false);

      video.dispatchEvent(new Event('loadeddata'));
      expect(loads).toHaveLength(2);
      expect(loads[1].signal.aborted).toBe(false);
    },
  );

  // The stand-in camera stream renders no inner players, so these tests hand it
  // the inner players' loads directly.
  const mountCameraStream = async (): Promise<PatchedCameraStream> =>
    mount<PatchedCameraStream>('advanced-camera-card-ha-camera-stream', (element) => {
      element._streams = () => [
        { type: 'web_rtc', visible: true },
        { type: 'hls', visible: false },
      ];
    });

  const innerLoadFor = (
    stream: PatchedCameraStream,
    type: string,
    info: MediaLoadedInfo,
  ): AbortController => {
    const abort = new AbortController();
    stream._captureInnerLoad(
      type,
      new CustomEvent<MediaLoadedInfoEventDetail>('advanced-camera-card:media:loaded', {
        detail: { info, signal: abort.signal },
      }),
    );
    return abort;
  };

  it('should keep announcing the visible stream when a hidden one goes', async () => {
    const stream = await mountCameraStream();
    const loads = collectLoads(stream);

    innerLoadFor(stream, 'web_rtc', { width: 640, height: 480, technology: ['webrtc'] });
    await stream.updateComplete;
    expect(loads).toHaveLength(1);

    innerLoadFor(stream, 'hls', {
      width: 640,
      height: 480,
      technology: ['hls'],
    }).abort();
    await stream.updateComplete;

    expect(loads[0].signal.aborted).toBe(false);
    expect(loads).toHaveLength(1);
  });

  it('should announce the visible stream again after its media is replaced', async () => {
    const stream = await mountCameraStream();
    const loads = collectLoads(stream);

    const info: MediaLoadedInfo = { width: 640, height: 480, technology: ['webrtc'] };

    const first = innerLoadFor(stream, 'web_rtc', info);
    await stream.updateComplete;
    expect(loads).toHaveLength(1);

    first.abort();
    expect(loads[0].signal.aborted).toBe(true);

    innerLoadFor(stream, 'web_rtc', info);
    await stream.updateComplete;
    expect(loads).toHaveLength(2);
  });
});
