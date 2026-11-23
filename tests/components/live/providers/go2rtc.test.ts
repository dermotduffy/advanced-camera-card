import { describe, expect, it } from 'vitest';

import { MediaLoadedInfoSinkController } from '../../../../src/components-lib/media-loaded-info-sink-controller';
import { VideoRTC } from '../../../../src/components/live/providers/go2rtc/video-rtc';
import { createLitElement, createMediaLoadedInfo } from '../../../test-utils';

// @vitest-environment jsdom
describe('VideoRTC media-loaded lifecycle', () => {
  it('should re-register loaded media when the existing player reconnects', () => {
    const host = createLitElement();
    const sink = new MediaLoadedInfoSinkController(host, {
      getTargetID: () => 'camera-1',
    });
    sink.hostConnected();

    if (!customElements.get('advanced-camera-card-live-go2rtc-player')) {
      customElements.define('advanced-camera-card-live-go2rtc-player', VideoRTC);
    }
    const player = document.createElement(
      'advanced-camera-card-live-go2rtc-player',
    ) as VideoRTC;
    player.targetID = 'camera-1';
    player.wsURL = '';
    player.video = document.createElement('video');
    host.appendChild(player);

    const dispatchLoadedInfo = (
      player as unknown as {
        _dispatchMediaLoadedInfo: (
          info: ReturnType<typeof createMediaLoadedInfo>,
        ) => void;
      }
    )._dispatchMediaLoadedInfo.bind(player);
    const lifecycle = player as unknown as {
      connectedCallback: () => void;
      disconnectedCallback: () => void;
    };
    dispatchLoadedInfo(createMediaLoadedInfo({ targetID: 'camera-1' }));
    expect(sink.has()).toBe(true);

    // The visibility-change path calls disconnectedCallback without destroying
    // the video. Its loaded event is aborted, but loadeddata will not fire again
    // when this same player becomes visible.
    lifecycle.disconnectedCallback();
    expect(sink.has()).toBe(false);

    lifecycle.connectedCallback();
    expect(sink.has()).toBe(true);

    player.ondisconnect();
    expect(sink.has()).toBe(false);
    lifecycle.connectedCallback();
    expect(sink.has()).toBe(false);

    player.reset();
    sink.hostDisconnected();
  });
});
