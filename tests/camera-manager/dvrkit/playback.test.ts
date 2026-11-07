import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { ReactiveControllerHost } from 'lit';

import {
  DvrkitPlaybackSessions,
  ResolvedMediaController,
} from '../../../src/components-lib/resolved-media-controller';

import { ResolvedMediaCache, resolveMedia } from '../../../src/ha/resolved-media';
import { createHASS, flushPromises } from '../../test-utils';

describe('dvrkit playback resolution', () => {
  it('requests an HLS playback URL on demand without caching expiring URLs', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS).mockResolvedValueOnce({ url: '/api/dvrkit/first.m3u8' }).mockResolvedValueOnce({ url: '/api/dvrkit/second.m3u8' });
    const cache = new ResolvedMediaCache();
    const id = 'dvrkit://camera.front/1705300000/1705303600';

    expect(await resolveMedia(hass, id, cache)).toEqual({ url: '/api/dvrkit/first.m3u8', mime_type: 'application/vnd.apple.mpegurl' });
    expect(await resolveMedia(hass, id, cache)).toEqual({ url: '/api/dvrkit/second.m3u8', mime_type: 'application/vnd.apple.mpegurl' });
    expect(hass.callWS).toHaveBeenCalledTimes(2);
    expect(hass.callWS).toHaveBeenCalledWith({
      type: 'dvrkit/playback/url', entity_id: 'camera.front', start: 1705300000, end: 1705303600,
    });
  });

  it('reopens an EVENT playlist at the requested wall-clock time and replaces the prior session', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS)
      .mockResolvedValueOnce({ url: '/api/dvrkit/first.m3u8' })
      .mockResolvedValueOnce({ url: '/api/dvrkit/second.m3u8' });
    const cache = new ResolvedMediaCache();
    const id = 'dvrkit://camera.front/1705300000/1705303600';

    const first = await resolveMedia(hass, id, cache);
    const second = await resolveMedia(hass, id, cache, {
      start: new Date(1705301234 * 1000),
      replaceURL: first?.url,
    });

    expect(first?.url).toBe('/api/dvrkit/first.m3u8');
    expect(second).toEqual({
      url: '/api/dvrkit/second.m3u8',
      mime_type: 'application/vnd.apple.mpegurl',
    });
    expect(hass.callWS).toHaveBeenNthCalledWith(1, {
      type: 'dvrkit/playback/url',
      entity_id: 'camera.front',
      start: 1705300000,
      end: 1705303600,
    });
    expect(hass.callWS).toHaveBeenNthCalledWith(2, {
      type: 'dvrkit/playback/url',
      entity_id: 'camera.front',
      start: 1705301234,
      end: 1705303600,
      replace_url: '/api/dvrkit/first.m3u8',
    });
  });

  it('does not use DVR playback options for ordinary media sources', async () => {
    const hass = createHASS();
    const media = { url: '/api/media.mp4', mime_type: 'video/mp4' };
    vi.mocked(hass.callWS).mockResolvedValue(media);
    const cache = new ResolvedMediaCache();
    const id = 'media-source://frigate/recording/front';

    expect(
      await resolveMedia(hass, id, cache, {
        start: new Date(1705301234 * 1000),
        replaceURL: '/api/dvrkit/first.m3u8',
      }),
    ).toEqual(media);
    expect(await resolveMedia(hass, id, cache)).toEqual(media);
    expect(hass.callWS).toHaveBeenCalledTimes(1);
    expect(hass.callWS).toHaveBeenCalledWith({
      type: 'media_source/resolve_media',
      media_content_id: id,
    });
  });

  it('rejects seeks outside the recording and caps long playback requests at one hour', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS).mockResolvedValue({ url: '/api/dvrkit/bounded.m3u8' });
    const id = 'dvrkit://camera.front/100/10000';

    expect(await resolveMedia(hass, id, null, { start: new Date(99 * 1000) })).toBeNull();
    expect(await resolveMedia(hass, id, null, { start: new Date(10000 * 1000) })).toBeNull();
    expect(await resolveMedia(hass, id, null, { start: new Date(NaN) })).toBeNull();
    expect(hass.callWS).not.toHaveBeenCalled();

    await resolveMedia(hass, id, null, { start: new Date(200 * 1000) });
    expect(hass.callWS).toHaveBeenCalledWith({
      type: 'dvrkit/playback/url',
      entity_id: 'camera.front',
      start: 200,
      end: 3800,
    });
  });

  it('reopens each camera at the same seek time and replaces only its own session', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS)
      .mockResolvedValueOnce({ url: '/api/dvrkit/front-1.m3u8' })
      .mockResolvedValueOnce({ url: '/api/dvrkit/back-1.m3u8' })
      .mockResolvedValueOnce({ url: '/api/dvrkit/front-2.m3u8' })
      .mockResolvedValueOnce({ url: '/api/dvrkit/back-2.m3u8' });
    const cache = new ResolvedMediaCache();
    const front = { hass, cache, contentID: 'dvrkit://camera.front/1705300000/1705303600', startTime: undefined as Date | null | undefined };
    const back = { hass, cache, contentID: 'dvrkit://camera.back/1705300000/1705303600', startTime: undefined as Date | null | undefined };
    const frontController = new ResolvedMediaController(mock<ReactiveControllerHost>(), () => front);
    const backController = new ResolvedMediaController(mock<ReactiveControllerHost>(), () => back);

    await frontController.hostUpdate();
    await backController.hostUpdate();
    front.startTime = back.startTime = new Date(1705301234 * 1000);
    await frontController.hostUpdate();
    await backController.hostUpdate();

    expect(hass.callWS).toHaveBeenCalledTimes(4);
    expect(hass.callWS).toHaveBeenNthCalledWith(3, {
      type: 'dvrkit/playback/url',
      entity_id: 'camera.front',
      start: 1705301234,
      end: 1705303600,
      replace_url: '/api/dvrkit/front-1.m3u8',
    });
    expect(hass.callWS).toHaveBeenNthCalledWith(4, {
      type: 'dvrkit/playback/url',
      entity_id: 'camera.back',
      start: 1705301234,
      end: 1705303600,
      replace_url: '/api/dvrkit/back-1.m3u8',
    });
    expect(frontController.getValue()?.url).toBe('/api/dvrkit/front-2.m3u8');
    expect(backController.getValue()?.url).toBe('/api/dvrkit/back-2.m3u8');

    // Re-rendering without a new seek must not create another DVR session.
    await frontController.hostUpdate();
    await backController.hostUpdate();
    expect(hass.callWS).toHaveBeenCalledTimes(4);
  });

  it('reopens the same wall-clock position only when the DVR revision changes', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS)
      .mockResolvedValueOnce({ url: '/api/dvrkit/initial.m3u8' })
      .mockResolvedValueOnce({ url: '/api/dvrkit/resumed.m3u8' });
    const options = {
      hass,
      contentID: 'dvrkit://camera.front/1705300000/1705303600',
      startTime: new Date(1705300123 * 1000),
      dvrkitRevision: 0,
    };
    const controller = new ResolvedMediaController(mock<ReactiveControllerHost>(), () => options);
    await controller.hostUpdate();
    await controller.hostUpdate();
    expect(hass.callWS).toHaveBeenCalledTimes(1);

    options.dvrkitRevision++;
    await controller.hostUpdate();
    expect(hass.callWS).toHaveBeenNthCalledWith(2, {
      type: 'dvrkit/playback/url',
      entity_id: 'camera.front',
      start: 1705300123,
      end: 1705303600,
      replace_url: '/api/dvrkit/initial.m3u8',
    });
    expect(controller.getValue()?.url).toBe('/api/dvrkit/resumed.m3u8');
  });

  it('replaces the previous hour session across slides in the same carousel', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS)
      .mockResolvedValueOnce({ url: '/api/dvrkit/hour-1.m3u8' })
      .mockResolvedValueOnce({ url: '/api/dvrkit/hour-2.m3u8' });
    const dvrkitSessions = new DvrkitPlaybackSessions();
    const first = new ResolvedMediaController(mock<ReactiveControllerHost>(), () => ({
      hass,
      dvrkitSessions,
      contentID: 'dvrkit://camera.front/1705300000/1705303600',
    }));
    const second = new ResolvedMediaController(mock<ReactiveControllerHost>(), () => ({
      hass,
      dvrkitSessions,
      contentID: 'dvrkit://camera.front/1705303600/1705307200',
    }));

    await first.hostUpdate();
    await second.hostUpdate();
    expect(hass.callWS).toHaveBeenNthCalledWith(2, {
      type: 'dvrkit/playback/url',
      entity_id: 'camera.front',
      start: 1705303600,
      end: 1705307200,
      replace_url: '/api/dvrkit/hour-1.m3u8',
    });
  });

  it('keeps independent carousel sessions for the same camera separate', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS)
      .mockResolvedValueOnce({ url: '/api/dvrkit/consumer-1.m3u8' })
      .mockResolvedValueOnce({ url: '/api/dvrkit/consumer-2.m3u8' });
    const contentID = 'dvrkit://camera.front/1705300000/1705303600';
    const firstSessions = new DvrkitPlaybackSessions();
    const secondSessions = new DvrkitPlaybackSessions();
    const first = new ResolvedMediaController(mock<ReactiveControllerHost>(), () => ({
      hass, contentID, dvrkitSessions: firstSessions,
    }));
    const second = new ResolvedMediaController(mock<ReactiveControllerHost>(), () => ({
      hass, contentID, dvrkitSessions: secondSessions,
    }));

    await first.hostUpdate();
    await second.hostUpdate();
    expect(hass.callWS).toHaveBeenNthCalledWith(2, {
      type: 'dvrkit/playback/url',
      entity_id: 'camera.front',
      start: 1705300000,
      end: 1705303600,
    });
    expect(first.getValue()?.url).toBe('/api/dvrkit/consumer-1.m3u8');
    expect(second.getValue()?.url).toBe('/api/dvrkit/consumer-2.m3u8');
  });

  it('releases a session after an in-flight open completes', async () => {
    const hass = createHASS();
    let finishOpen!: (value: { url: string }) => void;
    const pendingOpen = new Promise<{ url: string }>((resolve) => {
      finishOpen = resolve;
    });
    let notifyOpen!: () => void;
    const started = new Promise<void>((resolve) => { notifyOpen = resolve; });
    vi.mocked(hass.callWS).mockImplementationOnce(() => {
      notifyOpen();
      return pendingOpen;
    }).mockResolvedValueOnce({});
    const sessions = new DvrkitPlaybackSessions();
    const controller = new ResolvedMediaController(mock<ReactiveControllerHost>(), () => ({
      hass,
      dvrkitSessions: sessions,
      contentID: 'dvrkit://camera.front/1705300000/1705303600',
    }));

    const opening = controller.hostUpdate();
    await started;
    controller.hostDisconnected();
    sessions.release(hass);
    finishOpen({ url: '/api/dvrkit/open.m3u8' });
    await opening;
    await flushPromises();
    expect(controller.getValue()).toBeNull();

    expect(hass.callWS).toHaveBeenNthCalledWith(2, {
      type: 'dvrkit/playback/url',
      entity_id: 'camera.front',
      replace_url: '/api/dvrkit/open.m3u8',
      release: true,
    });
  });

  it('does not replace a different camera session when the controller changes cameras', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS)
      .mockResolvedValueOnce({ url: '/api/dvrkit/front.m3u8' })
      .mockResolvedValueOnce({ url: '/api/dvrkit/back.m3u8' });
    const options = { hass, contentID: 'dvrkit://camera.front/1705300000/1705303600' };
    const controller = new ResolvedMediaController(mock<ReactiveControllerHost>(), () => options);

    await controller.hostUpdate();
    options.contentID = 'dvrkit://camera.back/1705300000/1705303600';
    await controller.hostUpdate();

    expect(hass.callWS).toHaveBeenNthCalledWith(2, {
      type: 'dvrkit/playback/url',
      entity_id: 'camera.back',
      start: 1705300000,
      end: 1705303600,
    });
    expect(controller.getValue()?.url).toBe('/api/dvrkit/back.m3u8');
  });

  it('does not open a DVR session when the selected time is outside its recording', async () => {
    const hass = createHASS();
    const controller = new ResolvedMediaController(mock<ReactiveControllerHost>(), () => ({
      hass,
      contentID: 'dvrkit://camera.front/1705300000/1705303600',
      startTime: null,
    }));

    await controller.hostUpdate();
    expect(controller.getValue()).toBeNull();
    expect(hass.callWS).not.toHaveBeenCalled();
  });

  it('serializes rapid seeks and replaces the session produced by the preceding request', async () => {
    const hass = createHASS();
    let finishSeek!: (value: { url: string }) => void;
    const pendingSeek = new Promise<{ url: string }>((resolve) => {
      finishSeek = resolve;
    });
    let notifySeek!: () => void;
    const started = new Promise<void>((resolve) => { notifySeek = resolve; });
    vi.mocked(hass.callWS)
      .mockResolvedValueOnce({ url: '/api/dvrkit/initial.m3u8' })
      .mockImplementationOnce(() => {
        notifySeek();
        return pendingSeek;
      })
      .mockResolvedValueOnce({ url: '/api/dvrkit/latest.m3u8' });
    const options = {
      hass,
      contentID: 'dvrkit://camera.front/1705300000/1705303600',
      startTime: undefined as Date | undefined,
    };
    const controller = new ResolvedMediaController(mock<ReactiveControllerHost>(), () => options);
    await controller.hostUpdate();

    options.startTime = new Date(1705300100 * 1000);
    const firstSeek = controller.hostUpdate();
    await started;
    options.startTime = new Date(1705300200 * 1000);
    const latestSeek = controller.hostUpdate();

    finishSeek({ url: '/api/dvrkit/intermediate.m3u8' });
    await Promise.all([firstSeek, latestSeek]);

    expect(hass.callWS).toHaveBeenCalledTimes(3);
    expect(hass.callWS).toHaveBeenNthCalledWith(3, {
      type: 'dvrkit/playback/url',
      entity_id: 'camera.front',
      start: 1705300200,
      end: 1705303600,
      replace_url: '/api/dvrkit/intermediate.m3u8',
    });
    expect(controller.getValue()?.url).toBe('/api/dvrkit/latest.m3u8');
  });

  it('rejects malformed dvrkit content IDs without making a request', async () => {
    const hass = createHASS();
    expect(await resolveMedia(hass, 'dvrkit://camera.front/not-a-time/42')).toBeNull();
    expect(hass.callWS).not.toHaveBeenCalled();
  });

  it('returns null when playback URL resolution fails', async () => {
    const hass = createHASS();
    vi.mocked(hass.callWS).mockRejectedValue(new Error('Unavailable'));
    expect(await resolveMedia(hass, 'dvrkit://camera.front/100/200')).toBeNull();
  });
});
